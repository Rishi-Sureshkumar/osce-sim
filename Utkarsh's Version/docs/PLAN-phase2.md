# OSCE Simulator: Phase 2 plan

3D patient, tools and sound, voice, practice/exam modes, room-entry flow.

## Context
Phase 1 shipped a working OSCE simulator (Next 15, Zod contract in `src/domain/schemas.ts`, deterministic engine in `src/engine/`, append-only action log, mock-able AI in `src/server/ai/`, e2e smoke test). Phase 2 is meant to make the station feel like a real encounter:
- a 3D patient instead of the 2D SVG;
- real tools with sound;
- push-to-talk speech;
- practice and exam modes;
- a natural room-entry and courtesy flow in place of toolbar buttons.

It also fixes the bugs found in phase 1. Every `CLAUDE.md` invariant still holds:
- Findings and sounds come only from case and catalog data.
- Every input becomes the same `Action`.
- Content stays as data.
- Region ids are canonical.

Every milestone is committed only once `validate`, `typecheck`, `test`, `lint` and `e2e` pass.

## M0: bug fixes (first commit)

**Root cause of the hand-hygiene bug (confirmed by reading the code):**
- `evaluateRule` in `src/engine/rules.ts` orders the `before` comparison with `log.indexOf()`. That is append order.
- The timeline and the log display `t`. In phase 1, `t` was taken when the request started, and requests could overlap.
- So the two orderings disagreed. The student saw JVP at 00:03, then hand washing at 00:04, but the scorer saw washing first, so the item scored 1/1.
- Since the M4 commit, `t` has been stamped at append time and the browser sends actions one at a time. That narrowed the race but didn't remove it. Two tabs or a slow wording call can still reorder things.

**Fixes:**
1. **One canonical order.** Add `orderLog(actions)` in a new `src/engine/order.ts`: stable sort by `t`, ties broken by `seq`.
   - Add an optional `seq: number` to `Action` (additive). The file and Postgres repos already have an append order; Postgres has a `seq` column, and the file repo will assign it.
   - `evaluateRule`, `positionAt`, `findEvent`, the timeline, the action log, the findings panel and the grader transcript all consume `orderLog()`.
   - Write the failing unit test first: a log whose array order disagrees with its `t` values.
2. **Monotonic `t`.** At append, set `t = max(elapsed, lastT)` per session (a repo read plus the existing serialised writes). This guarantees that log order and timestamps agree from now on.
3. **One time formatter.** `mmss()` already floors (`src/components/common/format.ts`). Make it the only formatter (the grader transcript and coach view already import it) and add a unit test for its rounding.
4. **Clean dev overlay and console.** Load `/station/[id]` and `/results/[id]` in Playwright against `next dev` and collect console errors. Fix whatever remains. The known cause was the timer hydration mismatch, already fixed. Then add a permanent console-error assertion to the e2e smoke test.

## Schema PR (lands right after M0, before any feature work)
All changes are additive, so existing content stays valid. They are tested by `tests/content.test.ts` plus new tests.

- **Catalog `ExamManeuver`:**
  - `interaction: "click" | "place" | "sequence" | "drag_path"`, default `"click"`;
  - `tool?: "stethoscope" | "tuning_fork" | "reflex_hammer" | "penlight" | "bp_cuff" | "hands"`;
  - `toolMode?`: e.g. `"diaphragm" | "bell" | "128" | "512"`;
  - `steps?: { regionId, label }[]` for `sequence` interactions;
  - `touch: boolean`, defaulting to false for `inspect` and true otherwise. It powers "first physical contact" rules.
- **Finding values:** `abnormalFindings[m][r]` and `normalFinding[r]` accept `string | { text, audio?, visual? }`.
  - `audio` is `{ generator: "heart" | "breath" | "tone", params }` or `{ clipId }`.
  - `visual` drives animations, such as a reflex jerk amplitude or pupil constriction.
  - `resolveFinding` returns `{ findingText, resolvedFrom, audio?, visual? }` from the same fallback chain, so invariant 2 is unchanged.
