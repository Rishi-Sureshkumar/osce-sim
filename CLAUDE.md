# OSCE Simulator — guide for Claude Code sessions

Web-based OSCE simulator. Students take a history from a simulated patient (deterministic, offline), examine a patient
in a 3D exam room, present a differential, and get scored feedback against school
mark sheets. Coaches review sessions and override scores. Read `docs/PLAN.md` for milestones
and workstream ownership.

## Invariants — never violate

1. **Cases are the only source of truth for clinical facts, and no model decides anything.** There is no
   external LLM. The patient's replies are case (or conversation-bank) text chosen deterministically by
   `src/lang`; grading is the rules interpreter plus deterministic matching (`src/lang/grade`, verbatim
   quotes). The optional in-browser WebLLM (`src/lang/webllm`, off by default) may only reword text that
   was already chosen, for display; the log keeps the original. Nothing invents a finding, vital or fact.
2. **Finding resolution is deterministic** (`src/engine/resolveFinding.ts`):
   `case.abnormalFindings[m][region] ?? case.abnormalFindings[m].default ?? catalog[m].normalFinding[region] ?? catalog[m].normalFinding.default`,
   then `{vitals.*}` placeholders are filled from the case. If AI wording fails, show the raw text.
3. **Every input becomes the same `Action`** (`src/domain/schemas.ts`). Clicks, chat, toolbar,
   voice and VR all go through `src/input/adapters/*` → `POST /api/sessions/[id]/actions`
   (or `/chat` for speech). The session log is append-only. UI, scoring and the coach timeline
   read only from the log. Nothing scores from UI state.
4. **Content is data.** Cases, mark sheets and the exam catalog are JSON in `/content`,
   validated by Zod. Adding a case, maneuver or mark-sheet item must never need a code change.
5. **No external service; matching data stays on the server.** The sentence-embedding model is vendored
   (`npm run lang:vendor`) and runs in the browser (only to help pick a reply) and on the server (always
   re-embeds for grading — client vectors are never trusted for scores). Case facts, paraphrase banks and
   phrase vectors (`src/lang/generated`) never reach the browser: don't import `src/lang/server.ts`,
   `src/lang/tags.ts`, `src/lang/bank.ts` or `src/lang/grade` from a client component; never prefix env vars with `NEXT_PUBLIC_`.
6. **Region ids are canonical and stable** (`content/catalog/regions.json`). The 3D room (and any
   future VR renderer) maps to the same `regionId` strings; each region has a `group` (focus shot /
   menu grouping). Never rename or delete one; add new ones instead (retired ids get `hidden: true`).
   The app is 3D-only; the keyboard "Examine…" menu (`src/exam3d/ExamineMenu.tsx`) is the non-visual route.
7. **Copyright:** the FCM-1 framework is not cleared. Use `fcmId` numbers and our own short
   labels. Never paste framework text into the repo or UI. `sourceText` fields stay `""`.
   `/source` is git-ignored — never commit it.
8. **Log order is `orderLog()` (t, then seq)** — `src/engine/order.ts`. Never rely on array position.
   Sounds come from finding data (`audio`), never from a model.
9. **The browser never receives a full case.** Use `toPublicCase()`; history facts, abnormal
   findings and the expected differential stay on the server.

## Commands

```bash
npm run dev          # http://localhost:3000 (no DATABASE_URL = zero setup; no API key needed)
npm run typecheck    # tsc --noEmit
npm test             # vitest (engine, content validation, scoring, repo)
npm run lint
npm run validate     # schema + cross-reference check of /content
npm run e2e          # Playwright smoke test (builds + starts the app)
npm run check:copyright  # needs local /source/*.txt — flags 7-word runs copied from the framework
npm run seed         # writes a demo HF session (graded) into the configured store
npm run db:generate  # drizzle-kit: SQL migration from src/server/db/schema.ts
npm run db:migrate   # apply ./drizzle migrations to DATABASE_URL
npm run lang:vendor  # copy the MiniLM model + onnxruntime wasm into public/lang (pinned sha256; runs on install/test/build)
npm run lang:embed   # regenerate src/lang/generated phrase vectors after changing intents or banks
npm run lang:eval    # chat fixtures accuracy (tests/fixtures/chat; --verbose shows misses)
npm run lang:calibrate   # grading vs labelled transcripts (tests/fixtures/grading)
npm run case:paraphrases <caseId>  # thin intents, colliding paraphrases, fixture gaps
npm run qa           # full QA gate: validate, typecheck, lint, test, anchors, intersections, catalog, visual, e2e, review-check
```

