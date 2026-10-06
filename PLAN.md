# OSCE Simulator — Project Plan

A browser-based OSCE station simulator where a student takes a history, examines an
interactive patient model, and gets structured feedback on their exam technique and
clinical reasoning.

## 1. Core design decision: the case file is the source of truth

The LLM should **never invent exam findings**. Each case is an authored file
(JSON/YAML) that defines what is true about the patient. The LLM is used only to:

1. **Role-play the patient** during history taking, limited to facts in the case file.
2. **Turn structured findings into natural narration** ("On auscultation you hear fine
   bibasal crackles...").
3. **Grade and give feedback** against the case's rubric.

This keeps findings consistent between runs, makes grading reliable, and lets a
clinician review a case without reading prompts.

### Case schema (sketch)

```jsonc
{
  "id": "acute-chole-01",
  "doorCard": "45F presenting with RUQ pain. Take a focused history and examine. 10 min.",
  "vitals": { "hr": 104, "bp": "128/82", "rr": 18, "temp": 38.4, "spo2": 98 },
  "persona": { "name": "Maria Lopez", "age": 45, "affect": "uncomfortable, cooperative" },
  "history": {
    "volunteered": ["pain started after a fatty meal last night"],
    "ifAsked": {
      "radiation": "goes to my right shoulder blade",
      "nausea": "yes, vomited twice",
      "jaundice": "no"
    }
  },
  "exam": {
    // anything not listed falls back to the exam's default "normal" finding
    "abdomen.palpation.light": { "finding": "RUQ tenderness with guarding" },
    "abdomen.special.murphy":  { "finding": "Positive Murphy's sign", "abnormal": true },
    "heent.inspection.sclera": { "finding": "No scleral icterus" }
  },
  "investigations": { "lfts": "...", "us_abdomen": "..." },
  "diagnosis": "Acute cholecystitis",
  "differentials": ["biliary colic", "cholangitis", "pancreatitis", "PUD", "RLL pneumonia"],
  "rubric": {
    "history": ["onset", "radiation", "fever", "jaundice", "previous episodes"],
    "exam":    ["abdomen.palpation.light", "abdomen.special.murphy", "heent.inspection.sclera"],
    "critical": ["identifies sepsis risk / fever", "considers cholangitis"],
    "communication": ["introduces self", "consent before exam", "explains findings"]
  }
}
```

### Exam catalog (shared across all cases)

A fixed catalog maps **body region → available exams → default normal finding**:

| Region | Example exams |
|---|---|
| HEENT | inspection, pupils (PERRLA), fundoscopy, otoscopy, oropharynx, cervical nodes, thyroid |
| Neck | JVP, carotid auscultation, tracheal position |
| Chest / lungs | inspection, expansion, percussion, auscultation (by zone), tactile fremitus |
| Cardiac | apex beat, heaves/thrills, auscultation (aortic, pulmonary, tricuspid, mitral) |
| Abdomen | inspection, auscultation, light/deep palpation, percussion, Murphy's, McBurney's, rebound, shifting dullness |
| Extremities | pulses, edema, capillary refill, calf tenderness |
| Neuro | cranial nerves, tone, power, reflexes, sensation, coordination, gait |

Because exams outside the case fall back to "normal", authors only write the abnormal
findings. That keeps case authoring quick.

## 2. Architecture

```
┌────────────── Browser (Next.js / React / TS) ───────────────┐
│ Door card + timer │ Patient model │ Chat / voice │ Findings │
│                   │  (click region → exam menu)              │
└───────────────┬──────────────────────────────────────────────┘
                │ all user input becomes an Action
                ▼
        Action API  (/api/action)
   ask_question | perform_exam | order_test | present_case
                │
     ┌──────────┼──────────────┐
     ▼          ▼              ▼
 Case engine   LLM patient   Event log (timestamped)
 (lookup in    (constrained       │
  case file)    by case file)     ▼
                            Grader (rubric checks + LLM feedback)
```

**Key idea:** clicking the body, typing, and (later) speaking all produce the same
`Action` objects. A spoken "I'm going to listen to the lungs" becomes an LLM tool call
`perform_exam("chest.auscultation")`, which goes through the same path as a click. So
voice and VR become extra input methods, with no changes to the core.

### Suggested stack
- **Frontend:** Next.js + TypeScript + Tailwind.
- **Patient model:**
  - *MVP:* an SVG body map (front/back) with clickable regions. Takes about an hour to build and always works.
  - *Upgrade:* `react-three-fiber` with a rigged GLTF human model; raycast clicks to named
    mesh regions. Check the model license (CC-BY / CC0).
- **LLM:** Claude via the Anthropic SDK with tool use. Use a fast model for
  live patient dialogue and a stronger model for end-of-station grading.
- **State:** in-memory or SQLite for the hackathon; there's no need for auth.
- **Media:** CC-licensed heart/lung sound clips and fundoscopy/otoscopy images attached
  to findings (check each source's license).

## 3. Station flow

1. **Door card**: the stem, the task, and a countdown timer (e.g. 8–10 min).
2. **History**: chat (or voice) with the patient. The patient answers only what's asked,
   in character.
3. **Examination**: click a region, pick an exam, and see a short animation or highlight
   ("You place your stethoscope at the left lower sternal edge..."). Then the finding
   (plus audio or an image if available) is added to the **Findings panel**.
4. **Investigations** (optional): order tests and get results from the case file.
5. **Presentation**: the student gives a summary, their top differentials, and a plan
   (typed or spoken).
6. **Feedback report**:
   - Checklist score: history items, exam items, and critical actions, all deterministic
     from the event log.
   - Clinical reasoning: did the differential match the findings they actually elicited?
   - Missed items, with *why they matter* (e.g. "You didn't check for scleral icterus,
     which separates cholangitis from simple cholecystitis").
   - Communication and global rating, as in a real OSCE mark sheet.
   - A timeline replay of what they did, in order.

## 4. Hackathon milestones

| Phase | Goal | Done when |
|---|---|---|
| **M0** (setup) | Repo, Next.js scaffold, API key, 1 hand-written case | `npm run dev` shows door card |
| **M1** (core loop) | SVG body map → exam menu → finding from case file → findings panel | Can examine the full patient for case #1 |
| **M2** (history) | LLM patient chat constrained by case file | Realistic history for case #1, no leaks of the diagnosis |
| **M3** (feedback) | Event log → rubric scoring + LLM narrative feedback | End-of-station report renders |
| **M4** (polish/demo) | 2–3 more cases (e.g. CHF, pneumonia, appendicitis), timer, exam animations, sound clips | Demo script runs end-to-end |
| **Stretch A** | Voice: Web Speech API (or Whisper/Deepgram) STT + TTS patient voice | Whole station can be done hands-free |
| **Stretch B** | 3D patient (react-three-fiber) | Click on 3D mesh triggers same exam menu |
| **Stretch C** | VR via WebXR (`@react-three/xr`) on Quest browser | Same 3D scene usable in headset with controller pointing |
| **Stretch D** | LLM-assisted case generator (with clinician review step) | New case JSON drafted from a one-line prompt |

The order is deliberate. M1 is the demo even if nothing else ships, and every stretch
goal builds on the same Action API.

## 5. Suggested team split (3–4 people)
- **Frontend/UI:** body map, exam menus, findings panel, report page.
- **Case engine + content:** schema, exam catalog, writing and clinically validating cases.
- **LLM:** patient prompt and guardrails, voice-intent → action tool calls, grader prompt.
- **Stretch owner:** 3D/VR or voice, started once M1 is stable.

## 6. Risks & mitigations
| Risk | Mitigation |
|---|---|
| LLM invents findings or leaks the diagnosis | Findings come only from the case file; the patient prompt gets the history section only, with no diagnosis |
| Medically inaccurate content | Clinician/student review of each case; cite sources for findings |
| LLM latency breaks immersion | Fast model + streaming; exam results are local lookups, no LLM needed |
| 3D/VR eats the whole hackathon | Ship the SVG first; 3D is a swap-in view over the same region IDs |
| Feedback feels generic | Ground the feedback in the event log and rubric, and quote what the student actually did |

## 7. Open questions
- How long is the hackathon, and how big and skilled is the team?
- Which exam style to target: UK OSCE/PACES, USMLE-style, or a specific school's mark sheets?
- Is there a specialty or system focus for the demo cases (e.g. cardio-resp + abdo)?
- Is there access to a clinician to review cases before judging?