- **Case:**
  - `visibleSigns?: { jvpCm?, edema?: { regionId, grade }[], breathing?: "normal" | "laboured" }`. These drive only what is drawn on the model.
  - `findingsVisibility?: "immediate" | "end"`, default `"immediate"`.
  - Keep the existing `doorSign.timeLimitMinutes`. It is the prompt's `timeLimitMin`, and renaming it would break content; the plan records this.
- **Action:**
  - `examine` payload gains optional `tool`, `toolMode`, `placementError` (in scene units, plus a normalised 0–1), `durationMs` and `step`.
  - `say` gains optional `tags: { tag, evidence, via: "regex" | "model" }[]`.
  - New `courtesy` kinds: `expose`, `cover`. (Exit hygiene is a normal `hand_hygiene` after the last touch; no separate kind was needed.)
  - New action types: `hint` (practice help used), `state_change` (bed angle or drape, from direct manipulation), `timer` (pause, resume, auto-end) and `room` (knocked, entered, exited).
- **Session:** `mode: "practice" | "exam"`, default `"exam"` for old rows. Postgres needs a migration via `npm run db:generate`.
- **Rule language** (extending the single interpreter in `src/engine/rules.ts`):
  - `{ said: tag }`.
  - `{ technique: { maneuver, regions?, tool?, toolMode?, maxPlacementError?, minDurationMs?, position? } }`.
  - New event refs: `tag:<tag>`, `first:touch` and `last:hand_hygiene`.
  - "Hand hygiene before first contact" becomes `{ before: ["last-before:hand_hygiene@first:touch" ...] }`, implemented as the dedicated rule `{ hygieneBeforeTouch: true }`. That keeps the item JSON readable and the logic in one place.
  - Time-dependent rules get `examOnly: true` and are skipped in practice mode.

## M1: 3D patient (`src/exam3d/`)
- Add `three`, `@react-three/fiber@9` and `@react-three/drei@10` (React 19 compatible; checked against npm).
- **Model:**
  - Load `/public/models/patient.glb` if present.
  - Otherwise use a primitive mannequin in `Mannequin.tsx`: capsules and spheres with joints at a bed hinge.
  - `/public/models/LICENSE.md` documents the policy (CC0 or CC-BY only) and states that no model is bundled yet.
- **`regionAnchors.ts`:** one entry per canonical region `{ regionId, position, radius, bone?, normal? }`.
  - Precordial landmarks and lung zones (anterior, posterior and lateral, by side) map to the existing ids.
  - A unit test checks that every region in `regions.json` either has an anchor or is a `whole`-view button. It mirrors `tests/bodyShapes.test.ts`.
- **Picking:** an invisible sphere collider per anchor. A hit resolves to `regionId` and opens the existing `ManeuverMenu`. It posts through `examineFromClick` in `src/input/adapters/click.ts`, the identical Action the 2D view emits.
- **Camera:**
  - `OrbitControls` with min/max distance, and polar limits so the camera can't go under the bed.
  - Presets: body, head and neck, chest front, chest back, abdomen, hands, feet. They tween with a damped lerp.
  - Double-clicking a region focuses on it.
- **Patient state from the log** (a pure function `patientState(actions)` in `src/engine/patientState.ts`, shared by 2D, 3D and the scoring):
  - The bed angle follows the position courtesy and `state_change` actions.
  - The drape covers regions. Examining a draped region auto-appends `courtesy: expose`.
- **Visible signs:**
  - A jugular pulsation strip whose height comes from `visibleSigns.jvpElevatedCm`, pulsing at the case HR.
  - Ankle and shin edema drawn as scaled swelling meshes.
  - Nothing is drawn unless the case lists it.
- **Performance:**
  - Load with `next/dynamic` (`ssr: false`) behind a "Loading 3D patient…" state.
  - `frameloop="demand"` except while an animation is running, `dpr` capped at 1.5, no shadows on low-end devices.
