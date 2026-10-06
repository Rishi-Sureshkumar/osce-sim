# OSCE Simulator: build plan

## Goal
A deployable demo where a student can:
- complete the synthetic decompensated heart failure (HF) case end to end: hand hygiene, history, cardiovascular and pulmonary exam, then the differential;
- get scored feedback with quoted evidence.

A coach can then review that session and override scores. The codebase also has to let 9
people work in parallel with Claude Code without stepping on each other.

## Milestones
Each milestone leaves the app running and demoable. Each one is committed after the type
check and tests pass.

| # | Milestone | Scope | Status |
|---|---|---|---|
| M0 | Skeleton | Repo and config, Zod schemas (`src/domain/schemas.ts`), content loaders with schema and cross-reference validation, scripts (`typecheck`, `test`, `lint`, `validate`), `.env.example`, `CLAUDE.md`, this plan. Content: regions, full exam catalog (FCM #5–120), HF case, screening case, 3 mark sheets. | done |
| M1 | Exam engine, no AI | SVG body diagram: anterior and posterior views, plus head-and-neck, precordium and neuro sub-diagrams. Region → maneuver menu → "performed" visualisation (highlight and steps) → resolved finding in the Findings panel. Courtesy toolbar, live action log. Screening mode on the all-normal patient. Unit tests for finding resolution. | done |
| M2 | Case encounter and AI patient | Case picker, door sign, streaming patient chat that follows `unknownPolicy`, AI finding wording with raw-text fallback, differential and plan submission, session saved to the database. | done |
| M3 | Scoring and student feedback | Auto-rule interpreter, AI grading with verified evidence, a results page (score, evidence quotes, links to timeline timestamps), narrative summary. Tests for the interpreter and quote verification. | planned |
| M4 | Coach view | Session list; transcript and timeline view with exams and chat interleaved; override any score with the evidence beside it; override history; token usage. | planned |
| M5 | Ship | In-app feedback form (stored in the database), access-code gate, cost guards, Playwright smoke test of one full HF encounter with the model mocked, README deploy steps, seed script. | planned |

Out of scope for now, with interfaces only: voice input (`src/input/adapters/voice.ts`), the 3D model,
VR (`vr.ts`), and cases beyond HF and screening.

## File layout
```
content/
  catalog/regions.json              86 canonical regions (2D/3D/VR all map to these ids)
  catalog/maneuvers/<system>.json   general, cardiovascular, pulmonary, heent, abdominal, neuro, msk, skin
  cases/hf-decompensated-01.json    synthetic decompensated HFrEF encounter
  cases/screening-normal.json       synthetic all-normal patient for the full screening exam
  marksheets/exam-fcm1.json         FCM-1 framework items #1–120 (auto rules)
  marksheets/history-communication.json   communication checklist (AI-graded, with some not_assessable)
  marksheets/clinical-reasoning.json      summary / differential / plan (AI-graded against expectedDifferential)
src/domain/schemas.ts               TEAM CONTRACT
src/content/                        loadFromDisk (fs + Zod), validate (cross-refs), load (server cache, public views)
src/engine/                         resolveFinding, rules (single interpreter), evidence (quote check), scoring
src/input/adapters/                 click, text, toolbar (+ voice, vr stubs that throw NotImplemented)
src/server/ai/                      models.ts, client.ts, patient.ts, wording.ts, grader.ts, mock.ts
src/server/db/                      repo.ts (interface), pgRepo.ts (Drizzle), fileRepo.ts (local dev), schema.ts
src/server/                         session.ts (append + resolve), grading.ts, auth.ts, guards.ts
src/app/                            gate, home (case picker), station/[id], results/[id], coach, coach/[id], api/*
src/components/{common,body,station,results,coach}/
scripts/                            validate-content, seed, migrate, authoring/ (one-off content generators)
tests/                              vitest       e2e/   Playwright smoke test
drizzle/                            SQL migrations
```

## Workstreams (9 people, separate folders)

| # | Workstream | Owns | Day-2 ideas |
|---|---|---|---|
| 1 | Schemas and engine | `src/domain`, `src/engine`, `src/content`, `src/server/session.ts`, `tests/rules*`, `tests/resolve*` | Partial-credit rules, order rules across systems, schema migrations for new item types |
| 2 | Body diagram and regions | `src/components/body`, `content/catalog/regions.json` (with #1) | Nicer SVG art, hover tooltips, more zoom views (hands, eyes), then the 3D renderer on the same region ids |
| 3 | Exam catalog content: CV and pulm | `content/catalog/maneuvers/{cardiovascular,pulmonary,general}.json` | Heart/lung sound media (`demo.mediaUrl`), technique options (bell/diaphragm, positions) |
| 4 | Exam catalog content: other systems | `content/catalog/maneuvers/{heent,abdominal,neuro,msk,skin}.json` | Review normal findings with a clinician; add region-specific normals |
| 5 | Patient AI and prompts | `src/server/ai/patient.ts`, `src/server/ai/wording.ts`, `src/server/ai/mock.ts` | Persona tuning, red-team "leak the diagnosis" prompts, voice adapter |
| 6 | Scoring and mark sheets | `content/marksheets`, `src/server/ai/grader.ts`, `src/server/grading.ts`, `src/components/results` | Calibrate the grader against coach overrides; confirm the not-assessable list |
| 7 | Coach view | `src/app/coach`, `src/components/coach`, `src/app/api/coach` | Filters, CSV export, override analytics |
| 8 | Deploy, auth and cost guards | `src/middleware.ts`, `src/server/auth.ts`, `src/server/guards.ts`, `README.md`, Vercel/Neon setup | Per-user codes, spend dashboard |
| 9 | QA, demo script and HF case polish | `e2e/`, `content/cases/hf-decompensated-01.json`, `docs/DEMO.md` | Demo rehearsal, second case using `docs/CASE_AUTHORING.md` |

Shared-file rule: changes to `src/domain/schemas.ts` or `regions.json` need a heads-up to the team first (see `CLAUDE.md`).

## Decisions, assumptions and deviations from the brief
- **Next.js 15.5 (App Router)**, not 16. Next 16 is current, but 15 is the better-known
  target for 9 parallel agents. Upgrading later is mechanical.
- **Screening mode is a case** (`mode: "screening"`, `abnormalFindings: {}`). This gives one
  code path instead of a special case. The schema's `mode` enum adds `"screening"` alongside `"encounter"`.
- **Third mark sheet, `clinical-reasoning.json`**, for the summary, differential and plan. The communication
  checklist doesn't cover reasoning, and the definition of done needs differential feedback.
- **`Case.markSheetSections`** (optional) restricts a sheet to some sections per case. The HF
  case is a focused CV and respiratory encounter, so it's scored only on `exam-fcm1`'s courtesy, vitals,
  general, CV and pulmonary sections, not penalised for skipping neuro and MSK.
- **Vitals come from the case.** Catalog normal findings for vitals use `{vitals.hr}`-style
  placeholders that the engine fills deterministically. Cases override any normal text that would
  contradict them (e.g. respiratory effort).
- **Technique is scored, not enforced.** `requiresPositioning` never blocks an action in the
  UI. Mark-sheet `performedIn` rules check the patient's position at the time of the maneuver
  (e.g. JVP at 30°, bell at the apex in left lateral decubitus).
- **FCM #7–9 (blood pressure) are three maneuvers** (cuff, arm support, measurement), so their
  order can be scored. Maneuvers without a framework number (SpO2, temperature, hepatojugular reflux,
  perfusion, skin) have `fcmId: null`.
- **Models**: patient dialogue and grading use `claude-sonnet-5-5`; finding wording uses
  `claude-haiku-4-5-20251001` (`src/server/ai/models.ts`). Sonnet calls opt into the API's
  server-side refusal fallback (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`)
  so a rare false-positive safety decline is retried on another model, not shown as an error.
  The patient runs at `effort: "low"` for latency; the grader at `"medium"`.
- **The file store is local-dev only.** On Vercel, `DATABASE_URL` is required (the filesystem is read-only).
- **Rate limiting is in-memory, per server instance.** That's good enough for a hackathon demo; a shared store
  (e.g. Upstash) would be needed for real abuse protection.
- **`/source` is git-ignored.** The framework PDF and checklist must not be committed while
  copyright is open.

## Communication items defaulted to `not_assessable` (team to confirm)
In `content/marksheets/history-communication.json`:
- `remove-barriers`: sits down, breaks computer contact (body position and screen use aren't visible).
- `nonverbal-encourage`: nodding, silence, "um-hm" (not in a text transcript; voice might capture some of it).

In `content/marksheets/exam-fcm1.json`:
- `fcm-02-notes`: note-taking doesn't interfere with rapport.

Candidates the team might also move to `not_assessable`, currently AI-graded from the transcript:
- `comfort-privacy`: checks comfort, readiness and privacy.
- `respond-emotion`: shows empathy, but only verbal empathy is visible.

## Gaps
- No standalone OSCE mark sheet was available. The exam sheet is built from the FCM-1 framework
  items, and the history sheet from the communication checklist.
- `sourceText` is empty everywhere until copyright is cleared.

## Open questions
1. **Starting system**: we built CV and pulmonary in depth first, for the HF case. Confirm, or pick another system for case #2.
2. **Framework copyright**: can the FCM-1 text and illustrations be used in the app (internally? on a public link?). Until cleared, only item numbers and paraphrased labels are used.
3. **Not-assessable communication items**: confirm the list above; decide whether voice/VR should later make any of them assessable.
4. **Real-case permissions**: who can authorise real (de-identified) cases, and under what agreement? See `docs/CASE_AUTHORING.md`.
5. **Scoring scale**: the school sheets may use 0/1/2 or global ratings. We store a 0–1 fraction × weight per item. Confirm how coaches want it shown.
6. **Weights**: every exam item currently has weight 1 (reflexes 0.2 each). Should coaches weight critical items (e.g. hand hygiene) higher?
7. **Who sees what**: should students see `needs_review` items before a coach has looked at them?
