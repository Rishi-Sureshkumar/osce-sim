# Visual review (qa/REVIEW.md)

Every screenshot in `qa/screens/manifest.json` (163 PNGs from `npm run test:visual`) was opened and reviewed by the main agent.
Rows carry the sha256 prefix of the reviewed PNG; `npm run qa:review-check` fails on a new or changed screenshot until it is
reviewed again (`-- --scaffold` adds the rows). High defects must have an owner milestone; `QA_STRICT_OWNER=<M>` fails that owner's open highs.

## Defects

| id | severity | category | owner | status | description |
|---|---|---|---|---|---|
| V-FEEDBACK | high | grading | M1 | fixed | Feedback "Missed:" lines pasted grader guidance (cut at "e.g."); first-third window missed early greetings in short sessions — fixed in M1 (labels only; first 3 turns count as the opening) (6 shots) |
| V-HANDS | high | shot | M2 | open | Hands shot frames the thighs/table; the hands are hidden (bug 4) (8 shots) |
| V-NECK | high | shot | M2 | open | head_neck shot looks down on the scalp or from the head end: neck hidden by the chin, no front view of the face (bug 4) (8 shots) |
| V-SINK | high | room | M2 | fixed | Sink has no basin, soap or towel (bug 3) — fixed in M2 bug 3 (basin ≥ 10 cm, faucet, soap, towels; washing over the basin) (4 shots) |
| V-ARMS | high | pose | M3 | open | Supine arms hover above the table instead of resting (2 shots) |
| V-BACKREST | high | room | M3 | open | Seated: patient sits 11-15 cm inside the backrest; the back shot shows only the backrest (M3 intersections xfail) (2 shots) |
| V-EARBACK | high | shot | M3 | open | Ear shots in reclined positions are blocked by the raised backrest (8 shots) |
| V-FCHEST | high | drape | M3 | open | Female chest uncovers both breasts at once; must be per side and covered by default (1 shots) |
| V-LLD | high | pose | M3 | open | Left lateral decubitus pose contorted (arm flung up, hangs off the table edge) and the leg sheet disappears (6 shots) |
| V-LLDPRIV | high | drape | M3 | open | LLD: gown rides up, buttocks exposed, no sheet (2 shots) |
| V-PELVIS | high | drape | M3 | open | "All exposed" leaves the patient naked: the pelvis section must never be exposed (2 shots) |
| V-PUBIS | high | drape | M3 | open | Female abdomen exposure reaches the pubic area (pelvis section must stay covered) (1 shots) |
| V-SHEET | high | drape | M3 | open | Legs/feet poke through the leg sheet while "Legs: covered" (bug 6) (18 shots) |
| V-ARMSLLD | medium | shot | M2 | open | LLD arms shot frames the raised arm against the wall from behind (2 shots) |
| V-ARMSSEAT | medium | shot | M2 | open | Seated arms shot frames the torso; the arm is hidden behind the body (1 shots) |
| V-BACKHINT | medium | ux | M2 | open | Reclined 45°: back against the backrest but no "ask the patient to sit up" hint (2 shots) |
| V-BACKHINT2 | medium | ux | M2 | open | LLD: hint wrongly says the back is against the table (2 shots) |
| V-NECKLLD | medium | shot | M2 | open | LLD head_neck: face sideways, neck hidden by the shoulder (2 shots) |
| V-BODY | medium | asset | M3 | open | Female body barely differs from the male (proportions, hair) (2 shots) |
| V-ROD | medium | drape | M3 | open | Rolled/folded gown edges render as floating light-blue rods across the body (the roll-chest rod lies over the apex) (59 shots) |
| V-CHESTINV | medium | shot | M6 | open | Supine chest shot from the head end: the face is upside down at the bottom of the frame (3 shots) |
| V-PERFORMCLIP | medium | ui | M6 | open | Perform card clips the finding text at the canvas bottom (1 shots) |
| V-PLACARD | medium | ui | M6 | open | 3D door placard is a blank rectangle (text only in the side panel) (3 shots) |
| V-WRAP | medium | ui | M6 | open | Toolbar wraps at 1280/1180 wide ("Actions"/"Leave the room" on a second row) (2 shots) |
| V-EARDOWN | low | ux | M2 | open | LLD: the left ear faces the table; shot shows the back of the head (needs a hint) (2 shots) |
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

## Screenshots