- **Toggles:**
  - A 2D/3D toggle in `Station.tsx`, defaulting to 3D, remembered in localStorage.
  - The 2D view stays until 3D passes acceptance.
- **Accessible region picker:** a keyboard-accessible list of regions grouped by view. It doubles as the e2e driver.
  - An e2e test also clicks a real projected anchor point on the canvas. In dev and test builds the scene exposes each anchor's projected screen coordinates via `data-anchor-*` on an overlay.

## M2: tools and sound (`src/exam3d/tools/`, `src/audio/`)
- **Tool tray:** stethoscope (diaphragm/bell switch), tuning fork (128/512, tap to strike), reflex hammer, penlight, BP cuff, hands (palpate/percuss).
  - Choosing a tool filters the maneuvers to those with a matching `tool`.
  - Maneuvers without a `tool` stay click-only, so nothing in the catalog breaks.
- **Stethoscope:**
  - Drag onto the body. It snaps to the nearest valid anchor within a tolerance (anchor radius × 1.5).
  - Hold to listen. Audio plays while held, and the finding is logged after at least 3 s.
  - The Action records `placementError` and `durationMs`.
  - Off-target placement plays attenuated, low-passed sound and still logs the error.
  - The bell versus diaphragm and the patient position change which finding entry applies, through `toolMode`-specific maneuvers (the existing `auscultate_heart_bell` / `_diaphragm`). Audio params come from the case, e.g. the S3 under `auscultate_heart_bell.cardiac_mitral`.
- **Tuning fork:**
  - Weber: place at the vertex; the stereo pan comes from the case's `weber_test` audio params, with normal centred.
  - Rinne: a `sequence` of mastoid, then a "can't hear it" button, then the ear canal.
  - Vibration: the great toe DIP, on the new regions `toe_great_right/left` (added in the schema change set; nothing renamed).
  - The sequence engine validates order and logs each step with `step`.
- **Hammer and penlight:** place on the target, then play an animation scaled by the finding's `visual` (jerk amplitude, pupil constriction).
- **Sound engine (`src/audio/`):**
  - Procedural Web Audio by default.
  - `heart.ts`: S1/S2 from HR, with optional S3, S4 and systolic/diastolic murmur envelopes (grade 1–6 sets gain).
  - `breath.ts`: vesicular and bronchial breath sounds from RR via filtered noise, plus fine and coarse crackles as timed impulses, and wheeze.
  - `tone.ts`: tuning fork, decaying sine with pan.
  - A `clips.ts` override reads `/public/audio/manifest.json` (`{ id, file, source, license }`).
  - The schedulers are pure functions that return event timelines, so they are unit-testable without audio hardware. A thin player renders them.
  - Mute and volume controls, plus a text caption of what is heard (the finding text) for accessibility.
  - Sounds are never chosen by the AI. They come from `resolveFinding(...).audio`, with HR and RR from the case vitals.
- **Content:** add `audio` to the HF case:
  - S3 at the apex, best with the bell, and with a stronger gain in left lateral decubitus via a `technique`/position-specific entry;
  - fine crackles at the bases;
  - a soft holosystolic murmur at the mitral area;
  - normal heart and breath sounds as catalog defaults.
- **Content:** add Weber and Rinne lateralisation data to the screening case. It stays normal and centred. The HF case gets no ear findings, to keep that content honest.

## M3: speech to text
- **`src/input/adapters/voice.ts`:**
  - An `SttProvider` interface (`start`, `stop`, `onInterim`, `onFinal`, `isSupported`).
  - A `WebSpeechProvider` implementation, so a server-side provider can drop in later.
- **Push to talk:** a mic button, or holding Space when focus isn't in a text field.
  - Interim text shows live. The final text fills the chat input for editing.
  - An optional auto-send setting (localStorage).
  - Sending goes through `sendChat` with `source: "voice"`. The chat route already accepts `source`.