Before every commit: `npm run validate && npm run typecheck && npm test && npm run lint`
(and `npm run check:copyright` if you touched content/UI text).

Env for tooling: `TEST_DATABASE_URL` (also runs the Postgres repo test), `FILE_STORE_PATH`
(file-store location; e2e uses `test-results/e2e-store.json`), `ENCOUNTER_SECONDS_OVERRIDE` /
`PEN_SECONDS_OVERRIDE` (shorten the 1B encounter and note clocks in tests).

## Folder map (each workstream owns its folders — see docs/PLAN.md)

```
content/catalog/regions.json        canonical regions (schemas+engine owner approves changes)
content/catalog/maneuvers/*.json    exam catalog, one file per system
content/cases/*.json                cases (synthetic: true)
content/marksheets/*.json           mark sheets (auto rules / ai items / not_assessable)
src/domain/schemas.ts               TEAM CONTRACT (Zod) — heads-up to the team before changing
src/content/                        loaders + cross-reference validation
src/engine/                         pure TS: resolveFinding, rules interpreter, evidence check, scoring
src/input/adapters/                 click / text / toolbar → Action (+ tool, voice; vr is a stub)
src/lang/                           deterministic language layer: normalise/split, bank + matcher, patient replies, grade/, embed/, webllm/
src/server/db/                      Repo interface, Postgres (Drizzle) + file store
src/server/                         session service, chat, grading, auth, rate limit
src/app/api/                        route handlers
src/app/(pages)                     gate, home, station, results, coach
src/scene/                          rigged patient (PatientModel, rig.ts pose maths, patientRig.generated.ts), room/ props, quality
src/exam3d/                         3D exam view, hidden anchors (anchorDefs.ts → regionAnchors.ts), tools, camera, Examine… menu
scripts/assets/build-patient.ts     builds public/models/patient*.glb from MakeHuman CC0 (npm run assets:patient); see docs/ASSETS.md
src/components/station/             door, encounter bar (sanitise / bed / drape / Actions menu), chat, findings, log, maneuver menu, submit dialog
src/components/results/, coach/     results and coach UI
tests/                              vitest; e2e/ Playwright
```

## How to…

**Add a maneuver** — add an object to the right `content/catalog/maneuvers/<system>.json`:
`id` (snake_case, unique), `fcmId` (framework number or `null`; never guess), `label` (own words),
`system`, `technique`, `allowedRegions` (existing region ids), optional `requiresPositioning`,
`normalFinding.default` (+ optional per-region keys), `demo.steps` (own words), `sourceText: ""`.
Run `npm run validate`. No code change needed; it appears in the menu for its regions.

**Phase-2 maneuver fields** (all optional): `interaction` (`click|place|sequence|drag_path`), `tool`,
`toolMode` (`bell|diaphragm|128|512`), `steps` (for sequences, with 3D `landmark` names), `touch`
(defaults to true unless technique is `inspect`). Finding values may be plain text or
`{ text, audio?, visual?, byPosition? }` — e.g. an S3 under `auscultate_heart_bell.cardiac_mitral` with
`audio: { generator: "heart", params: { s3: 0.6 } }` and a louder `byPosition.left_lateral_decubitus`.