| file | sha256 | reviewed@ | defects | notes |
|---|---|---|---|---|
| 1180x820/hf-male/layout/01-station-inside.png | d637a6cba976 | 88e02c9+wt | V-WRAP | V-WRAP: Actions and Leave wrap to a second toolbar row; chat below the fold |
| 1180x820/hf-male/layout/02-note.png | 86d0c29c91c6 | 88e02c9+wt | — | OK |
| 1180x820/hf-male/layout/03-results.png | 7d71577453f2 | 88e02c9+wt | V-FEEDBACK | V-FEEDBACK: feedback text (fixed in M1) |
| 1180x820/hf-male/layout/04-coach-list.png | b662f3b53efe | 88e02c9+wt | V-HINTS | V-HINTS: "1 hints" |
| 1180x820/hf-male/layout/05-coach-detail.png | 479d91d70cee | 88e02c9+wt | V-FEEDBACK | V-FEEDBACK: feedback text (fixed in M1) |
| 1280x800/hf-male/layout/01-station-inside.png | fc5d379a2217 | 88e02c9+wt | V-WRAP, V-OVERFLOW | V-WRAP: "Leave the room" wraps to a second toolbar row · V-OVERFLOW: chat panel below the fold |
| 1280x800/hf-male/layout/02-note.png | 1b60f8737ddb | 88e02c9+wt | — | OK |
| 1280x800/hf-male/layout/03-results.png | e476d2097fa4 | 88e02c9+wt | V-FEEDBACK | V-FEEDBACK: feedback text (fixed in M1) |
| 1280x800/hf-male/layout/04-coach-list.png | 57c6b1a393c6 | 88e02c9+wt | V-HINTS | V-HINTS: "1 hints" |
| 1280x800/hf-male/layout/05-coach-detail.png | 76ef6ed20ac1 | 88e02c9+wt | V-FEEDBACK | V-FEEDBACK: feedback text (fixed in M1) |
| 1440x900/hf-male/drapes/01-chest_front__supine__chest-exposed.png | 295966018c2b | 88e02c9+wt | V-CHESTINV, V-ROD | V-CHESTINV: supine chest shot from the head end: face upside down at the bottom · V-ROD: rolled gown is a thick rod lying over the upper chest/apex |
| 1440x900/hf-male/drapes/02-abdomen__supine__abdomen-exposed.png | 73765eb53d55 | 88e02c9+wt | V-ROD | V-ROD: rods; navel dimple visible (useful for the bug 5 umbilicus check) |
| 1440x900/hf-male/drapes/03-legs__supine__legs-exposed.png | 188fe5ab6329 | 88e02c9+wt | V-ROD | V-ROD: gown edge rod at the thighs; pelvis stays covered (good) |
| 1440x900/hf-male/drapes/04-overview__supine__all-exposed.png | ce3309704134 | 88e02c9+wt | V-PELVIS | V-PELVIS: with all three sections uncovered the patient is fully naked (pelvis exposed). The pelvis must never be exposed (M3 sectioned drapes) |
| 1440x900/hf-male/layout/01-station-inside.png | 8bcc661f8a2c | 88e02c9+wt | V-ROD, V-OVERFLOW | V-ROD: rods · V-OVERFLOW: left column cut off at the bottom (chat options) |
| 1440x900/hf-male/layout/02-note.png | dcbe74389091 | 88e02c9+wt | — | OK |
| 1440x900/hf-male/layout/03-results.png | beea9d748db5 | 88e02c9+wt | V-FEEDBACK | V-FEEDBACK: "Missed:" lines paste grader guidance cut at "e.g." (fixed in M1: labels only); greet-by-name missed because first_third is clock-based (fixed in M1: first 3 turns count) |
| 1440x900/hf-male/layout/04-coach-list.png | ec4747b6530b | 88e02c9+wt | V-HINTS | V-HINTS: "1 hints" plural |
| 1440x900/hf-male/layout/05-coach-detail.png | 55f40d7c3ce7 | 88e02c9+wt | V-FEEDBACK | V-FEEDBACK: same feedback text issue (fixed in M1); matcher view shows correctly |
| 1440x900/hf-male/room/00-exam-corridor-placard.png | 92b0937c1be7 | 88e02c9+wt | V-PLACARD, V-PLACEHOLDER, V-OVERFLOW | V-PLACARD: 3D placard is blank (text only in the panel) · V-PLACEHOLDER: chat shows "Station finished" before the encounter · V-OVERFLOW: left column overflows: the "Enhanced patient" row is cut off at 1440x900 |
| 1440x900/hf-male/room/01-corridor.png | 83bbb6a5bfb3 | 88e02c9+wt | V-PLACARD | V-PLACARD: door placard in 3D is a blank grey rectangle (text only in the side panel) |
| 1440x900/hf-male/room/02-overview.png | c38e67f13bd6 | 88e02c9+wt | V-SINK, V-ROD | V-SINK: sink has no basin (bug 3) · V-ROD: rods on the chest |
| 1440x900/hf-male/room/03-sink.png | 1dcbf877bed5 | 88e02c9+wt | V-SINK | V-SINK: flat slab with a tap, no basin, no soap/towel (bug 3) |
| 1440x900/hf-male/room/04-tool_table.png | 84054fad835d | 88e02c9+wt | V-TOOLS | V-TOOLS: instruments are crude primitives (acceptable for now) |
| 1440x900/hf-male/shots/001-overview__supine__covered.png | de5d5261ec6b | 88e02c9+wt | V-ROD | V-ROD: rods on the chest |
| 1440x900/hf-male/shots/002-seated__supine__covered.png | 29df2423c70c | 88e02c9+wt | V-ARMS | V-ARMS: supine arms hover above the table, hands raised (pose not resting on the bed) |
| 1440x900/hf-male/shots/003-head_neck__supine__covered.png | bd82874f1171 | 88e02c9+wt | V-NECK | V-NECK: head_neck shot from the head end: face upside down, neck hidden; no front view of the face (bug 4) |
| 1440x900/hf-male/shots/004-ear_left__supine__covered.png | 93819b2a4ea7 | 88e02c9+wt | V-HAIR | V-HAIR: jagged hair edge; mastoid region partly under the hair shell (bug 2 related) |
| 1440x900/hf-male/shots/005-ear_right__supine__covered.png | 27c3092ed5c7 | 88e02c9+wt | V-HAIR | V-HAIR: jagged hair edge |
| 1440x900/hf-male/shots/006-chest_front__supine__covered.png | e80adc2a83da | 88e02c9+wt | V-CHESTINV, V-ROD | V-CHESTINV: chest shot from the head end, face upside down · V-ROD: rod across the chest |
| 1440x900/hf-male/shots/007-chest_back__supine__covered.png | 5968148ed101 | 88e02c9+wt | V-ROD | V-ROD: rods; hint correctly says the back is against the table |
| 1440x900/hf-male/shots/008-abdomen__supine__covered.png | cde6e968b105 | 88e02c9+wt | V-ROD | V-ROD: rods |
| 1440x900/hf-male/shots/009-arms__supine__covered.png | 8d9f8038ba39 | 88e02c9+wt | V-ROD | V-ROD: rod over the shoulder |
| 1440x900/hf-male/shots/010-hands__supine__covered.png | 84c7f364111e | 88e02c9+wt | V-ROD | V-ROD: rod across the hips; hands visible (OK) |
| 1440x900/hf-male/shots/011-legs__supine__covered.png | 1d64909f80f2 | 88e02c9+wt | V-SHEET | V-SHEET: legs poke through the leg sheet although Legs: covered (bug 6) |
| 1440x900/hf-male/shots/012-feet__supine__covered.png | 5cec4bd3f6f0 | 88e02c9+wt | V-SHEET | V-SHEET: feet/shins through the sheet (bug 6) |
| 1440x900/hf-male/shots/013-overview__reclined_30__covered.png | 764a05cbe32c | 88e02c9+wt | V-ROD | V-ROD: rods |
| 1440x900/hf-male/shots/014-seated__reclined_30__covered.png | 0f4aa8721753 | 88e02c9+wt | V-ROD | V-ROD: rods; posture on the backrest looks right |
| 1440x900/hf-male/shots/015-head_neck__reclined_30__covered.png | 6dc2966474a8 | 88e02c9+wt | V-NECK | V-NECK: top-down three-quarter view; neck hidden under the chin (bug 4) |
| 1440x900/hf-male/shots/016-ear_left__reclined_30__covered.png | 01a48c6e998c | 88e02c9+wt | V-EARBACK | V-EARBACK: backrest covers the lower half of the frame; mastoid/neck behind it |
| 1440x900/hf-male/shots/017-ear_right__reclined_30__covered.png | 2c693dd1d843 | 88e02c9+wt | V-EARBACK | V-EARBACK: backrest covers most of the frame |
| 1440x900/hf-male/shots/018-chest_front__reclined_30__covered.png | c94f5934a384 | 88e02c9+wt | V-ROD | V-ROD: rods |
| 1440x900/hf-male/shots/019-chest_back__reclined_30__covered.png | 3fdeea071baf | 88e02c9+wt | V-ROD | V-ROD: rods; correct hint shown |
| 1440x900/hf-male/shots/020-abdomen__reclined_30__covered.png | 0c27b61b61de | 88e02c9+wt | V-ROD | V-ROD: rods |
| 1440x900/hf-male/shots/021-arms__reclined_30__covered.png | 8230c2aeed04 | 88e02c9+wt | V-ROD | V-ROD: rods; table rail occludes the lower arm partly |
| 1440x900/hf-male/shots/022-hands__reclined_30__covered.png | e05ea8688add | 88e02c9+wt | V-HANDS | V-HANDS: hands at the frame edge, partly hidden by the rod; mostly the thighs in view |
| 1440x900/hf-male/shots/023-legs__reclined_30__covered.png | fc865a9b9681 | 88e02c9+wt | V-SHEET | V-SHEET: legs through the sheet (bug 6) |
| 1440x900/hf-male/shots/024-feet__reclined_30__covered.png | 1592335a2c29 | 88e02c9+wt | V-SHEET | V-SHEET: feet through the sheet (bug 6) |
| 1440x900/hf-male/shots/025-overview__reclined_45__covered.png | c6bfa2372add | 88e02c9+wt | V-ROD | V-ROD: rods |
| 1440x900/hf-male/shots/026-seated__reclined_45__covered.png | 2600e6d6d23f | 88e02c9+wt | V-ROD | V-ROD: rods |
| 1440x900/hf-male/shots/027-head_neck__reclined_45__covered.png | cc97b8759d5d | 88e02c9+wt | V-NECK, V-GOWNEDGE | V-NECK: top-down view; chin covers the neck, so the JVP and carotids can't be seen (bug 4) · V-GOWNEDGE: sawtooth gown neckline |
| 1440x900/hf-male/shots/028-ear_left__reclined_45__covered.png | 46928fc45841 | 88e02c9+wt | V-EARBACK | V-EARBACK: raised backrest fills the frame; ear not visible |
| 1440x900/hf-male/shots/029-ear_right__reclined_45__covered.png | 6b981b99219b | 88e02c9+wt | V-EARBACK | V-EARBACK: raised backrest fills the frame; ear not visible |
| 1440x900/hf-male/shots/030-chest_front__reclined_45__covered.png | 1c2028892b14 | 88e02c9+wt | V-ROD | V-ROD: rods; face crowded at the top edge |
| 1440x900/hf-male/shots/031-chest_back__reclined_45__covered.png | d4673716dc27 | 88e02c9+wt | V-BACKHINT | V-BACKHINT: back against the backrest but no "ask the patient to sit up" hint (flat/30° show it); view is the top of the head |
| 1440x900/hf-male/shots/032-abdomen__reclined_45__covered.png | 195f5da87018 | 88e02c9+wt | V-ROD | V-ROD: rods |
| 1440x900/hf-male/shots/033-arms__reclined_45__covered.png | 18f7004686f9 | 88e02c9+wt | V-ROD | V-ROD: rods; table rail covers the left part of the frame |
| 1440x900/hf-male/shots/034-hands__reclined_45__covered.png | d4889ffc85eb | 88e02c9+wt | V-HANDS | V-HANDS: hands shot frames the thighs and rod; no hands in view (bug 4) |
| 1440x900/hf-male/shots/035-legs__reclined_45__covered.png | 7ff098200706 | 88e02c9+wt | V-SHEET | V-SHEET: legs through the sheet (bug 6) |
| 1440x900/hf-male/shots/036-feet__reclined_45__covered.png | 7e78a454819d | 88e02c9+wt | V-SHEET | V-SHEET: feet through the sheet (bug 6) |
| 1440x900/hf-male/shots/037-overview__seated__covered.png | 8b02dea64378 | 88e02c9+wt | V-ROD | V-ROD: rods; seated posture reads well |
| 1440x900/hf-male/shots/038-seated__seated__covered.png | 4d9ca393eb74 | 88e02c9+wt | V-FRAME, V-ROD | V-FRAME: head cropped at the top of the conversation shot · V-ROD: rods |
| 1440x900/hf-male/shots/039-head_neck__seated__covered.png | e160655a9399 | 88e02c9+wt | V-NECK | V-NECK: looking down on the scalp; head bowed and the neck hidden (bug 4) |
| 1440x900/hf-male/shots/040-ear_left__seated__covered.png | b23855daea95 | 88e02c9+wt | V-HAIR | V-HAIR: jagged hair edge; ear and mastoid visible (good view) |
| 1440x900/hf-male/shots/041-ear_right__seated__covered.png | 79131d062361 | 88e02c9+wt | V-HAIR | V-HAIR: jagged hair edge; good view |
| 1440x900/hf-male/shots/042-chest_front__seated__covered.png | a5124c2ef5b6 | 88e02c9+wt | V-ROD | V-ROD: rod across the lower chest; good framing |
| 1440x900/hf-male/shots/043-chest_back__seated__covered.png | a4e18f41c1f2 | 88e02c9+wt | V-BACKREST | V-BACKREST: upright backrest fills the lower frame; the patient's back sits inside it (11-15 cm, M3 intersection xfail) |
| 1440x900/hf-male/shots/044-abdomen__seated__covered.png | 779727e0b739 | 88e02c9+wt | V-ROD | V-ROD: rods; gown flap over the lap |
| 1440x900/hf-male/shots/045-arms__seated__covered.png | eaff865990b5 | 88e02c9+wt | V-ROD | V-ROD: rods; the arm is mostly hidden behind the torso, so the arms shot frames the chest |
| 1440x900/hf-male/shots/046-hands__seated__covered.png | d4eeac389c9d | 88e02c9+wt | V-HANDS | V-HANDS: no hands: the shot frames the thighs (hands hidden behind them, bug 4) |
| 1440x900/hf-male/shots/047-legs__seated__covered.png | db1da09717bf | 88e02c9+wt | V-SHEET | V-SHEET: legs through the sheet (bug 6) |
| 1440x900/hf-male/shots/048-feet__seated__covered.png | 0dba48562333 | 88e02c9+wt | V-SHEET | V-SHEET: feet through the sheet (bug 6) |
| 1440x900/hf-male/shots/049-overview__left_lateral_decubitus__covered.png | 82dd47b142ba | 88e02c9+wt | V-LLD | V-LLD: LLD pose contorted (right arm flung over the head, knees splayed, lies at the table edge); leg sheet missing although Legs: covered |
| 1440x900/hf-male/shots/050-seated__left_lateral_decubitus__covered.png | 8a25674a0c28 | 88e02c9+wt | V-LLDPRIV | V-LLDPRIV: buttocks exposed: the gown rides up and there is no sheet |
| 1440x900/hf-male/shots/051-head_neck__left_lateral_decubitus__covered.png | e611633febb9 | 88e02c9+wt | V-NECKLLD | V-NECKLLD: face rotated 90°; neck hidden by the shoulder; rod floating at the left |
| 1440x900/hf-male/shots/052-ear_left__left_lateral_decubitus__covered.png | d82b08cb0be9 | 88e02c9+wt | V-EARDOWN | V-EARDOWN: left ear faces the table in LLD; the shot shows the back of the head (needs a hint) |
| 1440x900/hf-male/shots/053-ear_right__left_lateral_decubitus__covered.png | 534e7a163c43 | 88e02c9+wt | V-HAIR | V-HAIR: jagged hair edge; ear visible (OK) |
| 1440x900/hf-male/shots/054-chest_front__left_lateral_decubitus__covered.png | c0527d5dd802 | 88e02c9+wt | V-ROD | V-ROD: rod; chest framed sideways with the face cut off on the right (acceptable) |
| 1440x900/hf-male/shots/055-chest_back__left_lateral_decubitus__covered.png | 8353c7881124 | 88e02c9+wt | V-BACKHINT2 | V-BACKHINT2: hint says the back is against the table, but in LLD the back faces the camera and can be examined |
| 1440x900/hf-male/shots/056-abdomen__left_lateral_decubitus__covered.png | 55a530a451ad | 88e02c9+wt | V-ROD | V-ROD: two vertical rods across the abdomen |
| 1440x900/hf-male/shots/057-arms__left_lateral_decubitus__covered.png | afbc71525cbc | 88e02c9+wt | V-ARMSLLD | V-ARMSLLD: the arms shot frames the raised arm against the wall; the camera is behind the patient |
| 1440x900/hf-male/shots/058-hands__left_lateral_decubitus__covered.png | 5f666d1f7412 | 88e02c9+wt | V-HANDS | V-HANDS: hands shot frames the stool and table edge; no hands |
| 1440x900/hf-male/shots/059-legs__left_lateral_decubitus__covered.png | e80138c4e2d2 | 88e02c9+wt | V-LLD | V-LLD: legs bare although Legs: covered; knee flexion looks odd (left-lateral joint signs, bug 7) |
| 1440x900/hf-male/shots/060-feet__left_lateral_decubitus__covered.png | fbf68fea7c7f | 88e02c9+wt | V-LLD | V-LLD: feet bare, the sheet is missing in LLD |
| 1440x900/screening-female/dialogs/01-examine-menu.png | 8cd57937e28a | 88e02c9+wt | V-MENUSCROLL | V-MENUSCROLL: the long menu needs scrolling to reach Back/Abdomen with no visible scroll cue |
| 1440x900/screening-female/dialogs/02-maneuver-menu.png | c82369daf63d | 88e02c9+wt | — | OK |
| 1440x900/screening-female/dialogs/03-tool-chooser.png | dab54ba34130 | 88e02c9+wt | V-SHEET | V-SHEET: thigh pokes through the lap sheet behind the chooser (bug 6) |
| 1440x900/screening-female/dialogs/04-perform.png | 5be1c8518c24 | 88e02c9+wt | V-PERFORMCLIP | V-PERFORMCLIP: perform card cuts off the finding text at the bottom edge of the canvas (overflow); opened from the abdomen shot for a thyroid maneuver (shot context mismatch) |
| 1440x900/screening-female/dialogs/05-describe.png | 829132ecfea6 | 88e02c9+wt | V-TOASTSTACK | V-TOASTSTACK: hygiene nudge toast sits over the canvas while a modal is open |
| 1440x900/screening-female/dialogs/06-leave-confirm.png | f5aead78cf9b | 88e02c9+wt | — | OK |
| 1440x900/screening-female/dialogs/07-actions-menu.png | a0abd408fdd9 | 88e02c9+wt | V-MENUOVER | V-MENUOVER: the Actions menu covers the Findings panel (acceptable for a popover) |
| 1440x900/screening-female/dialogs/08-tools-menu.png | 197f960586dd | 88e02c9+wt | — | OK |
| 1440x900/screening-female/dialogs/09-bed-hud.png | 53109869f683 | 88e02c9+wt | — | OK |
| 1440x900/screening-female/dialogs/10-practice-help.png | b08c4f0d051d | 88e02c9+wt | V-HINTOVER | V-HINTOVER: the hint popover covers the Legs drape chip and the Actions/Leave buttons |
| 1440x900/screening-female/dialogs/11-finish.png | fc8365e32550 | 88e02c9+wt | — | OK |
| 1440x900/screening-female/drapes/01-chest_front__supine__chest-exposed.png | e08ef4e37297 | 88e02c9+wt | V-FCHEST, V-ROD | V-FCHEST: uncovering the chest bares both breasts; the female chest must be exposed per side and kept covered by default (sectioned drapes) · V-ROD: gown roll is a thick rod over the upper chest |
| 1440x900/screening-female/drapes/02-abdomen__supine__abdomen-exposed.png | b04d9b2075ac | 88e02c9+wt | V-PUBIS, V-ROD | V-PUBIS: abdomen exposure reaches the pubic area (the pelvis section must stay covered) · V-ROD: rods |
| 1440x900/screening-female/drapes/03-legs__supine__legs-exposed.png | d4e7362db24f | 88e02c9+wt | V-ROD | V-ROD: rod at the thigh; pelvis stays covered by the gown (OK) |
| 1440x900/screening-female/drapes/04-overview__supine__all-exposed.png | 1bd58271473b | 88e02c9+wt | V-PELVIS | V-PELVIS: with all three sections uncovered the patient is naked (pelvis exposed; pelvis must never be exposed) |
| 1440x900/screening-female/room/01-corridor.png | 78ee08e64e3f | 88e02c9+wt | V-PLACARD, V-PLACEHOLDER | V-PLACARD: 3D door placard is a blank grey rectangle · V-PLACEHOLDER: chat box says "Station finished" before the student has entered |
| 1440x900/screening-female/room/02-overview.png | a3db73404be1 | 88e02c9+wt | V-SINK, V-ROD | V-SINK: no basin (bug 3) · V-ROD: rods on the chest |
| 1440x900/screening-female/room/03-sink.png | 0d79dfdafad8 | 88e02c9+wt | V-SINK | V-SINK: flat slab with a tap; no basin, soap or towel (bug 3) |
| 1440x900/screening-female/room/04-tool_table.png | 060dcd2c7f13 | 88e02c9+wt | V-TOOLS | V-TOOLS: instruments are crude primitives (acceptable for now) |
| 1440x900/screening-female/shots/001-overview__supine__covered.png | f87336756a85 | 88e02c9+wt | V-ROD, V-BODY | V-ROD: rods · V-BODY: female body barely differs from the male (same proportions, short cap hair) |
| 1440x900/screening-female/shots/002-seated__supine__covered.png | 521121ba0e02 | 88e02c9+wt | V-ARMS, V-ROD | V-ARMS: supine arms hover above the abdomen instead of resting · V-ROD: rods |
| 1440x900/screening-female/shots/003-head_neck__supine__covered.png | 3ee849e79fdc | 88e02c9+wt | V-NECK | V-NECK: from the head end: face upside down, neck under the chin, no front view of the face (bug 4) |
| 1440x900/screening-female/shots/004-ear_left__supine__covered.png | 02648127414e | 88e02c9+wt | V-HAIR | V-HAIR: jagged hair edge; ear visible, mastoid partly under the hair |
| 1440x900/screening-female/shots/005-ear_right__supine__covered.png | 594cc9ef3393 | 88e02c9+wt | V-HAIR | V-HAIR: jagged hair edge; ear visible |
| 1440x900/screening-female/shots/006-chest_front__supine__covered.png | bc3f9618c08d | 88e02c9+wt | V-CHESTINV, V-ROD, V-GOWNFIT | V-CHESTINV: from the head end, face upside down · V-ROD: rods · V-GOWNFIT: gown is skin-tight (nipple outline shows through) |
| 1440x900/screening-female/shots/007-chest_back__supine__covered.png | 1bf4030b2ec4 | 88e02c9+wt | V-ROD | V-ROD: rods; correct "back against the table" hint |
| 1440x900/screening-female/shots/008-abdomen__supine__covered.png | d23acca6a013 | 88e02c9+wt | V-ROD | V-ROD: rods across the abdomen and hips |
| 1440x900/screening-female/shots/009-arms__supine__covered.png | 706fb3d56295 | 88e02c9+wt | V-ROD, V-GOWNFIT | V-ROD: rods; the arms shot mostly frames the gowned torso · V-GOWNFIT: skin-tight gown |
| 1440x900/screening-female/shots/010-hands__supine__covered.png | 38b07d533c51 | 88e02c9+wt | V-ROD | V-ROD: rod across the hips; hands visible (OK) |
| 1440x900/screening-female/shots/011-legs__supine__covered.png | 0bc529492698 | 88e02c9+wt | V-SHEET | V-SHEET: legs through the sheet (bug 6) |
| 1440x900/screening-female/shots/012-feet__supine__covered.png | 50dc0593b4ed | 88e02c9+wt | V-SHEET | V-SHEET: feet through the sheet (bug 6) |
| 1440x900/screening-female/shots/013-overview__reclined_30__covered.png | df8833939588 | 88e02c9+wt | V-ROD | V-ROD: rods |
| 1440x900/screening-female/shots/014-seated__reclined_30__covered.png | b641c4d010d3 | 88e02c9+wt | V-ROD | V-ROD: rods; head floats a little above the backrest pillow |
| 1440x900/screening-female/shots/015-head_neck__reclined_30__covered.png | 7183ed29d565 | 88e02c9+wt | V-NECK, V-ROD | V-NECK: face turned 90°, neck under the chin (bug 4) · V-ROD: rod |
| 1440x900/screening-female/shots/016-ear_left__reclined_30__covered.png | 747e30c9a19f | 88e02c9+wt | V-EARBACK | V-EARBACK: backrest covers most of the frame; mastoid hidden |
| 1440x900/screening-female/shots/017-ear_right__reclined_30__covered.png | ae7bb7a7f4ce | 88e02c9+wt | V-EARBACK | V-EARBACK: backrest covers most of the frame; ear barely visible |
| 1440x900/screening-female/shots/018-chest_front__reclined_30__covered.png | 3a7f571696a6 | 88e02c9+wt | V-ROD, V-CHESTROT | V-ROD: two vertical rods across the chest · V-CHESTROT: chest shot rotated 90° (head at the left) |
| 1440x900/screening-female/shots/019-chest_back__reclined_30__covered.png | 87bf89bda4d1 | 88e02c9+wt | V-ROD | V-ROD: rods; correct hint shown |
| 1440x900/screening-female/shots/020-abdomen__reclined_30__covered.png | 572661f31f37 | 88e02c9+wt | V-ROD, V-ZFIGHT | V-ROD: rods · V-ZFIGHT: backrest corner geometry flickers at the top right |
| 1440x900/screening-female/shots/021-arms__reclined_30__covered.png | f0d60dc88151 | 88e02c9+wt | V-ROD | V-ROD: rods; the forearm crosses the abdomen instead of resting at the side |
| 1440x900/screening-female/shots/022-hands__reclined_30__covered.png | ea31098f87f4 | 88e02c9+wt | V-HANDS | V-HANDS: hands shot frames the thighs; no hands in view (bug 4) |
| 1440x900/screening-female/shots/023-legs__reclined_30__covered.png | 3b3caea70c78 | 88e02c9+wt | V-SHEET | V-SHEET: legs through the sheet (bug 6) |
| 1440x900/screening-female/shots/024-feet__reclined_30__covered.png | 72f3555dab7a | 88e02c9+wt | V-SHEET | V-SHEET: feet through the sheet (bug 6) |
| 1440x900/screening-female/shots/025-overview__reclined_45__covered.png | ce276b03d1ef | 88e02c9+wt | V-ROD | V-ROD: rods |
| 1440x900/screening-female/shots/026-seated__reclined_45__covered.png | b22f8ca6decd | 88e02c9+wt | V-ROD | V-ROD: rod; good conversational framing |
| 1440x900/screening-female/shots/027-head_neck__reclined_45__covered.png | 305903cc0563 | 88e02c9+wt | V-NECK | V-NECK: top-down view; chin over the neck (bug 4) |
| 1440x900/screening-female/shots/028-ear_left__reclined_45__covered.png | c6fdc96a0d9d | 88e02c9+wt | V-EARBACK | V-EARBACK: whole frame is the backrest: the ear can't be seen at all |
| 1440x900/screening-female/shots/029-ear_right__reclined_45__covered.png | 9b39e0b6387e | 88e02c9+wt | V-EARBACK | V-EARBACK: backrest fills the frame: ear not visible |
| 1440x900/screening-female/shots/030-chest_front__reclined_45__covered.png | c80b3332e047 | 88e02c9+wt | V-ROD, V-GOWNFIT | V-ROD: rods · V-GOWNFIT: skin-tight gown |
| 1440x900/screening-female/shots/031-chest_back__reclined_45__covered.png | b10616c620db | 88e02c9+wt | V-BACKHINT | V-BACKHINT: top of the head; back against the backrest with no hint |
| 1440x900/screening-female/shots/032-abdomen__reclined_45__covered.png | ee089d7e9664 | 88e02c9+wt | V-ROD | V-ROD: rods |
| 1440x900/screening-female/shots/033-arms__reclined_45__covered.png | 95a0d9799243 | 88e02c9+wt | V-ROD | V-ROD: rods; table rail runs diagonally across the frame |
| 1440x900/screening-female/shots/034-hands__reclined_45__covered.png | 5af7f8ff8da6 | 88e02c9+wt | V-HANDS | V-HANDS: no hands, only the thighs (bug 4) |
| 1440x900/screening-female/shots/035-legs__reclined_45__covered.png | e665e97257dc | 88e02c9+wt | V-SHEET | V-SHEET: legs through the sheet (bug 6) |
| 1440x900/screening-female/shots/036-feet__reclined_45__covered.png | b6c193c43139 | 88e02c9+wt | V-SHEET | V-SHEET: feet through the sheet (bug 6) |
| 1440x900/screening-female/shots/037-overview__seated__covered.png | 7e0e12a04513 | 88e02c9+wt | V-ROD, V-BODY | V-ROD: rods · V-BODY: female model barely differs from the male (hips, hair) |
| 1440x900/screening-female/shots/038-seated__seated__covered.png | 3e8b6fcff8fa | 88e02c9+wt | V-FRAME, V-GOWNFIT | V-FRAME: head cropped at the top edge · V-GOWNFIT: skin-tight gown |
| 1440x900/screening-female/shots/039-head_neck__seated__covered.png | 811fa30eacd5 | 88e02c9+wt | V-NECK | V-NECK: top-down on the scalp; neck hidden by the chin (bug 4) |
| 1440x900/screening-female/shots/040-ear_left__seated__covered.png | 0e3e7bd7a890 | 88e02c9+wt | V-HAIR | V-HAIR: jagged hair edge; ear and mastoid visible (good) |
| 1440x900/screening-female/shots/041-ear_right__seated__covered.png | d88d996ce01c | 88e02c9+wt | V-HAIR | V-HAIR: jagged hair edge; good ear view |
| 1440x900/screening-female/shots/042-chest_front__seated__covered.png | b16ebd7173a1 | 88e02c9+wt | V-ROD, V-GOWNFIT | V-ROD: rod · V-GOWNFIT: skin-tight gown shows the breast outline |
| 1440x900/screening-female/shots/043-chest_back__seated__covered.png | c5491d76b925 | 88e02c9+wt | V-BACKREST | V-BACKREST: frame is entirely the backrest: the back can't be seen at all |
| 1440x900/screening-female/shots/044-abdomen__seated__covered.png | bf8f6b58182a | 88e02c9+wt | V-SHEET, V-ROD | V-SHEET: thigh through the lap sheet · V-ROD: rod |
| 1440x900/screening-female/shots/045-arms__seated__covered.png | 83f777a7dea1 | 88e02c9+wt | V-ARMSSEAT, V-ROD | V-ARMSSEAT: arms shot frames the torso; the arm is hidden behind the body and the table rail · V-ROD: rod |
| 1440x900/screening-female/shots/046-hands__seated__covered.png | d854a50ce631 | 88e02c9+wt | V-HANDS | V-HANDS: no hands, only the thighs (bug 4) |
| 1440x900/screening-female/shots/047-legs__seated__covered.png | 7bb520f73f36 | 88e02c9+wt | V-SHEET | V-SHEET: legs through the sheet (bug 6) |
| 1440x900/screening-female/shots/048-feet__seated__covered.png | 35e45fb1add0 | 88e02c9+wt | V-SHEET | V-SHEET: feet through the sheet (bug 6) |
| 1440x900/screening-female/shots/049-overview__left_lateral_decubitus__covered.png | 21f2e01d6084 | 88e02c9+wt | V-LLD | V-LLD: LLD pose contorted (arm flung over the tool trolley, body hangs off the table edge); leg sheet missing although Legs: covered |
| 1440x900/screening-female/shots/050-seated__left_lateral_decubitus__covered.png | 3195b8abff0c | 88e02c9+wt | V-LLDPRIV | V-LLDPRIV: buttocks and legs exposed; gown rides up; no sheet |
| 1440x900/screening-female/shots/051-head_neck__left_lateral_decubitus__covered.png | 4244116dfeea | 88e02c9+wt | V-NECKLLD, V-ROD | V-NECKLLD: face sideways and the neck hidden by the shoulder · V-ROD: rod |
| 1440x900/screening-female/shots/052-ear_left__left_lateral_decubitus__covered.png | 8be59ed99e8b | 88e02c9+wt | V-EARDOWN | V-EARDOWN: left ear faces the table; the shot shows the back of the head (needs a hint) |
| 1440x900/screening-female/shots/053-ear_right__left_lateral_decubitus__covered.png | 2dbab285bd91 | 88e02c9+wt | V-HAIR | V-HAIR: jagged hair edge; ear visible (OK) |
| 1440x900/screening-female/shots/054-chest_front__left_lateral_decubitus__covered.png | bf3f18dd1703 | 88e02c9+wt | V-ROD | V-ROD: vertical rods; chest framed sideways (acceptable) |
| 1440x900/screening-female/shots/055-chest_back__left_lateral_decubitus__covered.png | ed142b3bed81 | 88e02c9+wt | V-BACKHINT2 | V-BACKHINT2: "back against the table" hint is wrong in LLD; the frame shows the arm and shoulder rather than the back |
| 1440x900/screening-female/shots/056-abdomen__left_lateral_decubitus__covered.png | 99daa01578b0 | 88e02c9+wt | V-ROD | V-ROD: rods |
| 1440x900/screening-female/shots/057-arms__left_lateral_decubitus__covered.png | 4c621575bfdf | 88e02c9+wt | V-ARMSLLD | V-ARMSLLD: the arms shot frames the raised arm against the wall from behind |
| 1440x900/screening-female/shots/058-hands__left_lateral_decubitus__covered.png | 0298b39965d6 | 88e02c9+wt | V-HANDS | V-HANDS: hands shot frames the stool and table edge; one hand at the top edge |
| 1440x900/screening-female/shots/059-legs__left_lateral_decubitus__covered.png | 5d78264fed28 | 88e02c9+wt | V-LLD, V-SEAM | V-LLD: legs bare although Legs: covered · V-SEAM: visible skin seam line above the knee |
| 1440x900/screening-female/shots/060-feet__left_lateral_decubitus__covered.png | 5ab805c9b223 | 88e02c9+wt | V-LLD | V-LLD: feet bare, the sheet is missing in LLD |