- **Unsupported browsers** (e.g. Firefox, detected by the absence of `SpeechRecognition` / `webkitSpeechRecognition`) see a notice and fall back to typing.
- **Patient voice:** `speechSynthesis` reads replies when a toggle is on (off by default).
- **Privacy:** no audio is stored, only the transcribed text.
- **Tests:** unit-test the adapter with a fake provider. The e2e test stubs `window.webkitSpeechRecognition` to emit a scripted transcript.

## M4: practice vs exam mode
- **Mode selection:** a toggle on the case start screen sets `session.mode` (via `POST /api/sessions`). The mode shows in the station header, results and coach list/session.
- **Timer:**
  - Practice counts up and can be paused, logging a `timer` action.
  - Exam counts down from `doorSign.timeLimitMinutes`, warns at 2 minutes, and at zero auto-opens the presentation step. It logs `timer: auto_end`, and the exam is closed.
- **Practice help:**
  - A "Show me how" button plays the maneuver's `demo.steps` overlay.
  - A hint button gives a next suggested step from the mark sheet's unmet `auto` items.
  - Nudges are rule-driven, e.g. "You haven't washed your hands" fires on the first touch without hygiene.
  - Every hint and nudge is logged as a `hint` action.
- **Findings visibility:** `case.findingsVisibility` (`"end"` hides finding text in the panel until the presentation).
- **Per-section feedback (practice only):** a "Check this section" button runs the deterministic `auto` items for one section client-side, using the engine's pure functions. No AI call.
- **Scoring:** `GradingRun` gets a `mode` label. Rules marked `examOnly` are skipped in practice.

## M5: room entry and courtesy flow
- **Flow:**
  1. Outside: the door sign and a "Knock and enter" button (logs `room: knocked/entered`).
  2. In the room: the 3D scene has a sanitiser dispenser by the door. Hand hygiene is a press-and-hold of about 3 s with a progress ring.
  3. Hygiene state lives in `patientState()`. A touch while unclean is allowed and logged; practice mode also shows a nudge.
- **Courtesy tags (`src/server/tags.ts`):**
  - After each `say`, a regex/keyword pass assigns tags (`introduced_name`, `stated_role`, `confirmed_patient_identity`, `asked_consent_exam`, `explained_procedure`, `asked_comfort`, `offered_questions`, `closing`).
  - The matched words are the evidence, quoted verbatim.
  - A Haiku fallback runs only when no regex fires and the utterance is long enough. It sits in `src/server/ai/tagger.ts`, with a mock path and a quote check reusing `verifyEvidence` from `src/engine/evidence.ts`.
  - The tags are stored on the `say` Action.
  - The patient replies naturally; the existing prompt already allows "Sure, go ahead."
- **Direct manipulation:**
  - A bed-angle slider and handle, and a drag-the-sheet control. Each logs a `state_change`.
  - Spoken requests like "could you sit up" are detected by the tagger (`requested_position: seated`) and applied as a `state_change` with `source: "voice" | "text"`.
- **Closing:** saying goodbye, plus exit hand hygiene at the door, leads to the presentation step.
- **Remove the old toolbar.** Keep a compact keyboard-accessible "Actions" menu (wash hands, drape, position) as the fallback.
- **Mark sheets:**
  - #1 becomes `{ hygieneBeforeTouch: true }`.
  - #3 drape reads `state_change` or `courtesy`.
  - Communication items gain `{ said: tag }` auto variants where a tag fully decides them: introduce, consent, offers questions.
  - The rest stay AI-graded.
- **Coach view additions:** mode, a voice/typed badge per utterance, tool, placement error and duration on each exam row, hints used, and courtesy tags with their evidence.

## Workstreams
A–I as in the brief. The schema PR is owned by the schemas and engine owner and merges first.

## Verification
- **Unit tests:**
  - `orderLog`, and the M0 regression test (array order ≠ `t` order);
  - monotonic `t`;
  - `mmss` rounding;
  - the new rule types (`said`, `technique`, `hygieneBeforeTouch`, `examOnly`);
  - `resolveFinding` with object-valued findings and audio;
  - anchor coverage of every region;
  - `patientState()`;
  - audio schedulers (S3 timing relative to S2 at a given HR, crackle density, Weber pan sign);
  - the tag regexes, with evidence verified;
  - the sequence validator;
  - the voice adapter with a fake provider.
