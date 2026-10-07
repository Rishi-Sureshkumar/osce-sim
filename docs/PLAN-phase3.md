# Phase 3 plan: 3D-only, high-fidelity room, cinematic navigation, hidden targets, 1B OSCE flow and scoring

## Context
Phase 2 shipped a 3D patient made of primitive shapes. It also has visible target dots and snapping, tool use by drag, and a rubric built on FCM-1, the communication checklist and a clinical-reasoning sheet. Phase 3 brings the station close to the real UVA FCM 1B OSCE described in `/source/2024_1B_OSCE_Logistics.docx`:
- the app becomes 3D-only;
- a realistic patient in a composed exam room;
- click-driven camera "shots" in place of free orbiting;
- no visible exam targets: findings are earned by placing tools within a tolerance;
- the real 1B flow: door instructions, "You may begin", a 15-minute encounter, no re-entry, then a 10-minute post-encounter note (PEN);
- two-domain pass/fail scoring (Patient Encounter Skills, Communication Skills).

Every `CLAUDE.md` invariant still holds. Findings and sounds come only from case data, every input becomes one `Action` in one append-only log, content is JSON, and `regionId` values are canonical.

**Decisions made with the project lead:**
- **Patient model:** build `public/models/patient.glb` from MakeHuman CC0 assets (base mesh, default rig, skin weights), fetched from raw.githubusercontent.com.
- **Room props:** model clean, simple props in code. Poly Haven, Kenney and Quaternius are blocked from this container.
- **Asset licensing:** both are recorded in `docs/ASSETS.md` and `public/models/LICENSE.md`.

**Facts from the source documents:**
- **Timing:** a 15-minute encounter starts at the "You may begin" announcement. The 5-minute warning comes at 10:00 elapsed. There is no re-entry ("both feet across the threshold").
- **The PEN:** 10 minutes, with a 2-minute warning and a hard stop. Its sections are:
  1. history (pertinent positives and negatives);
  2. physical exam (only what was performed);
  3. up to 3 diagnoses.
  There is no workup in 1B.
- **Mouth and nose exams are verbal:** the student describes the maneuver and its purpose, and must be specific. Prohibited exams are listed on the door.
- **Student behaviour:** introduce yourself as a first-year student, don't defer decisions, share impressions without jargon near the end, and close.
- **Scoring:** you must pass both domains. They are scored from the SP checklists (physical exam and communication) plus faculty scoring of the PEN (history, exam and differential).
- **Communication checklist V2** has the same sections as our current `history-communication` sheet, attributed "Courtesy of Rebecca Kowalski".

## Work order
1. `docs/PLAN-phase3.md`: a clean copy of this plan, the asset list, assumptions, and open questions at the end. Commit.
2. Schema PR (S): one commit.
3. M1 → M6. After each: `validate`, `typecheck`, `test`, `lint` and `e2e`, then commit and push. Every commit leaves the app working.

## S: schema PR (`src/domain/schemas.ts`, one commit, flagged as a shared-file change)
**Region**
- Drop `view`, `svgPathId` and `zoomTo`.
- Add `group`: `head_neck | chest_front | chest_back | abdomen | arms | hands | legs | feet | whole | neuro`. It drives focus shots, the Examine menu and panel buttons.
- Add optional `verbal: true` for the mouth and nose regions.
- `head` and `precordium` (2D zoom aliases, unreferenced) are kept as ids with `hidden: true`, so no canonical id is deleted.
- New regions: `breast_left`, `breast_right`, `pelvic` (needed for prohibited-exam clicks).

**Case**
- `doorInstructions { reasonForVisit, task, prohibitedExams: { label, regionIds[] }[] }`. Vitals, name and age come from the case. This replaces `doorSign`; a schema preprocess maps old `doorSign` for compatibility.
- `timeLimits { encounterMin, penMin }`.
- `peChecklist: MarkSheetItem[]` (case-specific SP physical exam items, `auto` rules).
- `penKey { history: {id, text, kind: positive|negative, keywords[]}[], exam: {id, text, maneuverIds[], keywords[]}[], differential: {diagnosis, aliases[], rank, rationale}[] }`.

