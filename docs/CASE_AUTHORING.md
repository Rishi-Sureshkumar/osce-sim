# Case authoring

Cases are JSON files in `content/cases/`, validated against `Case` in `src/domain/schemas.ts`.
Adding a case needs no code change. Run `npm run validate` after every edit.

Start by copying `content/cases/hf-decompensated-01.json`.

## Schema walkthrough

| Field | What it is | Who sees it |
|---|---|---|
| `id` | lowercase slug, unique, never renamed once sessions exist | everyone |
| `title`, `mode` | `mode`: `"encounter"` (history, focused exam, differential) or `"screening"` (full exam on a normal patient) | student |
| `patient` | name, age, sex, pronouns, chief complaint, setting, and `persona` (affect, speaking style, worries, background) | name/age/complaint: student; persona: AI patient only |
| `doorSign` | the task and time limit shown on the door sign | student |
| `vitals` | `hr`, `rr`, `bpSystolic`, `bpDiastolic`, `tempC`, `spo2`, `spo2Context`. Filled into catalog findings via `{vitals.hr}`-style placeholders | revealed only when the student measures them |
| `history.openingStatement` | the patient's first answer to "what brings you in" | AI patient |
| `history.facts[]` | `{ id, topic, answer, revealOnlyIfAsked, keywords? }`. The ONLY clinical history the patient may state. `keywords` drive the mock patient (AI_MOCK) | AI patient |
| `history.pertinentNegatives[]` | `{ topic, answer, keywords? }` | AI patient |
| `history.unknownPolicy` | `negativeReply` (ROS-style "no") and `unknownReply` (anything not in the case) | AI patient |
| `abnormalFindings` | `{ [maneuverId]: { [regionId or "default"]: text } }`. Abnormal findings only; everything else falls back to the catalog's normal findings | resolved in code, shown when elicited |
| `expectedDifferential[]` | `{ rank, diagnosis, rationale }`. Used by the grader and shown in the post-station debrief | grader; student after finishing |
| `markSheetIds` | which mark sheets score this case | — |
| `markSheetSections` | optional: limit a sheet to some sections (e.g. CV + pulmonary only) | — |
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
- **Never put the diagnosis** in history facts or the persona. The AI patient must not be able to leak it.
- `npm run validate` checks that every maneuver and region id exists and that each region is allowed for its maneuver.

## Real (non-synthetic) cases: required checklist

Real cases are an **open item** (see `docs/PLAN.md`). Until the team has explicit permission,
only synthetic cases may be added. Before any case derived from a real patient goes into this repo
or is sent to the Anthropic API, every box below must be ticked. Record the checklist in the PR
description, and add a reference to it in `sourceNote`.

**Permission**
- [ ] Written permission from the case owner (faculty / clinical skills lead) to use the case in this tool.
- [ ] Permission covers sending the case text to a third-party AI service (Anthropic API) for the patient role-play and grading.
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