- **e2e:** extend the smoke test.
  - Knock and enter, then hold to sanitise.
  - Introduce by voice (stubbed recognizer), then history.
  - In the 3D view: JVP via the accessible picker and one real canvas click at a projected anchor.
  - Stethoscope bell at the apex in left lateral decubitus, held 3 s. Assert the caption shows the S3 and the Action has `placementError`.
  - Crackles at the bases.
  - Rinne sequence and Weber, on the screening case.
  - Run both practice and exam modes; check the exam auto-end with a shortened time-limit env.
  - Coach view shows the mode, voice badges, placement accuracy, hints and tags.
  - No console errors anywhere.
- **Manual:** WebGL is checked with headless Chromium screenshots of each focus preset. Audio is verified through the pure scheduler functions (Node has no `OfflineAudioContext`); real listening quality is a manual check.
- **Not verifiable here:** real microphone input, real iPad performance and listening quality. These are listed in the open questions as manual checks for the team.

## Milestone status

| # | Milestone | Status |
|---|---|---|
| M0 | Bug fixes | done |
| S | Schema changes | done |
| M1 | 3D patient | done (primitive mannequin; GLB loader deferred, see notes) |
| M2 | Tools and sound | done |
| M3 | Speech to text | done |
| M4 | Practice vs exam mode | done |
| M5 | Room entry and courtesy flow | done |

## Implementation notes
- **M1, model:** no CC0/CC-BY model is in the repo, so the GLB loader was not written. Untested code would mislead the team. `Mannequin.tsx` is the swap point, documented in `public/models/LICENSE.md`.
- **M1, neuro and whole-patient regions** are buttons in the 3D view, not body anchors. The `neuro_*` regions are exam domains, not places. The 2D "zoom" shortcut regions (`head`, `precordium`) have no 3D anchor.
- **M1, implied actions:** the actions API returns every action it appended (e.g. the automatic drape `expose`), so the live log matches the stored log.
- **M1, known warning:** react-three-fiber 9.8 triggers a `THREE.Clock` deprecation warning with three 0.186. It is a warning, not an error, and comes from inside the library.

- **M2, sound while holding:** `POST /api/sessions/[id]/listen` returns only the audio for a placement (no text) and logs nothing, so the stethoscope can play while held. The placement is logged as an `examine` on release, with `placementError` and `durationMs`. A listen under 3 s is logged, but the student sees "listened for x s" instead of the finding.
- **M2, tools vs menu:** in 3D, choosing an instrument maneuver from the menu picks up the tool instead of performing it. The 2D view still performs menu choices, as the accessibility fallback, and offers "Play sound". Technique items (`fcm-38-bell-technique`, `fcm-42-lung-technique`) can only be earned with the 3D tools.
- **M2, sequences:** sequence placements are measured against the step's landmark (mastoid, ear canal), not the region centre. The finding shows only after the last step, and out-of-order steps are flagged.
- **M2, camera:** "Left side" and "Right side" presets were added for lateral exams (ears, Rinne, lateral chest).
- **M2, vocal resonance** stays a menu maneuver: it needs the patient to say "ee" and shares the diaphragm placement with breath sounds.

- **M3, voice:** the recognizer prefers the standard `SpeechRecognition` over the `webkit` name. The draft keeps its "voice" source even if the student edits it before sending. Real-microphone accuracy is a manual check, because e2e uses a scripted recognizer.

- **M4, enforcement:** once the exam timer has auto-ended, the server rejects further exam, chat and courtesy actions. Pausing is refused in exam mode.
- **M4, help:** hints, progress checks (deterministic items only, so no AI cost) and "show me how" are practice-only, and every use is logged as a `hint` action. The hand-hygiene nudge is generated and logged server-side on the first unclean touch.
- **M4, "findings at the end":** the server withholds finding text from the student (sounds still play) until the station ends.
- **M4, test hook:** `TIME_LIMIT_SECONDS_OVERRIDE` shortens the exam countdown for e2e only. Leave it unset in production.
- **M4, time item:** `within-time` (`{ not: { happened: "timer:auto_end" } }`, exam mode only) was added to the reasoning and exam sheets.

