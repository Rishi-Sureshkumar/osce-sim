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
| V-ARMS | high | pose | M3 | fixed | Supine arms hover above the table instead of resting (2 shots) — fixed in M3.2: lying flat the arms lie on the mattress, the hands beside the hips (resting on the sheet, not under it); sitting up the forearms rest ~2 cm over the thighs |
| V-BACKREST | high | room | M3 | fixed | Seated: patient sits 11-15 cm inside the backrest; the back shot shows only the backrest (M3 intersections xfail) (2 shots) — fixed in M3.1: the raised head section pivots at a per-body point fitted to the back (test:intersections clean) |
| V-EARBACK | high | shot | M3 | fixed | Ear shots in reclined positions were blocked by the raised backrest — fixed at the M2 gate (ear views rise until clear of the table; mastoid and canal in view lying back) |
| V-FCHEST | high | drape | M3 | fixed | Female chest uncovers both breasts at once; must be per side and covered by default (1 shots) — fixed in M3.1: the female chest gown is per side and covered by default |
| V-LLD | high | pose | M3 | open | Left lateral decubitus pose contorted (arm flung up, hangs off the table edge) and the leg sheet disappears (6 shots) |
| V-LLDPRIV | high | drape | M3 | open | LLD: gown rides up, buttocks exposed, no sheet (2 shots) |
| V-PELVIS | high | drape | M3 | fixed | "All exposed" leaves the patient naked: the pelvis section must never be exposed (2 shots) — fixed in M3.1: the pelvis towel is never uncovered (all exposed leaves the towel) |
| V-PUBIS | high | drape | M3 | open | Female abdomen exposure reaches the pubic area (pelvis section must stay covered) (1 shots) |
| V-SHEET | high | drape | M3 | fixed | Legs/feet poke through the leg sheet while "Legs: covered" (bug 6) (18 shots) — fixed in M3.1 (bug 6): the leg sheet is built per pose from the skinned body; zero-tolerance coverage test for every position, model and leg state |
| V-ARMSLLD | medium | shot | M3 | open | LLD arms shot frames the raised arm against the wall from behind — the arm is flung up by the left-lateral pose (V-LLD); re-owned to M3 at the M2 gate |
| V-ARMSSEAT | medium | shot | M2 | fixed | Seated arms shot frames the torso; the arm is hidden behind the body — fixed at the M2 gate (arm and hand on the thigh in view; plus close left-arm and back-of-elbow views) |
| V-BACKHINT | medium | ux | M2 | fixed | Reclined 45°: back against the backrest but no "ask the patient to sit up" hint — fixed at the M2 gate (shotHint: lying back up to 45°, and seated against the backrest: "lean forward") |
| V-BACKHINT2 | medium | ux | M2 | fixed | LLD: hint wrongly said the back is against the table — fixed at the M2 gate (shotHint is per position) |
| V-NECKLLD | medium | shot | M3 | open | LLD head_neck: neck partly behind the shoulder — follows the left-lateral pose (V-LLD); re-owned to M3 at the M2 gate |
| V-BODY | medium | asset | M3 | open | Female body barely differs from the male (proportions, hair) (2 shots) |
| V-ROD | medium | drape | M3 | fixed | Rolled/folded gown edges render as floating light-blue rods across the body (the roll-chest rod lies over the apex) (59 shots) — fixed in M3.3: folded gown edges are tubes laid along the skin, drawn only where a fold exists, clear of exam targets |
| V-CHESTINV | medium | shot | M6 | open | Supine chest shot from the head end: the face is upside down at the bottom of the frame (3 shots) |
| V-PERFORMCLIP | medium | ui | M6 | fixed | Perform card clips the finding text at the canvas bottom (1 shots) — fixed in M6: the exam card grows upward inside the view with a height cap and scrolls |
| V-PLACARD | medium | ui | M6 | fixed | 3D door placard is a blank rectangle (text only in the side panel) (3 shots) — fixed in M6: the door instructions are printed on the 3D door (canvas texture) |
| V-WRAP | medium | ui | M6 | fixed | Toolbar wraps at 1280/1180 wide ("Actions"/"Leave the room" on a second row) (2 shots) — fixed in M6: top bar + one-row encounter bar at 1440/1280/1180 (fixed height; steady-layout regression) |
| V-EARDOWN | low | ux | M2 | fixed | LLD: the left ear faces the table — fixed at the M2 gate: a hint says the left ear is against the table |
| V-GOWNEDGE | low | asset | M3 | open | Gown neckline has a sawtooth edge (1 shots) |
| V-GOWNFIT | low | asset | M3 | open | Gown is skin-tight (body outline shows through) (5 shots) |
| V-HAIR | low | asset | M3 | open | Procedural hair shell has jagged edges over the ears (10 shots) |
| V-SEAM | low | asset | M3 | open | Visible skin seam line above the knee (1 shots) |
| V-TOOLS | low | asset | M3 | fixed | Instruments are crude primitives (2 shots) — fixed in M3.3: stethoscope with tubing, Taylor hammer, U-shaped forks, penlight, otoscope, cuff with gauge |
| V-ZFIGHT | low | room | M3 | open | Backrest corner geometry flickers (1 shots) |
| V-CHESTROT | low | shot | M6 | open | Reclined chest shot rotated 90° (1 shots) |
| V-FRAME | low | shot | M6 | open | Conversation (seated) shot crops the head (2 shots) |
| V-HINTOVER | low | ui | M6 | fixed | Hint popover covers the drape chips and Actions/Leave (1 shots) — fixed in M6: the hint popover opens below the encounter bar, clear of the drape chips and Actions |
| V-HINTS | low | ui | M6 | fixed | "1 hints" plural in the coach list (3 shots) — fixed in M6: plurals ("1 hint"); badges wrap whole |
| V-MENUOVER | low | ui | M6 | wontfix | Actions menu covers the Findings panel (1 shots) — accepted at the M6 gate: a dropdown menu overlays content below it and closes on Esc or an outside click |
| V-MENUSCROLL | low | ui | M6 | fixed | Examine menu needs scrolling with no visible cue (1 shots) — fixed in M6: the Examine menu shows a scroll cue when it overflows |
| V-OVERFLOW | low | ui | M6 | fixed | Left column overflows: chat options cut off below the fold (3 shots) — fixed in M6: collapsible side panels; the door placard folds once inside |
| V-PLACEHOLDER | low | ui | M6 | fixed | Chat input says "Station finished" before the encounter starts (2 shots) — fixed in M6: the chat placeholder says why it is closed (e.g. waiting for "You may begin") |
| V-TOASTSTACK | low | ui | M6 | fixed | Hygiene nudge toast stays over the canvas while a modal is open (1 shots) — fixed in M6: toasts step aside while a modal is open |
| V-JUSTIFY | high | grading | M4 | fixed | Fixed in M4: the justification counts only history points raised in the conversation and exam points whose maneuvers were performed; the label no longer says "the student" (tests/m4-hide-mistakes.test.ts). Was: results credit "Diagnoses are justified by findings the student elicited — orthopnea, raised JVP" when neither was elicited (JVP not examined; the note's claim is flagged as unperformed in the same feedback); "the student" in third person on a student page (found at the M2 gate) |
| V-HINTTEXT | low | ui | M6 | fixed | The canvas hint line ("Click the patient to move closer…") has no backdrop: unreadable over dark table rails; also shown in the tool-table view with no patient (found at the M2 gate) — fixed in M6: the canvas hint is a pill on a backdrop and is hidden in views without the patient |
| V-BADGES | low | ui | M6 | fixed | Coach transcript: "typed" badge runs into the text; "Matched" badge on 0-point items that say no words matched (found at the M2 gate) — fixed in M6: transcript badges sit on their own line; "No match" replaces "Matched" on 0-point items |

## Screenshots

| file | sha256 | reviewed@ | defects | notes |
|---|---|---|---|---|
| 1180x820/hf-male/layout/01-station-inside.png | 9f51cdef6ce6 | UNREVIEWED | V-WRAP, V-SHEET, V-OVERFLOW | changed (was 80e150123f38) |
| 1180x820/hf-male/layout/02-note.png | acb82688ca23 | UNREVIEWED | — | changed (was b25bbe3a6e5c) |
| 1180x820/hf-male/layout/03-results.png | 31bfc8012d7c | UNREVIEWED | — | changed (was 62b8011b0a53) |
| 1180x820/hf-male/layout/04-coach-list.png | 04c2fac745d7 | UNREVIEWED | V-HINTS | changed (was f379495dee95) |
| 1180x820/hf-male/layout/05-coach-detail.png | 47fa1cb38ca7 | UNREVIEWED | — | changed (was 9cdd1a3d5585) |
| 1280x800/hf-male/layout/01-station-inside.png | b3d4d76acc2a | UNREVIEWED | V-WRAP, V-SHEET, V-OVERFLOW | changed (was a24baa249236) |
| 1280x800/hf-male/layout/02-note.png | 289bb4f9a82c | UNREVIEWED | — | changed (was 97a0ed9cb4b0) |
| 1280x800/hf-male/layout/03-results.png | bcc90dc5ab81 | UNREVIEWED | — | changed (was 03f0709560a9) |
| 1280x800/hf-male/layout/04-coach-list.png | 2f47d8be4c4f | UNREVIEWED | V-HINTS | changed (was ed6433764bc7) |
| 1280x800/hf-male/layout/05-coach-detail.png | 4dbb285df7df | UNREVIEWED | — | changed (was a94cbe01e164) |
| 1440x900/hf-male/drapes/01-chest_front__supine__chest-left-exposed.png | 1969c9cfb38d | UNREVIEWED | — | changed (was 369dd8270be5) |
| 1440x900/hf-male/drapes/02-chest_front__supine__chest-exposed.png | 9c6450a96412 | UNREVIEWED | — | changed (was 76416ae47bc9) |
| 1440x900/hf-male/drapes/03-abdomen__supine__abdomen-exposed.png | 616002d3a087 | UNREVIEWED | — | changed (was e572ac8d5acd) |
| 1440x900/hf-male/drapes/04-legs__supine__legs-left-exposed.png | 0a6b6a731abd | UNREVIEWED | — | changed (was a71b524bb743) |
| 1440x900/hf-male/drapes/05-legs__supine__legs-exposed.png | 3c47e09ed62d | UNREVIEWED | — | changed (was 76414b62edbe) |
| 1440x900/hf-male/drapes/06-overview__supine__all-exposed.png | fd595fd3e0d1 | UNREVIEWED | — | changed (was fc4898378ea2) |
| 1440x900/hf-male/layout/01-station-inside.png | a10f634755d5 | UNREVIEWED | V-SHEET, V-OVERFLOW | changed (was c0e6e07c7c11) |
| 1440x900/hf-male/layout/02-note.png | 4ccf8a401588 | UNREVIEWED | — | changed (was 1a0acf2433c6) |
| 1440x900/hf-male/layout/03-results.png | 29d179591183 | UNREVIEWED | — | changed (was 4fb07c6bc55f) |
| 1440x900/hf-male/layout/04-coach-list.png | 57a4cde65eb1 | UNREVIEWED | V-HINTS | changed (was be2ed7ffc30d) |
| 1440x900/hf-male/layout/05-coach-detail.png | 7f05e36c6c4f | UNREVIEWED | — | changed (was 91e892cca698) |
| 1440x900/hf-male/room/00-exam-corridor-placard.png | 52dc680e2d83 | UNREVIEWED | V-PLACARD, V-PLACEHOLDER | changed (was c9c51c64b1d0) |
| 1440x900/hf-male/room/01-corridor.png | 59d7b97b2d32 | UNREVIEWED | V-PLACARD, V-PLACEHOLDER | changed (was 28eb37d0ba1e) |
| 1440x900/hf-male/room/02-overview.png | a10f634755d5 | UNREVIEWED | V-SHEET | changed (was c0e6e07c7c11) |
| 1440x900/hf-male/room/03-sink.png | 81cc97c85f7e | UNREVIEWED | — | changed (was fedfcbc6fcf6) |
| 1440x900/hf-male/room/04-tool_table.png | 7d12eeaee791 | UNREVIEWED | V-TOOLS | changed (was d542c32635b3) |
| 1440x900/hf-male/shots/001-overview__supine__covered.png | ed90baebf6ff | UNREVIEWED | V-SHEET | changed (was ef77c432af33) |
| 1440x900/hf-male/shots/002-seated__supine__covered.png | d89908a02861 | UNREVIEWED | V-ARMS, V-ROD | changed (was e724f36ba2e5) |
| 1440x900/hf-male/shots/003-head_neck__supine__covered.png | 16bea6eb04d8 | UNREVIEWED | V-ROD, V-GOWNEDGE | changed (was 389b88cce5ea) |
| 1440x900/hf-male/shots/004-ear_left__supine__covered.png | 65288e748a9f | UNREVIEWED | V-HAIR | changed (was 6b54ff8f8570) |
| 1440x900/hf-male/shots/005-ear_right__supine__covered.png | ba12d842f333 | UNREVIEWED | V-HAIR | changed (was 41938d2f6bbe) |
| 1440x900/hf-male/shots/006-chest_front__supine__covered.png | a4ebe9774057 | UNREVIEWED | V-CHESTINV, V-ROD, V-ARMS | changed (was a6b54a1df3d2) |
| 1440x900/hf-male/shots/007-chest_back__supine__covered.png | e8f887a9f204 | UNREVIEWED | V-ROD, V-ARMS | changed (was 0c4b68727855) |
| 1440x900/hf-male/shots/008-abdomen__supine__covered.png | bd509be9c255 | UNREVIEWED | V-ROD, V-ARMS | changed (was 126809759ef7) |
| 1440x900/hf-male/shots/009-arms__supine__covered.png | 11bfec0cedb2 | UNREVIEWED | V-ROD, V-ARMS | changed (was b387a463894e) |
| 1440x900/hf-male/shots/010-hands__supine__covered.png | d3c2fd8c78fd | UNREVIEWED | V-ROD | changed (was 9936dd81ae82) |
| 1440x900/hf-male/shots/011-legs__supine__covered.png | 13cff2456de5 | UNREVIEWED | V-SHEET | changed (was 87bd5304c190) |
| 1440x900/hf-male/shots/012-feet__supine__covered.png | c277225746d9 | UNREVIEWED | V-SHEET | changed (was 5724656982ac) |
| 1440x900/hf-male/shots/013-overview__reclined_30__covered.png | c1a454645b18 | UNREVIEWED | V-SHEET | changed (was 4bec810011c2) |
| 1440x900/hf-male/shots/014-seated__reclined_30__covered.png | 4495ad96e014 | UNREVIEWED | V-ARMS, V-ROD | changed (was 38484dfc18e1) |
| 1440x900/hf-male/shots/015-head_neck__reclined_30__covered.png | 10fb8f4da7e3 | UNREVIEWED | V-GOWNEDGE | changed (was e599aa65c835) |
| 1440x900/hf-male/shots/016-ear_left__reclined_30__covered.png | c37cc48f06a7 | UNREVIEWED | V-HAIR | changed (was 859dc095ecd4) |
| 1440x900/hf-male/shots/017-ear_right__reclined_30__covered.png | 8222f2fa796e | UNREVIEWED | V-HAIR | changed (was 218b296afeab) |
| 1440x900/hf-male/shots/018-chest_front__reclined_30__covered.png | 7c34216d9324 | UNREVIEWED | V-CHESTROT, V-ROD | changed (was 2e029cf585db) |
| 1440x900/hf-male/shots/019-chest_back__reclined_30__covered.png | 802ae2866d5d | UNREVIEWED | V-ROD | changed (was 00d8e33cc231) |
| 1440x900/hf-male/shots/020-abdomen__reclined_30__covered.png | 8ee2c0a0d161 | UNREVIEWED | V-ROD | changed (was d8e5c8c774b8) |
| 1440x900/hf-male/shots/021-arms__reclined_30__covered.png | a76587c9aadc | UNREVIEWED | V-ROD | changed (was 37cdb7260e1b) |
| 1440x900/hf-male/shots/022-hands__reclined_30__covered.png | b2682b241d12 | UNREVIEWED | V-ROD | changed (was f425aef29d57) |
| 1440x900/hf-male/shots/023-legs__reclined_30__covered.png | 6108598cfcac | UNREVIEWED | V-SHEET, V-ROD | changed (was 6d19974d6383) |
| 1440x900/hf-male/shots/024-feet__reclined_30__covered.png | d04e7bc82459 | UNREVIEWED | V-SHEET | changed (was 0eb42cf006c1) |
| 1440x900/hf-male/shots/025-overview__reclined_45__covered.png | b167351282d7 | UNREVIEWED | V-SHEET | changed (was 5ec5add849b0) |
| 1440x900/hf-male/shots/026-seated__reclined_45__covered.png | 993f14a2ba44 | UNREVIEWED | V-ARMS, V-ROD | changed (was dd4b583e6df4) |
| 1440x900/hf-male/shots/027-head_neck__reclined_45__covered.png | d0ec977b242f | UNREVIEWED | V-GOWNEDGE | changed (was ca3b5aa6937e) |
| 1440x900/hf-male/shots/028-ear_left__reclined_45__covered.png | 2f80a10316d6 | UNREVIEWED | V-HAIR | changed (was a080edf9b112) |
| 1440x900/hf-male/shots/029-ear_right__reclined_45__covered.png | 4539c799150b | UNREVIEWED | V-HAIR | changed (was c9eb63ba022e) |
| 1440x900/hf-male/shots/030-chest_front__reclined_45__covered.png | 5f7084836c82 | UNREVIEWED | V-ROD | changed (was 413e30fc7d1f) |
| 1440x900/hf-male/shots/031-chest_back__reclined_45__covered.png | e5556d860433 | UNREVIEWED | V-ROD | changed (was d6f7ba25387e) |
| 1440x900/hf-male/shots/032-abdomen__reclined_45__covered.png | 82c933dee9d8 | UNREVIEWED | V-ROD | changed (was 854c0ac0e7cb) |
| 1440x900/hf-male/shots/033-arms__reclined_45__covered.png | 7accb96a4d06 | UNREVIEWED | V-ROD | changed (was f2292dec811a) |
| 1440x900/hf-male/shots/034-hands__reclined_45__covered.png | 194b7fc5b68d | UNREVIEWED | V-ROD | changed (was 975d5a3b8984) |
| 1440x900/hf-male/shots/035-legs__reclined_45__covered.png | bfb5f39da9f7 | UNREVIEWED | V-SHEET, V-ROD | changed (was 321cd635225d) |
| 1440x900/hf-male/shots/036-feet__reclined_45__covered.png | 6cd82f7ff284 | UNREVIEWED | V-SHEET | changed (was 2840369a5813) |
| 1440x900/hf-male/shots/037-overview__seated__covered.png | a10f634755d5 | UNREVIEWED | V-SHEET, V-BACKREST | changed (was c0e6e07c7c11) |
| 1440x900/hf-male/shots/038-seated__seated__covered.png | abc47fc8da85 | UNREVIEWED | V-ARMS, V-ROD | changed (was 5e0fef252b50) |
| 1440x900/hf-male/shots/039-head_neck__seated__covered.png | 987270d4d0b8 | UNREVIEWED | V-GOWNEDGE | changed (was b7d27b3a9b0e) |
| 1440x900/hf-male/shots/040-ear_left__seated__covered.png | 51f73eed3eb9 | UNREVIEWED | V-HAIR | changed (was a0bb7ff33735) |
| 1440x900/hf-male/shots/041-ear_right__seated__covered.png | 9741975b4bbe | UNREVIEWED | V-HAIR | changed (was f2fd207b5832) |
| 1440x900/hf-male/shots/042-chest_front__seated__covered.png | fcdcd727c3c6 | UNREVIEWED | V-ROD | changed (was 599d88a7d0c2) |
| 1440x900/hf-male/shots/043-chest_back__seated__covered.png | 2b9b71f8592c | UNREVIEWED | V-BACKREST | changed (was f13642a67aff) |
| 1440x900/hf-male/shots/044-abdomen__seated__covered.png | cc780025319d | UNREVIEWED | V-ROD | changed (was 412fd726cc46) |
| 1440x900/hf-male/shots/045-arms__seated__covered.png | 90c82adf4dde | UNREVIEWED | V-ROD | changed (was bd27ea4b617e) |
| 1440x900/hf-male/shots/046-hands__seated__covered.png | c40113f3c52e | UNREVIEWED | V-SHEET | changed (was aaea15f9f02f) |
| 1440x900/hf-male/shots/047-legs__seated__covered.png | f36297d12bda | UNREVIEWED | V-SHEET | changed (was 861e485342d2) |
| 1440x900/hf-male/shots/048-feet__seated__covered.png | 442f0b246ef5 | UNREVIEWED | V-SHEET | changed (was 719ed7c02ad9) |
| 1440x900/hf-male/shots/049-overview__sitting_dangling__covered.png | 16c00096c1e5 | UNREVIEWED | V-SHEET | changed (was a52dd51fd203) |
| 1440x900/hf-male/shots/050-seated__sitting_dangling__covered.png | 06faf993d8bf | UNREVIEWED | V-ROD, V-GOWNEDGE | changed (was 590d8ca6300f) |
| 1440x900/hf-male/shots/051-head_neck__sitting_dangling__covered.png | a028af301426 | UNREVIEWED | V-GOWNEDGE | changed (was 69f029468906) |
| 1440x900/hf-male/shots/052-ear_left__sitting_dangling__covered.png | c5cda99486fb | UNREVIEWED | V-HAIR | changed (was 260577e2f116) |
| 1440x900/hf-male/shots/053-ear_right__sitting_dangling__covered.png | c359b5d4ac6c | UNREVIEWED | V-HAIR | changed (was c422608438d2) |
| 1440x900/hf-male/shots/054-chest_front__sitting_dangling__covered.png | caab2e7cac06 | UNREVIEWED | V-ROD | changed (was 67f4c228b4f0) |
| 1440x900/hf-male/shots/055-chest_back__sitting_dangling__covered.png | d088e65736ad | UNREVIEWED | V-HAIR | changed (was e377be31ae13) |
| 1440x900/hf-male/shots/056-abdomen__sitting_dangling__covered.png | 97ed07c1b1f2 | UNREVIEWED | V-ROD | changed (was c2ce1f14a4b2) |
| 1440x900/hf-male/shots/057-arms__sitting_dangling__covered.png | e9225c1349d5 | UNREVIEWED | V-ROD | changed (was f4e95dec0e61) |
| 1440x900/hf-male/shots/058-hands__sitting_dangling__covered.png | 67278eeda60f | UNREVIEWED | V-ROD | changed (was 562447686c57) |
| 1440x900/hf-male/shots/059-legs__sitting_dangling__covered.png | 7f41fad37d75 | UNREVIEWED | V-SHEET | changed (was 9cf7678bda6a) |
| 1440x900/hf-male/shots/060-feet__sitting_dangling__covered.png | 388d60f0c639 | UNREVIEWED | V-SHEET | changed (was 7cfd5985fbd4) |
| 1440x900/hf-male/shots/061-overview__left_lateral_decubitus__covered.png | 46e28e170c58 | UNREVIEWED | V-LLD, V-LLDPRIV | changed (was c8a6a483b8e9) |
| 1440x900/hf-male/shots/062-seated__left_lateral_decubitus__covered.png | 274d597de217 | UNREVIEWED | V-LLD | changed (was ef8a2a22f98a) |
| 1440x900/hf-male/shots/063-head_neck__left_lateral_decubitus__covered.png | ec8ad51c83ed | UNREVIEWED | V-LLD, V-ROD | changed (was 61a8a5523b5c) |
| 1440x900/hf-male/shots/064-ear_left__left_lateral_decubitus__covered.png | 1a96021e15fa | UNREVIEWED | — | changed (was faaa59a4ef2e) |
| 1440x900/hf-male/shots/065-ear_right__left_lateral_decubitus__covered.png | 1a705a7f2519 | UNREVIEWED | V-HAIR | changed (was 9effa599cdc6) |
| 1440x900/hf-male/shots/066-chest_front__left_lateral_decubitus__covered.png | 005bb77189bc | UNREVIEWED | V-ROD | changed (was 356c8f6822d0) |
| 1440x900/hf-male/shots/067-chest_back__left_lateral_decubitus__covered.png | 3cb8e341fa5b | UNREVIEWED | V-SEAM | changed (was 83e214f7a6aa) |
| 1440x900/hf-male/shots/068-abdomen__left_lateral_decubitus__covered.png | 3ca61c2c1d2b | UNREVIEWED | V-ROD, V-LLD | changed (was 44dfc0b26d3e) |
| 1440x900/hf-male/shots/069-arms__left_lateral_decubitus__covered.png | 78d9eb8ed593 | UNREVIEWED | V-LLD | changed (was c45c60551059) |
| 1440x900/hf-male/shots/070-hands__left_lateral_decubitus__covered.png | 915fd046e118 | UNREVIEWED | V-LLD | changed (was ca74ee8ff992) |
| 1440x900/hf-male/shots/071-legs__left_lateral_decubitus__covered.png | d3ddb98a927c | UNREVIEWED | V-LLDPRIV | changed (was 01d337b63003) |
| 1440x900/hf-male/shots/072-feet__left_lateral_decubitus__covered.png | 35a7b7f4c9ea | UNREVIEWED | V-LLDPRIV | changed (was 17243512c08f) |
| 1440x900/hf-male/views/01-face__seated__covered.png | f7be189194ec | UNREVIEWED | — | changed (was fb3ca265d764) |
| 1440x900/hf-male/views/02-neck_back__seated__covered.png | 1b23add7f893 | UNREVIEWED | — | changed (was 7251186bbdca) |
| 1440x900/hf-male/views/03-head_top__seated__covered.png | a31dcbfd8405 | UNREVIEWED | — | changed (was cceddca14bdc) |
| 1440x900/hf-male/views/04-arms_left__seated__covered.png | 2738f8fa36bc | UNREVIEWED | V-ROD | changed (was 34313e053bbe) |
| 1440x900/hf-male/views/05-elbow_right__seated__covered.png | 5f431c0bc5e8 | UNREVIEWED | — | changed (was a949d111c177) |
| 1440x900/hf-male/views/06-elbow_left__seated__covered.png | 2b2445e9fe52 | UNREVIEWED | — | changed (was b88c8be4cd1c) |
| 1440x900/hf-male/views/07-chest_right__seated__covered.png | 0c2c74df7c69 | UNREVIEWED | V-ROD | changed (was 6152d8826077) |
| 1440x900/hf-male/views/08-chest_left__seated__covered.png | 3b4363a9a70e | UNREVIEWED | V-ROD | changed (was 0a289be1cf20) |
| 1440x900/hf-male/views/09-ankle_right__sitting_dangling__covered.png | dabcb6c99cf3 | UNREVIEWED | V-SHEET | changed (was fd699e8eebdf) |
| 1440x900/hf-male/views/10-ankle_left__sitting_dangling__covered.png | 9795b91f66cd | UNREVIEWED | V-SHEET | changed (was d23e629d8bfd) |
| 1440x900/screening-female/dialogs/01-examine-menu.png | 0de080f657a3 | UNREVIEWED | V-MENUSCROLL | changed (was e3279940e232) |
| 1440x900/screening-female/dialogs/02-maneuver-menu.png | 677c979e3e22 | UNREVIEWED | V-SHEET | changed (was bd605454e36f) |
| 1440x900/screening-female/dialogs/03-tool-chooser.png | fcd5666abb2e | UNREVIEWED | V-ROD | changed (was 2c3d50123c32) |
| 1440x900/screening-female/dialogs/04-perform.png | 1006a1d9e7f3 | UNREVIEWED | V-PERFORMCLIP, V-ROD | changed (was 3cd267917551) |
| 1440x900/screening-female/dialogs/05-describe.png | 569500693603 | UNREVIEWED | V-TOASTSTACK | changed (was ec820cf04ca3) |
| 1440x900/screening-female/dialogs/06-leave-confirm.png | cde077f8dccf | UNREVIEWED | V-TOASTSTACK | changed (was 960cc69991f2) |
| 1440x900/screening-female/dialogs/07-actions-menu.png | 967203dc8fb6 | UNREVIEWED | V-MENUOVER, V-TOASTSTACK | changed (was 25570092643d) |
| 1440x900/screening-female/dialogs/08-tools-menu.png | abf95d50df9c | UNREVIEWED | — | changed (was b4eb05729f55) |
| 1440x900/screening-female/dialogs/09-bed-hud.png | 9f6752f5cd04 | UNREVIEWED | — | changed (was 1adffcb82750) |
| 1440x900/screening-female/dialogs/10-practice-help.png | 6ef0a2a1f105 | UNREVIEWED | V-HINTOVER | changed (was c54dfbde8b45) |
| 1440x900/screening-female/dialogs/11-finish.png | 6f939cdd48b1 | UNREVIEWED | — | changed (was 26777708908b) |
| 1440x900/screening-female/dialogs/12-settings.png | 4ca4ba198031 | UNREVIEWED | — | changed (was bf2ec9a9cbbf) |
| 1440x900/screening-female/drapes/01-chest_front__supine__chest-left-exposed.png | a788237e0ff9 | UNREVIEWED | — | changed (was 492bf0fa8840) |
| 1440x900/screening-female/drapes/02-chest_front__supine__chest-exposed.png | 2e556a7ee09f | UNREVIEWED | — | changed (was e6846fed5e6b) |
| 1440x900/screening-female/drapes/03-abdomen__supine__abdomen-exposed.png | 42fe5e3cca08 | UNREVIEWED | — | changed (was d4b8f9500ce5) |
| 1440x900/screening-female/drapes/04-legs__supine__legs-left-exposed.png | 16b347f0dc0b | UNREVIEWED | — | changed (was 74ec1524f390) |
| 1440x900/screening-female/drapes/05-legs__supine__legs-exposed.png | 64c7b89e4181 | UNREVIEWED | — | changed (was 4af862bee537) |
| 1440x900/screening-female/drapes/06-overview__supine__all-exposed.png | de1512c42af5 | UNREVIEWED | — | changed (was 949e98fdaaf1) |
| 1440x900/screening-female/room/01-corridor.png | b5a830f1932a | UNREVIEWED | V-PLACARD, V-PLACEHOLDER | changed (was 8313214ef2c3) |
| 1440x900/screening-female/room/02-overview.png | 355fa1379eb9 | UNREVIEWED | V-SHEET | changed (was 4faa4bba4d37) |
| 1440x900/screening-female/room/03-sink.png | 428daf133a04 | UNREVIEWED | — | changed (was fd1bb67a81e7) |
| 1440x900/screening-female/room/04-tool_table.png | 2f6bd08afa7d | UNREVIEWED | V-TOOLS | changed (was c38724a2aa95) |
| 1440x900/screening-female/shots/001-overview__supine__covered.png | 0cdb21c66225 | UNREVIEWED | V-SHEET | changed (was a0677062c159) |
| 1440x900/screening-female/shots/002-seated__supine__covered.png | 2e033c330e95 | UNREVIEWED | V-ARMS, V-ROD | changed (was 428d235f15ee) |
| 1440x900/screening-female/shots/003-head_neck__supine__covered.png | b11ef295df8a | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was f313ba49ab3f) |
| 1440x900/screening-female/shots/004-ear_left__supine__covered.png | 7f89ee320c1e | UNREVIEWED | V-HAIR | changed (was a4b30dd1388f) |
| 1440x900/screening-female/shots/005-ear_right__supine__covered.png | 103bfd01c0ea | UNREVIEWED | V-HAIR | changed (was 37595fb27f36) |
| 1440x900/screening-female/shots/006-chest_front__supine__covered.png | b10d6d7e7f52 | UNREVIEWED | V-CHESTINV, V-ROD, V-ARMS, V-GOWNFIT | changed (was f62a471b81bd) |
| 1440x900/screening-female/shots/007-chest_back__supine__covered.png | 4d813119a8a5 | UNREVIEWED | V-ROD, V-ARMS, V-GOWNFIT | changed (was 41802a7ccd38) |
| 1440x900/screening-female/shots/008-abdomen__supine__covered.png | 1004713d4126 | UNREVIEWED | V-ROD, V-ARMS | changed (was 58ac6fe1068d) |
| 1440x900/screening-female/shots/009-arms__supine__covered.png | bf23214bee48 | UNREVIEWED | V-ROD, V-ARMS, V-GOWNFIT | changed (was e0d822fb1501) |
| 1440x900/screening-female/shots/010-hands__supine__covered.png | 3a617b84a15f | UNREVIEWED | V-ROD | changed (was 251be4768295) |
| 1440x900/screening-female/shots/011-legs__supine__covered.png | f9c4c15b3a37 | UNREVIEWED | V-SHEET | changed (was 38e87e1cb6f2) |
| 1440x900/screening-female/shots/012-feet__supine__covered.png | 0aa32f45c4ba | UNREVIEWED | V-SHEET | changed (was eb3c58ace893) |
| 1440x900/screening-female/shots/013-overview__reclined_30__covered.png | c27ae17cfca4 | UNREVIEWED | V-SHEET | changed (was cd12e9ddb10b) |
| 1440x900/screening-female/shots/014-seated__reclined_30__covered.png | 87714f0c1363 | UNREVIEWED | V-ROD | changed (was 0f6a87a6cca1) |
| 1440x900/screening-female/shots/015-head_neck__reclined_30__covered.png | 2fff3b4d1e87 | UNREVIEWED | V-GOWNFIT, V-GOWNEDGE | changed (was 25a0812f76c9) |
| 1440x900/screening-female/shots/016-ear_left__reclined_30__covered.png | 436da028657b | UNREVIEWED | V-HAIR | changed (was f14151da169e) |
| 1440x900/screening-female/shots/017-ear_right__reclined_30__covered.png | e53c6ad14aac | UNREVIEWED | V-HAIR | changed (was 0cc9760e60ca) |
| 1440x900/screening-female/shots/018-chest_front__reclined_30__covered.png | 922ef7a98055 | UNREVIEWED | V-CHESTROT, V-ROD, V-GOWNFIT | changed (was 867b157105c7) |
| 1440x900/screening-female/shots/019-chest_back__reclined_30__covered.png | 5dde69e73a54 | UNREVIEWED | V-ROD | changed (was a0b7587e2123) |
| 1440x900/screening-female/shots/020-abdomen__reclined_30__covered.png | 7c26ea65a2aa | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was 4d924e5bcd39) |
| 1440x900/screening-female/shots/021-arms__reclined_30__covered.png | cdaea5805c87 | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was 5ec33ecbcad0) |
| 1440x900/screening-female/shots/022-hands__reclined_30__covered.png | 156f6af83962 | UNREVIEWED | V-ARMS, V-ROD | changed (was fe95760a9556) |
| 1440x900/screening-female/shots/023-legs__reclined_30__covered.png | a9bf2a6ea3c4 | UNREVIEWED | V-SHEET, V-ROD | changed (was 3bf31f48058a) |
| 1440x900/screening-female/shots/024-feet__reclined_30__covered.png | 0586567d6a4d | UNREVIEWED | V-SHEET | changed (was a44c7d7bb45d) |
| 1440x900/screening-female/shots/025-overview__reclined_45__covered.png | 5a1b7d370258 | UNREVIEWED | V-SHEET | changed (was 245c5f50ca40) |
| 1440x900/screening-female/shots/026-seated__reclined_45__covered.png | 7f3c3fa696b7 | UNREVIEWED | V-ARMS, V-ROD | changed (was 26d8ab79df43) |
| 1440x900/screening-female/shots/027-head_neck__reclined_45__covered.png | 153b9866d811 | UNREVIEWED | V-GOWNFIT, V-GOWNEDGE | changed (was c68791864bb2) |
| 1440x900/screening-female/shots/028-ear_left__reclined_45__covered.png | 67efb1e6c321 | UNREVIEWED | V-HAIR | changed (was e0cabc29a25d) |
| 1440x900/screening-female/shots/029-ear_right__reclined_45__covered.png | 0f212a678ad9 | UNREVIEWED | V-HAIR | changed (was 179182e6869b) |
| 1440x900/screening-female/shots/030-chest_front__reclined_45__covered.png | ee4cbd26a4f8 | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was 690259eb1fed) |
| 1440x900/screening-female/shots/031-chest_back__reclined_45__covered.png | 022b66f2c643 | UNREVIEWED | V-ROD | changed (was d2df56a2daa2) |
| 1440x900/screening-female/shots/032-abdomen__reclined_45__covered.png | 4a0c8af3dc02 | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was 4b9e2d55b425) |
| 1440x900/screening-female/shots/033-arms__reclined_45__covered.png | cd42c44da639 | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was 9c49001ff412) |
| 1440x900/screening-female/shots/034-hands__reclined_45__covered.png | 13b2fd7c9e52 | UNREVIEWED | V-ROD | changed (was 8dccab2b14de) |
| 1440x900/screening-female/shots/035-legs__reclined_45__covered.png | 0283140d68eb | UNREVIEWED | V-SHEET, V-ROD | changed (was 79d90336105b) |
| 1440x900/screening-female/shots/036-feet__reclined_45__covered.png | 7a56b07ebd74 | UNREVIEWED | V-SHEET | changed (was 060adada5541) |
| 1440x900/screening-female/shots/037-overview__seated__covered.png | 355fa1379eb9 | UNREVIEWED | V-SHEET | changed (was 4faa4bba4d37) |
| 1440x900/screening-female/shots/038-seated__seated__covered.png | 1737016b8606 | UNREVIEWED | V-ARMS, V-ROD, V-GOWNFIT | changed (was 5bd5e16bde13) |
| 1440x900/screening-female/shots/039-head_neck__seated__covered.png | cb1dcb9af360 | UNREVIEWED | V-GOWNFIT, V-GOWNEDGE | changed (was 55fc3fb0a0c3) |
| 1440x900/screening-female/shots/040-ear_left__seated__covered.png | 49e2b6cf6016 | UNREVIEWED | V-HAIR | changed (was 968ce46321da) |
| 1440x900/screening-female/shots/041-ear_right__seated__covered.png | fbcbc9e67355 | UNREVIEWED | V-HAIR | changed (was 55e6f8e3a4ee) |
| 1440x900/screening-female/shots/042-chest_front__seated__covered.png | 098744f95fc1 | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was 1f822f519992) |
| 1440x900/screening-female/shots/043-chest_back__seated__covered.png | c0e5f7880998 | UNREVIEWED | V-BACKREST | changed (was 2f94dc17e9d1) |
| 1440x900/screening-female/shots/044-abdomen__seated__covered.png | 90cd5f138b9b | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was d167138aee1f) |
| 1440x900/screening-female/shots/045-arms__seated__covered.png | f993c85ec762 | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was bac4f0f8b293) |
| 1440x900/screening-female/shots/046-hands__seated__covered.png | a990a4e7b34f | UNREVIEWED | V-ROD | changed (was 1f405bc731e3) |
| 1440x900/screening-female/shots/047-legs__seated__covered.png | 4a4c72790bd5 | UNREVIEWED | V-SHEET | changed (was aa58ac678703) |
| 1440x900/screening-female/shots/048-feet__seated__covered.png | a2f94e774df9 | UNREVIEWED | V-SHEET | changed (was a439bc9c6d59) |
| 1440x900/screening-female/shots/049-overview__sitting_dangling__covered.png | 5c366b0888e0 | UNREVIEWED | V-SHEET, V-GOWNFIT | changed (was 376b8ae05cc8) |
| 1440x900/screening-female/shots/050-seated__sitting_dangling__covered.png | d8a1a01caa64 | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was 00e75650e9b2) |
| 1440x900/screening-female/shots/051-head_neck__sitting_dangling__covered.png | a96b540cf7dd | UNREVIEWED | V-GOWNFIT, V-GOWNEDGE | changed (was a107480914e6) |
| 1440x900/screening-female/shots/052-ear_left__sitting_dangling__covered.png | 3b40fadc95b0 | UNREVIEWED | V-HAIR | changed (was e583269614f7) |
| 1440x900/screening-female/shots/053-ear_right__sitting_dangling__covered.png | 71d7e6f07bb9 | UNREVIEWED | V-HAIR | changed (was 60442b50f779) |
| 1440x900/screening-female/shots/054-chest_front__sitting_dangling__covered.png | b3eb42fcba50 | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was 57b0661a8c3e) |
| 1440x900/screening-female/shots/055-chest_back__sitting_dangling__covered.png | c47001b92c5b | UNREVIEWED | V-GOWNFIT, V-HAIR | changed (was 67507dd53f33) |
| 1440x900/screening-female/shots/056-abdomen__sitting_dangling__covered.png | 56b4877f1d01 | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was 850d75dd022a) |
| 1440x900/screening-female/shots/057-arms__sitting_dangling__covered.png | c5b193e52432 | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was 4a95862b81c7) |
| 1440x900/screening-female/shots/058-hands__sitting_dangling__covered.png | f9e00e066838 | UNREVIEWED | V-ROD, V-SHEET | changed (was c600a8bb70a3) |
| 1440x900/screening-female/shots/059-legs__sitting_dangling__covered.png | 199fff574140 | UNREVIEWED | V-SHEET | changed (was 76547cc048e6) |
| 1440x900/screening-female/shots/060-feet__sitting_dangling__covered.png | 0951addce5c7 | UNREVIEWED | V-SHEET | changed (was be72e9412ea3) |
| 1440x900/screening-female/shots/061-overview__left_lateral_decubitus__covered.png | 62cbaac59968 | UNREVIEWED | V-LLD, V-LLDPRIV | changed (was abe96c9e3e79) |
| 1440x900/screening-female/shots/062-seated__left_lateral_decubitus__covered.png | 58912ca2e023 | UNREVIEWED | V-LLD, V-LLDPRIV | changed (was f193c978ef7f) |
| 1440x900/screening-female/shots/063-head_neck__left_lateral_decubitus__covered.png | 804f72fdbc1a | UNREVIEWED | V-LLD, V-GOWNFIT | changed (was 2f167ad9f603) |
| 1440x900/screening-female/shots/064-ear_left__left_lateral_decubitus__covered.png | 9f2af3f9ef96 | UNREVIEWED | V-LLD | changed (was 0f2ce5b7def0) |
| 1440x900/screening-female/shots/065-ear_right__left_lateral_decubitus__covered.png | 9224f60a4f59 | UNREVIEWED | V-HAIR | changed (was 67c794dda42a) |
| 1440x900/screening-female/shots/066-chest_front__left_lateral_decubitus__covered.png | 154609de8af3 | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was 13113f752659) |
| 1440x900/screening-female/shots/067-chest_back__left_lateral_decubitus__covered.png | 430c5705aa08 | UNREVIEWED | V-GOWNFIT | changed (was e86e5a6b889c) |
| 1440x900/screening-female/shots/068-abdomen__left_lateral_decubitus__covered.png | bd8b73b123ea | UNREVIEWED | V-ROD, V-LLD | changed (was a4ee715b1f5e) |
| 1440x900/screening-female/shots/069-arms__left_lateral_decubitus__covered.png | 79e0d019a9d4 | UNREVIEWED | V-LLD | changed (was 99e99191f55e) |
| 1440x900/screening-female/shots/070-hands__left_lateral_decubitus__covered.png | 7fde538d78cd | UNREVIEWED | V-LLD | changed (was bc70d529c64e) |
| 1440x900/screening-female/shots/071-legs__left_lateral_decubitus__covered.png | 319ce26decaf | UNREVIEWED | V-LLDPRIV, V-LLD | changed (was 8541ef7154d9) |
| 1440x900/screening-female/shots/072-feet__left_lateral_decubitus__covered.png | 555850b1633c | UNREVIEWED | V-LLDPRIV | changed (was 9634f0974c3b) |
| 1440x900/screening-female/views/01-face__seated__covered.png | 848cab17cb0c | UNREVIEWED | — | changed (was 688206d08fa4) |
| 1440x900/screening-female/views/02-neck_back__seated__covered.png | 315c378510fd | UNREVIEWED | — | changed (was faf097ff67a6) |
| 1440x900/screening-female/views/03-head_top__seated__covered.png | 6ca4ca6bc7fe | UNREVIEWED | — | changed (was afb38f744e22) |
| 1440x900/screening-female/views/04-arms_left__seated__covered.png | aed686651b8b | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was 786dcbc451a5) |
| 1440x900/screening-female/views/05-elbow_right__seated__covered.png | 6efdd326cbb8 | UNREVIEWED | — | changed (was ce8736905959) |
| 1440x900/screening-female/views/06-elbow_left__seated__covered.png | f43da7e3f47c | UNREVIEWED | — | changed (was b497a734e94f) |
| 1440x900/screening-female/views/07-chest_right__seated__covered.png | aaa0ec19ed1a | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was 7f4ee4fcd8a8) |
| 1440x900/screening-female/views/08-chest_left__seated__covered.png | 5eb6163cef69 | UNREVIEWED | V-ROD, V-GOWNFIT | changed (was 6778e5e9c286) |
| 1440x900/screening-female/views/09-ankle_right__sitting_dangling__covered.png | a0970d4452fe | UNREVIEWED | V-SHEET | changed (was 9d840d537aea) |
| 1440x900/screening-female/views/10-ankle_left__sitting_dangling__covered.png | 4d0863747dcd | UNREVIEWED | V-SHEET | changed (was 6d8a0b0be989) |
