# OSCE Simulator — Project Plan

A browser-based OSCE station simulator. The student takes a history, examines an
interactive patient from head to toe, presents a summary, and gets feedback scored
against **our school's own mark sheets**.

**Constraints:** 9 people, 2 days, built mostly with Claude Code (9 Max accounts). We
want a deployed link we can hand to our coaches for feedback.

---

## 1. Core design decisions

### 1.1 The case file is the source of truth
The LLM **never invents exam findings**. Each case is an authored JSON file that
defines what is true about the patient. The LLM only:
1. **Role-plays the patient** in history taking, limited to the case's history facts.
2. **Narrates findings** in natural language from the structured findings.
3. **Grades and gives feedback** against the mark sheet.

### 1.2 Everything the student does is an `Action`
Clicks, typed chat, and later voice and VR all produce the same `Action` objects. These go
into one timestamped **event log**, which drives both the findings panel and the grader.

```ts
type Action =
  | { kind: "procedure"; id: ProcedureId }          // wash hands, introduce, consent, position 45°, expose, chaperone...
  | { kind: "ask"; text: string }                   // history question (free text / speech)
  | { kind: "exam"; id: ExamId }                    // e.g. "cvs.auscultation.mitral"
  | { kind: "order"; id: InvestigationId }
  | { kind: "present"; summary: string; ddx: string[]; plan: string };
```

`procedure` matters for real mark sheets. A lot of marks come from hand hygiene,
introductions, consent, positioning, exposure and thanking the patient, which a body
click can't capture. These get a toolbar of "procedure" buttons (or voice).

### 1.3 Mark sheets are data, not code
School mark sheets are converted into a rubric JSON once (Claude can draft this from
a PDF or photo, and a human checks it). Each item states **how it is evidenced**:

```jsonc
{
  "id": "cvs-exam-v1",
  "title": "Cardiovascular Examination",
  "scale": { "0": "Not done", "1": "Attempted / partial", "2": "Done well" },
  "sections": [
    { "title": "Introduction", "items": [
      { "id": "hh",      "text": "Washes hands",            "evidence": { "type": "action", "any": ["procedure.hand_hygiene"] } },
      { "id": "consent", "text": "Obtains consent",         "evidence": { "type": "transcript" } }   // LLM-judged
    ]},
    { "title": "Examination", "items": [
      { "id": "jvp",  "text": "Assesses JVP at 45°",        "evidence": { "type": "action", "all": ["procedure.position_45", "cvs.neck.jvp"], "ordered": true } },
      { "id": "ausc", "text": "Auscultates 4 valve areas",  "evidence": { "type": "action", "all": ["cvs.auscultation.aortic","cvs.auscultation.pulmonary","cvs.auscultation.tricuspid","cvs.auscultation.mitral"] } }
    ]},
    { "title": "Presentation", "items": [
      { "id": "ddx",  "text": "Sensible differential",      "evidence": { "type": "presentation" } }  // LLM-judged
    ]}
  ],
  "globalRating": ["Clear fail", "Borderline", "Clear pass", "Excellent"]
}
```

- `action` items are scored **deterministically** from the event log, including order
  where it matters (e.g. inspect → palpate → percuss → auscultate).