- **M5, the door:** a session opens outside the room (door sign plus "Knock and enter", logged as `room` knock and enter). Exam and chat controls appear only inside. The exam clock runs from session start, so reading the door sign counts.
- **M5, hand hygiene:** the dispenser stands by the head of the bed in the 3D scene. The "Hold to sanitise hands" button does the same in either view. Both need a 3 s hold, show a ring and log `courtesy: hand_hygiene`. The Actions menu has an instant "Clean hands (no hold)" for keyboard and switch users.
- **M5, tags:** `src/server/tags.ts` (regex, pure, unit-tested) runs on every chat turn. `src/server/ai/tagger.ts` (Haiku, mock path, 5 s timeout) runs only when the regex found nothing, the utterance is at least 20 characters and it contains a courtesy cue word. A model tag is kept only if its evidence appears verbatim in the utterance. Tags are set server-side; the actions API strips any `tags` a browser sends.
- **M5, spoken positioning:** a `requested_position` tag appends a `state_change` (`via: "verbal"`). It only fires on requests ("could you…", "please…", or an imperative sentence), never on symptom questions such as "do you get breathless when you lie flat?". The e2e test caught that bug and a unit test now covers it. `reclined_45` was added to the `Position` enum (additive).
- **M5, direct manipulation:** the bed-angle slider (flat / 30° / 45° / seated) and the per-zone drape toggles log `state_change` (`via: "direct"`). Drape toggles were built instead of a drag-the-sheet gesture; they are faster to use and to test. The sheet in the 3D scene follows the state.
- **M5, leaving:** "Leave the room" logs `room: exit`, locks the exam and opens the presentation, which can't be dismissed. In practice mode, leaving without a goodbye tag or without hand hygiene after the last contact first shows one logged nudge, with "Leave anyway".
- **M5, mark sheets:**
  - `fcm-01` is `{ hygieneBeforeTouch: true }`.
  - `fcm-03` credits re-covering a zone (`drape:cover`) or the menu's re-drape. The automatic expose doesn't count.
  - New auto items: `courtesy-introduce`, `courtesy-consent` (consent tag before the first touch), `courtesy-exit-hygiene` and `courtesy-closing`.
  - In the history sheet, `introduce-self-role` and `anything-else` became `said` rules. Every other communication item stays AI-graded.
- **M5, event refs:** `drape:cover`, `drape:expose` and `drape_change` were added. `position:<p>` now matches `state_change` as well as the courtesy. `first:`/`last:` accept any event ref (e.g. `last:hand_hygiene`).
- **M5, coach view:** each tagged utterance shows its tags with the words that earned them, and model tags are marked. Knock, enter and exit, plus every bed and drape change (direct, verbal or menu), appear in the timeline.

## Open questions
1. **3D model:** source and license. No CC0/CC-BY GLB is bundled; the primitive mannequin ships until the team picks one.
2. **Sounds:** recorded or procedural (procedural by default)? If recorded, which licensed library?
3. **Exam time:** is 15 minutes right for the HF case, and what for the screening exam?
4. **Voice:** which browsers to support (Chrome/Edge/Safari via Web Speech; Firefox falls back to typing)? Is a server STT provider needed?
5. **Hint content:** generic "next unmet item", or coach-authored hints per case?
6. **Courtesy tags:** should a tag fully decide a communication item (auto), or only feed the AI grader? M5 made five items tag-decided (introduce ×2, consent, closing, offers questions). Coaches can override any of them.
7. **Placement tolerance:** what tolerance and minimum listen time should count as correct technique?
8. **Hygiene hold:** is a 3 s hold enough, or should it approach a real 20 s rub? Should hygiene also be required on re-entry?
