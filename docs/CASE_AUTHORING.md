# Case authoring

Cases are JSON files in `content/cases/`, validated against `Case` in `src/domain/schemas.ts`.
Adding a case needs no code change. Run `npm run validate` after every edit.

Start by copying `content/cases/hf-decompensated-01.json`.

## Schema walkthrough

| Field | What it is | Who sees it |
|---|---|---|
| `id` | lowercase slug, unique, never renamed once sessions exist | everyone |
| `title`, `mode` | `mode`: `"encounter"` (history, focused exam, differential) or `"screening"` (full exam on a normal patient) | student |
| `patient` | name, age, sex, pronouns, chief complaint, setting, and `persona` (affect, speaking style, worries, background) | name/age/complaint: student; persona: authors and coaches (the patient's replies come only from `history`) |
| `doorSign` | the task and time limit shown on the door sign | student |
| `vitals` | `hr`, `rr`, `bpSystolic`, `bpDiastolic`, `tempC`, `spo2`, `spo2Context`. Filled into catalog findings via `{vitals.hr}`-style placeholders | revealed only when the student measures them |
| `history.openingStatement` | the patient's first answer to "what brings you in" | patient (server) |
| `history.facts[]` | `{ id, topic, answer, revealOnlyIfAsked, intents, followUps[], emotion? }`. The ONLY clinical history the patient may state; `answer` is said verbatim. `intents` = how students ask for it (below). `followUps[] { id, intents, answer }` answer "how many pillows?" after the fact was discussed. `emotion` sets the patient's mood once the fact comes up | patient (server) |
| `history.pertinentNegatives[]` | `{ id ("neg-…"), topic, answer, intents }` | patient (server) |
| `history.unknownPolicy` | `negativeReply` (ROS-style "no", for symptoms the history bank knows but the case doesn't) and `unknownReply` (anything else) | patient (server) |
| `history.conversation[]` | optional per-case overrides of the conversation bank (`content/lang/conversation.json`): `{ kind, replies[], intents? }` for greeting, consent, closing… Replies may use `{patient.name}` and `{student.name}` | patient (server) |
| `history.emotionCues[]` | `{ emotion, acknowledgement }`: what the patient says when the student responds with empathy while in that mood | patient (server) |
| `history.notRelevantTopics[]` | topic ids from `content/lang/topics.json` the case deliberately leaves out | validator, coaches |
| `abnormalFindings` | `{ [maneuverId]: { [regionId or "default"]: text } }`. Abnormal findings only; everything else falls back to the catalog's normal findings | resolved in code, shown when elicited |
| `expectedDifferential[]` | `{ rank, diagnosis, rationale }`. Shown in the post-station debrief | student after finishing |
| `acceptableDiagnoses[]` | `{ id, diagnosis, synonyms[], satisfies[] }`: other wordings of a key diagnosis that earn the `penKey.differential` items listed in `satisfies` | grader only |
| `itemsNotApplicable[]` | `{ itemId, reason }`: mark-sheet items that don't apply to this case (e.g. sexual history in acute heart failure). Shown greyed, never scored | coaches |
| `markSheetIds` | which mark sheets score this case | — |
| `markSheetSections` | optional: limit a sheet to some sections (e.g. CV + pulmonary only) | — |
| `doorInstructions` | 1B door placard: `reasonForVisit`, `task`, `prohibitedExams[] { label, regionIds }` (clicking those regions logs a `prohibited_attempt`) | student |
| `timeLimits` | `{ encounterMin, penMin }` (1B: 15 and 10). With `mode: "encounter"` this turns on the 1B flow: "You may begin", timed encounter, then the post-encounter note | student |
| `peChecklist[]` | the case's SP physical-exam checklist: mark-sheet items with `auto` rules. Scored in the patient-encounter domain | coaches; student after finishing |
| `penKey` | faculty key for the post-encounter note: `history[] { id, text, kind: positive/negative, keywords }`, `exam[] { id, text, maneuverIds, keywords }`, `differential[] { id, diagnosis, aliases, rank, rationale }`. Ids unique across all three. `terms[]` (words a note uses for the point) and `exemplars[]` (example sentences) let the deterministic grader recognise paraphrases | grader only |
| `synthetic` | must be `true` | — |
| `sourceNote` | where the case came from (e.g. "written by the team", or the permission reference) | coaches |

### Rules of thumb
- **Consistency is the author's job.** The engine never invents a finding, so a case is only as
  coherent as its JSON. Check that history, vitals and findings tell one story (e.g. tachypnoea in the
  vitals and "mildly laboured" in `respiratory_rate`).
- **Override contradicting normals.** Catalog normals are written for a healthy adult (e.g.
  "unlaboured breathing", "regular rhythm, normal volume"). If the case's vitals make one wrong,
  override that maneuver in `abnormalFindings`.
- **Per-region findings** belong on the exact region a student would click (e.g. `lung_post_rl` for a right base).
  `default` applies to every other allowed region of that maneuver.
- **History answers** are written in the patient's voice, in plain language, one fact per entry.
  Mark anything a student should have to ask for as `revealOnlyIfAsked: true`.
- **Never put the diagnosis** in history facts or the persona. The patient must not be able to leak it.
- `npm run validate` checks that every maneuver and region id exists and that each region is allowed for its maneuver.

## Intents: how students ask

Every fact, follow-up and pertinent negative in an encounter case needs `intents`:

```json
"intents": {
  "canonical": "Do you get short of breath when you lie flat?",
  "paraphrases": ["Can you lie flat?", "How many pillows do you sleep on?", "Is your breathing worse lying down?", "Do you have to sleep propped up?", "Any trouble breathing at night when you lie down?"],
  "keywords": ["lie flat", "pillows", "propped up"],
  "patterns": [],
  "topics": ["hpi.aggravating"]
}
```

- **At least 5 paraphrases** in the words students actually use (lay and clinical, open and closed,
  short and long). Keywords are multi-word where possible; `patterns` are regexes on the normalised text.
- **Topics** come from `content/lang/topics.json`; they credit the history-coverage items of the mark sheets.
- Generic questions the case doesn't answer (any ROS symptom, social history…) are already in
  `content/lang/history-bank.json` and get the case's `negativeReply`. Only add a fact when the case has
  something to say.
- After editing: `npm run lang:embed` (phrase vectors), `npm run case:paraphrases <caseId>` (thin intents,
  paraphrases that collide with another fact, fixture gaps), then `npm test`. A new case also needs a blind
  chat fixture (`tests/fixtures/chat/<caseId>.json`, 60 questions written without seeing the paraphrases)
  scoring ≥ 90%. Try questions live in `/dev/chat-tester` (coach code).

## Real (non-synthetic) cases: required checklist

Real cases are an **open item** (see `docs/PLAN.md`). Until the team has explicit permission,
only synthetic cases may be added. Before any case derived from a real patient goes into this repo,
every box below must be ticked. Record the checklist in the PR
description, and add a reference to it in `sourceNote`.

**Permission**
- [ ] Written permission from the case owner (faculty / clinical skills lead) to use the case in this tool.
- [ ] Permission covers use in this tool. (Since Phase 4 the case text is not sent to any external service:
      the patient and grading run on our own server.)
- [ ] Permission covers storing it in a public or private GitHub repo, as applicable.
- [ ] The source is a teaching case or standardized-patient script, not a clinical record. If it was
      derived from a clinical record, confirm institutional approval (e.g. IRB/ethics or privacy office) in writing.

**De-identification** (remove or replace all of these; HIPAA Safe Harbor identifiers as a minimum)
- [ ] Names (patient, relatives, clinicians), initials.
- [ ] Geographic detail smaller than a state/region (street, city, ZIP/postcode, hospital or clinic names).
- [ ] All dates except the year (admission, discharge, birth, death, procedures), and ages over 89.
- [ ] Phone/fax numbers, email addresses, URLs, IP addresses.
- [ ] Record numbers: MRN, health plan, account, licence, device or serial numbers.
- [ ] Photos, images, voice recordings and any other biometric data.
- [ ] Any other unique identifying characteristic: rare diagnosis + location combinations, occupation + employer,
      distinctive events, family structure that could identify someone.
- [ ] Details altered enough that the patient wouldn't recognise themselves (change age by a few years, swap
      non-essential details) without changing the teaching points.

**Review**
- [ ] A second team member checked the de-identified case against this list.
- [ ] A clinician reviewed the case for medical accuracy and internal consistency.
- [ ] `synthetic` stays `true` (the case is now a fictionalised derivative), and `sourceNote` names the permission
      reference, not the original patient.
- [ ] The original, identifiable material was never committed: check `git log -p` on the PR.

If any box can't be ticked, don't add the case. Write a synthetic case inspired by the teaching
points instead.
