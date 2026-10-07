# OSCE Simulator — guide for Claude Code sessions

Web-based OSCE simulator. Students take a history from an AI patient, examine a patient
in a 3D exam room, present a differential, and get scored feedback against school
mark sheets. Coaches review sessions and override scores. Read `docs/PLAN.md` for milestones
and workstream ownership.

## Invariants — never violate

1. **Cases are the only source of truth for clinical facts.** The model never invents a
   finding, vital sign, lab or history fact. The AI has exactly three jobs: (a) voice the
   patient from case facts, (b) reword a structured finding, (c) grade `ai` mark-sheet items.
2. **Finding resolution is deterministic** (`src/engine/resolveFinding.ts`):
   `case.abnormalFindings[m][region] ?? case.abnormalFindings[m].default ?? catalog[m].normalFinding[region] ?? catalog[m].normalFinding.default`,
   then `{vitals.*}` placeholders are filled from the case. If AI wording fails, show the raw text.
3. **Every input becomes the same `Action`** (`src/domain/schemas.ts`). Clicks, chat, toolbar,
   voice and VR all go through `src/input/adapters/*` → `POST /api/sessions/[id]/actions`
   (or `/chat` for speech). The session log is append-only. UI, scoring and the coach timeline
   read only from the log. Nothing scores from UI state.
4. **Content is data.** Cases, mark sheets and the exam catalog are JSON in `/content`,
   validated by Zod. Adding a case, maneuver or mark-sheet item must never need a code change.
5. **The Anthropic API key is server-side only.** All model calls go through `src/server/ai/`.
   Never import that folder from a client component; never prefix env vars with `NEXT_PUBLIC_`.
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
npm run dev          # http://localhost:3000 (AI_MOCK=true and no DATABASE_URL = zero setup)
npm run typecheck    # tsc --noEmit
npm test             # vitest (engine, content validation, scoring, repo)
npm run lint
npm run validate     # schema + cross-reference check of /content
npm run e2e          # Playwright smoke test (builds + starts the app with AI_MOCK=true)
npm run check:copyright  # needs local /source/*.txt — flags 7-word runs copied from the framework
npm run seed         # writes a demo HF session (graded) into the configured store
npm run db:generate  # drizzle-kit: SQL migration from src/server/db/schema.ts
npm run db:migrate   # apply ./drizzle migrations to DATABASE_URL
```

Before every commit: `npm run validate && npm run typecheck && npm test && npm run lint`
(and `npm run check:copyright` if you touched content/UI text).

Env for tooling: `TEST_DATABASE_URL` (also runs the Postgres repo test), `FILE_STORE_PATH`
(file-store location; e2e uses `test-results/e2e-store.json`).

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
src/server/ai/                      the ONLY place that talks to Anthropic (models.ts, patient, wording, grader, mock)
src/server/db/                      Repo interface, Postgres (Drizzle) + file store
src/server/                         session service, auth, rate limit, cost guards
src/app/api/                        route handlers
src/app/(pages)                     gate, home, station, results, coach
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
- `scoring: "ai"` + `guidance` (what the grader looks for) + optional `mockKeywords` (used when AI_MOCK=true).
  Grader output must quote evidence; quotes are verified verbatim server-side, otherwise `needs_review`.
- `scoring: "not_assessable"` + `notAssessableReason`. Shown greyed out to coaches, never scored.

**Courtesy tags** — what the student says is tagged server-side in `src/server/tags.ts` (regex
first; `src/server/ai/tagger.ts` is the verified-quote model fallback). Add a phrasing there with a
test in `tests/tags.test.ts`. Tags are never accepted from the browser. Positioning tags must only
match requests, never symptom questions.

**Add an input method (voice / VR)** — implement the adapter in `src/input/adapters/` so it returns
`ActionInput`s and posts them like `click.ts` does. Do not touch the engine.

**Add a model call** — only inside `src/server/ai/`, with model ids from `src/server/ai/models.ts`,
a mock path for `AI_MOCK=true`, token usage recorded via `recordUsage`, and a raw-data fallback.

## Conventions

- TypeScript strict; `noUncheckedIndexedAccess` is on.
- Server-only modules import `"server-only"`.
- Keep components small and inside your workstream's folder. If you must edit a shared file
  (`schemas.ts`, `regions.json`, `src/server/session.ts`), say so in your PR description.
- Develop with `AI_MOCK=true` (default in `.env.example`) so building costs no API credit.
