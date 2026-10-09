# Visual review (qa/REVIEW.md)

Every screenshot in `qa/screens/manifest.json` (207 PNGs from `npm run test:visual`; re-reviewed at the M2 gate, with clocks, dates and log times masked) was opened and reviewed by the main agent.
Determinism (M2 close, with masking): a second tour (run B, stopped after 140 shots) matched run A pixel for pixel on all 140
(`.cache/lab/pixdiff.mjs`, 0 changed pixels); the PNG bytes can still differ, so compare runs with the pixel diff, not the sha.
Run A against the earlier reviewed run: 201 identical; 6 differed only in masked dates, durations and log times (coach list,
coach detail, actions menu) — no new defects.
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
| V-JUSTIFY | high | grading | M4 | fixed | Fixed in M4: the justification counts only history points raised in the conversation and exam points whose maneuvers were performed; the label no longer says "the student" (tests/m4-hide-mistakes.test.ts). Was: results credit "Diagnoses are justified by findings the student elicited — orthopnea, raised JVP" when neither was elicited (JVP not examined; the note's claim is flagged as unperformed in the same feedback); "the student" in third person on a student page (found at the M2 gate) |
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
| 1440x900/hf-male/drapes/01-chest_front__supine__chest-left-exposed.png | a6b54a1df3d2 | UNREVIEWED | — | new |
| 1440x900/hf-male/drapes/02-abdomen__supine__abdomen-exposed.png | b73b7d39a212 | 0b84dda+wt | V-ROD, V-ARMS | Abdomen uncovered, navel visible; rolls above and below · V-ROD · V-ARMS: hands raised |
| 1440x900/hf-male/drapes/02-chest_front__supine__chest-exposed.png | 34690f084459 | UNREVIEWED | — | new |
| 1440x900/hf-male/drapes/03-abdomen__supine__abdomen-exposed.png | aa2cc413b825 | UNREVIEWED | — | new |
| 1440x900/hf-male/drapes/03-legs__supine__legs-exposed.png | dbd352c78bef | 0b84dda+wt | — | Legs uncovered supine: both legs flat on the table, nothing clipping |
| 1440x900/hf-male/drapes/04-legs__supine__legs-left-exposed.png | 9175d384fe06 | UNREVIEWED | — | new |
| 1440x900/hf-male/drapes/04-overview__supine__all-exposed.png | a618b3896338 | 0b84dda+wt | V-PELVIS, V-ROD | All exposed: the patient is naked (pelvis exposed) · V-PELVIS · V-ROD: rolls across chest and abdomen |
| 1440x900/hf-male/drapes/05-legs__supine__legs-exposed.png | 87bd5304c190 | UNREVIEWED | — | new |
| 1440x900/hf-male/drapes/06-overview__supine__all-exposed.png | ef77c432af33 | UNREVIEWED | — | new |
| 1440x900/hf-male/layout/01-station-inside.png | 048c870ee188 | 0b84dda+wt | V-SHEET, V-OVERFLOW | Station inside at 1440: door instructions with vitals, room view · V-SHEET: feet through the sheet · V-OVERFLOW: chat options cut at the bottom |
| 1440x900/hf-male/layout/02-note.png | 1a0acf2433c6 | 0b84dda+wt | — | Post-encounter note at 1440, readable |
| 1440x900/hf-male/layout/03-results.png | 3f85442b5f78 | 0b84dda+wt | — | Results: feedback with verbatim quotes, strengths, improvements (note claim of an unperformed JVP exam flagged), case debrief list |
| 1440x900/hf-male/layout/04-coach-list.png | d1109db6e8a5 | 0b84dda+wt | V-HINTS | Coach session list · V-HINTS: "1 hints" plural |
| 1440x900/hf-male/layout/05-coach-detail.png | c73c89f9a751 | 0b84dda+wt | — | Coach detail: feedback, pass banner, domain card with items and overrides, note with the unperformed-exam flag, transcript with match details |
| 1440x900/hf-male/room/00-exam-corridor-placard.png | fec6cf3400e2 | 0b84dda+wt | V-PLACARD, V-PLACEHOLDER | Exam-mode corridor: "You may begin" button, disabled "Knock and enter" with the wait message · V-PLACARD: blank 3D placard · V-PLACEHOLDER: chat says "Station finished" |
| 1440x900/hf-male/room/01-corridor.png | 28eb37d0ba1e | UNREVIEWED | V-PLACARD, V-PLACEHOLDER | changed (was 3de7ebe2286f) |
| 1440x900/hf-male/room/02-overview.png | c0e6e07c7c11 | UNREVIEWED | V-SHEET | changed (was 048c870ee188) |
| 1440x900/hf-male/room/03-sink.png | fedfcbc6fcf6 | UNREVIEWED | — | changed (was b05bce06c815) |
| 1440x900/hf-male/room/04-tool_table.png | d542c32635b3 | UNREVIEWED | V-TOOLS | changed (was 34dfbe6e2449) |
| 1440x900/hf-male/shots/001-overview__supine__covered.png | ef77c432af33 | UNREVIEWED | V-SHEET | changed (was 83d0309bbb0d) |
| 1440x900/hf-male/shots/002-seated__supine__covered.png | e724f36ba2e5 | UNREVIEWED | V-ARMS, V-ROD | changed (was 87f1655b70ad) |
| 1440x900/hf-male/shots/003-head_neck__supine__covered.png | 389b88cce5ea | UNREVIEWED | V-ROD, V-GOWNEDGE | changed (was 903c7ce8477f) |
| 1440x900/hf-male/shots/004-ear_left__supine__covered.png | 6b54ff8f8570 | UNREVIEWED | V-HAIR | changed (was 4ee593e8cabd) |
| 1440x900/hf-male/shots/005-ear_right__supine__covered.png | 41938d2f6bbe | UNREVIEWED | V-HAIR | changed (was a68f82d69649) |
| 1440x900/hf-male/shots/006-chest_front__supine__covered.png | a6b54a1df3d2 | UNREVIEWED | V-CHESTINV, V-ROD, V-ARMS | changed (was e800ce684722) |
| 1440x900/hf-male/shots/007-chest_back__supine__covered.png | 0c4b68727855 | UNREVIEWED | V-ROD, V-ARMS | changed (was 719d72d3b89d) |
| 1440x900/hf-male/shots/008-abdomen__supine__covered.png | 126809759ef7 | UNREVIEWED | V-ROD, V-ARMS | changed (was 74c249dbb742) |
| 1440x900/hf-male/shots/009-arms__supine__covered.png | b387a463894e | UNREVIEWED | V-ROD, V-ARMS | changed (was fcb466389180) |
| 1440x900/hf-male/shots/010-hands__supine__covered.png | 9936dd81ae82 | UNREVIEWED | V-ROD | changed (was 8c1f0b5be348) |
| 1440x900/hf-male/shots/011-legs__supine__covered.png | 87bd5304c190 | UNREVIEWED | V-SHEET | changed (was 7b58cad605cd) |
| 1440x900/hf-male/shots/012-feet__supine__covered.png | 5724656982ac | UNREVIEWED | V-SHEET | changed (was 75aa4b303f9d) |
| 1440x900/hf-male/shots/013-overview__reclined_30__covered.png | 4bec810011c2 | UNREVIEWED | V-SHEET | changed (was d3a1000fc1a6) |
| 1440x900/hf-male/shots/014-seated__reclined_30__covered.png | 38484dfc18e1 | UNREVIEWED | V-ARMS, V-ROD | changed (was 193e0ad15c4b) |
| 1440x900/hf-male/shots/015-head_neck__reclined_30__covered.png | e599aa65c835 | UNREVIEWED | V-GOWNEDGE | changed (was b4037fdb7d33) |
| 1440x900/hf-male/shots/016-ear_left__reclined_30__covered.png | 859dc095ecd4 | UNREVIEWED | V-HAIR | changed (was 636e9b227ffd) |
| 1440x900/hf-male/shots/017-ear_right__reclined_30__covered.png | 218b296afeab | UNREVIEWED | V-HAIR | changed (was 243ec251f34d) |
| 1440x900/hf-male/shots/018-chest_front__reclined_30__covered.png | 2e029cf585db | UNREVIEWED | V-CHESTROT, V-ROD | changed (was 369835aebcc9) |
| 1440x900/hf-male/shots/019-chest_back__reclined_30__covered.png | 00d8e33cc231 | UNREVIEWED | V-ROD | changed (was dde5a94ff1f6) |
| 1440x900/hf-male/shots/020-abdomen__reclined_30__covered.png | d8e5c8c774b8 | UNREVIEWED | V-ROD | changed (was db5dc7047fe2) |
| 1440x900/hf-male/shots/021-arms__reclined_30__covered.png | 37cdb7260e1b | UNREVIEWED | V-ROD | changed (was ec27ce06a730) |
| 1440x900/hf-male/shots/022-hands__reclined_30__covered.png | f425aef29d57 | UNREVIEWED | V-ROD | changed (was a10a58a8fdcf) |
| 1440x900/hf-male/shots/023-legs__reclined_30__covered.png | 6d19974d6383 | UNREVIEWED | V-SHEET, V-ROD | changed (was eb04af4b6b72) |
| 1440x900/hf-male/shots/024-feet__reclined_30__covered.png | 0eb42cf006c1 | UNREVIEWED | V-SHEET | changed (was f8240b428b6e) |
| 1440x900/hf-male/shots/025-overview__reclined_45__covered.png | 5ec5add849b0 | UNREVIEWED | V-SHEET | changed (was db2194364687) |
| 1440x900/hf-male/shots/026-seated__reclined_45__covered.png | dd4b583e6df4 | UNREVIEWED | V-ARMS, V-ROD | changed (was 331e38487f2e) |
| 1440x900/hf-male/shots/027-head_neck__reclined_45__covered.png | ca3b5aa6937e | UNREVIEWED | V-GOWNEDGE | changed (was 3eed08705371) |
| 1440x900/hf-male/shots/028-ear_left__reclined_45__covered.png | a080edf9b112 | UNREVIEWED | V-HAIR | changed (was 6bf1d20783a2) |
| 1440x900/hf-male/shots/029-ear_right__reclined_45__covered.png | c9eb63ba022e | UNREVIEWED | V-HAIR | changed (was 173431c98e6d) |
| 1440x900/hf-male/shots/030-chest_front__reclined_45__covered.png | 413e30fc7d1f | UNREVIEWED | V-ROD | changed (was 24d123881286) |
| 1440x900/hf-male/shots/031-chest_back__reclined_45__covered.png | d6f7ba25387e | UNREVIEWED | V-ROD | changed (was 3208460671a7) |
| 1440x900/hf-male/shots/032-abdomen__reclined_45__covered.png | 854c0ac0e7cb | UNREVIEWED | V-ROD | changed (was ec12066e97ac) |
| 1440x900/hf-male/shots/033-arms__reclined_45__covered.png | f2292dec811a | UNREVIEWED | V-ROD | changed (was 818fae068e9c) |
| 1440x900/hf-male/shots/034-hands__reclined_45__covered.png | 975d5a3b8984 | UNREVIEWED | V-ROD | changed (was 354f925e75a0) |
| 1440x900/hf-male/shots/035-legs__reclined_45__covered.png | 321cd635225d | UNREVIEWED | V-SHEET, V-ROD | changed (was 57b5a5c6a594) |
| 1440x900/hf-male/shots/036-feet__reclined_45__covered.png | 2840369a5813 | UNREVIEWED | V-SHEET | changed (was 95141e47e19e) |
| 1440x900/hf-male/shots/037-overview__seated__covered.png | c0e6e07c7c11 | UNREVIEWED | V-SHEET, V-BACKREST | changed (was 048c870ee188) |
| 1440x900/hf-male/shots/038-seated__seated__covered.png | 5e0fef252b50 | UNREVIEWED | V-ARMS, V-ROD | changed (was 121339c5a856) |
| 1440x900/hf-male/shots/039-head_neck__seated__covered.png | b7d27b3a9b0e | UNREVIEWED | V-GOWNEDGE | changed (was 7cabbd0237cb) |
| 1440x900/hf-male/shots/040-ear_left__seated__covered.png | a0bb7ff33735 | UNREVIEWED | V-HAIR | changed (was 06343e68862f) |
| 1440x900/hf-male/shots/041-ear_right__seated__covered.png | f2fd207b5832 | UNREVIEWED | V-HAIR | changed (was 7265f1054088) |
| 1440x900/hf-male/shots/042-chest_front__seated__covered.png | 599d88a7d0c2 | UNREVIEWED | V-ROD | changed (was 086bf157f97a) |
| 1440x900/hf-male/shots/043-chest_back__seated__covered.png | f13642a67aff | UNREVIEWED | V-BACKREST | changed (was 0f3d82213011) |
| 1440x900/hf-male/shots/044-abdomen__seated__covered.png | 412fd726cc46 | UNREVIEWED | V-ROD | changed (was bf56f717c39a) |
| 1440x900/hf-male/shots/045-arms__seated__covered.png | bd27ea4b617e | UNREVIEWED | V-ROD | changed (was 884b269c874f) |
| 1440x900/hf-male/shots/046-hands__seated__covered.png | aaea15f9f02f | UNREVIEWED | V-SHEET | changed (was ab6a127d729b) |
| 1440x900/hf-male/shots/047-legs__seated__covered.png | 861e485342d2 | UNREVIEWED | V-SHEET | changed (was 8525cc6a2a3c) |
| 1440x900/hf-male/shots/048-feet__seated__covered.png | 719ed7c02ad9 | UNREVIEWED | V-SHEET | changed (was d9f527f95262) |
| 1440x900/hf-male/shots/049-overview__sitting_dangling__covered.png | a52dd51fd203 | UNREVIEWED | V-SHEET | changed (was 212cdf88813d) |
| 1440x900/hf-male/shots/050-seated__sitting_dangling__covered.png | 590d8ca6300f | UNREVIEWED | V-ROD, V-GOWNEDGE | changed (was df5749651942) |
| 1440x900/hf-male/shots/051-head_neck__sitting_dangling__covered.png | 69f029468906 | UNREVIEWED | V-GOWNEDGE | changed (was f0ccca73ea56) |
| 1440x900/hf-male/shots/052-ear_left__sitting_dangling__covered.png | 260577e2f116 | UNREVIEWED | V-HAIR | changed (was 09ad34af3d06) |
| 1440x900/hf-male/shots/053-ear_right__sitting_dangling__covered.png | c422608438d2 | UNREVIEWED | V-HAIR | changed (was 9fe2b819f4b5) |
| 1440x900/hf-male/shots/054-chest_front__sitting_dangling__covered.png | 67f4c228b4f0 | UNREVIEWED | V-ROD | changed (was b729f9a5e8e2) |
| 1440x900/hf-male/shots/055-chest_back__sitting_dangling__covered.png | e377be31ae13 | UNREVIEWED | V-HAIR | changed (was 3c4e8a7ae276) |
| 1440x900/hf-male/shots/056-abdomen__sitting_dangling__covered.png | c2ce1f14a4b2 | UNREVIEWED | V-ROD | changed (was 4301f4dc924a) |
| 1440x900/hf-male/shots/057-arms__sitting_dangling__covered.png | f4e95dec0e61 | UNREVIEWED | V-ROD | changed (was 3371a36faba3) |
| 1440x900/hf-male/shots/058-hands__sitting_dangling__covered.png | 562447686c57 | UNREVIEWED | V-ROD | changed (was 5c948f8a0d49) |
| 1440x900/hf-male/shots/059-legs__sitting_dangling__covered.png | 9cf7678bda6a | UNREVIEWED | V-SHEET | changed (was 1c7a6be1be1b) |
| 1440x900/hf-male/shots/060-feet__sitting_dangling__covered.png | 7cfd5985fbd4 | UNREVIEWED | V-SHEET | changed (was c30dd305c4a4) |
| 1440x900/hf-male/shots/061-overview__left_lateral_decubitus__covered.png | c8a6a483b8e9 | UNREVIEWED | V-LLD, V-LLDPRIV | changed (was f1aa724c43d1) |
| 1440x900/hf-male/shots/062-seated__left_lateral_decubitus__covered.png | ef8a2a22f98a | UNREVIEWED | V-LLD | changed (was 669c78910e75) |
| 1440x900/hf-male/shots/063-head_neck__left_lateral_decubitus__covered.png | 61a8a5523b5c | UNREVIEWED | V-LLD, V-ROD | changed (was ea216fd238f7) |
| 1440x900/hf-male/shots/064-ear_left__left_lateral_decubitus__covered.png | faaa59a4ef2e | UNREVIEWED | — | changed (was cbc3b451f795) |
| 1440x900/hf-male/shots/065-ear_right__left_lateral_decubitus__covered.png | 9effa599cdc6 | UNREVIEWED | V-HAIR | changed (was 96279379a99a) |
| 1440x900/hf-male/shots/066-chest_front__left_lateral_decubitus__covered.png | 356c8f6822d0 | UNREVIEWED | V-ROD | changed (was 3fa92bd37bfa) |
| 1440x900/hf-male/shots/067-chest_back__left_lateral_decubitus__covered.png | 83e214f7a6aa | UNREVIEWED | V-SEAM | changed (was eb04921d105c) |
| 1440x900/hf-male/shots/068-abdomen__left_lateral_decubitus__covered.png | 44dfc0b26d3e | UNREVIEWED | V-ROD, V-LLD | changed (was 3b3577f368ba) |
| 1440x900/hf-male/shots/069-arms__left_lateral_decubitus__covered.png | c45c60551059 | UNREVIEWED | V-LLD | changed (was 8b9e8c316436) |
| 1440x900/hf-male/shots/070-hands__left_lateral_decubitus__covered.png | ca74ee8ff992 | UNREVIEWED | V-LLD | changed (was 2178464ca72e) |
| 1440x900/hf-male/shots/071-legs__left_lateral_decubitus__covered.png | 01d337b63003 | UNREVIEWED | V-LLDPRIV | changed (was 85eeef86d387) |
| 1440x900/hf-male/shots/072-feet__left_lateral_decubitus__covered.png | 17243512c08f | UNREVIEWED | V-LLDPRIV | changed (was f54645fbaf4b) |
| 1440x900/hf-male/views/01-face__seated__covered.png | fb3ca265d764 | UNREVIEWED | — | changed (was 43b6ba923a64) |
| 1440x900/hf-male/views/02-neck_back__seated__covered.png | 7251186bbdca | UNREVIEWED | — | changed (was aca5f5d27bf8) |
| 1440x900/hf-male/views/03-head_top__seated__covered.png | cceddca14bdc | UNREVIEWED | — | changed (was f26ebfd2a7d6) |
| 1440x900/hf-male/views/04-arms_left__seated__covered.png | 34313e053bbe | UNREVIEWED | V-ROD | changed (was b7aa6b428c3d) |
| 1440x900/hf-male/views/05-elbow_right__seated__covered.png | a949d111c177 | UNREVIEWED | — | changed (was f2b01b7343e7) |
| 1440x900/hf-male/views/06-elbow_left__seated__covered.png | b88c8be4cd1c | UNREVIEWED | — | changed (was 6e298ccd298f) |
| 1440x900/hf-male/views/07-chest_right__seated__covered.png | 6152d8826077 | UNREVIEWED | V-ROD | changed (was e66b51684787) |
| 1440x900/hf-male/views/08-chest_left__seated__covered.png | 0a289be1cf20 | UNREVIEWED | V-ROD | changed (was 14bbfb21d009) |
| 1440x900/hf-male/views/09-ankle_right__sitting_dangling__covered.png | fd699e8eebdf | UNREVIEWED | V-SHEET | changed (was 2c00233af9e5) |
| 1440x900/hf-male/views/10-ankle_left__sitting_dangling__covered.png | d23e629d8bfd | UNREVIEWED | V-SHEET | changed (was c8672706e9e9) |
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
| 1440x900/screening-female/drapes/01-chest_front__supine__chest-left-exposed.png | f62a471b81bd | UNREVIEWED | — | new |
| 1440x900/screening-female/drapes/02-abdomen__supine__abdomen-exposed.png | 2d0f630891bc | 0b84dda+wt | V-ROD, V-PUBIS | Abdomen uncovered, navel visible; the lower roll sits low over the pubic area · V-ROD · V-PUBIS |
| 1440x900/screening-female/drapes/02-chest_front__supine__chest-exposed.png | 2d12acf9cc15 | UNREVIEWED | — | new |
| 1440x900/screening-female/drapes/03-abdomen__supine__abdomen-exposed.png | 58ac6fe1068d | UNREVIEWED | — | new |
| 1440x900/screening-female/drapes/03-legs__supine__legs-exposed.png | 2b26dc0cb495 | 0b84dda+wt | — | Legs uncovered supine: legs flat on the table, nothing clipping |
| 1440x900/screening-female/drapes/04-legs__supine__legs-left-exposed.png | 13709be4794c | UNREVIEWED | — | new |
| 1440x900/screening-female/drapes/04-overview__supine__all-exposed.png | 5da339ff862f | 0b84dda+wt | V-PELVIS, V-ROD | All exposed: patient naked (pelvis exposed) · V-PELVIS · V-ROD |
| 1440x900/screening-female/drapes/05-legs__supine__legs-exposed.png | 38e87e1cb6f2 | UNREVIEWED | — | new |
| 1440x900/screening-female/room/01-corridor.png | 8313214ef2c3 | UNREVIEWED | V-PLACARD, V-PLACEHOLDER | changed (was c83d433ff505) |
| 1440x900/screening-female/room/02-overview.png | 4faa4bba4d37 | UNREVIEWED | V-SHEET | changed (was 53d00c88f692) |
| 1440x900/screening-female/room/03-sink.png | fd1bb67a81e7 | UNREVIEWED | — | changed (was 83c86f2a0294) |
| 1440x900/screening-female/room/04-tool_table.png | c38724a2aa95 | UNREVIEWED | V-TOOLS | changed (was ff84e049e75d) |
| 1440x900/screening-female/shots/001-overview__supine__covered.png | a0677062c159 | UNREVIEWED | V-SHEET | changed (was 74d42dffb797) |
| 1440x900/screening-female/shots/002-seated__supine__covered.png | 428d235f15ee | UNREVIEWED | V-ARMS, V-ROD | changed (was 3ab4950d775f) |
| 1440x900/screening-female/shots/003-head_neck__supine__covered.png | f313ba49ab3f | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was c09055b2cb0e) |
| 1440x900/screening-female/shots/004-ear_left__supine__covered.png | a4b30dd1388f | UNREVIEWED | V-HAIR | changed (was 6b3fffc070a7) |
| 1440x900/screening-female/shots/005-ear_right__supine__covered.png | 37595fb27f36 | UNREVIEWED | V-HAIR | changed (was bcb26472879d) |
| 1440x900/screening-female/shots/006-chest_front__supine__covered.png | f62a471b81bd | UNREVIEWED | V-CHESTINV, V-ROD, V-ARMS, V-GOWNFIT | changed (was d728bf790f2a) |
| 1440x900/screening-female/shots/007-chest_back__supine__covered.png | 41802a7ccd38 | UNREVIEWED | V-ROD, V-ARMS, V-GOWNFIT | changed (was ec1bfaccdcc9) |
| 1440x900/screening-female/shots/008-abdomen__supine__covered.png | 58ac6fe1068d | UNREVIEWED | V-ROD, V-ARMS | changed (was 927d050616f6) |
| 1440x900/screening-female/shots/009-arms__supine__covered.png | e0d822fb1501 | UNREVIEWED | V-ROD, V-ARMS, V-GOWNFIT | changed (was e75964b59e34) |
| 1440x900/screening-female/shots/010-hands__supine__covered.png | 251be4768295 | UNREVIEWED | V-ROD | changed (was ad9294aba1af) |
| 1440x900/screening-female/shots/011-legs__supine__covered.png | 38e87e1cb6f2 | UNREVIEWED | V-SHEET | changed (was 77444d560822) |
| 1440x900/screening-female/shots/012-feet__supine__covered.png | eb3c58ace893 | UNREVIEWED | V-SHEET | changed (was 07759c81b9d4) |
| 1440x900/screening-female/shots/013-overview__reclined_30__covered.png | cd12e9ddb10b | UNREVIEWED | V-SHEET | changed (was c963a241af6e) |
| 1440x900/screening-female/shots/014-seated__reclined_30__covered.png | 0f6a87a6cca1 | UNREVIEWED | V-ROD | changed (was e37425b990ed) |
| 1440x900/screening-female/shots/015-head_neck__reclined_30__covered.png | 25a0812f76c9 | UNREVIEWED | V-GOWNFIT, V-GOWNEDGE | changed (was 6d92aa12c902) |
| 1440x900/screening-female/shots/016-ear_left__reclined_30__covered.png | f14151da169e | UNREVIEWED | V-HAIR | changed (was d1105deef1f0) |
| 1440x900/screening-female/shots/017-ear_right__reclined_30__covered.png | 0cc9760e60ca | UNREVIEWED | V-HAIR | changed (was c9ed11e027c1) |
| 1440x900/screening-female/shots/018-chest_front__reclined_30__covered.png | 867b157105c7 | UNREVIEWED | V-CHESTROT, V-ROD, V-GOWNFIT | changed (was 7e373170c112) |
| 1440x900/screening-female/shots/019-chest_back__reclined_30__covered.png | a0b7587e2123 | UNREVIEWED | V-ROD | changed (was 98a5e495f2e8) |
| 1440x900/screening-female/shots/020-abdomen__reclined_30__covered.png | 4d924e5bcd39 | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was 45bc935da137) |
| 1440x900/screening-female/shots/021-arms__reclined_30__covered.png | 5ec33ecbcad0 | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was cd155920fe31) |
| 1440x900/screening-female/shots/022-hands__reclined_30__covered.png | fe95760a9556 | UNREVIEWED | V-ARMS, V-ROD | changed (was edbdb36e2fdc) |
| 1440x900/screening-female/shots/023-legs__reclined_30__covered.png | 3bf31f48058a | UNREVIEWED | V-SHEET, V-ROD | changed (was 0dc36f5c9d48) |
| 1440x900/screening-female/shots/024-feet__reclined_30__covered.png | a44c7d7bb45d | UNREVIEWED | V-SHEET | changed (was ab7caaddf29b) |
| 1440x900/screening-female/shots/025-overview__reclined_45__covered.png | 245c5f50ca40 | UNREVIEWED | V-SHEET | changed (was 8cd800bc97a7) |
| 1440x900/screening-female/shots/026-seated__reclined_45__covered.png | 26d8ab79df43 | UNREVIEWED | V-ARMS, V-ROD | changed (was 42a7c99de4fe) |
| 1440x900/screening-female/shots/027-head_neck__reclined_45__covered.png | c68791864bb2 | UNREVIEWED | V-GOWNFIT, V-GOWNEDGE | changed (was a0e53af81c5d) |
| 1440x900/screening-female/shots/028-ear_left__reclined_45__covered.png | e0cabc29a25d | UNREVIEWED | V-HAIR | changed (was 3ab81c1907cc) |
| 1440x900/screening-female/shots/029-ear_right__reclined_45__covered.png | 179182e6869b | UNREVIEWED | V-HAIR | changed (was 5ee882c97aa3) |
| 1440x900/screening-female/shots/030-chest_front__reclined_45__covered.png | 690259eb1fed | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was 19c54df3cf67) |
| 1440x900/screening-female/shots/031-chest_back__reclined_45__covered.png | d2df56a2daa2 | UNREVIEWED | V-ROD | changed (was ba05a825024e) |
| 1440x900/screening-female/shots/032-abdomen__reclined_45__covered.png | 4b9e2d55b425 | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was 9a5f51625183) |
| 1440x900/screening-female/shots/033-arms__reclined_45__covered.png | 9c49001ff412 | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was 353303923c5a) |
| 1440x900/screening-female/shots/034-hands__reclined_45__covered.png | 8dccab2b14de | UNREVIEWED | V-ROD | changed (was 25609d82f3b7) |
| 1440x900/screening-female/shots/035-legs__reclined_45__covered.png | 79d90336105b | UNREVIEWED | V-SHEET, V-ROD | changed (was 384d5da02c67) |
| 1440x900/screening-female/shots/036-feet__reclined_45__covered.png | 060adada5541 | UNREVIEWED | V-SHEET | changed (was 4bf506e87b20) |
| 1440x900/screening-female/shots/037-overview__seated__covered.png | 4faa4bba4d37 | UNREVIEWED | V-SHEET | changed (was 431d6a419953) |
| 1440x900/screening-female/shots/038-seated__seated__covered.png | 5bd5e16bde13 | UNREVIEWED | V-ARMS, V-ROD, V-GOWNFIT | changed (was 11907a0e3599) |
| 1440x900/screening-female/shots/039-head_neck__seated__covered.png | 55fc3fb0a0c3 | UNREVIEWED | V-GOWNFIT, V-GOWNEDGE | changed (was b7b18addcfc9) |
| 1440x900/screening-female/shots/040-ear_left__seated__covered.png | 968ce46321da | UNREVIEWED | V-HAIR | changed (was eaf43e0621c1) |
| 1440x900/screening-female/shots/041-ear_right__seated__covered.png | 55e6f8e3a4ee | UNREVIEWED | V-HAIR | changed (was fb0a1280a8a8) |
| 1440x900/screening-female/shots/042-chest_front__seated__covered.png | 1f822f519992 | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was 952a4df8060b) |
| 1440x900/screening-female/shots/043-chest_back__seated__covered.png | 2f94dc17e9d1 | UNREVIEWED | V-BACKREST | changed (was 08e06b0c1d6a) |
| 1440x900/screening-female/shots/044-abdomen__seated__covered.png | d167138aee1f | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was 7884a986c449) |
| 1440x900/screening-female/shots/045-arms__seated__covered.png | bac4f0f8b293 | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was f968f49e6756) |
| 1440x900/screening-female/shots/046-hands__seated__covered.png | 1f405bc731e3 | UNREVIEWED | V-ROD | changed (was 022a72c18486) |
| 1440x900/screening-female/shots/047-legs__seated__covered.png | aa58ac678703 | UNREVIEWED | V-SHEET | changed (was 10be6511c5c3) |
| 1440x900/screening-female/shots/048-feet__seated__covered.png | a439bc9c6d59 | UNREVIEWED | V-SHEET | changed (was 3fa6c346b15b) |
| 1440x900/screening-female/shots/049-overview__sitting_dangling__covered.png | 376b8ae05cc8 | UNREVIEWED | V-SHEET, V-GOWNFIT | changed (was 4de6494ae568) |
| 1440x900/screening-female/shots/050-seated__sitting_dangling__covered.png | 00e75650e9b2 | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was 9c160e1ef3f7) |
| 1440x900/screening-female/shots/051-head_neck__sitting_dangling__covered.png | a107480914e6 | UNREVIEWED | V-GOWNFIT, V-GOWNEDGE | changed (was 01f9a9955815) |
| 1440x900/screening-female/shots/052-ear_left__sitting_dangling__covered.png | e583269614f7 | UNREVIEWED | V-HAIR | changed (was bc3913539f33) |
| 1440x900/screening-female/shots/053-ear_right__sitting_dangling__covered.png | 60442b50f779 | UNREVIEWED | V-HAIR | changed (was 040b6ce336c3) |
| 1440x900/screening-female/shots/054-chest_front__sitting_dangling__covered.png | 57b0661a8c3e | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was fa3ecd3c7e36) |
| 1440x900/screening-female/shots/055-chest_back__sitting_dangling__covered.png | 67507dd53f33 | UNREVIEWED | V-GOWNFIT, V-HAIR | changed (was a45e1978384b) |
| 1440x900/screening-female/shots/056-abdomen__sitting_dangling__covered.png | 850d75dd022a | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was b89101eada18) |
| 1440x900/screening-female/shots/057-arms__sitting_dangling__covered.png | 4a95862b81c7 | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was 0aed3aa19eb2) |
| 1440x900/screening-female/shots/058-hands__sitting_dangling__covered.png | c600a8bb70a3 | UNREVIEWED | V-ROD, V-SHEET | changed (was 47ec26a7fd64) |
| 1440x900/screening-female/shots/059-legs__sitting_dangling__covered.png | 76547cc048e6 | UNREVIEWED | V-SHEET | changed (was a8d04eebcbf2) |
| 1440x900/screening-female/shots/060-feet__sitting_dangling__covered.png | be72e9412ea3 | UNREVIEWED | V-SHEET | changed (was 3aa63d182369) |
| 1440x900/screening-female/shots/061-overview__left_lateral_decubitus__covered.png | abe96c9e3e79 | UNREVIEWED | V-LLD, V-LLDPRIV | changed (was e60a26a048e6) |
| 1440x900/screening-female/shots/062-seated__left_lateral_decubitus__covered.png | f193c978ef7f | UNREVIEWED | V-LLD, V-LLDPRIV | changed (was 57f0d9d286ad) |
| 1440x900/screening-female/shots/063-head_neck__left_lateral_decubitus__covered.png | 2f167ad9f603 | UNREVIEWED | V-LLD, V-GOWNFIT | changed (was 494d283052f6) |
| 1440x900/screening-female/shots/064-ear_left__left_lateral_decubitus__covered.png | 0f2ce5b7def0 | UNREVIEWED | V-LLD | changed (was c327f4072f7a) |
| 1440x900/screening-female/shots/065-ear_right__left_lateral_decubitus__covered.png | 67c794dda42a | UNREVIEWED | V-HAIR | changed (was 973efd6a0236) |
| 1440x900/screening-female/shots/066-chest_front__left_lateral_decubitus__covered.png | 13113f752659 | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was be73cddd1746) |
| 1440x900/screening-female/shots/067-chest_back__left_lateral_decubitus__covered.png | e86e5a6b889c | UNREVIEWED | V-GOWNFIT | changed (was a21204e6c9af) |
| 1440x900/screening-female/shots/068-abdomen__left_lateral_decubitus__covered.png | a4ee715b1f5e | UNREVIEWED | V-ROD, V-LLD | changed (was b0c8ddc7361b) |
| 1440x900/screening-female/shots/069-arms__left_lateral_decubitus__covered.png | 99e99191f55e | UNREVIEWED | V-LLD | changed (was 9b31ab869e7f) |
| 1440x900/screening-female/shots/070-hands__left_lateral_decubitus__covered.png | bc70d529c64e | UNREVIEWED | V-LLD | changed (was 8b1362a78526) |
| 1440x900/screening-female/shots/071-legs__left_lateral_decubitus__covered.png | 8541ef7154d9 | UNREVIEWED | V-LLDPRIV, V-LLD | changed (was af4e7c62da9c) |
| 1440x900/screening-female/shots/072-feet__left_lateral_decubitus__covered.png | 9634f0974c3b | UNREVIEWED | V-LLDPRIV | changed (was ebacbca5bbeb) |
| 1440x900/screening-female/views/01-face__seated__covered.png | 688206d08fa4 | UNREVIEWED | — | changed (was ab58dbdace7c) |
| 1440x900/screening-female/views/02-neck_back__seated__covered.png | faf097ff67a6 | UNREVIEWED | — | changed (was a837dff933f4) |
| 1440x900/screening-female/views/03-head_top__seated__covered.png | afb38f744e22 | UNREVIEWED | — | changed (was 981f8903726f) |
| 1440x900/screening-female/views/04-arms_left__seated__covered.png | 786dcbc451a5 | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was 1bbc598f23bb) |
| 1440x900/screening-female/views/05-elbow_right__seated__covered.png | ce8736905959 | UNREVIEWED | — | changed (was c18897b56806) |
| 1440x900/screening-female/views/06-elbow_left__seated__covered.png | b497a734e94f | UNREVIEWED | — | changed (was fe47263130bb) |
| 1440x900/screening-female/views/07-chest_right__seated__covered.png | 7f4ee4fcd8a8 | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was 624bf11763d6) |
| 1440x900/screening-female/views/08-chest_left__seated__covered.png | 6778e5e9c286 | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was e2eb944cee7a) |
| 1440x900/screening-female/views/09-ankle_right__sitting_dangling__covered.png | 9d840d537aea | UNREVIEWED | V-SHEET | changed (was 4784dfd2d05c) |
| 1440x900/screening-female/views/10-ankle_left__sitting_dangling__covered.png | 6d8a0b0be989 | UNREVIEWED | V-SHEET | changed (was 5d6a0a448d8d) |
