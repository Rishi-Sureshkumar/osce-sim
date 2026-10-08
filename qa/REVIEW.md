# Visual review (qa/REVIEW.md)

Every screenshot in `qa/screens/manifest.json` (207 PNGs from `npm run test:visual`; re-reviewed at the M2 gate, with clocks, dates and log times masked) was opened and reviewed by the main agent.
Rows carry the sha256 prefix of the reviewed PNG; `npm run qa:review-check` fails on a new or changed screenshot until it is
reviewed again (`-- --scaffold` adds the rows). High defects must have an owner milestone; `QA_STRICT_OWNER=<M>` fails that owner's open highs.

## Defects

| id | severity | category | owner | status | description |
|---|---|---|---|---|---|
| V-FEEDBACK | high | grading | M1 | fixed | Feedback "Missed:" lines pasted grader guidance (cut at "e.g."); first-third window missed early greetings in short sessions — fixed in M1 (labels only; first 3 turns count as the opening) (6 shots) |
| V-HANDS | high | shot | M2 | fixed | Hands shot frames the thighs/table; the hands are hidden (bug 4) — fixed at the M2 gate: reclined, the forearms rest on the thighs, so the hands are in view supine, reclined 30/45, seated and dangling (the female 30° hands are still partly tucked: V-ARMS; left lateral: V-LLD) |
| V-NECK | high | shot | M2 | fixed | head_neck shot looks down on the scalp or from the head end: neck hidden by the chin, no front view of the face (bug 4) — fixed in M2 bug 4 (head_neck framed from the front along the head's forward axis; new frontal face shot 40 cm, fov 35; head steady for the eye exam) (8 shots) |
| V-SINK | high | room | M2 | fixed | Sink has no basin, soap or towel (bug 3) — fixed in M2 bug 3 (basin ≥ 10 cm, faucet, soap, towels; washing over the basin) (4 shots) |
| V-ARMS | high | pose | M3 | open | Supine arms hover above the table instead of resting (2 shots) |
| V-BACKREST | high | room | M3 | open | Seated: patient sits 11-15 cm inside the backrest; the back shot shows only the backrest (M3 intersections xfail) (2 shots) |
| V-EARBACK | high | shot | M3 | fixed | Ear shots in reclined positions were blocked by the raised backrest — fixed at the M2 gate (ear views rise until clear of the table; mastoid and canal in view lying back) |
| V-FCHEST | high | drape | M3 | open | Female chest uncovers both breasts at once; must be per side and covered by default (1 shots) |
| V-LLD | high | pose | M3 | open | Left lateral decubitus pose contorted (arm flung up, hangs off the table edge) and the leg sheet disappears (6 shots) |
| V-LLDPRIV | high | drape | M3 | open | LLD: gown rides up, buttocks exposed, no sheet (2 shots) |
| V-PELVIS | high | drape | M3 | open | "All exposed" leaves the patient naked: the pelvis section must never be exposed (2 shots) |
| V-PUBIS | high | drape | M3 | open | Female abdomen exposure reaches the pubic area (pelvis section must stay covered) (1 shots) |
| V-SHEET | high | drape | M3 | open | Legs/feet poke through the leg sheet while "Legs: covered" (bug 6) (18 shots) |
| V-ARMSLLD | medium | shot | M3 | open | LLD arms shot frames the raised arm against the wall from behind — the arm is flung up by the left-lateral pose (V-LLD); re-owned to M3 at the M2 gate |
| V-ARMSSEAT | medium | shot | M2 | fixed | Seated arms shot frames the torso; the arm is hidden behind the body — fixed at the M2 gate (arm and hand on the thigh in view; plus close left-arm and back-of-elbow views) |
| V-BACKHINT | medium | ux | M2 | fixed | Reclined 45°: back against the backrest but no "ask the patient to sit up" hint — fixed at the M2 gate (shotHint: lying back up to 45°, and seated against the backrest: "lean forward") |
| V-BACKHINT2 | medium | ux | M2 | fixed | LLD: hint wrongly said the back is against the table — fixed at the M2 gate (shotHint is per position) |
| V-NECKLLD | medium | shot | M3 | open | LLD head_neck: neck partly behind the shoulder — follows the left-lateral pose (V-LLD); re-owned to M3 at the M2 gate |
| V-BODY | medium | asset | M3 | open | Female body barely differs from the male (proportions, hair) (2 shots) |
| V-ROD | medium | drape | M3 | open | Rolled/folded gown edges render as floating light-blue rods across the body (the roll-chest rod lies over the apex) (59 shots) |
| V-CHESTINV | medium | shot | M6 | open | Supine chest shot from the head end: the face is upside down at the bottom of the frame (3 shots) |
| V-PERFORMCLIP | medium | ui | M6 | open | Perform card clips the finding text at the canvas bottom (1 shots) |
| V-PLACARD | medium | ui | M6 | open | 3D door placard is a blank rectangle (text only in the side panel) (3 shots) |
| V-WRAP | medium | ui | M6 | open | Toolbar wraps at 1280/1180 wide ("Actions"/"Leave the room" on a second row) (2 shots) |
| V-EARDOWN | low | ux | M2 | fixed | LLD: the left ear faces the table — fixed at the M2 gate: a hint says the left ear is against the table |
| V-GOWNEDGE | low | asset | M3 | open | Gown neckline has a sawtooth edge (1 shots) |
| V-GOWNFIT | low | asset | M3 | open | Gown is skin-tight (body outline shows through) (5 shots) |
| V-HAIR | low | asset | M3 | open | Procedural hair shell has jagged edges over the ears (10 shots) |
| V-SEAM | low | asset | M3 | open | Visible skin seam line above the knee (1 shots) |
| V-TOOLS | low | asset | M3 | open | Instruments are crude primitives (2 shots) |
| V-ZFIGHT | low | room | M3 | open | Backrest corner geometry flickers (1 shots) |
| V-CHESTROT | low | shot | M6 | open | Reclined chest shot rotated 90° (1 shots) |
| V-FRAME | low | shot | M6 | open | Conversation (seated) shot crops the head (2 shots) |
| V-HINTOVER | low | ui | M6 | open | Hint popover covers the drape chips and Actions/Leave (1 shots) |
| V-HINTS | low | ui | M6 | open | "1 hints" plural in the coach list (3 shots) |
| V-MENUOVER | low | ui | M6 | open | Actions menu covers the Findings panel (1 shots) |
| V-MENUSCROLL | low | ui | M6 | open | Examine menu needs scrolling with no visible cue (1 shots) |
| V-OVERFLOW | low | ui | M6 | open | Left column overflows: chat options cut off below the fold (3 shots) |
| V-PLACEHOLDER | low | ui | M6 | open | Chat input says "Station finished" before the encounter starts (2 shots) |
| V-TOASTSTACK | low | ui | M6 | open | Hygiene nudge toast stays over the canvas while a modal is open (1 shots) |
| V-JUSTIFY | high | grading | M4 | open | Results credit "Diagnoses are justified by findings the student elicited — orthopnea, raised JVP" when neither was elicited (JVP not examined; the note's claim is flagged as unperformed in the same feedback); "the student" in third person on a student page (found at the M2 gate) |
| V-HINTTEXT | low | ui | M6 | open | The canvas hint line ("Click the patient to move closer…") has no backdrop: unreadable over dark table rails; also shown in the tool-table view with no patient (found at the M2 gate) |
| V-BADGES | low | ui | M6 | open | Coach transcript: "typed" badge runs into the text; "Matched" badge on 0-point items that say no words matched (found at the M2 gate) |

## Screenshots

| file | sha256 | reviewed@ | defects | notes |
|---|---|---|---|---|
| 1180x820/hf-male/layout/01-station-inside.png | d378c0d476f3 | 0b84dda+wt | V-WRAP, V-SHEET, V-OVERFLOW | Station at 1180: "Actions" and "Leave the room" on a second toolbar row · V-WRAP · V-SHEET · V-OVERFLOW |
| 1180x820/hf-male/layout/02-note.png | b25bbe3a6e5c | 0b84dda+wt | — | Post-encounter note at 1180: history, exam, diagnosis with findings, door instructions; timer and autosave masked |
| 1180x820/hf-male/layout/03-results.png | 87d0eda94f06 | 0b84dda+wt | — | Results at 1180: readable, nothing clipped |
| 1180x820/hf-male/layout/04-coach-list.png | a7e6d00230c3 | 0b84dda+wt | V-HINTS | Coach list at 1180 · V-HINTS |
| 1180x820/hf-male/layout/05-coach-detail.png | d0a7b01dab55 | 0b84dda+wt | — | Coach detail at 1180: two columns, readable |
| 1280x800/hf-male/layout/01-station-inside.png | 3db5ea82c77c | 0b84dda+wt | V-WRAP, V-SHEET, V-OVERFLOW | Station at 1280: "Leave the room" wraps to a second toolbar row · V-WRAP · V-SHEET · V-OVERFLOW: chat cut off below |
| 1280x800/hf-male/layout/02-note.png | 97a0ed9cb4b0 | 0b84dda+wt | — | Post-encounter note at 1280, readable |
| 1280x800/hf-male/layout/03-results.png | 8a331bdfbd4b | 0b84dda+wt | — | Results at 1280: feedback and debrief readable, nothing clipped |
| 1280x800/hf-male/layout/04-coach-list.png | 3bbe2f0323ed | 0b84dda+wt | V-HINTS | Coach list at 1280 · V-HINTS |
| 1280x800/hf-male/layout/05-coach-detail.png | 1bf95b5eb84d | 0b84dda+wt | — | Coach detail at 1280: two columns, readable |
| 1440x900/hf-male/drapes/01-chest_front__supine__chest-exposed.png | 671f457ee746 | 0b84dda+wt | V-CHESTINV, V-ROD, V-ARMS | Chest uncovered supine, viewed from the head end (face upside down) · V-CHESTINV · V-ROD: the rolled gown lies across the upper chest · V-ARMS |
| 1440x900/hf-male/drapes/02-abdomen__supine__abdomen-exposed.png | b73b7d39a212 | 0b84dda+wt | V-ROD, V-ARMS | Abdomen uncovered, navel visible; rolls above and below · V-ROD · V-ARMS: hands raised |
| 1440x900/hf-male/drapes/03-legs__supine__legs-exposed.png | dbd352c78bef | 0b84dda+wt | — | Legs uncovered supine: both legs flat on the table, nothing clipping |
| 1440x900/hf-male/drapes/04-overview__supine__all-exposed.png | a618b3896338 | 0b84dda+wt | V-PELVIS, V-ROD | All exposed: the patient is naked (pelvis exposed) · V-PELVIS · V-ROD: rolls across chest and abdomen |
| 1440x900/hf-male/layout/01-station-inside.png | 048c870ee188 | 0b84dda+wt | V-SHEET, V-OVERFLOW | Station inside at 1440: door instructions with vitals, room view · V-SHEET: feet through the sheet · V-OVERFLOW: chat options cut at the bottom |
| 1440x900/hf-male/layout/02-note.png | 1a0acf2433c6 | 0b84dda+wt | — | Post-encounter note at 1440, readable |
| 1440x900/hf-male/layout/03-results.png | 3f85442b5f78 | 0b84dda+wt | — | Results: feedback with verbatim quotes, strengths, improvements (note claim of an unperformed JVP exam flagged), case debrief list |
| 1440x900/hf-male/layout/04-coach-list.png | d1109db6e8a5 | 0b84dda+wt | V-HINTS | Coach session list · V-HINTS: "1 hints" plural |
| 1440x900/hf-male/layout/05-coach-detail.png | c73c89f9a751 | 0b84dda+wt | — | Coach detail: feedback, pass banner, domain card with items and overrides, note with the unperformed-exam flag, transcript with match details |
| 1440x900/hf-male/room/00-exam-corridor-placard.png | fec6cf3400e2 | 0b84dda+wt | V-PLACARD, V-PLACEHOLDER | Exam-mode corridor: "You may begin" button, disabled "Knock and enter" with the wait message · V-PLACARD: blank 3D placard · V-PLACEHOLDER: chat says "Station finished" |
| 1440x900/hf-male/room/01-corridor.png | 3de7ebe2286f | 0b84dda+wt | V-PLACARD, V-PLACEHOLDER | Practice corridor, door and Knock and enter · V-PLACARD · V-PLACEHOLDER |
| 1440x900/hf-male/room/02-overview.png | 048c870ee188 | 0b84dda+wt | V-SHEET | Room on entering, patient seated, sink with basin and soap, tool table · V-SHEET: feet through the sheet |
| 1440x900/hf-male/room/03-sink.png | b05bce06c815 | 0b84dda+wt | — | OK: sink with a deep basin, drain, faucet, soap pump and wall dispenser (bug 3) |
| 1440x900/hf-male/room/04-tool_table.png | 34dfbe6e2449 | 0b84dda+wt | V-TOOLS | Tool table with the instruments · V-TOOLS: crude primitives |
| 1440x900/hf-male/shots/001-overview__supine__covered.png | 83d0309bbb0d | 0b84dda+wt | V-SHEET | Room view, patient supine, sink with basin and soap · V-SHEET: feet stick up through the leg sheet |
| 1440x900/hf-male/shots/002-seated__supine__covered.png | 87f1655b70ad | 0b84dda+wt | V-ARMS, V-ROD | Stool view of the supine patient · V-ARMS: arms raised off the table · V-ROD: rods over the chest |
| 1440x900/hf-male/shots/003-head_neck__supine__covered.png | 903c7ce8477f | 0b84dda+wt | V-ROD, V-GOWNEDGE | Head & neck from the front, face and neck visible on the pillow · V-ROD · V-GOWNEDGE: sawtooth neckline |
| 1440x900/hf-male/shots/004-ear_left__supine__covered.png | 4ee593e8cabd | 0b84dda+wt | V-HAIR | Left ear and the skin behind it from the side · V-HAIR: jagged hair edge above the ear |
| 1440x900/hf-male/shots/005-ear_right__supine__covered.png | a68f82d69649 | 0b84dda+wt | V-HAIR | Right ear and mastoid from the side · V-HAIR |
| 1440x900/hf-male/shots/006-chest_front__supine__covered.png | e800ce684722 | 0b84dda+wt | V-CHESTINV, V-ROD, V-ARMS | Chest from the head end · V-CHESTINV: face upside down at the bottom · V-ROD · V-ARMS: arms raised |
| 1440x900/hf-male/shots/007-chest_back__supine__covered.png | 719d72d3b89d | 0b84dda+wt | V-ROD, V-ARMS | Back view while supine: shows the front from above, with the new hint "The back is against the table. Ask the patient to sit up or lean forward" (V-BACKHINT fixed) · V-ROD · V-ARMS: arm off the table |
| 1440x900/hf-male/shots/008-abdomen__supine__covered.png | 74c249dbb742 | 0b84dda+wt | V-ROD, V-ARMS | Abdomen from above · V-ROD: two rods · V-ARMS: left hand hovers above the abdomen |
| 1440x900/hf-male/shots/009-arms__supine__covered.png | fcb466389180 | 0b84dda+wt | V-ROD, V-ARMS | Right arm from the right · V-ARMS: arm lifted off the table · V-ROD |
| 1440x900/hf-male/shots/010-hands__supine__covered.png | 8c1f0b5be348 | 0b84dda+wt | V-ROD | Both hands visible beside the hips (V-HANDS fixed for supine) · V-ROD |
| 1440x900/hf-male/shots/011-legs__supine__covered.png | 7b58cad605cd | 0b84dda+wt | V-SHEET | Legs under the sheet · V-SHEET: right leg out of the sheet edge, feet outside it |
| 1440x900/hf-male/shots/012-feet__supine__covered.png | 75aa4b303f9d | 0b84dda+wt | V-SHEET | Feet from the foot end · V-SHEET: both feet poke up through the sheet |
| 1440x900/hf-male/shots/013-overview__reclined_30__covered.png | d3a1000fc1a6 | 0b84dda+wt | V-SHEET | Room view reclined 30°: hands resting toward the lap · V-SHEET: feet up through the sheet |
| 1440x900/hf-male/shots/014-seated__reclined_30__covered.png | 193e0ad15c4b | 0b84dda+wt | V-ARMS, V-ROD | Stool view reclined 30°: forearms come forward over the thighs (hands visible) but float a little above them · V-ROD |
| 1440x900/hf-male/shots/015-head_neck__reclined_30__covered.png | b4037fdb7d33 | 0b84dda+wt | V-GOWNEDGE | Head & neck from the front: face and neck clear · V-GOWNEDGE: sawtooth neckline |
| 1440x900/hf-male/shots/016-ear_left__reclined_30__covered.png | 636e9b227ffd | 0b84dda+wt | V-HAIR | Left ear from the side, clear of the backrest (the pillow sits below it) · V-HAIR |
| 1440x900/hf-male/shots/017-ear_right__reclined_30__covered.png | 243ec251f34d | 0b84dda+wt | V-HAIR | Right ear from the side, clear · V-HAIR |
| 1440x900/hf-male/shots/018-chest_front__reclined_30__covered.png | 369835aebcc9 | 0b84dda+wt | V-CHESTROT, V-ROD | Chest from the head end, rotated (face sideways at the left) · V-CHESTROT · V-ROD |
| 1440x900/hf-male/shots/019-chest_back__reclined_30__covered.png | dde5a94ff1f6 | 0b84dda+wt | V-ROD | Back view at 30°: the "back is against the table" hint is shown (correct) · V-ROD |
| 1440x900/hf-male/shots/020-abdomen__reclined_30__covered.png | db5dc7047fe2 | 0b84dda+wt | V-ROD | Abdomen from above; forearms rest on the thighs at the edges · V-ROD: two rods |
| 1440x900/hf-male/shots/021-arms__reclined_30__covered.png | ec27ce06a730 | 0b84dda+wt | V-ROD | Right arm from the right: upper arm, elbow, forearm on the thigh · V-ROD |
| 1440x900/hf-male/shots/022-hands__reclined_30__covered.png | a10a58a8fdcf | 0b84dda+wt | V-ROD | Both hands on the thighs, fully visible (V-HANDS fixed: hands no longer under the thighs) · V-ROD |
| 1440x900/hf-male/shots/023-legs__reclined_30__covered.png | eb04af4b6b72 | 0b84dda+wt | V-SHEET, V-ROD | Legs under the sheet, hands on the thighs · V-SHEET: right leg through the sheet edge · V-ROD |
| 1440x900/hf-male/shots/024-feet__reclined_30__covered.png | f8240b428b6e | 0b84dda+wt | V-SHEET | Feet from the foot end · V-SHEET: feet up through the sheet |
| 1440x900/hf-male/shots/025-overview__reclined_45__covered.png | db2194364687 | 0b84dda+wt | V-SHEET | Room view at 45°: hands toward the lap · V-SHEET: feet through the sheet |
| 1440x900/hf-male/shots/026-seated__reclined_45__covered.png | 331e38487f2e | 0b84dda+wt | V-ARMS, V-ROD | Stool view at 45°: forearms come over the thighs but the hands float above them · V-ROD |
| 1440x900/hf-male/shots/027-head_neck__reclined_45__covered.png | 3eed08705371 | 0b84dda+wt | V-GOWNEDGE | Head & neck from the front at 45° (the JVP view): face and neck clear · V-GOWNEDGE |
| 1440x900/hf-male/shots/028-ear_left__reclined_45__covered.png | 6bf1d20783a2 | 0b84dda+wt | V-HAIR | Left ear and the skin behind it at 45°, clear of the backrest (V-EARBACK fixed: the view rises over the table) · V-HAIR |
| 1440x900/hf-male/shots/029-ear_right__reclined_45__covered.png | 173431c98e6d | 0b84dda+wt | V-HAIR | Right ear and mastoid at 45°, clear (V-EARBACK fixed) · V-HAIR |
| 1440x900/hf-male/shots/030-chest_front__reclined_45__covered.png | 24d123881286 | 0b84dda+wt | V-ROD | Chest from above the head end at 45°, face at the top-left · V-ROD |
| 1440x900/hf-male/shots/031-chest_back__reclined_45__covered.png | 3208460671a7 | 0b84dda+wt | V-ROD | Back view at 45°: the "back is against the table" hint now shows at 45° (V-BACKHINT fixed); view is the top of the head on the pillow · V-ROD |
| 1440x900/hf-male/shots/032-abdomen__reclined_45__covered.png | ec12066e97ac | 0b84dda+wt | V-ROD | Abdomen from above; forearms resting on the thighs · V-ROD |
| 1440x900/hf-male/shots/033-arms__reclined_45__covered.png | 818fae068e9c | 0b84dda+wt | V-ROD | Right arm from the right: arm, elbow and forearm on the thigh · V-ROD |
| 1440x900/hf-male/shots/034-hands__reclined_45__covered.png | 354f925e75a0 | 0b84dda+wt | V-ROD | Both hands on the thighs, fully visible (V-HANDS fixed at 45°) · V-ROD |
| 1440x900/hf-male/shots/035-legs__reclined_45__covered.png | 57b5a5c6a594 | 0b84dda+wt | V-SHEET, V-ROD | Legs under the sheet · V-SHEET: right leg out of the sheet edge · V-ROD |
| 1440x900/hf-male/shots/036-feet__reclined_45__covered.png | 95141e47e19e | 0b84dda+wt | V-SHEET | Feet up through the sheet |
| 1440x900/hf-male/shots/037-overview__seated__covered.png | 048c870ee188 | 0b84dda+wt | V-SHEET, V-BACKREST | Room view seated, hands in the lap · V-SHEET: feet through the sheet · V-BACKREST: sits into the backrest |
| 1440x900/hf-male/shots/038-seated__seated__covered.png | 121339c5a856 | 0b84dda+wt | V-ARMS, V-ROD | Stool view seated: forearms reach forward over the thighs, hands hover above them · V-ROD |
| 1440x900/hf-male/shots/039-head_neck__seated__covered.png | 7cabbd0237cb | 0b84dda+wt | V-GOWNEDGE | Head & neck from the front seated: face and neck clear · V-GOWNEDGE |
| 1440x900/hf-male/shots/040-ear_left__seated__covered.png | 06343e68862f | 0b84dda+wt | V-HAIR | Left ear and the skin behind it, clear · V-HAIR |
| 1440x900/hf-male/shots/041-ear_right__seated__covered.png | 7265f1054088 | 0b84dda+wt | V-HAIR | Right ear and mastoid, clear · V-HAIR |
| 1440x900/hf-male/shots/042-chest_front__seated__covered.png | 086bf157f97a | 0b84dda+wt | V-ROD | Chest from the front seated, face at the top · V-ROD |
| 1440x900/hf-male/shots/043-chest_back__seated__covered.png | 0f3d82213011 | 0b84dda+wt | V-BACKREST | Back view seated: only the top of the back above the backrest; the patient sits into the backrest |
| 1440x900/hf-male/shots/044-abdomen__seated__covered.png | bf56f717c39a | 0b84dda+wt | V-ROD | Abdomen seated, hands on the thighs · V-ROD (plus small leaf-shaped sheet fragments at the hands: part of V-SHEET) |
| 1440x900/hf-male/shots/045-arms__seated__covered.png | 884b269c874f | 0b84dda+wt | V-ROD | Right arm seated: arm, elbow, hand on the thigh visible (V-ARMSSEAT does not occur on this model) · V-ROD |
| 1440x900/hf-male/shots/046-hands__seated__covered.png | ab6a127d729b | 0b84dda+wt | V-SHEET | Both hands on the thighs, fully visible (V-HANDS fixed seated) · V-SHEET: fragments of sheet poke up beside the wrists |
| 1440x900/hf-male/shots/047-legs__seated__covered.png | 8525cc6a2a3c | 0b84dda+wt | V-SHEET | Legs under the sheet, hands on the thighs · V-SHEET: sheet fragments, right leg out of the edge |
| 1440x900/hf-male/shots/048-feet__seated__covered.png | d9f527f95262 | 0b84dda+wt | V-SHEET | Feet up through the sheet |
| 1440x900/hf-male/shots/049-overview__sitting_dangling__covered.png | 212cdf88813d | 0b84dda+wt | V-SHEET | Room view, sitting at the foot end with the legs hanging, hands on the thighs · V-SHEET: the leg sheet hangs off the table end as a flat plane |
| 1440x900/hf-male/shots/050-seated__sitting_dangling__covered.png | df5749651942 | 0b84dda+wt | V-ROD, V-GOWNEDGE | Stool view follows the patient to the table's end: seated with hands on the knees (empty-table framing fixed) · V-ROD · V-GOWNEDGE |
| 1440x900/hf-male/shots/051-head_neck__sitting_dangling__covered.png | f0ccca73ea56 | 0b84dda+wt | V-GOWNEDGE | Head & neck from the front: face and neck clear · V-GOWNEDGE |
| 1440x900/hf-male/shots/052-ear_left__sitting_dangling__covered.png | 09ad34af3d06 | 0b84dda+wt | V-HAIR | Left ear and the skin behind it, clear · V-HAIR |
| 1440x900/hf-male/shots/053-ear_right__sitting_dangling__covered.png | 9fe2b819f4b5 | 0b84dda+wt | V-HAIR | Right ear and mastoid, clear · V-HAIR |
| 1440x900/hf-male/shots/054-chest_front__sitting_dangling__covered.png | b729f9a5e8e2 | 0b84dda+wt | V-ROD | Chest from the front, face at the top · V-ROD |
| 1440x900/hf-male/shots/055-chest_back__sitting_dangling__covered.png | 3c4e8a7ae276 | 0b84dda+wt | V-HAIR | Back of the trunk from behind and above, sitting at the table's end: the back is reachable (no backrest), gown back panel · V-HAIR |
| 1440x900/hf-male/shots/056-abdomen__sitting_dangling__covered.png | 4301f4dc924a | 0b84dda+wt | V-ROD | Abdomen sitting, hands on the knees · V-ROD |
| 1440x900/hf-male/shots/057-arms__sitting_dangling__covered.png | 3371a36faba3 | 0b84dda+wt | V-ROD | Right arm sitting: arm, elbow and hand on the knee · V-ROD |
| 1440x900/hf-male/shots/058-hands__sitting_dangling__covered.png | 5c948f8a0d49 | 0b84dda+wt | V-ROD | Both hands on the knees, fully visible, legs over the table end · V-ROD |
| 1440x900/hf-male/shots/059-legs__sitting_dangling__covered.png | 1c7a6be1be1b | 0b84dda+wt | V-SHEET | Knees over the table end, hands on them · V-SHEET: the sheet hangs as a flat plane beside the shanks |
| 1440x900/hf-male/shots/060-feet__sitting_dangling__covered.png | c30dd305c4a4 | 0b84dda+wt | V-SHEET | Feet view sitting: the hanging sheet plane fills the frame and hides the feet (covered) · V-SHEET |
| 1440x900/hf-male/shots/061-overview__left_lateral_decubitus__covered.png | f1aa724c43d1 | 0b84dda+wt | V-LLD, V-LLDPRIV | Room view, left lateral: the top arm flung up overhead, legs bent but splayed; no sheet over the legs · V-LLD · V-LLDPRIV |
| 1440x900/hf-male/shots/062-seated__left_lateral_decubitus__covered.png | 669c78910e75 | 0b84dda+wt | V-LLD | Stool view of the left-lateral patient from behind: back, raised arm · V-LLD |
| 1440x900/hf-male/shots/063-head_neck__left_lateral_decubitus__covered.png | ea216fd238f7 | 0b84dda+wt | V-LLD, V-ROD | Head & neck in left lateral: face sideways on the pillow (as the patient lies), neck partly behind the shoulder · V-NECKLLD · V-ROD |
| 1440x900/hf-male/shots/064-ear_left__left_lateral_decubitus__covered.png | cbc3b451f795 | 0b84dda+wt | — | Left ear lying on the table: the frame is the table, and the new hint says "The left ear is against the table. Ask the patient to sit up or turn" (V-EARDOWN fixed) |
| 1440x900/hf-male/shots/065-ear_right__left_lateral_decubitus__covered.png | 96279379a99a | 0b84dda+wt | V-HAIR | Right (upper) ear and mastoid from above, clear · V-HAIR |
| 1440x900/hf-male/shots/066-chest_front__left_lateral_decubitus__covered.png | 3fa92bd37bfa | 0b84dda+wt | V-ROD | Chest in left lateral: front of the chest with the apex area facing the camera, face at the right · V-ROD |
| 1440x900/hf-male/shots/067-chest_back__left_lateral_decubitus__covered.png | eb04921d105c | 0b84dda+wt | V-SEAM | Back in left lateral, facing the camera with the gown back panel; no "against the table" hint (V-BACKHINT2 fixed) · faint dashed seam line on the table |
| 1440x900/hf-male/shots/068-abdomen__left_lateral_decubitus__covered.png | 3b3577f368ba | 0b84dda+wt | V-ROD, V-LLD | Abdomen in left lateral, the upper thigh across the frame · V-ROD · V-LLD |
| 1440x900/hf-male/shots/069-arms__left_lateral_decubitus__covered.png | 8b9e8c316436 | 0b84dda+wt | V-LLD | Arms in left lateral: the raised upper arm against the wall and sink from behind · V-ARMSLLD (pose: M3 V-LLD) |
| 1440x900/hf-male/shots/070-hands__left_lateral_decubitus__covered.png | 2178464ca72e | 0b84dda+wt | V-LLD | Hands in left lateral: one hand hangs off the table edge, the other is out of frame · V-HANDS (pose: M3 V-LLD) |
| 1440x900/hf-male/shots/071-legs__left_lateral_decubitus__covered.png | 85eeef86d387 | 0b84dda+wt | V-LLDPRIV | Legs bent in left lateral, no sheet over them · V-LLDPRIV |
| 1440x900/hf-male/shots/072-feet__left_lateral_decubitus__covered.png | f54645fbaf4b | 0b84dda+wt | V-LLDPRIV | Feet in left lateral, uncovered · V-LLDPRIV |
| 1440x900/hf-male/views/01-face__seated__covered.png | 43b6ba923a64 | 0b84dda+wt | — | OK: straight-on face, both eyes, nose and mouth fill the view (bug 4) |
| 1440x900/hf-male/views/02-neck_back__seated__covered.png | aca5f5d27bf8 | 0b84dda+wt | — | OK: back of the head and neck from behind and above, both posterior triangles and the occiput in view; gown collar at the base |
| 1440x900/hf-male/views/03-head_top__seated__covered.png | f26ebfd2a7d6 | 0b84dda+wt | — | OK: vertex from above, centred; backrest rails either side |
| 1440x900/hf-male/views/04-arms_left__seated__covered.png | b7aa6b428c3d | 0b84dda+wt | V-ROD | Left arm from the patient's left: upper arm, elbow, forearm and hand on the lap all visible · V-ROD: rod across the chest |
| 1440x900/hf-male/views/05-elbow_right__seated__covered.png | f2b01b7343e7 | 0b84dda+wt | — | OK: back of the right elbow (olecranon) centred, from above and behind; steep downward view past the table edge, but the target is clear |
| 1440x900/hf-male/views/06-elbow_left__seated__covered.png | 6e298ccd298f | 0b84dda+wt | — | OK: back of the left elbow centred (mirror of the right view) |
| 1440x900/hf-male/views/07-chest_right__seated__covered.png | e66b51684787 | 0b84dda+wt | V-ROD | Right side of the chest from in front of the hanging arm: the mid-axillary area between arm and pectoral is open · V-ROD: rod across the chest |
| 1440x900/hf-male/views/08-chest_left__seated__covered.png | 14bbfb21d009 | 0b84dda+wt | V-ROD | Left side of the chest (mirror view), lateral chest open in front of the arm · V-ROD: rod |
| 1440x900/hf-male/views/09-ankle_right__sitting_dangling__covered.png | 2c00233af9e5 | 0b84dda+wt | V-SHEET | Back of the right ankle (Achilles, heel) centred, legs hanging · V-SHEET: the leg sheet is a flat translucent plane cutting through the shank |
| 1440x900/hf-male/views/10-ankle_left__sitting_dangling__covered.png | c8672706e9e9 | 0b84dda+wt | V-SHEET | Back of the left ankle centred · V-SHEET: sheet plane through the shank |
| 1440x900/screening-female/dialogs/01-examine-menu.png | d82857a319d0 | 0b84dda+wt | V-MENUSCROLL | Examine menu (✕, search field, grouped regions) · V-MENUSCROLL: more groups below with no scroll cue |
| 1440x900/screening-female/dialogs/02-maneuver-menu.png | 48ce18eb9eea | 0b84dda+wt | V-SHEET | Maneuver menu for the thyroid (title, technique group, ✕, Show me) over the room view · V-SHEET: feet through the sheet |
| 1440x900/screening-female/dialogs/03-tool-chooser.png | 8b0f92266d16 | 0b84dda+wt | V-ROD | "Which exam?" chooser with ✕ and three palpation options over the abdomen (hands tool cursor and contact patch visible) · V-ROD |
| 1440x900/screening-female/dialogs/04-perform.png | 7114353f0d41 | 0b84dda+wt | V-PERFORMCLIP, V-ROD | Perform card with steps and the finding; the finding text is clipped at the canvas bottom · V-PERFORMCLIP · V-ROD |
| 1440x900/screening-female/dialogs/05-describe.png | 81f1a185b5c4 | 0b84dda+wt | V-TOASTSTACK | Mouth & throat verbal exam dialog (✕, text box, Cancel/Done) opened from the face view · V-TOASTSTACK: hygiene toast stays over the canvas under the modal |
| 1440x900/screening-female/dialogs/06-leave-confirm.png | 5ec291c780bc | 0b84dda+wt | V-TOASTSTACK | Leave-the-room confirmation (✕, Stay/Leave) · V-TOASTSTACK |
| 1440x900/screening-female/dialogs/07-actions-menu.png | 03272d35a6ef | 0b84dda+wt | V-MENUOVER, V-TOASTSTACK | Actions menu with ✕ and all positions incl. Sitting, legs dangling · V-MENUOVER: covers the Findings panel · V-TOASTSTACK |
| 1440x900/screening-female/dialogs/08-tools-menu.png | 5d18700ece66 | 0b84dda+wt | — | Tools menu (✕, every tool incl. BP cuff and hands) over the face view; one finding listed |
| 1440x900/screening-female/dialogs/09-bed-hud.png | 47dd82a5a362 | 0b84dda+wt | — | Head-of-table controls (✕, Raise/Lower/Done), opened from the seated view next to the lever |
| 1440x900/screening-female/dialogs/10-practice-help.png | 6b341977dd60 | 0b84dda+wt | V-HINTOVER | Hint popover (✕) · V-HINTOVER: covers the drape chips and Actions/Leave |
| 1440x900/screening-female/dialogs/11-finish.png | 905bac38a92b | 0b84dda+wt | — | Finish confirmation (✕, Keep going/Submit), backdrop dims the page |
| 1440x900/screening-female/drapes/01-chest_front__supine__chest-exposed.png | ef50ea291f6b | 0b84dda+wt | V-FCHEST, V-CHESTINV, V-ROD | Female chest uncovered: both breasts at once, viewed from the head end · V-FCHEST · V-CHESTINV · V-ROD |
| 1440x900/screening-female/drapes/02-abdomen__supine__abdomen-exposed.png | 2d0f630891bc | 0b84dda+wt | V-ROD, V-PUBIS | Abdomen uncovered, navel visible; the lower roll sits low over the pubic area · V-ROD · V-PUBIS |
| 1440x900/screening-female/drapes/03-legs__supine__legs-exposed.png | 2b26dc0cb495 | 0b84dda+wt | — | Legs uncovered supine: legs flat on the table, nothing clipping |
| 1440x900/screening-female/drapes/04-overview__supine__all-exposed.png | 5da339ff862f | 0b84dda+wt | V-PELVIS, V-ROD | All exposed: patient naked (pelvis exposed) · V-PELVIS · V-ROD |
| 1440x900/screening-female/room/01-corridor.png | c83d433ff505 | 0b84dda+wt | V-PLACARD, V-PLACEHOLDER | Practice corridor (screening) · V-PLACARD · V-PLACEHOLDER |
| 1440x900/screening-female/room/02-overview.png | 53d00c88f692 | 0b84dda+wt | V-SHEET | Room on entering, female seated · V-SHEET: feet through the sheet |
| 1440x900/screening-female/room/03-sink.png | 83c86f2a0294 | 0b84dda+wt | — | OK: sink with basin, faucet, soap and dispenser (bug 3) |
| 1440x900/screening-female/room/04-tool_table.png | ff84e049e75d | 0b84dda+wt | V-TOOLS | Tool table · V-TOOLS |
| 1440x900/screening-female/shots/001-overview__supine__covered.png | 74d42dffb797 | 0b84dda+wt | V-SHEET | Room view supine · V-SHEET: feet up through the sheet |
| 1440x900/screening-female/shots/002-seated__supine__covered.png | 3ab4950d775f | 0b84dda+wt | V-ARMS, V-ROD | Stool view supine · V-ARMS: forearm raised off the body · V-ROD |
| 1440x900/screening-female/shots/003-head_neck__supine__covered.png | c09055b2cb0e | 0b84dda+wt | V-ROD, V-GOWNFIT | Head & neck from the front on the pillow: face and neck clear · V-ROD · V-GOWNFIT |
| 1440x900/screening-female/shots/004-ear_left__supine__covered.png | 6b3fffc070a7 | 0b84dda+wt | V-HAIR | Left ear from the side, clear · V-HAIR |
| 1440x900/screening-female/shots/005-ear_right__supine__covered.png | bcb26472879d | 0b84dda+wt | V-HAIR | Right ear from the side, clear · V-HAIR |
| 1440x900/screening-female/shots/006-chest_front__supine__covered.png | d728bf790f2a | 0b84dda+wt | V-CHESTINV, V-ROD, V-ARMS, V-GOWNFIT | Chest from the head end, face upside down at the bottom · V-CHESTINV · V-ROD · V-ARMS · V-GOWNFIT |
| 1440x900/screening-female/shots/007-chest_back__supine__covered.png | ec1bfaccdcc9 | 0b84dda+wt | V-ROD, V-ARMS, V-GOWNFIT | Back view supine shows the front from above with the "back is against the table… sit up or lean forward" hint (correct) · V-ROD · V-ARMS · V-GOWNFIT |
| 1440x900/screening-female/shots/008-abdomen__supine__covered.png | 927d050616f6 | 0b84dda+wt | V-ROD, V-ARMS | Abdomen from above · V-ROD: two rods · V-ARMS: left hand hovers over the abdomen |
| 1440x900/screening-female/shots/009-arms__supine__covered.png | e75964b59e34 | 0b84dda+wt | V-ROD, V-ARMS, V-GOWNFIT | Right arm from the right · V-ARMS: arm raised off the table · V-ROD · V-GOWNFIT |
| 1440x900/screening-female/shots/010-hands__supine__covered.png | ad9294aba1af | 0b84dda+wt | V-ROD | Both hands beside the hips, visible (V-HANDS fixed supine) · V-ROD |
| 1440x900/screening-female/shots/011-legs__supine__covered.png | 77444d560822 | 0b84dda+wt | V-SHEET | Legs · V-SHEET: thighs and feet through the sheet |
| 1440x900/screening-female/shots/012-feet__supine__covered.png | 07759c81b9d4 | 0b84dda+wt | V-SHEET | Feet up through the sheet |
| 1440x900/screening-female/shots/013-overview__reclined_30__covered.png | c963a241af6e | 0b84dda+wt | V-SHEET | Room view at 30° · V-SHEET: feet through the sheet |
| 1440x900/screening-female/shots/014-seated__reclined_30__covered.png | e37425b990ed | 0b84dda+wt | V-ROD | Stool view at 30°, hands toward the lap · V-ROD |
| 1440x900/screening-female/shots/015-head_neck__reclined_30__covered.png | 6d92aa12c902 | 0b84dda+wt | V-GOWNFIT, V-GOWNEDGE | Head & neck from the front: face and neck clear · V-GOWNFIT · V-GOWNEDGE |
| 1440x900/screening-female/shots/016-ear_left__reclined_30__covered.png | d1105deef1f0 | 0b84dda+wt | V-HAIR | Left ear visible; the pillow fills the foreground below and behind it (the pillow takes no clicks) · V-HAIR · V-EARBACK |
| 1440x900/screening-female/shots/017-ear_right__reclined_30__covered.png | c9ed11e027c1 | 0b84dda+wt | V-HAIR | Right ear visible, pillow in the foreground · V-HAIR · V-EARBACK |
| 1440x900/screening-female/shots/018-chest_front__reclined_30__covered.png | 7e373170c112 | 0b84dda+wt | V-CHESTROT, V-ROD, V-GOWNFIT | Chest at 30°, rotated (face at the left) · V-CHESTROT · V-ROD · V-GOWNFIT |
| 1440x900/screening-female/shots/019-chest_back__reclined_30__covered.png | 98a5e495f2e8 | 0b84dda+wt | V-ROD | Back view at 30°: "back is against the table" hint shown (correct) · V-ROD |
| 1440x900/screening-female/shots/020-abdomen__reclined_30__covered.png | 45bc935da137 | 0b84dda+wt | V-ROD, V-GOWNFIT | Abdomen at 30°, hands at the thighs · V-ROD · V-GOWNFIT |
| 1440x900/screening-female/shots/021-arms__reclined_30__covered.png | cd155920fe31 | 0b84dda+wt | V-ROD, V-GOWNFIT | Right arm at 30°: arm along the side, hand at the thigh · V-ROD · V-GOWNFIT |
| 1440x900/screening-female/shots/022-hands__reclined_30__covered.png | edbdb36e2fdc | 0b84dda+wt | V-ARMS, V-ROD | Hands view at 30°: hands at the sides of the thighs, partly tucked under them (improved; M3 V-ARMS per-model arm pose) · V-ROD |
| 1440x900/screening-female/shots/023-legs__reclined_30__covered.png | 0dc36f5c9d48 | 0b84dda+wt | V-SHEET, V-ROD | Legs · V-SHEET: thighs and feet through the sheet · V-ROD |
| 1440x900/screening-female/shots/024-feet__reclined_30__covered.png | ab7caaddf29b | 0b84dda+wt | V-SHEET | Feet up through the sheet |
| 1440x900/screening-female/shots/025-overview__reclined_45__covered.png | 8cd800bc97a7 | 0b84dda+wt | V-SHEET | Room view at 45°, hands at the lap · V-SHEET: feet through the sheet |
| 1440x900/screening-female/shots/026-seated__reclined_45__covered.png | 42a7c99de4fe | 0b84dda+wt | V-ARMS, V-ROD | Stool view at 45°: forearms come forward over the thighs but the hands float above them · V-ROD |
| 1440x900/screening-female/shots/027-head_neck__reclined_45__covered.png | a0e53af81c5d | 0b84dda+wt | V-GOWNFIT, V-GOWNEDGE | Head & neck from the front at 45°: face and neck clear · V-GOWNFIT · V-GOWNEDGE |
| 1440x900/screening-female/shots/028-ear_left__reclined_45__covered.png | 3ab81c1907cc | 0b84dda+wt | V-HAIR | Left ear at 45°, clear (V-EARBACK fixed) · V-HAIR |
| 1440x900/screening-female/shots/029-ear_right__reclined_45__covered.png | 5ee882c97aa3 | 0b84dda+wt | V-HAIR | Right ear at 45°, clear (V-EARBACK fixed) · V-HAIR |
| 1440x900/screening-female/shots/030-chest_front__reclined_45__covered.png | 19c54df3cf67 | 0b84dda+wt | V-ROD, V-GOWNFIT | Chest at 45° from above the head end, face top-left · V-ROD · V-GOWNFIT |
| 1440x900/screening-female/shots/031-chest_back__reclined_45__covered.png | ba05a825024e | 0b84dda+wt | V-ROD | Back view at 45°: top of the head; "back is against the table" hint now shown at 45° (V-BACKHINT fixed) · V-ROD |
| 1440x900/screening-female/shots/032-abdomen__reclined_45__covered.png | 9a5f51625183 | 0b84dda+wt | V-ROD, V-GOWNFIT | Abdomen at 45°, hands at the thighs · V-ROD · V-GOWNFIT |
| 1440x900/screening-female/shots/033-arms__reclined_45__covered.png | 353303923c5a | 0b84dda+wt | V-ROD, V-GOWNFIT | Right arm at 45°: arm and hand at the thigh · V-ROD · V-GOWNFIT |
| 1440x900/screening-female/shots/034-hands__reclined_45__covered.png | 25609d82f3b7 | 0b84dda+wt | V-ROD | Both hands on the thighs, visible (V-HANDS fixed at 45° for the female model) · V-ROD |
| 1440x900/screening-female/shots/035-legs__reclined_45__covered.png | 384d5da02c67 | 0b84dda+wt | V-SHEET, V-ROD | Legs · V-SHEET: thighs and feet through the sheet · V-ROD |
| 1440x900/screening-female/shots/036-feet__reclined_45__covered.png | 4bf506e87b20 | 0b84dda+wt | V-SHEET | Feet up through the sheet |
| 1440x900/screening-female/shots/037-overview__seated__covered.png | 431d6a419953 | 0b84dda+wt | V-SHEET | Room view seated, hands in the lap · V-SHEET: feet through the sheet |
| 1440x900/screening-female/shots/038-seated__seated__covered.png | 11907a0e3599 | 0b84dda+wt | V-ARMS, V-ROD, V-GOWNFIT | Stool view seated: forearms reach forward, hands hover above the thighs · V-ROD · V-GOWNFIT |
| 1440x900/screening-female/shots/039-head_neck__seated__covered.png | b7b18addcfc9 | 0b84dda+wt | V-GOWNFIT, V-GOWNEDGE | Head & neck from the front seated: face and neck clear · V-GOWNFIT · V-GOWNEDGE |
| 1440x900/screening-female/shots/040-ear_left__seated__covered.png | eaf43e0621c1 | 0b84dda+wt | V-HAIR | Left ear from the side and a little behind, the skin behind the ear bare · V-HAIR |
| 1440x900/screening-female/shots/041-ear_right__seated__covered.png | fb0a1280a8a8 | 0b84dda+wt | V-HAIR | Right ear and mastoid from the side · V-HAIR |
| 1440x900/screening-female/shots/042-chest_front__seated__covered.png | 952a4df8060b | 0b84dda+wt | V-ROD, V-GOWNFIT | Chest from the front seated · V-ROD · V-GOWNFIT |
| 1440x900/screening-female/shots/043-chest_back__seated__covered.png | 08e06b0c1d6a | 0b84dda+wt | V-BACKREST | Back view seated: only the backrest fills the frame (patient sits into it) · V-BACKREST; the "lean forward" hint added after this shot (see the re-shot) |
| 1440x900/screening-female/shots/044-abdomen__seated__covered.png | 7884a986c449 | 0b84dda+wt | V-ROD, V-GOWNFIT | Abdomen seated, hands on the thighs · V-ROD · V-GOWNFIT |
| 1440x900/screening-female/shots/045-arms__seated__covered.png | f968f49e6756 | 0b84dda+wt | V-ROD, V-GOWNFIT | Right arm seated: arm, elbow and hand on the thigh in view (V-ARMSSEAT fixed: the arm is no longer hidden behind the body) · V-ROD · V-GOWNFIT |
| 1440x900/screening-female/shots/046-hands__seated__covered.png | 022a72c18486 | 0b84dda+wt | V-ROD | Both hands on the thighs, fully visible (V-HANDS fixed seated) · V-ROD |
| 1440x900/screening-female/shots/047-legs__seated__covered.png | 10be6511c5c3 | 0b84dda+wt | V-SHEET | Legs, hands on the thighs · V-SHEET: thighs and feet through the sheet |
| 1440x900/screening-female/shots/048-feet__seated__covered.png | 3fa6c346b15b | 0b84dda+wt | V-SHEET | Feet up through the sheet |
| 1440x900/screening-female/shots/049-overview__sitting_dangling__covered.png | 4de6494ae568 | 0b84dda+wt | V-SHEET, V-GOWNFIT | Room view: sitting at the foot end, legs hanging, hands on the thighs · V-SHEET: sheet hangs off the end · V-GOWNFIT |
| 1440x900/screening-female/shots/050-seated__sitting_dangling__covered.png | 9c160e1ef3f7 | 0b84dda+wt | V-ROD, V-GOWNFIT | Stool view follows the patient to the table's end (fixed) · V-ROD · V-GOWNFIT |
| 1440x900/screening-female/shots/051-head_neck__sitting_dangling__covered.png | 01f9a9955815 | 0b84dda+wt | V-GOWNFIT, V-GOWNEDGE | Head & neck from the front, sitting: face and neck clear · V-GOWNFIT · V-GOWNEDGE |
| 1440x900/screening-female/shots/052-ear_left__sitting_dangling__covered.png | bc3913539f33 | 0b84dda+wt | V-HAIR | Left ear and the skin behind it, sitting · V-HAIR |
| 1440x900/screening-female/shots/053-ear_right__sitting_dangling__covered.png | 040b6ce336c3 | 0b84dda+wt | V-HAIR | Right ear and mastoid, sitting · V-HAIR |
| 1440x900/screening-female/shots/054-chest_front__sitting_dangling__covered.png | fa3ecd3c7e36 | 0b84dda+wt | V-ROD, V-GOWNFIT | Chest from the front, sitting · V-ROD · V-GOWNFIT |
| 1440x900/screening-female/shots/055-chest_back__sitting_dangling__covered.png | a45e1978384b | 0b84dda+wt | V-GOWNFIT, V-HAIR | Back from behind and above, sitting at the table's end: the back is reachable · V-GOWNFIT: the gown back hugs the body · V-HAIR |
| 1440x900/screening-female/shots/056-abdomen__sitting_dangling__covered.png | b89101eada18 | 0b84dda+wt | V-ROD, V-GOWNFIT | Abdomen sitting, hands on the thighs · V-ROD · V-GOWNFIT |
| 1440x900/screening-female/shots/057-arms__sitting_dangling__covered.png | 0aed3aa19eb2 | 0b84dda+wt | V-ROD, V-GOWNFIT | Right arm sitting: arm and hand on the thigh · V-ROD · V-GOWNFIT |
| 1440x900/screening-female/shots/058-hands__sitting_dangling__covered.png | 47ec26a7fd64 | 0b84dda+wt | V-ROD, V-SHEET | Both hands on the thighs, knees over the table end · V-ROD · V-SHEET: sheet plane below the knees |
| 1440x900/screening-female/shots/059-legs__sitting_dangling__covered.png | a8d04eebcbf2 | 0b84dda+wt | V-SHEET | Knees over the table end · V-SHEET: flat sheet plane hangs in front of the shanks |
| 1440x900/screening-female/shots/060-feet__sitting_dangling__covered.png | 3aa63d182369 | 0b84dda+wt | V-SHEET | Feet view sitting: the hanging sheet plane fills the frame (covered) · V-SHEET |
| 1440x900/screening-female/shots/061-overview__left_lateral_decubitus__covered.png | e60a26a048e6 | 0b84dda+wt | V-LLD, V-LLDPRIV | Room view, left lateral: arm flung overhead, legs splayed, no sheet · V-LLD · V-LLDPRIV |
| 1440x900/screening-female/shots/062-seated__left_lateral_decubitus__covered.png | 57f0d9d286ad | 0b84dda+wt | V-LLD, V-LLDPRIV | Stool view of the back in left lateral: raised arm, buttock outline under the gown · V-LLD · V-LLDPRIV |
| 1440x900/screening-female/shots/063-head_neck__left_lateral_decubitus__covered.png | 494d283052f6 | 0b84dda+wt | V-LLD, V-GOWNFIT | Head & neck in left lateral: face sideways on the pillow, neck partly behind the shoulder · V-NECKLLD · V-GOWNFIT |
| 1440x900/screening-female/shots/064-ear_left__left_lateral_decubitus__covered.png | c327f4072f7a | 0b84dda+wt | V-LLD | Left ear lying on the table: the frame is the table, with the new hint "The left ear is against the table…" (V-EARDOWN fixed) · the camera clips into the table there (V-LLD pose, M3) |
| 1440x900/screening-female/shots/065-ear_right__left_lateral_decubitus__covered.png | 973efd6a0236 | 0b84dda+wt | V-HAIR | Right (upper) ear and mastoid, clear · V-HAIR |
| 1440x900/screening-female/shots/066-chest_front__left_lateral_decubitus__covered.png | be73cddd1746 | 0b84dda+wt | V-ROD, V-GOWNFIT | Chest in left lateral, apex side facing the camera · V-ROD · V-GOWNFIT |
| 1440x900/screening-female/shots/067-chest_back__left_lateral_decubitus__covered.png | a21204e6c9af | 0b84dda+wt | V-GOWNFIT | Back in left lateral facing the camera, no wrong hint (V-BACKHINT2 fixed) · V-GOWNFIT |
| 1440x900/screening-female/shots/068-abdomen__left_lateral_decubitus__covered.png | b0c8ddc7361b | 0b84dda+wt | V-ROD, V-LLD | Abdomen in left lateral, thigh across the frame · V-ROD · V-LLD |
| 1440x900/screening-female/shots/069-arms__left_lateral_decubitus__covered.png | 9b31ab869e7f | 0b84dda+wt | V-LLD | Arms in left lateral: the raised arm from behind against the door · V-ARMSLLD (pose: M3 V-LLD) |
| 1440x900/screening-female/shots/070-hands__left_lateral_decubitus__covered.png | 8b1362a78526 | 0b84dda+wt | V-LLD | Hands in left lateral: one hand hangs off the table edge, the other is out of frame · V-HANDS (pose: M3 V-LLD) |
| 1440x900/screening-female/shots/071-legs__left_lateral_decubitus__covered.png | af4e7c62da9c | 0b84dda+wt | V-LLDPRIV, V-LLD | Legs bent in left lateral, no sheet · V-LLDPRIV · V-LLD |
| 1440x900/screening-female/shots/072-feet__left_lateral_decubitus__covered.png | ebacbca5bbeb | 0b84dda+wt | V-LLDPRIV | Feet in left lateral, uncovered · V-LLDPRIV |
| 1440x900/screening-female/views/01-face__seated__covered.png | ab58dbdace7c | 0b84dda+wt | — | OK: straight-on face, eyes, nose and mouth (bug 4) |
| 1440x900/screening-female/views/02-neck_back__seated__covered.png | a837dff933f4 | 0b84dda+wt | — | OK: back of the head and neck, both sides of the neck and the occiput in view |
| 1440x900/screening-female/views/03-head_top__seated__covered.png | 981f8903726f | 0b84dda+wt | — | OK: vertex from above, centred |
| 1440x900/screening-female/views/04-arms_left__seated__covered.png | 1bbc598f23bb | 0b84dda+wt | V-ROD, V-GOWNFIT | Left arm from the patient's left: arm, elbow, forearm, hand on the lap · V-ROD: rod across the chest · V-GOWNFIT: skin-tight gown shows the breast outline |
| 1440x900/screening-female/views/05-elbow_right__seated__covered.png | c18897b56806 | 0b84dda+wt | — | OK: back of the right elbow centred, from above and behind |
| 1440x900/screening-female/views/06-elbow_left__seated__covered.png | fe47263130bb | 0b84dda+wt | — | OK: back of the left elbow centred (mirror view) |
| 1440x900/screening-female/views/07-chest_right__seated__covered.png | 624bf11763d6 | 0b84dda+wt | V-ROD, V-GOWNFIT | Right side of the chest in front of the hanging arm; lateral chest open · V-ROD: rod · V-GOWNFIT: breast outline through the gown |
| 1440x900/screening-female/views/08-chest_left__seated__covered.png | e2eb944cee7a | 0b84dda+wt | V-ROD, V-GOWNFIT | Left side of the chest (mirror) · V-ROD · V-GOWNFIT |
| 1440x900/screening-female/views/09-ankle_right__sitting_dangling__covered.png | 4784dfd2d05c | 0b84dda+wt | V-SHEET | Back of the right ankle (Achilles, heel) centred · V-SHEET: sheet plane cuts through the shank |
| 1440x900/screening-female/views/10-ankle_left__sitting_dangling__covered.png | 5d6a0a448d8d | 0b84dda+wt | V-SHEET | Back of the left ankle centred · V-SHEET |
