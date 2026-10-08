# Phase 4 plan (OSCE simulator): QA harness, no external LLM, anatomy fixes, distinct models and drapes, hide-findings and mistakes, 3 new cases, UI

## Context

Testers found bugs the Phase 3 build should have caught:
- penlight hit area too large;
- mastoid not detected;
- sink with no basin;
- no front view of the face;
- landmarks drift between views;
- legs poking through the drapes;
- reflexes that don't move the leg;
- a popup stuck open with no ✕;
- a BP cuff that records nothing.

There is also no paid LLM endpoint. Phase 4 therefore:
1. builds an automated QA harness first;
2. replaces every model call with a deterministic, offline language layer;
3. fixes the bugs, each with a regression test;
4. rebuilds the male and female patients and sectioned drapes;
5. adds a hide-findings mode and mistake alerts;
6. adds 3 new cases;
7. polishes the UI.

Every `CLAUDE.md` invariant still holds, except that there is no external LLM (invariants 1 and 5 are rewritten in M1).

**User decisions:**
- **Models:** we build `patient_male.glb` and `patient_female.glb` ourselves from MakeHuman CC0, with `bpy` cleanup. A GLB the user supplies later drops into the same build step.
- **Embeddings:** computed in the student's browser, as the brief says. The server always re-embeds for grading.
- **WebLLM:** built behind a toggle and unit-tested with a fake engine.

**Environment facts:**
- huggingface.co is blocked. The MiniLM weights come from npm package `@ryanstark24/sfgraph-models`, which contains `Xenova/all-MiniLM-L6-v2` `model_quantized.onnx` plus tokenizer and a `CHECKSUM.json`.
- npm and GitHub raw are reachable. The MakeHuman cache is in `.cache/makehuman`.
- `bpy` 5.2.2 (Blender as a Python module) is on PyPI for Python 3.13.
- There is no `toktx`; `ktx2-encoder` is available as wasm.
- There is no WebGPU here.
- The frontend-design skill isn't available, so design principles are applied directly.

## Decisions that resolve conflicts with the brief

| Topic | Decision |
|---|---|
| Invariants 1 and 5 | **Rewritten:** no model ever picks a fact, finding or score. Patient replies are case text chosen by `src/lang`. WebLLM may only reword text that has already been chosen, display only. Matching data (fact bank, paraphrase vectors) stays on the server. |
| Scoring kind | `"ai"` is renamed `"match"`. A Zod preprocess maps legacy content. `ItemScore.scoring` still accepts `"ai"` so stored runs parse. |
| Settings | Stored in `session_start.payload.settings` (the log is authoritative), plus `settings` actions for mid-session changes. `findingsDisplay` is locked after start. `Session.settings` is a nullable mirror (migration `0003`). |
| Mistakes file | `content/mistakes.json`, loaded by `src/content/`. This keeps invariant 4 (content is data in `/content`); the brief said `src/content/`. |
| Auto-expose before an exam | Removed in M3. Otherwise "examined through the gown" can never fire. An exam through cover gives a muffled finding and logs a mistake. |
| TestHook in production | Mounted only when `QA_HOOKS=true` (Playwright sets it). Today it exposes the hidden targets to anyone with devtools. |
| Forced FinishDialog | Becomes an inline full-page step, like `PenForm`, so every real dialog follows the contract. |
| "Fails on old code" | Means it fails on the parent of the fixing commit. Proof is kept in `qa/regressions/<bug>.txt`, produced by `scripts/qa/prove-regression.ts` (runs the new test in a git worktree at the parent commit). |

## Commit order and gates

```
P   docs/PLAN-phase4.md
S   schema commit
M0  QA harness:
      .1 refactor + QA hooks + console fixes
      .2 Dialog contract
      .3 test:catalog
      .4 test:intersections
      .5 test:visual + REVIEW
M1  no external LLM
M2  one commit per bug: test → proof of failure → fix
M3  models, drapes, room
M4  hide-findings mode and mistake alerts
M5  three new cases
M6  UI polish
```

- **QA gate for each milestone:** `npm run qa` runs:
  - `validate`, `typecheck`, `lint`, `test`, `test:anchors`, `test:intersections`;
  - then one build and one server (`QA_HOOKS=true`, reused);
  - then `test:catalog`, `test:visual` and `e2e`, each with the console guard;
  - then `qa:review-check`.
  - The main agent then opens every new or changed PNG with Read.
- **Expected failures:** `qa/xfail.json` lists `{id, owner, reason}`. Results are reported as PASS, XFAIL, XPASS (an error) or FAIL. `QA_STRICT_OWNER=M2` (or `M3`) makes that owner's entries fail, so M2 must empty its part of the list and M3 its part.

## S — schema commit (`src/domain/schemas.ts`, flagged as a shared-file change)

**Enums**
- `Position` gains `sitting_dangling`.
- `Tool` gains `cotton_swab` and `pin`.
- `DrapeSection` = `chest_left | chest_right | abdomen | pelvis | leg_left | leg_right | back`.
- `Emotion`, `Severity`, `FindingsDisplay` (`show | hide`).