**Sounds** are data: `audio: { generator: "heart" | "breath" | "tone", params }` (see `AudioSpec`) or
`{ clipId }` for a recorded clip listed with source + license in `public/audio/manifest.json`. The pure
schedules in `src/audio/schedule.ts` are unit-tested; `src/audio/engine.ts` plays them.

**Add a case** — copy `content/cases/hf-decompensated-01.json`, keep `synthetic: true`, and follow
`docs/CASE_AUTHORING.md` (including the de-identification checklist for anything based on a real
patient). Only list *abnormal* findings; everything else falls back to the catalog's normals.
Use `{vitals.hr}`-style placeholders only in the catalog; in a case, override any normal text that
would contradict the case (e.g. "unlaboured" breathing).

**Add a mark-sheet item** — add to `content/marksheets/<sheet>.json`:
- `scoring: "auto"` + a `rule` (see the Rule type in schemas.ts: `performed`, `courtesy`, `before`,
  `performedIn`, `submitted`, `said` (courtesy tags), `technique` (tool/mode/placement/duration/position),
  `hygieneBeforeTouch`, `happened` (any event ref, e.g. `room:exit`, `drape:cover`, `tag:closing`), `all`, `any`, `not`). Add `modes: ["exam"]` for time-dependent items. The single interpreter is `src/engine/rules.ts`;
  never write per-item code.
- `scoring: "match"` + `guidance` (what earns credit, for coaches) + a `match` spec: `sources`, `keywords`,
  `patterns`, `exemplars` / `counterExemplars` (similarity), `topics` (history coverage), `form`, `window`,
  `minMatches`, `penalties`. Credit quotes the student's own sentence verbatim; similarity in the review band
  gives `needs_review`. Re-run `npm run lang:calibrate` after changing specs (targets: ≥ 90% agreement, ≤ 10% review).
  A case can switch an item off with `itemsNotApplicable` (shown greyed, never scored).
- `scoring: "not_assessable"` + `notAssessableReason`. Shown greyed out to coaches, never scored.

**1B scoring** — every mark sheet has a `domain` (`patient_encounter` | `communication`) and a `passThreshold`;
the station passes only when both domains pass (`domainTotals` in `src/engine/scoring.ts`). A case adds its own
SP exam checklist (`peChecklist`) and post-encounter note key (`penKey`); `src/engine/penItems.ts` turns them
into sheets at grading time, so a new case needs no code. Give maneuvers `penTerms` (words a note uses for
their findings) so `src/engine/penCheck.ts` can flag note claims about exams that were never performed.
Item ids must be unique across all of a case's sheets (`npm run validate` checks).

**Courtesy tags** — what the student says is tagged server-side in `src/server/tags.ts` (regex
first; `src/lang/tags.ts` falls back to similarity with example phrasings). Add a phrasing there with a
test in `tests/tags.test.ts`. Tags are never accepted from the browser. Positioning tags must only
match requests, never symptom questions.

**Add an input method (voice / VR)** — implement the adapter in `src/input/adapters/` so it returns
`ActionInput`s and posts them like `click.ts` does. Do not touch the engine.

**Add a language feature** — keep it deterministic and inside `src/lang/` (pure modules, data in
`content/lang/` or the case). New history facts need `intents` (canonical + ≥ 5 paraphrases + keywords/topics);
run `npm run lang:embed`, `npm run case:paraphrases <caseId>` and keep the chat fixtures ≥ 90%. Thresholds live in
`src/lang/thresholds.ts`. A WebLLM use may only reword already-chosen text behind the faithfulness guard
(`src/lang/webllm/guard.ts`) and must be tested with `FakeEngine`.

## Conventions

- TypeScript strict; `noUncheckedIndexedAccess` is on.
- Server-only modules import `"server-only"`.
- Keep components small and inside your workstream's folder. If you must edit a shared file
  (`schemas.ts`, `regions.json`, `src/server/session.ts`), say so in your PR description.
- Tests may not reach the network (`tests/setup/no-network.ts`); the app needs no external service at all.