- `transcript` and `presentation` items are scored by the LLM. It must quote the evidence
  (the student's words), so coaches can audit each score.

### 1.4 Full head-to-toe exam catalog
There is one shared catalog of every exam with a **default normal finding**. Cases only
override the abnormal findings. IDs follow `system.region.maneuver[.site]`:

| System | Coverage |
|---|---|
| General | end-of-bed inspection, vitals, hands/nails, hydration |
| HEENT | pupils, fundoscopy, otoscopy, oropharynx, lymph nodes, thyroid |
| CVS | radial/brachial/carotid pulses, JVP, apex, heaves/thrills, 4 valve areas (+ manoeuvres), sacral/ankle oedema, peripheral pulses |
| Resp | inspection, trachea, expansion, percussion, tactile fremitus/vocal resonance, auscultation by zone (front/back) |
| Abdo | inspection, auscultation, light/deep palpation by quadrant, liver/spleen/kidneys, percussion, shifting dullness, special tests (Murphy's, McBurney's, Rovsing's, rebound) |
| Neuro | cranial nerves I–XII, tone, power, reflexes, sensation, coordination, gait |
| MSK | look/feel/move/special tests per joint (stretch: knee, shoulder, hip) |

The **clinical content team** writes this catalog in week-1 quality: normal findings
phrased the way our school teaches them.

### 1.5 Real cases and privacy
If we get access to real cases, they must be **fully de-identified before they go
into the repo or to the API**: no names, dates, MRNs or locations. Ideally use teaching
cases rather than patient records. Get permission from whoever provides them.

### 1.6 API billing ≠ Max plans
The 9 Max subscriptions cover **Claude Code for building**. The app itself calls the
Claude API at runtime for the patient chat and grading, and that needs a separate
**Anthropic Console API key with credits**. Set one up on day 0 and put a spend limit
on it. (Hackathon usage should be cheap. A fast model handles the patient and a
stronger one handles the end-of-station grading.)

---

## 2. Architecture

```
┌──────────────────── Next.js app (TypeScript) ────────────────────┐
│ Door card + timer │ Patient view │ Chat/voice │ Findings │ Report │
│                   │ (SVG → 3D)   │            │  panel   │        │
└─────────┬────────────────────────────────────────────────────────┘
          │ Action
          ▼
   /api/action ──► Case engine (catalog + case lookup, no LLM)
          │    └─► Patient agent (Claude, history only, streamed)
          ▼
     Event log ──► /api/grade ──► Rubric engine (deterministic items)
                                └► Grader agent (Claude, transcript/presentation items)
```

- **Stack:** Next.js + TS + Tailwind, `zod` schemas for case/rubric/catalog, Anthropic SDK.
- **Patient view:** SVG body map first (front/back, zoomable regions). Then
  `react-three-fiber` 3D with the **same region IDs**. Then WebXR (`@react-three/xr`).
- **Storage:** JSON files in the repo for content; SQLite or a simple store for sessions/reports.
- **Deploy:** Vercel (or similar) from `main`, so coaches always have a live link.

### Repo layout (each workstream owns a folder → fewer merge conflicts)
```
/content/catalog/*.json      exam catalog (clinical team)
/content/cases/*.json        cases (clinical team)
/content/rubrics/*.json      mark sheets (clinical team)
/src/schema/                 zod types — OWNED BY LEAD, changes via PR review only
/src/engine/                 case engine, rubric engine (pure TS, unit tested)
/src/agents/                 patient + grader + voice-intent prompts
/src/app/station/            station UI
/src/app/report/             feedback report UI
/src/app/faculty/            coach view
/src/patient-view/svg|3d|xr  interchangeable patient renderers
```

---

## 3. Team of 9 — workstreams

| # | Role | Owns | Day 1 deliverable | Day 2 deliverable |
|---|---|---|---|---|
| 1 | **Lead / integrator** | `src/schema`, CLAUDE.md, CI, merges, demo script | Schemas + skeleton by ~11:00; first end-to-end by evening | Integration, bug triage, demo rehearsal |
| 2 | **Station UI** | door card, timer, procedure toolbar, chat, findings panel | Working station shell | Polish, accessibility, responsive |
| 3 | **Patient view (2D)** | SVG body map, region → exam menu, exam "animation"/narration overlay | All systems clickable | Zoom views (hands, eyes, chest zones), media (sounds/images) |
| 4 | **Engines** | case engine + rubric engine + tests | Deterministic scoring works | Ordering rules, edge cases, perf |
| 5 | **AI: patient** | patient agent, guardrails (no diagnosis leaks, stays in character) | Realistic history for case #1 | Personas/affect, voice-intent → Action tool calls |
| 6 | **AI: grader + report** | grader agent, report page | Report with scores + evidence quotes | Narrative feedback, "why it matters", timeline replay |
| 7 | **Clinical content A** | exam catalog (all systems), mark sheet → rubric | Catalog for CVS/Resp/Abdo + 1 rubric | Neuro/MSK/HEENT + remaining rubrics |
| 8 | **Clinical content B** | cases, de-identification, clinical review | Case #1 fully authored | 3–5 cases total across systems |
| 9 | **Stretch: voice → 3D/XR** | STT/TTS, then 3D renderer | Voice in/out working on station | 3D patient (same region IDs), XR if time |

Medical students without much coding experience fit roles 7–8 well. They can still use
Claude Code to draft JSON, which the `zod` schemas and tests validate automatically.

---

## 4. Two-day timeline

**Day 0 (before the hackathon, ~1 hr):** create the repo and API key with a spend limit,
set up a Vercel project, get one mark sheet as a PDF, pick case #1, and give everyone their role.

**Day 1**
| Time | Milestone |
|---|---|
| 09:00–11:00 | **Contracts first.** Lead + Claude write `src/schema` (Action, Case, Catalog, Rubric, EventLog), CLAUDE.md, and the skeleton app with stub endpoints. Content team starts the catalog + case #1 + rubric in parallel. Nobody else touches shared types after this without review. |
| 11:00–17:00 | Parallel build. Small PRs, merge to `main` often, CI on every PR (typecheck, unit tests, schema validation of all content). |
| 17:00–19:00 | **M1 integration:** door card → history → full exam → present → report, for case #1. |
| Evening | Fix what integration broke. Voice prototype. |

**Day 2**
| Time | Milestone |
|---|---|
| 09:00–13:00 | More cases and rubrics, report quality, media, 3D renderer. |
| 13:00–15:00 | **Coach-ready build:** faculty view, feedback button, deployed link. Run a dry run with a teammate as the "student". |
| 15:00 | **Feature freeze.** Bug fixes only. |
| 15:00–17:00 | Demo rehearsal (two runs, one good student and one weak), backup video recording. |

---

## 5. Making 9 parallel Claude Code sessions work
- **CLAUDE.md at the root**: architecture, folder ownership, "never edit `src/schema`
  without the lead", commands (`npm run dev/test/validate`), and the "LLM never invents
  findings" rule.
- **Contracts before code.** Agents work best against fixed types. Merge the schemas first.
- **One branch per person or task, small PRs**, rebased often. Protect `main` and require CI to pass.
- **Content validation script** (`npm run validate`) checks every case and rubric
  against the schema and checks that every referenced `ExamId` exists in the catalog. This catches
  content errors before they reach the demo.
- **Fixtures**: a recorded "golden" event log for case #1, so UI and grader work can
  proceed without the live AI chat.
- Use `/code-review` before merging larger PRs.

---

## 6. Coach-facing features (for feedback)
- **Deployed link** with a case picker. No login needed, or a single shared passcode.
- **Faculty view:** see a session's full transcript and timeline, the auto-scores next
  to the evidence, and **override any score** with a comment. Overrides are logged, so we can
  measure where the grader disagrees with coaches.
- **In-app feedback form** on the report page ("Was this score fair?", free text).
- **Case/rubric viewer** so coaches can review the clinical content directly.

---

## 7. Stretch goals (in order)
1. **Voice:** browser Web Speech API for STT (fast to build), or a streaming STT
   service for accuracy. TTS for the patient voice. Speech goes through the patient agent,
   which emits `Action`s by tool call ("I'm going to listen to the heart" →
   `exam: cvs.auscultation.*`).
2. **3D patient:** react-three-fiber with a CC0/CC-BY rigged human model, raycasting to
   meshes named with region IDs.
3. **VR:** WebXR on a Quest browser, reusing the 3D scene, with controller-pointer selection.
4. **Case generator:** Claude drafts a case JSON from a one-line prompt, and it isn't used until a clinician signs it off.

---

## 8. Risks
| Risk | Mitigation |
|---|---|
| Merge chaos with 9 agents | Contracts first, folder ownership, small PRs, CI gate |
| LLM leaks diagnosis / invents findings | Patient agent only sees `history` + `persona`; findings come from the engine |
| Grader scores are unfair or opaque | Deterministic where possible; LLM items must quote evidence; coach overrides |
| Mark sheet items can't be captured from clicks | Procedure toolbar + transcript-judged items |
| Real-case privacy | De-identify before use; prefer teaching cases |
| 3D/VR eats time | Only one person on it, SVG view is the demo baseline |
| Live demo fails | Recorded backup video, and seeded fixture sessions for the report page |

## 9. Still needed from the team
- One or more **school mark sheets** (PDF or photo) to build the rubric format against.
- Which **system(s)** to start with for case #1. CVS or abdo makes a strong demo.
- Who on the team is clinical and who is technical, to finalise role assignment.