**Regions**
- `Region.drapeSections?` (which sections cover each region).
- 18 new region ids, all additions, no renames: `upper_arm_*` (cuff site), `biceps_tendon_*`, `triceps_tendon_*`, `brachioradialis_*`, `patellar_tendon_*`, `achilles_*`, `sole_*`, `foot_lateral_*` (S1), `leg_medial_*` (L4).

**Audio**
- New generators:
  - `korotkoff` {systolic?, diastolic?, muffleMmHg, auscultatoryGap?, intensity}. Values are filled from the case vitals.
  - `percussion` {note resonant|hyperresonant|dull|stony_dull|tympanic|flat}.
  - `voice` {phrase ee|ninety_nine|whisper_123, transmission, egophony}.
- Heart gains `s2Intensity` and `ejectionClick`.

**Findings**
- Finding objects gain `response {say?, wince?}` (the patient's reaction counts as a stimulus) and `terms[]` (for recognition).
- Visual keys add `clonusBeats`, `pupilConsensual` and `pittingDepthMm`.

**Sequences and maneuvers**
- `SequenceStep` gains `kind place|signal|control`, `tool/toolMode`, `toleranceCm`, `minDurationMs`, `logsManeuver`, `control bp_gauge|support_arm`.
- Maneuvers gain `toleranceCm?` and `requiresExposure?`.

**Language**
- `Intent` {canonical, paraphrases[≤30], keywords[], patterns[], topics[]}.
- `HistoryFact` gains `intents?`, `followUps[]` ({id, intents, answer, emotion}) and `emotion?`.
- `PertinentNegative` gains `id?` (derived as `neg-<slug>`; required from M1) and `intents?`.
- `history.conversation[]` ({kind, intents?, replies[], emotion?}) for opening, greeting, introduction, consent, anything_else, empathy, thanks, closing, small_talk, position_request, and so on.
- `history.emotionCues[]` and `history.notRelevantTopics[]`.

**Case**
- `acceptableDiagnoses[]` {id, diagnosis, synonyms[], satisfies[]}.
- `mistakes[]` (case-specific rules).
- `itemsNotApplicable[]`.
- `defaultFindingsDisplay?`.
- `penKey.history[]` and `penKey.exam[]` gain `terms[]` and `exemplars[]`.

**Mark sheets**
- `MarkSheetItem.scoring` becomes `auto | match | not_assessable`.
- New `match: MatchSpec`: {sources (say, describe_exam, pen_history, pen_exam, pen_diagnoses, interpretation), keywords, patterns, exemplars, counterExemplars, topics, form, polarity, minMatches, window, penalties[], thresholds?}.
- `exemplars` and `mockKeywords` are folded into `match`.

**Grading records**
- `GradingRun.usage` and `GradingRun.mocked` become optional; `grader` is `deterministic | ai_legacy`.
- `Session.usage` becomes optional; `Session.settings` is added.

**Rules**
- New kinds: `state {handsClean, position, exposedAll/Any, exposedCountAtLeast, eventRegionCovered, exposedIdleMsAtLeast, inRoom}`, `drapeDiscipline {recoverWithinMs}`, `penUnperformed {atLeast}`.
- New refs: `mistake:<id>`, `interpretation`, `settings`, `drape:expose:<section>`, `drape:cover:<section>`, `region:<id>`.
- `evaluateRule(rule, log, ctx?)` gains an optional context argument.

**Mistakes and actions**
- `MistakeRule` {id, label, message ≤140, severity, modes, appliesTo?, trigger {on {type/ref/maneuver/region/tool/toolMode/position}, when?, unless?}, once, anchor}.
- New actions:
  - `mistake` (system) {ruleId, severity, message, causeActionId?, alerted};
  - `interpretation` {examActionId, regionId, maneuverId, text};
  - `settings`.
- Existing actions gain:
  - `say.match` and `patient_say.match`, holding server-set `UtteranceMatch`;
  - `ExamResult.doneText`, `reported` and `response`;
  - `StateChangePayload.drape` takes {zone | section, covered}, so old zone actions still parse;
  - `CourtesyTag` gains `shared_impression`.

**Mechanical updates in the same commit (to keep typecheck green)**
- Fill `POSITION_ANGLE`, `POSITION_LABELS` and `tableAngle` for `sitting_dangling`.
- `describeAction` and `quotableText` cases for the new actions.
- `allowedInPhase` for the new actions.
- Legacy drape zone → section mapping in `patientState`.
- `"ai"` → `"match"` code paths, behaviour unchanged.
- Rule-reference validation for the new refs.
- New `tests/phase4-contract.test.ts`.

## M0 — QA harness (built first)

**M0.1 Testability refactor, hooks and console fixes (no behaviour change; snapshot-tested)**
- Extract pure modules:
  - `src/exam3d/hit.ts`, `resolveHit` (from `Patient3D.toHit`);
  - `src/exam3d/tools/decide.ts`, `decidePlacement` and `holdCandidate` (from Exam3DView `contact`, `instantTool` and `holdAt`);
  - `src/scene/livePose.ts`, `liveRotations`;
  - `src/scene/animation/reflex.ts`;
  - `src/scene/drapeGeometry.ts`;
  - `src/scene/room/tableGeometry.ts`;
  - `src/scene/room/layout.ts`.
- QA flags:
  - `QA_HOOKS=true` is passed as a prop and mounts TestHook;
  - `?qa=fast` sets tween, step and door delays to zero;
  - `freezeTime` makes frames byte-stable;
  - `GET /api/qa/sessions/[id]/log` returns the unredacted log (coach role plus QA_HOOKS).
- TestHook gains:
  - `settled`, which replaces the fixed sleeps;
  - `pose`, `bone()`, `objectState(name)`;
  - `probe(x,y)`: ordered hits with kind (body, hair, gown, drape, bed, prop) and part;
  - `lastPointer`: hits, BodyHit, snap and decision;
  - `skinPointNear(region, cm, dir)`.
- The asset build emits per-triangle part labels (ear, scalp, face, eye, …) and a hair raycast proxy.
- FileRepo gets an mtime-cached store.
- **Console fixes:**
  - `Canvas shadows="percentage"` removes the PCFSoft warning.
  - The `THREE.Clock` warning comes from r3f 9.8.1, the latest stable. Fix it with patch-package (inline Clock-compatible class), applied in `postinstall`, with a test checking the patch is present.
  - The Playwright console-guard fixture (`e2e/qa/fixtures.ts`) fails on any warning, error, `pageerror`, failed request or ≥400 response that isn't explicitly allowlisted.

**M0.2 Dialog contract**
- `src/components/ui/Overlay.tsx` provides `<Dialog id kind=modal|popover|menu|confirm>`:
  - visible ✕ (`aria-label="Close"`);
  - Esc closes;
  - an outside click closes, except for `confirm`;
  - focus trap, initial focus and focus restore;
  - `role="dialog"` on the panel.
- `Toast.tsx` has a ✕ and auto-dismisses after 6 s.
- `DIALOG_IDS` registry. Every overlay from the inventory migrates to `Overlay.tsx`: ManeuverMenu, tool chooser, perform card, ExamineMenu, DescribeDialog, leave confirm, Actions menu, Tools menu, bed HUD, practice help, toasts.
- Clear `choice` and `performing` on leave, deadline and auto-end.
- Tests:
  - a static scan plus an ESLint rule: no `role="dialog"`, `aria-modal` or `fixed inset-0` outside `Overlay.tsx`;
  - `e2e/dialogs.spec.ts`, where `OPENERS satisfies Record<DialogId, opener>`, so an unregistered dialog fails typecheck. It checks ✕, Esc, outside click and a 12-Tab focus loop for each dialog.
- The bug-8 regression (Achilles reflex result on the left ankle) is proven against `be1700b`.

**M0.3 `npm run test:catalog`** (`playwright.catalog.config.ts`, 3 workers)
- `e2e/qa/catalogPlan.ts` generates every maneuver × allowed region × model, using the required position, focus shot, sections to expose, tool, mode and steps. Runs are sharded by (model, position).
- Each pair is placed at **two points**:
  - the stored anchor;
  - an independent anatomical **oracle** point from `qa/anatomy/oracle.ts`. Examples: mastoid 1.5–2.5 cm behind and 1–2 cm below the ear canal; cuff site on the upper arm 2–3 cm above the antecubital fossa; the tendon sites.
  - The oracle is what catches misplaced anchors; checking anchors only against themselves would be circular.
- Placement uses real `page.mouse` events on the canvas, going through `Patient3D` → Exam3DView tool handlers → the server.
- Asserts:
  - (a) `probe` shows the first hit is body skin (not hair, ear, drape, bed or prop);
  - (b) the snapped region is correct, within tolerance, with no chooser;
  - (c) an `examine` appears in the QA log;
  - (d) the newest Findings entry equals the expected `resolveFinding` + `findingDisplay` text.
- A 2× tolerance negative (`skinPointNear`) asserts a non-finding `tool_contact` and no examine.
- Click and menu maneuvers, panel regions, verbal regions (`describe_exam` logged) and prohibited regions (`prohibited_attempt` logged) are also covered.
- About 1,150 interactions, roughly 10 min on 3 workers. `CATALOG_FILTER` runs a subset.
- `npm run test:anchors` is a Node pre-flight with the same oracle and occlusion checks (GLB via gltf-transform, CPU skinning, BVH), taking about 10 s.
- Initial xfail list, red on the current code:
  - mastoid ×4;
  - BP cuff ×8;
  - reflex tendon sites;
  - female penlight (eye anchor 1.88 cm from the pupil, tolerance 1.5);
  - female `abd_llq`/`abd_rlq` and wrist;
  - `abd_bruits`, which can't be recorded because the stethoscope hold always takes `candidates[0]` (found by the harness; becomes M2.10).

**M0.4 `npm run test:intersections`** (Node, `scripts/qa/intersections.ts`)
1. Load the GLBs with `@gltf-transform` (meshopt or Draco decode).
2. CPU-skin through the `rig.ts` FK (bone transforms) with inverse bind matrices, 4 weights per vertex, plus morph weights.
3. Run model × 7 positions × drape states (all covered, each section exposed alone, all exposed except pelvis).
4. Checks:
   - bed: inside the `tableGeometry` boxes;
   - closed meshes: point in mesh by BVH ray parity;
   - cloth: signed distance under covered sections ≤ 0.
5. Pass threshold: ≤ 0.5% of skin vertices per combination.
6. Writes `qa/intersections.json`. The legs-vs-sheet failures and the left-lateral knee hyperextension are xfail, owned by M3.

**M0.5 `npm run test:visual`** (`playwright.visual.config.ts`)
- Viewports: 1440×900 for the full matrix, plus 1280×800 and 1180×820 for layout screens.
- Tour (fast and freeze modes):
  - corridor, placard, wash;
  - every shot × 6 positions × both sexes;
  - drape states;
  - every `DIALOG_IDS` opener;
  - PEN, results, coach list and coach detail.
- Screenshots go to `qa/screens/<vp>/<case>-<sex>/<area>/NN-<shot>__<position>__<drape>.png`, with a `manifest.json` of sha256 and metadata. PNGs are git-ignored; the manifest and `qa/REVIEW.md` are committed.
- `qa/REVIEW.md` has one row per PNG: sha, reviewed@commit, defects (id, severity, category), status.
- `qa:review-check` enforces that every PNG has a row with a matching sha and that no high-severity defect is open. Unchanged shas carry forward. About 260 PNGs per full pass.
- **The main agent opens each PNG with Read.** Sub-agents may pre-triage, but they only flag.

## M1 — no external LLM (`src/lang/`)

**Layout**

| Where it runs | Files |
|---|---|
| Both browser and server | `normalize.ts` (lowercase, contractions, numbers, `synonyms.json` longest-first, e.g. SOB→short of breath), `split.ts` (bundled questions → ≤5 clauses), `keywords.ts` (word-boundary phrase index), `negation.ts` (NegEx-lite), `question.ts` (open/closed), `embed/vectors.ts` |
| Server only | `bank.ts` (case intents + `content/lang/{conversation,history-bank,topics}.json`), `matcher.ts`, `patient.ts`, `grade/{match,pen,interpret}.ts`, `embed/node.ts`, `provider.ts`, `providers/{deterministic,anthropic-stub}.ts`, `thresholds.ts` |
| Browser only | `embed/browser.ts`, `webllm/{engine,rephrase,secondOpinion,guard}.ts` |

- Precomputed vectors live in `src/lang/generated/<caseId>.json` and `banks.json` as int8, base64. Each file carries a hash of model sha + normalizer version + texts.
- A staleness test recomputes that hash without loading the model.
- `npm run lang:embed` regenerates the vectors.

**Embedding model**
- `npm run lang:vendor` (run on prebuild, pretest and postinstall) copies the npm package's model and tokenizer, plus the onnxruntime-web wasm, into `public/lang/` (git-ignored).
- It verifies `CHECKSUM.json` plus a sha256 we pin, and runs a functional ordering test, since the upstream hash can't be checked from here.
- Licences are recorded in `public/lang/LICENSE.md` and `docs/ASSETS.md`.
- Loaded with `@huggingface/transformers` 4.3.1 (`allowRemoteModels=false`, local model path, q8, wasm, single thread) in the browser, and onnxruntime-node on the server.
- `next.config` adds `serverExternalPackages` and a client alias.
- Fallback if this misbehaves: our own WordPiece tokenizer plus ORT directly.

**Chat** (`src/server/chat.ts`; the route body gains an optional `embedding`)
- The browser lazy-loads the model on first chat focus or when idle. It sends the utterance vector `{model, dims:384, vector}` with each message.
- The server validates the model id, length and norm, and uses the vector only to pick which case fact to reveal.
- If the vector is missing (model still downloading), the server embeds as a fallback. **Grading always re-embeds on the server and never reads client data.**
- Pipeline per clause:
  1. Exact normalized paraphrase match.
  2. Keyword or pattern match.
  3. Cosine similarity: accept at ≥0.60 with a ≥0.04 margin. Recency and topic boosts help with follow-ups.
  4. Below threshold: ROS or history-bank intents get `negativeReply`; anything else gets `unknownReply`.
- Replies are case text, verbatim and deduplicated. `revealOnlyIfAsked:false` facts are volunteered one at a time on "anything else".
- Conversation basics come from the conversation bank, with `{patient.name}` and `{student.name}` placeholders. Empathy picks the `emotionCues` reply for the current emotion.
- Matches are logged as `say.match` and `patient_say.match`, redacted from the student.
- Courtesy tags: `regexTags` first. The model fallback is replaced by cosine to exemplars, with the matched sentence as evidence.

**Deterministic grading**
- `grade/match.ts` (communication and history coverage):
  - sentence-level candidates from the item's sources;
  - keyword or pattern hit, or best cosine to exemplars; counter-exemplars and penalties apply (jargon, "my attending will decide");
  - ≥0.70 gives credit, with a verbatim quote that is run through `verifyEvidence`;
  - [0.55, 0.70) gives `needs_review` with its best quote;
  - topic items credit history coverage from re-matched questions.
- `grade/pen.ts`:
  - term or cosine matching with polarity, so negatives must be negated in the note;
  - diagnoses matched against `acceptableDiagnoses` (synonyms or cosine) and penKey aliases; diagnoses that match nothing are listed for the coach;
  - `penCheck` switches to the word-boundary `mentions()`, which removes the "MI" in "minimal" false positive.
- `engine/feedback.ts` writes the summary, strengths and improvements from templates over the scores; `grader:"deterministic"`.
- `scripts/lang/calibrate.ts` runs over labelled transcripts. Targets: ≥90% agreement and ≤10% `needs_review`.

**Delete**
- `src/server/ai/*` (the wording guard moves into `webllm/guard.ts`) and `@anthropic-ai/sdk`.
- Turn and token caps, `hasAiBudget`, `recordUsage`, `emptyUsage`, `totalTokens`, `sessionTokens`.
- The coach Tokens column and the tokens element, and the "AI_MOCK is on" banner.
- The AI env vars, `AI_MOCK` in the configs, and `tests/patientPrompt.test.ts`.
- **Keep** the access-code gate and `rateLimit`.

**Rewrite**
- Tests: `grading`, `courtesyFlow`, `tags`, `scoring1b` and `repo`; also `scripts/seed.ts`.
- e2e keeps "catch my breath", "three pillows", the greet-by-name quote and `pen-dx-adhf`.
- The bundle test also asserts that no paraphrase or generated data appears in client chunks.
- No-network proof:
  - vitest setup throws on any non-localhost fetch;
  - `e2e/complete-<case>.spec.ts` blocks all off-host requests and asserts none were attempted.

**Tools and fixtures**
- `npm run case:paraphrases <caseId>` lists facts with fewer than 5 paraphrases, cross-fact collisions (cosine >0.9) and gaps in fixture coverage.
- `/dev/chat-tester` (coach role, dev or QA only, via `POST /api/dev/match`) shows the normalized text, clauses, top-5 matches with scores, the reply and the thresholds.
- `tests/fixtures/chat/<caseId>.json` has 60 questions with their expected targets (fact, negative, conversation, follow-up, unknown or multi). The test requires ≥90% and prints a confusion table.
- **Fixture authors must never see the paraphrases** (blind sub-agents), so the score isn't overfitted.

**WebLLM and stub**
- WebLLM is a dynamic import of `@mlc-ai/web-llm`, only when "Enhanced patient" is on and `navigator.gpu` exists.
- The download size is shown before loading.
- `rephrase` is display only: the log keeps canonical text. It has a 4 s timeout and a faithfulness guard (numbers, negations, content words, length).
- `secondOpinion` runs in the coach's browser on `needs_review` items and is advisory only.
- Tested with `FakeEngine`: success, timeout, error, and unfaithful output.
- `providers/anthropic.ts` is a stub (`available:false`, no SDK).

**Budget**
- Split the budget test into:
  - (a) station first-load JS + GLBs ≤15 MB;
  - (b) total static JS ≤15 MB;
  - (c) nothing under `/lang/*` is fetched before first chat or idle.
- The single-file demo artifact can't hold the 23 MB model. It uses keyword-only matching, or the model split into chunks.

**Docs:** rewrite `CLAUDE.md` invariants 1 and 5, the "Add a model call" recipe (becomes "Add a language feature"), README, `docs/CASE_AUTHORING.md` (intents, paraphrases, conversation, emotion, acceptable diagnoses) and `.env.example`.

## M2 — bug fixes (one commit each: test → proof on the parent commit → fix)

| # | Fix | Regression test |
|---|---|---|
| 1 Penlight | Beam centre = the ray hitting the eye proxy. A finding only within 0.6 cm (iris) of the correct pupil. Narrow cursor cone. Sweeping across both eyes logs both; a new `swinging_flashlight` maneuver; separate direct and consensual pupil response per eye. | `decidePlacement` at 1.2 cm gives no finding. A drag across both eyes gives 2 examines. |
| 2 Mastoid | Anchor recalibrated to behind and below the canal, as a skinned-vertex anchor. Hair and ear raycast proxies (so they can block). Rinne step `toleranceCm:2`. Ear shot moved posterolateral. | Mastoid–canal distance between 1.2 and 3.2 cm (today 5–5.8). The catalog xfail entries are cleared. |
| 3 Sink | Lathe basin ≥10 cm deep, faucet, soap/sanitizer and towel dispensers. Hands animate over the basin. | `objectState("sink-basin")` depth ≥0.08 m, and the hands sit inside the basin's footprint. |
| 4 Face shot | `face` shot ~40 cm in front of the eyes, fov 35. Pitch limits on every focus shot. During the eye exam the head doesn't turn or sway and the eyes look at a far target. | Shot distance and angle; pitch > 0; head yaw 0 while examining the eyes. |
| 5 Landmarks | **Skinned-vertex anchors** (MakeHuman vertex indices, barycentric weights, lift off the skin) with full skin blending. One generated rig file per model, from per-model calibration files. Picking uses a neutral exam pose, and proxies are baked from it. `/dev/anchors` uses the real `Patient3D` and fixes the trunk-angle mismatch. Precordial areas, PMI, lung zones, cuff site and reflex sites recalibrated. | For every anchor × position × model: within 3 mm of the skin, and anchor-to-landmark distance stays constant within ±5 mm across poses. |
| 6 Drapes | Fixed in M3 | Intersection xfail, owned by M3 |
| 7 Reflexes | `sitting_dangling` pose with animated pose transitions. Fix the left-lateral joint signs. Correct joint directions: patellar extends the knee, Achilles plantarflexes, triceps extends the elbow. Amplitude by grade 0–4+, with clonus (6 Hz decaying). Reflexes move to the tendon regions. Wrong position → muted jerk ×0.25, logged. New `ankle_clonus` maneuver. | Joint deltas have the right sign, the dangling geometry is right, and left lateral flexes. |
| 8 Stuck popup | M0.2 | Proven against `be1700b` |
| 9 BP cuff | `blood_pressure` sequence: wrap the cuff on `upper_arm` → support the arm → palpate the brachial artery → stethoscope over it → SVG aneroid gauge (inflate, deflate at 2–3 mmHg/s) → record. Korotkoff schedule from the case BP. The BP appears in Findings. Cuff on the forearm or too high is logged. | e2e: cuff at the oracle site, then the full sequence logs the case BP. Unit test of the Korotkoff schedule. |
| 10 abd_bruits (found by the harness) | The stethoscope hold asks which maneuver when several fit (remembers the last choice). | `holdCandidate` test; the catalog entry is cleared. |

## M3 — models, drapes, room

**Models** (`npm run assets:build`; `assets:patient` stays as an alias)
- Distinct bodies, built from MakeHuman targets (macro and universal; breast targets reachable on GitHub raw):
  - male, about 70: old, average muscle, heavier;
  - female, 30s–40s: young, female breast target, hips.
- MakeHuman hair and eyebrow assets aren't reachable (404), so **hair is procedural**: male short and grey, female shoulder-length shell. Eyebrows are painted.
- Same 57+2 bones and identity rest pose.
- **bpy cleanup** (`scripts/assets/blender/cleanup.py`, `python3 -I`):
  - mesh data only; never through Blender's glTF exporter, which re-orients bones;
  - merge by distance, remove loose and interior faces, report non-manifold, dissolve degenerate faces, recalculate normals, smooth weights at shoulders, hips and knees;
  - a MakeHuman vertex index attribute is kept, so anchors survive.
- gltf-transform: dedup, weld, prune, meshopt, then KTX2 via `ktx2-encoder` (WebP fallback, documented).
- `public/models/LICENSE.md` and `docs/ASSETS.md` are updated.

**Drapes**
- Skinned `drape_<section>` meshes offset 0.5–1 cm from the skin.
- Pre-shaped by our own offline Verlet relaxation per pose class, converted to morph targets, plus a `fold` morph. Fallback: offset shell plus fold morph.
- `MeshPhysicalMaterial` with sheen, and `ContactShadows`.
- Click a section to fold it (350 ms) or re-cover it; logged as `state_change {section, covered}`.
- Pelvis is never exposed (the server refuses). The female chest is per side and covered by default, and breast exam is prohibited on the door.
- `regions.json` `drapeSections` is filled; auto-expose is removed.

**Room**
- Fix intersections, floating props and z-fighting; real-world scale; a true hinge for the table head; warm 4000 K lighting with ACES tone mapping.

**Gate:** the M3 xfail entries are empty and every changed PNG has been reviewed.

## M4 — hide-findings mode and mistakes

**Hide findings**
- Chosen in CasePicker and shown as a chip.
- In hide mode, `redactForStudent` replaces `findingText` with a server-built `doneText` (e.g. "Auscultated mitral area, bell, left lateral decubitus") and keeps audio, visual and `response`.
- Findings with no stimulus show as "reported finding".
- Captions become neutral (`captionFor(spec,{reveal:false})`). Weber and Rinne lateralisation come from the patient's spoken response.
- Each finding gets an interpretation box (an `interpretation` action).
- Results gain a **Recognition** section, scored by `grade/interpret.ts`.
- New stimuli: edema pit dent, percussion and voice sounds, Korotkoff.
- `npm run qa:stimuli` lists key findings without a stimulus in `qa/REVIEW.md`.

**Mistakes**
- Rules live in `content/mistakes.json` (the 10 from the brief) plus per-case `Case.mistakes`.
- The pure function `src/engine/mistakes.ts` `detectMistakes()` runs after every append and on `enforceFlow`/tick (for idle-exposure rules). Each rule fires once.
- It appends a system `mistake` action with `alerted = alerts==="on" || (alerts==="default" && practice)`.
- `MistakeBadge`: a pulsing red "!" at the rule's anchor, with an expandable message and ✕.
- `audioEngine.ding()`: soft, gain 0.15, respects mute.
- Results gain a Mistakes section.
- A "comfort and privacy: re-covers after examining" item (rule `drapeDiscipline`) is added to each case's `peChecklist`.

## M5 — three new cases (main agent does the shared catalog and audio additions first)

**Shared additions**
- `vocal_resonance` uses the stethoscope with the voice generator; front and lateral zones added for fremitus, percussion and resonance.
- Percussion audio and `s2Intensity`.
- Sensation via `cotton_swab` and `pin` on `leg_medial`, `foot` and `foot_lateral`, with spoken responses.
- SLR gets a spoken response; carotid auscultation gets the radiated murmur.

**The cases**
- **`cap-rll-01`** (female, 30s): fever, productive cough, pleuritic pain. Right lower lobe consolidation: bronchial breath sounds, crackles, egophony, increased fremitus (reported), dullness.
- **`aortic-stenosis-01`** (male, 70s): exertional dyspnea, near-syncope. Grade 3 crescendo–decrescendo murmur at the right upper sternal border, radiating to the carotids; soft S2; delayed carotid upstroke (reported).
- **`s1-radiculopathy-01`** (female, 40s): back pain radiating down the left leg. Left Achilles reflex 1 (right 2); positive SLR at 40°; reduced lateral foot sensation; plantarflexion 4/5. Covers the dangling-leg reflexes, the fork and sensory testing.

**Each case includes:** door instructions with prohibited exams, vitals, intents with ≥5 paraphrases, follow-ups, emotion, conversation replies, `peChecklist`, `penKey` with terms, `acceptableDiagnoses`, time limits {15, 10}, a blind 60-question fixture, and a no-network e2e spec.

**Validator additions:** vitals ranges, key-finding stimuli, the link between diagnoses and the key, intents present, and fixture ≥90%. All cases join the catalog coverage test.

## M6 — UI polish
- `@theme` tokens: ink scale, calm teal accent, status colours, contrast ≥4.5:1, type scale 12/14/16/20/24, 4-pt spacing, radii, two elevations.
- **Top bar:** case, mode, findings chip, timer, settings popover (alerts, sound, quality, enhanced patient with its size), Leave room.
- **Layout:**
  - the 3D view is the hero;
  - chat in a collapsible left drawer; Findings and Notes tabs in a right drawer;
  - the door placard as a corridor overlay;
  - the current tool as a chip with ✕;
  - a floating cluster for bed, drape and hygiene, with the Actions menu as the keyboard route;
  - tooltips only on hover;
  - the action log moves to the coach view only, and e2e reads the QA log or the coach timeline.
- **Results:** verdict, then two domain cards, then sections, then items with evidence; then Recognition, Mistakes and the PEN review.
- The visual tour covers 1440×900, 1280×800 and 1180×820.

## Orchestration (ultracode)
- **The main agent alone** writes shared files: `schemas.ts`, `regions.json`, the catalog JSON, `session.ts`, `chat.ts`, `grading.ts`, `Station.tsx`, `Exam3DView.tsx`, `PatientModel`, `rig.ts`, the asset build and `xfail.json`.
- **Parallel workflow agents** take new-file work, using worktrees when they write in parallel:
  - the intersection checker, the visual tour and the review-check script;
  - dialog migrations per component;
  - per-case intents and paraphrases, synonyms and banks;
  - mark-sheet exemplars (65 items);
  - blind fixture authors;
  - WebLLM with its fake engine, and `/dev/chat-tester`;
  - pure modules for the M2 bugs;
  - the bpy script and the drape relaxer;
  - the mistake UI and the recognition grader;
  - one author per new case, each followed by an **independent adversarial clinical reviewer**;
  - the results page restyle;
  - screenshot pre-triage (flags only).
- Each milestone ends with an adversarial review workflow over the diff (correctness, invariants, security), then the QA gate.

## Verification
- `npm run qa`, the full gate described above.
- `qa/regressions/*.txt` for bugs 1–10.
- Chat fixtures ≥90% for HF and the 3 new cases.
- `complete-*.spec.ts` ×4 with off-host network blocked: communication and PEN grading with verified verbatim quotes.
- A hide-mode spec for each of the 4 cases.
- A mistakes spec: badge and ding in practice; silent but logged in exam and listed in results.
- `qa:review-check` green with no high defects, and every PNG opened by the main agent.
- The `PLAN-phase4.md` status table is updated.

## Risks
- **Skinned anchors and live-pose unification touch every 3D file.** Build them in Node first (`test:anchors`) and keep the existing API.
- **Drape relaxation.** Fallback is an offset shell plus fold morph; the intersection check decides.
- **Bone re-orientation by Blender's exporter.** Avoided by round-tripping mesh data only.
- **Catalog runtime and flakiness under SwiftShader.** Mitigated by the `settled` signal, the fast and freeze modes, shards and the Node pre-flight.
- **ORT in Next.js (wasm paths, server size).** Mitigated by externals; fallback is our own tokenizer plus ORT.
- **Model provenance.** Mitigated by the pinned sha256, the functional test and an open question.
- **AudioSpec params visible in devtools in hide mode.** Documented.
- **Review volume, about 260 PNGs per pass.** Mitigated by sha carry-forward.
- **Authoring volume and clinical accuracy.** Mitigated by sub-agents plus adversarial review plus the validator.
- **Procedural hair quality.** Recorded as a known limitation.

## Milestone status
| # | Milestone | Status |
|---|---|---|
| P | This plan | done |
| S | Schema changes | done |
| M0 | QA harness | done: catalog 946 checks (627 pass, 319 xfail owned by M2/M3/M6), anchors 1493 pass / 307 xfail, intersections 71 pass / 139 xfail, 163 screenshots reviewed (qa/REVIEW.md: 12 high defects open, owned by M2/M3) |
| M1 | No external LLM | done: chat fixtures HF 100% / screening 96%; grading calibration 94.0% agreement, 5.9% needs_review; no-network tests; in-browser embeddings e2e |
| M2 | Bug fixes 1–10 | done: nine fixed with proofs in qa/regressions (plus begin-race and the M2 review findings); bug 6 (legs through the drapes) belongs to M3 and stays open; no M2 xfail left; catalog 950 checks (911 pass, 39 xfail owned by M3/M6, 0 fail); anchors 1810 pass / 14 xfail (M3); 207 screenshots reviewed (qa/REVIEW.md, no open M2 defect); unit 330/330, e2e 13/13. The full `npm run qa` re-run was skipped: hackathon scope (see below) |
| M3 | Models, drapes, room | deferred (hackathon scope) |
| M4 | Hide findings and mistake alerts | done (hackathon scope): findings display chosen at start (CasePicker; fixed in `session.settings` and the session_start payload); in hide mode an exam with a sound or visual shows only what was done (`doneText`) and the student writes an `interpretation`, while text-only findings are still shown; neutral captions; results and coach pages gain Recognition (informational word match, `src/engine/recognition.ts`) and Mistakes sections; 5 global mistake rules in `content/mistakes.json` (same rule language as mark sheets, `src/engine/mistakes.ts`), alerted with a chime in practice and logged silently in exam; V-JUSTIFY fixed (diagnosis support counts only findings elicited in the encounter). Not built: new stimuli (percussion, voice, pit dent), `qa:stimuli`, idle-exposure rules, per-anchor badges (alerts sit above Findings). Unit 344/344, e2e smoke + hide-mistakes + dialogs + regressions green |
| M5 | Three new cases | planned |
| M6 | UI polish | deferred (hackathon scope) |

## Assets and sources
- Patient models: built in-repo from MakeHuman 1.x CC0 assets (base mesh hm08, default skeleton and weights, macrodetails/universal/breast targets) fetched from the makehumancommunity GitHub repository; cleaned with Blender as a Python module (`bpy`, GPL tool, not shipped). Hair is procedural (MakeHuman hair proxies are not reachable from the build environment).
- Sentence embeddings: `Xenova/all-MiniLM-L6-v2` quantized ONNX (Apache-2.0 upstream), vendored from the npm package `@ryanstark24/sfgraph-models` because huggingface.co is blocked here; pinned by sha256.
- Optional in-browser LLM: `@mlc-ai/web-llm` (Apache-2.0); the model weights download from the MLC/HF CDN only when a user enables "Enhanced patient".
- Room props, drapes, sounds: generated in code.

## Open questions
1. Intent thresholds (accept 0.60 with a 0.04 margin; grading credit 0.70, review 0.63 — raised from 0.55 after calibration, because MiniLM puts unrelated questions at 0.55–0.65). Who signs off, and are per-item overrides allowed (`match.thresholds` exists)?
2. Should WebLLM ship on the shared link? Considerations: size, HF CDN, model licence, WebGPU support, privacy.
3. Model sources: MiniLM from an npm mirror whose upstream hash can't be verified here; MakeHuman CC0 targets; procedural hair; MPFB2 not used.
4. Should exam mode ever show mistake alerts? Today the toggle can turn them on.
5. The 70% domain pass thresholds are still placeholders.
6. Should Recognition count toward the score, or stay informational?
7. Should mistakes cost points?
8. Neutral captions in hide mode reduce accessibility.
9. Is the AudioSpec leak acceptable for high-stakes exams?
10. Should the findings display be switchable mid-session in practice?
11. Commit the screenshots, or keep only the manifest and REVIEW?
12. Should Babinski become a drag path along the sole?
13. Should an exam through cover block the finding, or record it plus a mistake?
14. Keep the removed turn cap as an abuse limit?
15. Should faculty author or validate the fixtures and exemplars?
16. How should onnxruntime-node be hosted on serverless?
17. KTX2 vs WebP.
18. (M1) Mark-sheet items whose guidance has two parts ("summarise and ask if accurate", "announce and ask permission", parents and siblings) earn full credit from one matching sentence. Split them into separate items, or add a multi-part match spec?
19. (M1) "If relevant" items (sexual or travel history) need a per-case decision: `itemsNotApplicable` now switches an item off for a case (HF: sexual history). Who decides relevance for each case?
20. (M1) The history bank answers generic yes/no questions with the case's `negativeReply`; it only answers when nothing in the case matches. Should every new case review the bank topics it leaves unanswered (`notRelevantTopics`)?
21. (M1) No provider abstraction (`providers/anthropic-stub.ts`) was built: nothing plugs in beside the deterministic layer, and a stub would be dead code. Revisit if an external model is ever allowed back for advisory use.

### Hackathon scope (decided after M2)
The project is for a two-day hackathon, so the remaining work is cut to what shows in a demo, with light
checks (unit tests and a quick e2e before each commit; no full catalog/visual gate per milestone):
1. M4 — hide-findings mode and mistake alerts.
2. M5 — one or two new cases (S1 radiculopathy uses the new reflex and dangling-leg work; CAP or AS next).
M3 (rebuilt models, sectioned drapes) and M6 (UI polish) are deferred; their defects stay listed in
qa/REVIEW.md and qa/xfail.json.