**Catalog maneuver**
- Optional `penTerms: string[]`: the words a note uses for that maneuver's findings. Used by the deterministic "reported but not performed" check.

**New actions**
- `sit_down`.
- `describe_exam { regionId, text }`: quotable by the grader.
- `prohibited_attempt { regionId }`.
- `tool_contact { tool, toolMode?, nearestRegionId|null, distanceCm, toleranceCm, durationMs, outcome: finding|near|background|nothing }`. Every placement is logged. An `examine` is appended only for a recorded finding.
- `submit_pen { history, exam, diagnoses: {diagnosis, support?}[] (≤3) }`.

Notes on actions:
- `submit_ddx` stays readable for old sessions.
- "expose" is already covered by courtesy `expose` and `state_change` drape, so no duplicate type is added.
- `timer` events gain `begin`, `encounter_warning`, `encounter_end`, `pen_warning` and `pen_lock`.

**MarkSheet**
- Add `domain: patient_encounter | communication`, `passThreshold` (0–1) and `attribution?`.

**Rules**
- New rule `{ placedWithin: { maneuver, regionId?, position? } }`: a `tool_contact` with outcome `finding`, or `examine` for click maneuvers.
- Event refs: `sit_down`, `describe:<regionId>`.

**Anchors**
- `toleranceCm` on `RegionAnchor` (`src/exam3d/regionAnchors.ts`).

## M1: 3D-only
- **Delete:**
  - `src/components/body/*` and `ViewTabs.tsx`;
  - `tests/bodyShapes.test.ts`;
  - the 2D/3D toggle and `VIEW_KEY` in `Station.tsx`;
  - the `zoomTo` handling;
  - the 2D "Play sound" path in `PerformOverlay.tsx` (the `audio` prop, `audioEngine` and caption);
  - the `examView` branches.
- **Rewire uses of `view` to `group`:** `RegionPicker.tsx`, `Exam3DView.tsx` (`panelRegions`), `regionAnchors.ts` (`PANEL_VIEWS` becomes groups `whole`/`neuro`), and `tests/regionAnchors.test.ts`.
- **"Examine…" command menu:** `RegionPicker` becomes `src/exam3d/ExamineMenu.tsx`.
  - A keyboard-operable dialog: region list grouped by `group`, then maneuver list.
  - It emits the same `examineFromClick` actions and draws no diagram.
  - Opened with a button or `E`.
  - It is also the e2e driver for menu exams.
- **e2e:** remove the 2D toggle steps.

## M2: patient model and exam room
**Model build:** `scripts/assets/build-patient.ts` (checked in, rerunnable; output committed).
- **Download** (all CC0): MakeHuman `base.obj`, `rigs/default.mhskel` and `default_weights.mhw` from `raw.githubusercontent.com/makehumancommunity/makehuman`.
- **Build:**
  1. Strip the `helper-*` and `joint-*` groups.
  2. Keep body, eyes, eyebrows, teeth and tongue.
  3. Scale to metres (adult ~1.75 m).
  4. Build the skinned mesh from the rig and weights. Reduce the rig to about 60 deforming bones: spine, neck, head, jaw, eyelids, arms, hands and fingers, legs, feet.
- **Gown:** an offset shell over the torso and upper-thigh vertices, split into chest, abdomen and back panels, so the drape system can fold each one.
- **Materials:**
  - procedural PBR skin, baked to a 1k WebP texture, with areola, umbilicus and subtle tone variation;
  - eye material with iris and pupil (pupil scale driven by the penlight);
  - gown fabric.
