# OSCE Simulator

> **Educational prototype. Synthetic cases. Not for clinical use.**

A web-based OSCE station simulator for medical students:
- take a history from an AI patient;
- examine a clickable patient, front and back, with head-and-neck, precordium and neuro zoom views;
- present a summary, differential and plan;
- get feedback scored against the school's mark sheets.

Coaches review every session's timeline and can override any score.

- Team guide for Claude Code sessions: [`CLAUDE.md`](CLAUDE.md)
- Milestones, workstreams, decisions and open questions: [`docs/PLAN.md`](docs/PLAN.md)
- Adding cases safely: [`docs/CASE_AUTHORING.md`](docs/CASE_AUTHORING.md)

## Run locally (no API key, no database)

```bash
npm install
cp .env.example .env.local     # AI_MOCK=true; leave DATABASE_URL empty
npm run dev                    # http://localhost:3000
```

- **Access codes:** if `ACCESS_CODE`, `COACH_ACCESS_CODE` and `AUTH_SECRET` are all unset, local dev
  is open and coach pages work without a code. Set all three to try the gate.
- **Storage:** without `DATABASE_URL`, sessions are stored in `.data/store.json`.
- **`npm run seed`** adds a graded demo session, so the coach view has something to show.
- **Real AI:** set `AI_MOCK=false` and `ANTHROPIC_API_KEY=...`. The key is used server-side only.

## Checks

```bash
npm run validate        # content schemas + cross-references
npm run typecheck
npm test                # unit tests (set TEST_DATABASE_URL to also run the Postgres repo test)
npm run lint
npm run e2e             # builds, starts with AI_MOCK=true, runs the full HF encounter + coach override
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
   | `ANTHROPIC_API_KEY` | an Anthropic Console API key. This is separate from Claude Max plans, and the Console bills it. |
   | `AI_MOCK` | `false` for the real demo, `true` for a free preview deployment |
   | cost guards (optional) | `MAX_PATIENT_TURNS`, `PATIENT_MAX_OUTPUT_TOKENS`, `GRADER_MAX_OUTPUT_TOKENS`, `MAX_SESSION_TOKENS`, `RATE_LIMIT_PER_MINUTE` (see `.env.example`) |

   Without the access-code variables, a production deployment **fails closed**: every page asks for a
   code, and none is accepted.
5. **Deploy.** Every push to `main` redeploys. Share the URL and the student code. Coaches use `/coach`.
6. **Spend limit.** Set a monthly spend limit on the API key in the Anthropic Console. Token usage per
   session is shown in the coach view.

### Cost and safety guards
- The whole app sits behind the access code. Coach pages and APIs need the coach code. No model call is reachable without a code.
- **Per session:** patient turns are capped (`MAX_PATIENT_TURNS`) and so are total tokens (`MAX_SESSION_TOKENS`).
  Output tokens are capped per call. Grading runs once per session for students; coaches can re-run it.
- **Per IP:** API routes are rate-limited (in memory, per server instance).
- **Prompt caching:** the patient's rules and case are cached between turns.
- **Free development:** `AI_MOCK=true` gives deterministic canned responses, so the team can build without API spend.

## Models

These are set in `src/server/ai/models.ts`:
- Patient and grader: `claude-sonnet-5-5`
- Finding wording: `claude-haiku-4-5-20251001`

Sonnet requests opt into server-side refusal fallback (`fallbacks: "default"`).
