# OSCE Simulator

> **Educational prototype. Synthetic cases. Not for clinical use.**

A web-based OSCE station simulator for medical students:
- take a history from a simulated patient (deterministic and offline: no external AI service or API key);
- examine a patient in a 3D exam room with real tools (stethoscope, penlight, hammer, tuning fork, BP cuff);
- present a summary, differential and plan;
- get feedback scored against the school's mark sheets.

Coaches review every session's timeline and can override any score.

- Team guide for Claude Code sessions: [`CLAUDE.md`](CLAUDE.md)
- Milestones, workstreams, decisions and open questions: [`docs/PLAN.md`](docs/PLAN.md), Phase 4: [`docs/PLAN-phase4.md`](docs/PLAN-phase4.md)
- Adding cases safely: [`docs/CASE_AUTHORING.md`](docs/CASE_AUTHORING.md)

## Run locally (no API key, no database)

```bash
npm install
cp .env.example .env.local     # leave DATABASE_URL empty
npm run dev                    # http://localhost:3000
```

- **Access codes:** if `ACCESS_CODE`, `COACH_ACCESS_CODE` and `AUTH_SECRET` are all unset, local dev
  is open and coach pages work without a code. Set all three to try the gate.
- **Storage:** without `DATABASE_URL`, sessions are stored in `.data/store.json`.
- **`npm run seed`** adds a graded demo session, so the coach view has something to show.
- **Language model files:** `npm install` vendors the sentence-embedding model (MiniLM, ~23 MB) and the
  onnxruntime wasm into `public/lang/` (`npm run lang:vendor`, sha256-pinned). The browser loads them only
  when the student first uses chat; until then, and for all grading, the server embeds.

## Checks

```bash
npm run validate        # content schemas + cross-references
npm run typecheck
npm test                # unit tests (set TEST_DATABASE_URL to also run the Postgres repo test)
npm run lint
npm run e2e             # builds, starts the app, runs the full HF encounter + coach override
npm run qa              # the full QA gate (catalog, intersections, visual tour + review check, e2e)
npm run check:copyright # needs local /source/*.txt; flags text copied from the framework
```

## Deploy to Vercel (with Neon / Vercel Postgres)

1. **Database.** Create a Postgres database (Vercel → Storage → Neon, or neon.tech directly) and copy
   its connection string.
2. **Schema.** Apply it once from your machine:
   ```bash
   DATABASE_URL="postgres://…" npm run db:migrate
   DATABASE_URL="postgres://…" npm run seed      # optional demo session
   ```
3. **Vercel project.** Import the GitHub repo in Vercel (framework preset: Next.js; the defaults are fine).
4. **Environment variables** (Project → Settings → Environment Variables, Production and Preview):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the Postgres connection string (required on Vercel) |
   | `ACCESS_CODE` | code you give students |
   | `COACH_ACCESS_CODE` | code you give coaches (it also works for the student pages) |
   | `AUTH_SECRET` | output of `openssl rand -hex 32` |
   | `RATE_LIMIT_PER_MINUTE` (optional) | per-IP API rate limit (default 60) |

   Without the access-code variables, a production deployment **fails closed**: every page asks for a
   code, and none is accepted.
5. **Deploy.** Every push to `main` redeploys. Share the URL and the student code. Coaches use `/coach`.
6. **Server runtime.** Grading embeds on the server with `onnxruntime-node` (a native module, listed in
   `serverExternalPackages`). If your host can't run it, chat still works (keywords, or the browser's
   vectors) and grading falls back to keywords and patterns; see the open question in `docs/PLAN-phase4.md`.

### Safety guards
- The whole app sits behind the access code. Coach pages and APIs need the coach code.
- Grading runs once per session for students; coaches can re-run it.
- **Per IP:** API routes are rate-limited (in memory, per server instance).
- Nothing is sent to an external service: no API key, no per-use cost.

## Language layer (no external model)

- **Patient:** each question is normalised, split into clauses and matched to the case's facts, pertinent
  negatives, follow-ups or the conversation bank (exact phrase → keywords/patterns → MiniLM similarity,
  thresholds in `src/lang/thresholds.ts`). The reply is always the case's own text.
- **Grading:** `auto` items by the rules interpreter; `match` items by keywords, patterns, exemplar similarity
  and history topics, quoting the student's sentence verbatim (borderline similarity → `needs_review`).
- **Optional:** "Enhanced patient" (WebLLM, WebGPU only, off by default) rewords the chosen reply for display;
  a faithfulness guard rejects any change to numbers, sides or negations. Coaches can ask it for an advisory
  second opinion on needs-review items. It never changes a score.
- Embedding model: `Xenova/all-MiniLM-L6-v2` (q8, Apache-2.0), see `docs/ASSETS.md`.