- **Compress:** export via `three` GLTFExporter in Node, then `@gltf-transform` with meshopt and WebP textures. KTX2 needs `toktx`, which isn't installed; recorded in ASSETS.md.
- **Targets:** about 40–60k triangles; ≤ 6 MB GLB.
- **Landmarks:** sternal notch, clavicles, nipples, costal margins, umbilicus, iliac crests, scapulae, spine, ears, jaw, knuckles and toes come from the MakeHuman topology. The script also emits landmark positions from known vertex indices, which seed the anchor table in `regionAnchors.ts` (bone-relative, bind-pose metres).
- **Licences:** `public/models/LICENSE.md` and `docs/ASSETS.md` record sources and CC0 licences.

**Patient component** `src/scene/Patient.tsx` (drei `useGLTF`, plus `useProgress` for a loading screen):
- Poses are data in `src/scene/poses.ts` (bone rotations for seated, reclined 30/45, supine, left lateral decubitus, leaning forward). The table head angle blends the spine and pelvis rotations.
- **Idle life** from the case vitals:
  - chest/spine breathing at RR;
  - eyelid blink every 3–6 s;
  - small idle sway;
  - the head turns toward the camera while the patient speaks (during chat streaming);
  - a neck pulse at HR when `visibleSigns.jvpCm` is set (vertex-shader bulge over the JVP area, extending to the case's height).
- Edema: shin and ankle swelling. Laboured breathing: accessory motion and a higher amplitude.
- The primitive `Mannequin.tsx` is deleted once the GLB renders in e2e.

**Room** `src/scene/room/*`: one composed scene of procedural low-poly props with PBR colours:
- corridor with door and door-instructions placard;
- hinged door;
- sink and sanitizer on the left wall as you enter;
- exam table with an adjustable head section;
- tool table holding stethoscope, reflex hammer, 128 and 512 Hz forks, penlight, otoscope/ophthalmoscope, cotton swabs and BP cuff;
- rolling stool, chair, wall computer, curtain, wastebasket.

Lighting is stable: hemisphere light, one shadowed key light, and contact shadows. Each prop is listed in ASSETS.md as replaceable by a GLB.

**Quality setting** (high/low, localStorage): low sets dpr 1, turns shadows off, halves the shadow map, turns contact shadows off, and reduces anisotropy. An FPS meter appears with `?fps`.

**Budget:** initial download ≤ 15 MB, checked by an e2e test that sums the transfer size of `/models` plus JS. A loading screen shows progress.

## M3: cinematic, click-driven navigation
- **`src/scene/shots.ts`:** each shot is data: `{ id, label, parent, camera {position, target, fov}, freeLook {yawDeg, zoomMin, zoomMax}, transitions[] }`. Shots:
  - corridor, room overview, sink, tool table, seated;
  - a focus shot per region `group`.
  Upper-body shots follow the pose.
- **`src/scene/shotMachine.ts`:** a pure reducer (`go`, `back`, `canGo`) with unit tests.
- **`CameraRig`:** reused, tweening ~0.6–1.2 s with an ease-in-out curve. OrbitControls is replaced by limited yaw and zoom.
- **Navigation UI:** a Back button, `Esc`, and a breadcrumb.

| Click | Behaviour | Action |
|---|---|---|
| Door (corridor) | Procedural knock sound, door swings, camera walks in | `room` knock and enter |
| Sink | First-person hands lather with foam particles for ~4 s; can't be skipped in exam mode | `courtesy` hand_hygiene |
| Tool table | Camera tilts down; hovered tool lifts and shows its name; click to pick it up, camera returns | Sets the active tool (no action) |
| Stool | Camera lowers to seated eye level | `sit_down` |
| Patient region | Focus shot for that group | (none) |
| Table head control | Head section animates; posture follows | `state_change` position (direct) |
| Drape edge | Panel folds back or covers | `state_change` drape |
| Door (inside) | "Leaving ends the encounter. No re-entry." confirmation | `room` exit, then PEN |

**Surface-following tools:**
- `src/scene/tools/ToolCursor.tsx` raycasts against a per-pose collision mesh. The skinned geometry is baked when the pose changes, using `three-mesh-bvh` (MIT).
- The tool head (diaphragm or bell, fork base, hammer tip, penlight beam) aligns to the surface normal.
- Click to use the hammer or penlight; press and hold the stethoscope or fork.
- Animations are driven by the finding's `visual`: reflex jerk by grade, pupil constriction, and fork strike then hum.
- The existing sequence logic is reused unchanged: `sequenceProgress`, `stepForPlacement` and the Rinne signal button (`src/exam3d/tools/toolLogic.ts`).

**Verbal regions** (mouth, nose):
- Clicking opens "Describe the maneuver and what you're looking for." The answer can be voice or text.
- It becomes a `describe_exam` action, graded by an `ai` item for specificity. A finding is shown only if the case defines one.

**Prohibited regions:** listed in `doorInstructions`. Clicking shows "Not performed in this encounter (see door instructions)" and logs `prohibited_attempt`.

**Removed:** the HTML tool tray and the camera preset tabs, replaced by the scene plus the Examine menu.

## M4: no giveaway targets
- **Hidden markers:** the anchor spheres, dots, rings, hover highlights and snap indicators are no longer rendered in the exam view.
- **Anchor table:** anchors stay in `regionAnchors.ts`, re-expressed as bone + bind-pose offset in metres, each with `toleranceCm`: precordial areas 2, apex 2.5, lung zones 4, others 3–5.
- **Pure function** `contactOutcome(distanceCm, toleranceCm)` in `src/exam3d/tools/contact.ts`:
  - **inside the tolerance:** `finding`, full sound;
  - **up to 2× the tolerance:** `near`, attenuated and low-passed, no finding;
  - **elsewhere on the chest or back:** `background`, generic normal heart or vesicular sound from the catalog normals, no finding;
  - **anywhere else:** `nothing`.

  `placementSound` is reworked to take the outcome and the distance.
- **Stethoscope:** after 3 s of continuous contact inside the tolerance, it appends `examine`. Every contact logs a `tool_contact` with the nearest region and distance in cm. The student never sees the distance.
- **Other tools:** hands and the other tools follow the same rule. Outside the tolerance the result is "Nothing notable here."
- **Practice only:** a "Show landmarks" toggle fades in anatomical labels for ~3 s (no dots) and logs a `hint`. It is absent in exam mode.
- **Calibration page:** `/dev/anchors` renders the anchors as a debug overlay. It calls `notFound()` when `NODE_ENV === "production"`.
- **Unit tests:**
  - the tolerance bands;
  - the DoD case: 4 cm off the apex records no S3 and gives `near` with attenuated sound;
  - anchors move with the pose.

## M5: encounter flow mirroring the 1B OSCE
- **Phases are derived from the log** (pure `encounterPhase(log, case, mode, now)` in `src/engine/encounter.ts`): corridor → begun (`timer:begin`) → in room → left (`room:exit` or `encounter_end`) → PEN → submitted.
- **Corridor:**
  - The door placard shows name, age, reason for visit, vitals, task and prohibited exams.
  - A "You may begin" announcement (speechSynthesis plus an on-screen banner) logs `timer:begin`.
  - **Exam mode:** begin is a button standing in for the proctor's cue. The door stays locked until begin.
  - **Practice mode:** begin is automatic.
- **Notepad:** a panel available in every phase (scratch only, kept per session in localStorage, not graded), mirroring the paper the real exam provides.
- **Timers (exam mode):**
  - Encounter: 15 minutes from begin, with the warning at 10:00. At 15:00, `encounter_end` is logged and the student is moved out.
  - PEN: 10 minutes from exit, with a 2-minute warning. At time-up the note locks and is submitted from the last autosaved draft.
  - The server enforces both deadlines: actions after the encounter end are refused, and the PEN draft (`Session.penDraft`, autosaved every 5 s) is used if the client misses the deadline.
  - Overrides: `ENCOUNTER_SECONDS_OVERRIDE` and `PEN_SECONDS_OVERRIDE` (test only).
- **No re-entry:** after `room:exit`, the door is disabled.
- **PEN form** replaces `FinishDialog`:
  - three required sections: History, Physical examination, Diagnoses (up to 3);
  - an optional "Supporting findings" field per diagnosis (open question);
  - no plan field;
  - shows "Physical exam: include only maneuvers you performed".
- **Practice mode:** no timer pressure, hints and nudges allowed, all logged.
- **Grader prompt additions:** introduce yourself as a first-year student; flag deferring decisions ("my attending will decide"); impressions shared without jargon.

## M6: 1B scoring (two domains)
- **`content/marksheets/communication-1b.json`** (`domain: communication`, `passThreshold: 0.7`, placeholder, `attribution: "Courtesy of Rebecca Kowalski"`):
  - The communication-checklist V2 sections, with paraphrased labels (reusing today's paraphrased items).
  - `remove-barriers` becomes `auto` (`{ happened: "sit_down" }`).
  - Introduce: `said` rule plus an `ai` item that checks "first-year student".
  - Paraverbal encouragement and use of silence are `not_assessable`.
  - "Shares impressions" `ai` guidance flags jargon and deferral.
- **`content/marksheets/encounter-1b.json`** (`domain: patient_encounter`, `passThreshold: 0.7`):
  - history-coverage items moved out of communication (PMH, PSH, meds, allergies, FH, SH, ROS), graded `ai` over the transcript;
  - PEN items generated at grading time from `case.penKey`: one per history key, one per exam key, and one per accepted diagnosis (aliases and ranked alternatives allowed);
  - a justification-quality item;
  - a "no unperformed findings reported" item.

  `src/engine/penItems.ts` builds the generated items, so content stays data. Mock grading uses the `keywords`.
- **Case `peChecklist` items** join the patient-encounter domain at scoring time, using `sheetsForCase` plus the case checklist. Hand hygiene and drape items move into the HF `peChecklist`.
- **`exam-fcm1`** stays as the catalog-wide sheet for screening cases only (`domain: patient_encounter`). `history-communication` and `clinical-reasoning` are deleted.
- **Deterministic PEN cross-check** (`src/engine/penCheck.ts`, pure, tested):
  1. Split the exam section into claims (lines and bullets).
  2. Match each claim to maneuvers by catalog `penTerms` and `penKey.exam` keywords.
  3. Link supporting `examine` or `tool_contact` actions.
  4. Flag claims about maneuvers that weren't performed.

  The AI grader receives the flags and can add more.
- **Totals:** `domainTotals(scores, sheets)` in `src/engine/scoring.ts` gives points, max, percentage, threshold and pass per domain. The station passes only if both domains pass.
- **Kept as they are:** the existing machinery (`scoreDeterministicItems`, `scoreAiItems` with verbatim quote checks and `needs_review`, `applyOverrides`).
- **Results and coach UI:**
  - `DomainCard`: pass/fail, score and threshold, with items grouped by section.
  - Evidence (`ScoreItem`) shows quotes, timestamps and stethoscope placement distances from `tool_contact`.
  - `PenReview` shows the PEN beside the transcript. Each claim links to its supporting action, or is flagged.
- **HF case:**
  - `doorInstructions`: prohibited breast and pelvic exams;
  - `timeLimits {15, 10}`;
  - `peChecklist`: JVP at 30–45°, PMI, four areas plus apex bell in left lateral decubitus, posterior base auscultation and percussion, edema, hepatojugular reflux, hand hygiene, drape;
  - `penKey`.

  The screening case gets `doorInstructions` and `timeLimits`.

## Reused, not rewritten
- **Engine:** `orderLog`, the rule interpreter (`src/engine/rules.ts`), `resolveFinding` (with `byPosition`), `patientState`, `verifyEvidence`/`quotableText` (extended for `describe_exam` and `submit_pen`), `scoring.ts`.
- **Tools and audio:** `toolLogic` sequences, the audio engine and schedules (`src/audio/*`).
- **Server and input:** the courtesy tagger (`src/server/tags.ts`), session service guards (`src/server/session.ts`), the voice adapter, practice hints.

## Tests and verification
- **Unit:**
  - shot machine;
  - `contactOutcome` bands, including 4 cm off the apex → `near` with no finding;
  - anchors follow the pose;
  - `encounterPhase` and deadlines;
  - `penCheck`: a reported S3 without a bell exam is flagged;
  - `penItems` generation;
  - `domainTotals` pass/fail;
  - the new rules (`placedWithin`, `sit_down`, `describe`);
  - content validation (domains, thresholds, `peChecklist` refs, `penTerms`);
  - all existing tests, updated where they named the old sheets.
- **e2e:** HF in exam mode, in order:
  1. corridor placard, then begin, then knock;
  2. sink hold, then stool;
  3. history by voice (scripted recognizer);
  4. tool table, then stethoscope;
  5. find the S3 (bell, left lateral decubitus) and crackles, by moving the cursor over the hidden anchors via the test hook;
  6. assert a placement 4 cm off the apex logs `near` and records no finding;
  7. share impressions, then leave and confirm;
  8. PEN with a deliberately unperformed finding, which is flagged;
  9. two domain cards, with pass/fail and threshold shown.

  Plus the screening/Rinne test (adapted), the exam timers with shortened overrides, the bundle and size-budget scan, and no console errors.
- **Manual / not verifiable here:** iPad frame rate (low setting) and listening quality. FPS is sampled in headless Chromium only as a smoke number.

## Asset list
| Asset | Source | License | Status |
|---|---|---|---|
| Patient body, rig and skin weights | MakeHuman 1.x `base.obj`, `default.mhskel`, `default_weights.mhw` | CC0 1.0 | built by `scripts/assets/build-patient.ts` |
| Skin, eye and gown textures | generated procedurally by the build script | CC0 (ours) | built |
| Room props (door, sink, sanitizer, exam table, tool table and tools, stool, chair, computer, curtain, wastebasket) | modelled in code (`src/scene/room/*`) | ours | Poly Haven, Kenney and Quaternius are unreachable from the build container; replaceable with GLBs, see `docs/ASSETS.md` |
| Sounds | procedural (`src/audio/*`) | ours | unchanged from phase 2 |

## Assumptions
- **Begin button:** in exam mode, a "Begin" button stands in for the proctor's "You may begin" announcement.
- **Notepad:** scratch paper, never graded or logged (as in the real exam).
- **Pass threshold:** the placeholder is 70% per domain, stored as data.
- **PEN lock:** at time-up the note is submitted from the latest autosaved draft.
- **Model credit:** the patient model is graded on anatomical landmarks, not photorealism.

## Milestone status
| # | Milestone | Status |
|---|---|---|
| S | Schema changes | done |
| M1 | 3D-only | done |
| M2 | Patient model and room | done |
| M3 | Cinematic navigation | done |
| M4 | Hidden targets | done |
| M5 | 1B encounter flow and PEN | done |
| M6 | Two-domain scoring | done |

### M4 notes (as built)
- `src/exam3d/tools/contact.ts` (pure, tested) decides `finding` / `near` / `background` / `nothing` from distance vs `toleranceCm`; the 3D view logs a `tool_contact` for every placement through `contactFromTool`.
- A stethoscope inside the tolerance records its `examine` after 3 s of continuous contact; sliding across a band boundary restarts the clock. Off-target chest/back placements play the catalog's *normal* heart or breath sounds (`POST /listen { background }`), never the case's.
- The server refuses a tool `examine` outside its tolerance or a stethoscope one shorter than 3 s, refuses hints in exam mode, and redacts distances (and hides `tool_contact`) from the student while the session is active. Coaches and results see them in full.
- Snapping: inside several tolerances the most central anchor wins (relative distance), so the 6 cm breast zone never swallows the apex.
- Practice "Show landmarks" shows labels only (no markers) for 3 s and logs a hint. `/dev/anchors` draws tolerance and 2× bands; `notFound()` in production.

### M5 notes (as built)
- `src/engine/encounter.ts` derives corridor → encounter → pen → submitted from the log; `allowedInPhase` and `dueTimerEvents` are shared by server and client. Applies to encounter cases with `timeLimits` (`PublicCase.flow`); screening cases keep the old countdown and finish dialog.
- The server owns the deadlines (`enforceFlow` runs on every action, view, draft save and `POST /tick`): it logs `encounter_end` when the encounter time has passed, refuses anything but the note afterwards (no re-entry), and after the note deadline (+5 s grace) logs `pen_lock` and submits the last autosaved draft (`Session.penDraft`, migration `0002_pen_draft`). Students can't log `encounter_end`/`pen_lock` themselves, and warnings only when due.
- Exam mode: "You may begin" button (stands in for the proctor; spoken with speechSynthesis) unlocks the door. Practice begins automatically and has no deadlines.
- PEN form: History, Physical examination ("include only maneuvers you performed"), up to 3 diagnoses with optional supporting findings, no plan; autosaves every 5 s; submitted as-is and marked `locked` at time-up.
- Notepad: scratch only, localStorage per session, never sent to the server.
- Test overrides: `ENCOUNTER_SECONDS_OVERRIDE`, `PEN_SECONDS_OVERRIDE`.

### M6 notes (as built)
- `communication-1b.json` (communication domain, attribution "Courtesy of Rebecca Kowalski") keeps the paraphrased checklist sections; `remove-barriers` is now auto (`happened: sit_down`), "first-year student" is a new AI item, paraverbal/silence stays not assessable, and the impression item penalises jargon and deferral.
- `encounter-1b.json` (patient-encounter domain) holds history coverage (PMH, PSH, meds, allergies, FH, SH, ROS) and the exam-mode timing item. At grading time `sheetsForCase` adds the case's `peChecklist` sheet (`case-pe`) and a sheet generated from `penKey` (`pen`: one AI item per history point, exam point and diagnosis, a justification item, and the deterministic "reports only performed exams" item). `history-communication` and `clinical-reasoning` are deleted; `exam-fcm1` remains for the screening case (patient-encounter domain).
- `src/engine/penCheck.ts` splits the PEN exam section into claims, matches them to maneuvers by catalog `penTerms` and `penKey.exam` keywords, links supporting exams (or on-target tool contacts) and flags the rest. Each flagged claim costs half of the consistency item; the flags are also passed to the AI grader.
- `domainTotals` / `stationPass` in `scoring.ts`: points, max, fraction, threshold and pass per domain; the station passes only if both domains pass. Results and coach views show a verdict, two domain cards (sheets inside, items grouped by section, overrides per item) and a PEN review beside the transcript with each claim linked or flagged. Placement distances appear in evidence once the session has ended.
- Content validation now checks item ids are unique across all of a case's sheets, generated ones included (the grader matches judgements by id).

## Open questions
1. Domain pass thresholds: 70% is a placeholder, applied to both domains.
2. Does the PEN have a justification field? The screenshot cuts off below item 3. Built as an optional "supporting findings" field per diagnosis.
3. Permission to use the communication checklist text and the FCM framework text verbatim.
4. Patient model: is the MakeHuman CC0 build good enough, or should a commissioned or scanned model replace it?
5. Which communication items stay not-assessable? Silence could later be measured from voice timing.
6. KTX2 textures need `toktx` in the build environment; WebP for now.
7. How should the real exam's announcement audio be reproduced (TTS vs recorded)?
8. PEN consistency: each unperformed claim costs half of a 2-point item. Should faculty weight this differently, or treat any unperformed claim as a fail?
9. The `penTerms` matching is keyword-based. Faculty should review the terms per maneuver, and decide whether a claim like "lungs clear" (no named maneuver) should require any auscultation.
10. Communication HPI items stay in the communication domain (they're on the communication checklist); history coverage (PMH→ROS) counts toward the patient encounter. Confirm this split.
