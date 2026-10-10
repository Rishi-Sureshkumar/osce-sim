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
| V-LLD | high | pose | M3 | fixed | Left lateral decubitus pose contorted (arm flung up, hangs off the table edge) and the leg sheet disappears (6 shots) — fixed in M3.2: two-bone-IK left lateral pose (lower arm forward on the mattress, upper arm along the flank, side pillow); the leg sheet stays (confirmed at the M3/M6 review, both bodies) |
| V-LLDPRIV | high | drape | M3 | fixed | LLD: gown rides up, buttocks exposed, no sheet (2 shots) — fixed in M3.1/M3.2: the sheet covers the legs and buttocks in left lateral; the gown stays on (confirmed at the M3/M6 review) |
| V-PELVIS | high | drape | M3 | fixed | "All exposed" leaves the patient naked: the pelvis section must never be exposed (2 shots) — fixed in M3.1: the pelvis towel is never uncovered (all exposed leaves the towel) |
| V-PUBIS | high | drape | M3 | fixed | Female abdomen exposure reaches the pubic area (pelvis section must stay covered) (1 shots) — fixed in M3.1: the abdomen panel stops at the sheet; the pubic area stays under the towel (confirmed at the M3/M6 review, both bodies) |
| V-SHEET | high | drape | M3 | fixed | Legs/feet poke through the leg sheet while "Legs: covered" (bug 6) (18 shots) — fixed in M3.1 (bug 6): the leg sheet is built per pose from the skinned body; zero-tolerance coverage test for every position, model and leg state |
| V-ARMSLLD | medium | shot | M3 | fixed | LLD arms shot frames the raised arm against the wall from behind — the arm is flung up by the left-lateral pose (V-LLD); re-owned to M3 at the M2 gate — fixed in M3.2: the upper arm lies along the flank, so the arms view shows the arm on the body |
| V-ARMSSEAT | medium | shot | M2 | fixed | Seated arms shot frames the torso; the arm is hidden behind the body — fixed at the M2 gate (arm and hand on the thigh in view; plus close left-arm and back-of-elbow views) |
| V-BACKHINT | medium | ux | M2 | fixed | Reclined 45°: back against the backrest but no "ask the patient to sit up" hint — fixed at the M2 gate (shotHint: lying back up to 45°, and seated against the backrest: "lean forward") |
| V-BACKHINT2 | medium | ux | M2 | fixed | LLD: hint wrongly said the back is against the table — fixed at the M2 gate (shotHint is per position) |
| V-NECKLLD | medium | shot | M3 | fixed | LLD head_neck: neck partly behind the shoulder — follows the left-lateral pose (V-LLD); re-owned to M3 at the M2 gate — fixed in M3.2: with the IK pose and side pillow the neck is in view from the front |
| V-BODY | medium | asset | M3 | fixed | Female body barely differs from the male (proportions, hair) (2 shots) — fixed: distinct bodies (older heavier man, grey short hair; woman in her 30s with breast and hip targets, brown hair) (confirmed at the M3/M6 review) |
| V-ROD | medium | drape | M3 | fixed | Rolled/folded gown edges render as floating light-blue rods across the body (the roll-chest rod lies over the apex) (59 shots) — fixed in M3.3: folded gown edges are tubes laid along the skin, drawn only where a fold exists, clear of exam targets |
| V-CHESTINV | medium | shot | M6 | fixed | Supine chest shot from the head end: the face is upside down at the bottom of the frame (3 shots) — fixed in M6: the chest view is no longer upside down (the face sits to the side, as from beside the bed) |
| V-PERFORMCLIP | medium | ui | M6 | fixed | Perform card clips the finding text at the canvas bottom (1 shots) — fixed in M6: the exam card grows upward inside the view with a height cap and scrolls |
| V-PLACARD | medium | ui | M6 | fixed | 3D door placard is a blank rectangle (text only in the side panel) (3 shots) — fixed in M6: the door instructions are printed on the 3D door (canvas texture) |
| V-WRAP | medium | ui | M6 | fixed | Toolbar wraps at 1280/1180 wide ("Actions"/"Leave the room" on a second row) (2 shots) — fixed in M6: top bar + one-row encounter bar at 1440/1280/1180 (fixed height; steady-layout regression) |
| V-EARDOWN | low | ux | M2 | fixed | LLD: the left ear faces the table — fixed at the M2 gate: a hint says the left ear is against the table |
| V-GOWNEDGE | low | asset | M3 | fixed | Gown neckline has a sawtooth edge (1 shots) — fixed in M3.3: iso-clipped smooth neckline, sleeves and hem |
| V-GOWNFIT | low | asset | M3 | open | Gown is skin-tight (body outline shows through) (5 shots) — improved in M3.3 (inflate-only smoothing bridges hollows); the woman's gown still follows the breast contour |
| V-HAIR | low | asset | M3 | fixed | Procedural hair shell has jagged edges over the ears (10 shots) — fixed in M3.3: the hair cap is clipped at a smooth hairline |
| V-SEAM | low | asset | M3 | fixed | Visible skin seam line above the knee (1 shots) — not reproduced at the M3/M6 review (legs exposed, both bodies) |
| V-TOOLS | low | asset | M3 | fixed | Instruments are crude primitives (2 shots) — fixed in M3.3: stethoscope with tubing, Taylor hammer, U-shaped forks, penlight, otoscope, cuff with gauge |
| V-ZFIGHT | low | room | M3 | fixed | Backrest corner geometry flickers (1 shots) — fixed in M3.3: a gap at the table hinge removes the coplanar mattress faces |
| V-CHESTROT | low | shot | M6 | fixed | Reclined chest shot rotated 90° (1 shots) — fixed in M6: the reclined chest view is upright |
| V-FRAME | low | shot | M6 | fixed | Conversation (seated) shot crops the head (2 shots) — fixed in M6: the conversation view keeps the whole head in frame (52° field of view) |
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
| V-HANDSHEET | high | drape | M3 | fixed | Found at the M3/M6 review: lying flat or reclined, the sheet's fall-off draped it over the hands beside the hips (hands hidden, 85% of the arm under the sheet supine) — fixed: the sheet tucks under arms that rest on something (tests/m3-drapes.test.ts) |
| V-GOWNBACK | high | drape | M3 | fixed | Found at the M3/M6 review: with the back covered, the spine was bare from the neck to the buttocks (woman sitting up; a notch on the man) — fixed: per-body front/back seam and a bounded neckline (tests/m3-gown-back.test.ts) |
| V-HUDOVER | medium | ui | M6 | fixed | Found by the catalog: a one-row tool HUD ran under the right panel once "Listening for" showed, hiding Put down / Tools… — fixed: buttons first, labels truncate (e2e/regressions/steady-layout.spec.ts) |
| V-COACHBADGE | low | ui | M6 | fixed | Found at the M3/M6 review: coach list "1 hint" badge split across two lines; "1 overrides" — fixed: badges wrap whole, singular |
| V-CHATNARROW | low | ui | M6 | fixed | Found at the M3/M6 review: the chat box too narrow for its placeholder ("Ask the pat…") — fixed: push-to-talk is a microphone icon |

## Screenshots

| file | sha256 | reviewed@ | defects | notes |
|---|---|---|---|---|
| 1180x820/hf-male/layout/01-station-inside.png | 1cbf5a110414 | 383637c | — | Station inside: top bar, one-row encounter bar, collapsible panels, 3D view the hero, one-row tool HUD, mic button and full chat placeholder (1180x820) |
| 1180x820/hf-male/layout/02-note.png | acb82688ca23 | 383637c | — | Post-encounter note with the door card; top bar (1180x820) |
| 1180x820/hf-male/layout/03-results.png | 9839d8f6ea12 | 383637c | — | Results: verdict and per-domain score bars, feedback, debrief (1180x820) |
| 1180x820/hf-male/layout/04-coach-list.png | 6f465eff6be8 | 383637c | — | Coach list: badges wrap whole, singular "1 hint" (1180x820) |
| 1180x820/hf-male/layout/05-coach-detail.png | d7f3ba137423 | 383637c | — | Coach detail: feedback, verdict, note with the unperformed claim flagged, mistakes, transcript badges (1180x820) |
| 1280x800/hf-male/layout/01-station-inside.png | af53b1a199ba | 383637c | — | Station inside: top bar, one-row encounter bar, collapsible panels, 3D view the hero, one-row tool HUD, mic button and full chat placeholder (1280x800) |
| 1280x800/hf-male/layout/02-note.png | 289bb4f9a82c | 383637c | — | Post-encounter note with the door card; top bar (1280x800) |
| 1280x800/hf-male/layout/03-results.png | c89f0c8bb8a8 | 383637c | — | Results: verdict and per-domain score bars, feedback, debrief (1280x800) |
| 1280x800/hf-male/layout/04-coach-list.png | 95e1ed67f335 | 383637c | — | Coach list: badges wrap whole, singular "1 hint" (1280x800) |
| 1280x800/hf-male/layout/05-coach-detail.png | 749e17fd18ae | 383637c | — | Coach detail: feedback, verdict, note with the unperformed claim flagged, mistakes, transcript badges (1280x800) |
| 1440x900/hf-male/drapes/01-chest_front__supine__chest-left-exposed.png | b505824ba07a | 383637c | — | Drapes (man): chest-left-exposed — per-side chest, pelvis towel always on, legs fold back each side, feet bare, folded gown edges as rolls along the skin |
| 1440x900/hf-male/drapes/02-chest_front__supine__chest-exposed.png | b7b90cc9b94b | 383637c | — | Drapes (man): chest-exposed — per-side chest, pelvis towel always on, legs fold back each side, feet bare, folded gown edges as rolls along the skin |
| 1440x900/hf-male/drapes/03-abdomen__supine__abdomen-exposed.png | 72d87adfb2b5 | 383637c | — | Drapes (man): abdomen-exposed — per-side chest, pelvis towel always on, legs fold back each side, feet bare, folded gown edges as rolls along the skin |
| 1440x900/hf-male/drapes/04-legs__supine__legs-left-exposed.png | 5192a378d03a | 383637c | — | Drapes (man): legs-left-exposed — per-side chest, pelvis towel always on, legs fold back each side, feet bare, folded gown edges as rolls along the skin |
| 1440x900/hf-male/drapes/05-legs__supine__legs-exposed.png | ce456f6100e6 | 383637c | — | Drapes (man): legs-exposed — per-side chest, pelvis towel always on, legs fold back each side, feet bare, folded gown edges as rolls along the skin |
| 1440x900/hf-male/drapes/06-overview__supine__all-exposed.png | 16dd7919d26b | 383637c | — | Drapes (man): all-exposed — per-side chest, pelvis towel always on, legs fold back each side, feet bare, folded gown edges as rolls along the skin |
| 1440x900/hf-male/layout/01-station-inside.png | d0e88483ef59 | 383637c | — | Station inside: top bar, one-row encounter bar, collapsible panels, 3D view the hero, one-row tool HUD, mic button and full chat placeholder (1440x900) |
| 1440x900/hf-male/layout/02-note.png | 4ccf8a401588 | 383637c | — | Post-encounter note with the door card; top bar (1440x900) |
| 1440x900/hf-male/layout/03-results.png | b0cd6a13608e | 383637c | — | Results: verdict and per-domain score bars, feedback, debrief (1440x900) |
| 1440x900/hf-male/layout/04-coach-list.png | 8dd298eaed80 | 383637c | — | Coach list: badges wrap whole, singular "1 hint" (1440x900) |
| 1440x900/hf-male/layout/05-coach-detail.png | 4262fd6b7642 | 383637c | — | Coach detail: feedback, verdict, note with the unperformed claim flagged, mistakes, transcript badges (1440x900) |
| 1440x900/hf-male/room/00-exam-corridor-placard.png | 52dc680e2d83 | 383637c | — | Room: door placard printed on the door, sink with basin, rebuilt instruments, patient on the table |
| 1440x900/hf-male/room/01-corridor.png | 59d7b97b2d32 | 383637c | — | Room: door placard printed on the door, sink with basin, rebuilt instruments, patient on the table |
| 1440x900/hf-male/room/02-overview.png | d0e88483ef59 | 383637c | — | Room: door placard printed on the door, sink with basin, rebuilt instruments, patient on the table |
| 1440x900/hf-male/room/03-sink.png | 81cc97c85f7e | 383637c | — | Room: door placard printed on the door, sink with basin, rebuilt instruments, patient on the table |
| 1440x900/hf-male/room/04-tool_table.png | 7d12eeaee791 | 383637c | — | Room: door placard printed on the door, sink with basin, rebuilt instruments, patient on the table |
| 1440x900/hf-male/shots/001-overview__supine__covered.png | 2f569c59ecb2 | 383637c | — | overview — supine (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/002-seated__supine__covered.png | c96f66d0a068 | 383637c | — | seated — supine (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/003-head_neck__supine__covered.png | 635bcecc353b | 383637c | — | head_neck — supine (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/004-ear_left__supine__covered.png | 9fa64ecaa442 | 383637c | — | ear_left — supine (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/005-ear_right__supine__covered.png | ada85a74f56d | 383637c | — | ear_right — supine (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/006-chest_front__supine__covered.png | fe371caaa903 | 383637c | — | chest_front — supine (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/007-chest_back__supine__covered.png | 2630d5a33c53 | 383637c | — | chest_back — supine (man): framing and pose correct, sheet and gown in place; back fully under the gown (V-GOWNBACK fixed) |
| 1440x900/hf-male/shots/008-abdomen__supine__covered.png | 45dbe47ddc4c | 383637c | — | abdomen — supine (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/009-arms__supine__covered.png | c2fa316c63b5 | 383637c | — | arms — supine (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/010-hands__supine__covered.png | a7d8304062cb | 383637c | — | hands — supine (man): framing and pose correct, sheet and gown in place; hands rest on/beside the sheet (V-HANDSHEET fixed) |
| 1440x900/hf-male/shots/011-legs__supine__covered.png | 13cff2456de5 | 383637c | — | legs — supine (man): framing and pose correct, sheet and gown in place; hands rest on/beside the sheet (V-HANDSHEET fixed) |
| 1440x900/hf-male/shots/012-feet__supine__covered.png | c277225746d9 | 383637c | — | feet — supine (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/013-overview__reclined_30__covered.png | f3c99ba71278 | 383637c | — | overview — reclined_30 (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/014-seated__reclined_30__covered.png | baf3374b66c0 | 383637c | — | seated — reclined_30 (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/015-head_neck__reclined_30__covered.png | 39da859a221b | 383637c | — | head_neck — reclined_30 (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/016-ear_left__reclined_30__covered.png | fe7553792c46 | 383637c | — | ear_left — reclined_30 (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/017-ear_right__reclined_30__covered.png | 4ecaf77f925e | 383637c | — | ear_right — reclined_30 (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/018-chest_front__reclined_30__covered.png | c6a13a53fb87 | 383637c | — | chest_front — reclined_30 (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/019-chest_back__reclined_30__covered.png | 566f21625116 | 383637c | — | chest_back — reclined_30 (man): framing and pose correct, sheet and gown in place; back fully under the gown (V-GOWNBACK fixed) |
| 1440x900/hf-male/shots/020-abdomen__reclined_30__covered.png | ec3c2cd04ee1 | 383637c | — | abdomen — reclined_30 (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/021-arms__reclined_30__covered.png | c5ac55b61084 | 383637c | — | arms — reclined_30 (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/022-hands__reclined_30__covered.png | a132b00153b9 | 383637c | — | hands — reclined_30 (man): framing and pose correct, sheet and gown in place; hands rest on/beside the sheet (V-HANDSHEET fixed) |
| 1440x900/hf-male/shots/023-legs__reclined_30__covered.png | 6108598cfcac | 383637c | — | legs — reclined_30 (man): framing and pose correct, sheet and gown in place; hands rest on/beside the sheet (V-HANDSHEET fixed) |
| 1440x900/hf-male/shots/024-feet__reclined_30__covered.png | d04e7bc82459 | 383637c | — | feet — reclined_30 (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/025-overview__reclined_45__covered.png | dca481d3489c | 383637c | — | overview — reclined_45 (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/026-seated__reclined_45__covered.png | 39f089d3a0ca | 383637c | — | seated — reclined_45 (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/027-head_neck__reclined_45__covered.png | 8dedb232ec3f | 383637c | — | head_neck — reclined_45 (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/028-ear_left__reclined_45__covered.png | 86a7069e4ff1 | 383637c | — | ear_left — reclined_45 (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/029-ear_right__reclined_45__covered.png | 8a6225147972 | 383637c | — | ear_right — reclined_45 (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/030-chest_front__reclined_45__covered.png | 0816cb7f238a | 383637c | — | chest_front — reclined_45 (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/031-chest_back__reclined_45__covered.png | 7d27352d5e11 | 383637c | — | chest_back — reclined_45 (man): framing and pose correct, sheet and gown in place; back fully under the gown (V-GOWNBACK fixed) |
| 1440x900/hf-male/shots/032-abdomen__reclined_45__covered.png | 93e13ec88259 | 383637c | — | abdomen — reclined_45 (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/033-arms__reclined_45__covered.png | 9f8a9de253a4 | 383637c | — | arms — reclined_45 (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/034-hands__reclined_45__covered.png | 6d93deae92f8 | 383637c | — | hands — reclined_45 (man): framing and pose correct, sheet and gown in place; hands rest on/beside the sheet (V-HANDSHEET fixed) |
| 1440x900/hf-male/shots/035-legs__reclined_45__covered.png | bfb5f39da9f7 | 383637c | — | legs — reclined_45 (man): framing and pose correct, sheet and gown in place; hands rest on/beside the sheet (V-HANDSHEET fixed) |
| 1440x900/hf-male/shots/036-feet__reclined_45__covered.png | 6cd82f7ff284 | 383637c | — | feet — reclined_45 (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/037-overview__seated__covered.png | d0e88483ef59 | 383637c | — | overview — seated (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/038-seated__seated__covered.png | 3846d39299a1 | 383637c | — | seated — seated (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/039-head_neck__seated__covered.png | 49db2403d27b | 383637c | — | head_neck — seated (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/040-ear_left__seated__covered.png | babd03bebfe0 | 383637c | — | ear_left — seated (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/041-ear_right__seated__covered.png | 7305b942997b | 383637c | — | ear_right — seated (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/042-chest_front__seated__covered.png | e54f90e3ef7f | 383637c | — | chest_front — seated (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/043-chest_back__seated__covered.png | cd6adbc8058d | 383637c | — | chest_back — seated (man): framing and pose correct, sheet and gown in place; back fully under the gown (V-GOWNBACK fixed) |
| 1440x900/hf-male/shots/044-abdomen__seated__covered.png | 263bc7805c03 | 383637c | — | abdomen — seated (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/045-arms__seated__covered.png | 4e69f24db836 | 383637c | — | arms — seated (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/046-hands__seated__covered.png | f77509f911df | 383637c | — | hands — seated (man): framing and pose correct, sheet and gown in place; hands rest on/beside the sheet (V-HANDSHEET fixed) |
| 1440x900/hf-male/shots/047-legs__seated__covered.png | f36297d12bda | 383637c | — | legs — seated (man): framing and pose correct, sheet and gown in place; hands rest on/beside the sheet (V-HANDSHEET fixed) |
| 1440x900/hf-male/shots/048-feet__seated__covered.png | 442f0b246ef5 | 383637c | — | feet — seated (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/049-overview__sitting_dangling__covered.png | 47d8cc06470f | 383637c | — | overview — sitting_dangling (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/050-seated__sitting_dangling__covered.png | 4868071f2c61 | 383637c | — | seated — sitting_dangling (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/051-head_neck__sitting_dangling__covered.png | cc4cb642c2d5 | 383637c | — | head_neck — sitting_dangling (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/052-ear_left__sitting_dangling__covered.png | 444a98fe04bb | 383637c | — | ear_left — sitting_dangling (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/053-ear_right__sitting_dangling__covered.png | dde784dc2291 | 383637c | — | ear_right — sitting_dangling (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/054-chest_front__sitting_dangling__covered.png | e6715076dbf2 | 383637c | — | chest_front — sitting_dangling (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/055-chest_back__sitting_dangling__covered.png | 40e6c71ba62e | 383637c | — | chest_back — sitting_dangling (man): framing and pose correct, sheet and gown in place; back fully under the gown (V-GOWNBACK fixed) |
| 1440x900/hf-male/shots/056-abdomen__sitting_dangling__covered.png | 37ffd2627a88 | 383637c | — | abdomen — sitting_dangling (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/057-arms__sitting_dangling__covered.png | 7f6dbbe3eea5 | 383637c | — | arms — sitting_dangling (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/058-hands__sitting_dangling__covered.png | 9ea59bfcb138 | 383637c | — | hands — sitting_dangling (man): framing and pose correct, sheet and gown in place; hands rest on/beside the sheet (V-HANDSHEET fixed) |
| 1440x900/hf-male/shots/059-legs__sitting_dangling__covered.png | f52d5156d5a8 | 383637c | — | legs — sitting_dangling (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/060-feet__sitting_dangling__covered.png | 388d60f0c639 | 383637c | — | feet — sitting_dangling (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/061-overview__left_lateral_decubitus__covered.png | 6ee9ed4c7c89 | 383637c | — | overview — left_lateral_decubitus (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/062-seated__left_lateral_decubitus__covered.png | cd61f70db282 | 383637c | — | seated — left_lateral_decubitus (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/063-head_neck__left_lateral_decubitus__covered.png | 68d1fb129841 | 383637c | — | head_neck — left_lateral_decubitus (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/064-ear_left__left_lateral_decubitus__covered.png | 0b9fd0f00d3b | 383637c | — | ear_left — left_lateral_decubitus (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/065-ear_right__left_lateral_decubitus__covered.png | 60e5bcde9d2a | 383637c | — | ear_right — left_lateral_decubitus (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/066-chest_front__left_lateral_decubitus__covered.png | b6b5cb84ec32 | 383637c | — | chest_front — left_lateral_decubitus (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/067-chest_back__left_lateral_decubitus__covered.png | d99584150067 | 383637c | — | chest_back — left_lateral_decubitus (man): framing and pose correct, sheet and gown in place; back fully under the gown (V-GOWNBACK fixed) |
| 1440x900/hf-male/shots/068-abdomen__left_lateral_decubitus__covered.png | aad97b891614 | 383637c | — | abdomen — left_lateral_decubitus (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/069-arms__left_lateral_decubitus__covered.png | 20d741565d55 | 383637c | — | arms — left_lateral_decubitus (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/070-hands__left_lateral_decubitus__covered.png | e8e04bbde09f | 383637c | — | hands — left_lateral_decubitus (man): framing and pose correct, sheet and gown in place; hands rest on/beside the sheet (V-HANDSHEET fixed) |
| 1440x900/hf-male/shots/071-legs__left_lateral_decubitus__covered.png | d3ddb98a927c | 383637c | — | legs — left_lateral_decubitus (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/shots/072-feet__left_lateral_decubitus__covered.png | 35a7b7f4c9ea | 383637c | — | feet — left_lateral_decubitus (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/views/01-face__seated__covered.png | cfc22f08c141 | 383637c | — | face — seated (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/views/02-neck_back__seated__covered.png | 7d3235e6d5af | 383637c | — | neck_back — seated (man): framing and pose correct, sheet and gown in place; back fully under the gown (V-GOWNBACK fixed) |
| 1440x900/hf-male/views/03-head_top__seated__covered.png | 493c39ee9420 | 383637c | — | head_top — seated (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/views/04-arms_left__seated__covered.png | c36aaef4427a | 383637c | — | arms_left — seated (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/views/05-elbow_right__seated__covered.png | a72c800dad05 | 383637c | — | elbow_right — seated (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/views/06-elbow_left__seated__covered.png | 8c6fb7225d38 | 383637c | — | elbow_left — seated (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/views/07-chest_right__seated__covered.png | 034d9a6537df | 383637c | — | chest_right — seated (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/views/08-chest_left__seated__covered.png | d081da2d2634 | 383637c | — | chest_left — seated (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/views/09-ankle_right__sitting_dangling__covered.png | dabcb6c99cf3 | 383637c | — | ankle_right — sitting_dangling (man): framing and pose correct, sheet and gown in place |
| 1440x900/hf-male/views/10-ankle_left__sitting_dangling__covered.png | 9795b91f66cd | 383637c | — | ankle_left — sitting_dangling (man): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/dialogs/01-examine-menu.png | 0de080f657a3 | 383637c | — | Dialog 01-examine-menu: ✕, focus and layout correct; hint popover below the encounter bar (V-HINTOVER fixed); Actions dropdown overlays the side panel (V-MENUOVER accepted) |
| 1440x900/screening-female/dialogs/02-maneuver-menu.png | 0ad65569894b | 383637c | — | Dialog 02-maneuver-menu: ✕, focus and layout correct; hint popover below the encounter bar (V-HINTOVER fixed); Actions dropdown overlays the side panel (V-MENUOVER accepted) |
| 1440x900/screening-female/dialogs/03-tool-chooser.png | 4da93e895c7e | 383637c | — | Dialog 03-tool-chooser: ✕, focus and layout correct; hint popover below the encounter bar (V-HINTOVER fixed); Actions dropdown overlays the side panel (V-MENUOVER accepted) |
| 1440x900/screening-female/dialogs/04-perform.png | 7acf1199ae91 | 383637c | — | Dialog 04-perform: ✕, focus and layout correct; hint popover below the encounter bar (V-HINTOVER fixed); Actions dropdown overlays the side panel (V-MENUOVER accepted) |
| 1440x900/screening-female/dialogs/05-describe.png | 76dc536bd92e | 383637c | — | Dialog 05-describe: ✕, focus and layout correct; hint popover below the encounter bar (V-HINTOVER fixed); Actions dropdown overlays the side panel (V-MENUOVER accepted) |
| 1440x900/screening-female/dialogs/06-leave-confirm.png | 03b49943485c | 383637c | — | Dialog 06-leave-confirm: ✕, focus and layout correct; hint popover below the encounter bar (V-HINTOVER fixed); Actions dropdown overlays the side panel (V-MENUOVER accepted) |
| 1440x900/screening-female/dialogs/07-actions-menu.png | 2f765e14ce09 | 383637c | V-MENUOVER | Dialog 07-actions-menu: ✕, focus and layout correct; hint popover below the encounter bar (V-HINTOVER fixed); Actions dropdown overlays the side panel (V-MENUOVER accepted) |
| 1440x900/screening-female/dialogs/08-tools-menu.png | b0880a37ded0 | 383637c | — | Dialog 08-tools-menu: ✕, focus and layout correct; hint popover below the encounter bar (V-HINTOVER fixed); Actions dropdown overlays the side panel (V-MENUOVER accepted) |
| 1440x900/screening-female/dialogs/09-bed-hud.png | 6c258803d025 | 383637c | — | Dialog 09-bed-hud: ✕, focus and layout correct; hint popover below the encounter bar (V-HINTOVER fixed); Actions dropdown overlays the side panel (V-MENUOVER accepted) |
| 1440x900/screening-female/dialogs/10-practice-help.png | 39a4b266dd54 | 383637c | — | Dialog 10-practice-help: ✕, focus and layout correct; hint popover below the encounter bar (V-HINTOVER fixed); Actions dropdown overlays the side panel (V-MENUOVER accepted) |
| 1440x900/screening-female/dialogs/11-finish.png | 728661c1dfcf | 383637c | — | Dialog 11-finish: ✕, focus and layout correct; hint popover below the encounter bar (V-HINTOVER fixed); Actions dropdown overlays the side panel (V-MENUOVER accepted) |
| 1440x900/screening-female/dialogs/12-settings.png | 360cfe2ad363 | 383637c | — | Dialog 12-settings: ✕, focus and layout correct; hint popover below the encounter bar (V-HINTOVER fixed); Actions dropdown overlays the side panel (V-MENUOVER accepted) |
| 1440x900/screening-female/drapes/01-chest_front__supine__chest-left-exposed.png | be18359d3964 | 383637c | — | Drapes (woman): chest-left-exposed — per-side chest, pelvis towel always on, legs fold back each side, feet bare, folded gown edges as rolls along the skin |
| 1440x900/screening-female/drapes/02-chest_front__supine__chest-exposed.png | 7c47eb97592d | 383637c | — | Drapes (woman): chest-exposed — per-side chest, pelvis towel always on, legs fold back each side, feet bare, folded gown edges as rolls along the skin |
| 1440x900/screening-female/drapes/03-abdomen__supine__abdomen-exposed.png | d86e64cd5cb9 | 383637c | — | Drapes (woman): abdomen-exposed — per-side chest, pelvis towel always on, legs fold back each side, feet bare, folded gown edges as rolls along the skin |
| 1440x900/screening-female/drapes/04-legs__supine__legs-left-exposed.png | 6170dce9b93d | 383637c | — | Drapes (woman): legs-left-exposed — per-side chest, pelvis towel always on, legs fold back each side, feet bare, folded gown edges as rolls along the skin |
| 1440x900/screening-female/drapes/05-legs__supine__legs-exposed.png | c69365f8e749 | 383637c | — | Drapes (woman): legs-exposed — per-side chest, pelvis towel always on, legs fold back each side, feet bare, folded gown edges as rolls along the skin |
| 1440x900/screening-female/drapes/06-overview__supine__all-exposed.png | 6b1619a7920d | 383637c | — | Drapes (woman): all-exposed — per-side chest, pelvis towel always on, legs fold back each side, feet bare, folded gown edges as rolls along the skin |
| 1440x900/screening-female/room/01-corridor.png | b5a830f1932a | 383637c | — | Room: door placard printed on the door, sink with basin, rebuilt instruments, patient on the table |
| 1440x900/screening-female/room/02-overview.png | b1e49b831c79 | 383637c | — | Room: door placard printed on the door, sink with basin, rebuilt instruments, patient on the table |
| 1440x900/screening-female/room/03-sink.png | 428daf133a04 | 383637c | — | Room: door placard printed on the door, sink with basin, rebuilt instruments, patient on the table |
| 1440x900/screening-female/room/04-tool_table.png | 2f6bd08afa7d | 383637c | — | Room: door placard printed on the door, sink with basin, rebuilt instruments, patient on the table |
| 1440x900/screening-female/shots/001-overview__supine__covered.png | 2ce4fa778fbc | 383637c | — | overview — supine (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/002-seated__supine__covered.png | 2918a6433e2b | 383637c | — | seated — supine (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/003-head_neck__supine__covered.png | cd4e7c24b30d | 383637c | V-GOWNFIT | head_neck — supine (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/004-ear_left__supine__covered.png | d9809111e1a3 | 383637c | — | ear_left — supine (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/005-ear_right__supine__covered.png | af73b2b90afc | 383637c | — | ear_right — supine (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/006-chest_front__supine__covered.png | ae6dd6626169 | 383637c | V-GOWNFIT | chest_front — supine (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/007-chest_back__supine__covered.png | 7a9416b776f8 | 383637c | — | chest_back — supine (woman): framing and pose correct, sheet and gown in place; back fully under the gown (V-GOWNBACK fixed) |
| 1440x900/screening-female/shots/008-abdomen__supine__covered.png | c75d54ba60a6 | 383637c | V-GOWNFIT | abdomen — supine (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/009-arms__supine__covered.png | 47e14c127b20 | 383637c | V-GOWNFIT | arms — supine (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/010-hands__supine__covered.png | d4f70b709112 | 383637c | — | hands — supine (woman): framing and pose correct, sheet and gown in place; hands rest on/beside the sheet (V-HANDSHEET fixed) |
| 1440x900/screening-female/shots/011-legs__supine__covered.png | f9c4c15b3a37 | 383637c | — | legs — supine (woman): framing and pose correct, sheet and gown in place; hands rest on/beside the sheet (V-HANDSHEET fixed) |
| 1440x900/screening-female/shots/012-feet__supine__covered.png | 0aa32f45c4ba | 383637c | — | feet — supine (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/013-overview__reclined_30__covered.png | ada13a58bf65 | 383637c | — | overview — reclined_30 (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/014-seated__reclined_30__covered.png | dd6547b97315 | 383637c | — | seated — reclined_30 (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/015-head_neck__reclined_30__covered.png | 792770b740d3 | 383637c | V-GOWNFIT | head_neck — reclined_30 (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/016-ear_left__reclined_30__covered.png | d71efb1e614e | 383637c | — | ear_left — reclined_30 (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/017-ear_right__reclined_30__covered.png | b4e2aa71d44f | 383637c | — | ear_right — reclined_30 (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/018-chest_front__reclined_30__covered.png | 26539bd138e3 | 383637c | V-GOWNFIT | chest_front — reclined_30 (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/019-chest_back__reclined_30__covered.png | 1111b046c415 | 383637c | — | chest_back — reclined_30 (woman): framing and pose correct, sheet and gown in place; back fully under the gown (V-GOWNBACK fixed) |
| 1440x900/screening-female/shots/020-abdomen__reclined_30__covered.png | 5c8e2688b84a | 383637c | V-GOWNFIT | abdomen — reclined_30 (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/021-arms__reclined_30__covered.png | 5f25b4388e7b | 383637c | V-GOWNFIT | arms — reclined_30 (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/022-hands__reclined_30__covered.png | a6e2e3b96fad | 383637c | — | hands — reclined_30 (woman): framing and pose correct, sheet and gown in place; hands rest on/beside the sheet (V-HANDSHEET fixed) |
| 1440x900/screening-female/shots/023-legs__reclined_30__covered.png | a9bf2a6ea3c4 | 383637c | — | legs — reclined_30 (woman): framing and pose correct, sheet and gown in place; hands rest on/beside the sheet (V-HANDSHEET fixed) |
| 1440x900/screening-female/shots/024-feet__reclined_30__covered.png | 0586567d6a4d | 383637c | — | feet — reclined_30 (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/025-overview__reclined_45__covered.png | 2b9c329dd4ad | 383637c | — | overview — reclined_45 (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/026-seated__reclined_45__covered.png | 8480a4b229e0 | 383637c | — | seated — reclined_45 (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/027-head_neck__reclined_45__covered.png | e39d8739d3aa | 383637c | V-GOWNFIT | head_neck — reclined_45 (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/028-ear_left__reclined_45__covered.png | bddba252e082 | 383637c | — | ear_left — reclined_45 (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/029-ear_right__reclined_45__covered.png | 98eef0f19d05 | 383637c | — | ear_right — reclined_45 (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/030-chest_front__reclined_45__covered.png | c015ae3aaf03 | 383637c | V-GOWNFIT | chest_front — reclined_45 (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/031-chest_back__reclined_45__covered.png | 1d35678eda4a | 383637c | — | chest_back — reclined_45 (woman): framing and pose correct, sheet and gown in place; back fully under the gown (V-GOWNBACK fixed) |
| 1440x900/screening-female/shots/032-abdomen__reclined_45__covered.png | 42193196633d | 383637c | V-GOWNFIT | abdomen — reclined_45 (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/033-arms__reclined_45__covered.png | f349e7814ea0 | 383637c | V-GOWNFIT | arms — reclined_45 (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/034-hands__reclined_45__covered.png | 65bcafde14fb | 383637c | — | hands — reclined_45 (woman): framing and pose correct, sheet and gown in place; hands rest on/beside the sheet (V-HANDSHEET fixed) |
| 1440x900/screening-female/shots/035-legs__reclined_45__covered.png | 0283140d68eb | 383637c | — | legs — reclined_45 (woman): framing and pose correct, sheet and gown in place; hands rest on/beside the sheet (V-HANDSHEET fixed) |
| 1440x900/screening-female/shots/036-feet__reclined_45__covered.png | 7a56b07ebd74 | 383637c | — | feet — reclined_45 (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/037-overview__seated__covered.png | b1e49b831c79 | 383637c | — | overview — seated (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/038-seated__seated__covered.png | 313eee5076a2 | 383637c | — | seated — seated (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/039-head_neck__seated__covered.png | 8df4a9a9eefb | 383637c | V-GOWNFIT | head_neck — seated (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/040-ear_left__seated__covered.png | 038dc6cb7ac3 | 383637c | — | ear_left — seated (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/041-ear_right__seated__covered.png | 19f7b46ba299 | 383637c | — | ear_right — seated (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/042-chest_front__seated__covered.png | fb3b44038822 | 383637c | V-GOWNFIT | chest_front — seated (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/043-chest_back__seated__covered.png | e97891ed36f9 | 383637c | — | chest_back — seated (woman): framing and pose correct, sheet and gown in place; back fully under the gown (V-GOWNBACK fixed) |
| 1440x900/screening-female/shots/044-abdomen__seated__covered.png | 5f3d821f8be5 | 383637c | V-GOWNFIT | abdomen — seated (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/045-arms__seated__covered.png | 009b58ec817f | 383637c | V-GOWNFIT | arms — seated (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/046-hands__seated__covered.png | 6d9821790fcd | 383637c | — | hands — seated (woman): framing and pose correct, sheet and gown in place; hands rest on/beside the sheet (V-HANDSHEET fixed) |
| 1440x900/screening-female/shots/047-legs__seated__covered.png | 4a4c72790bd5 | 383637c | — | legs — seated (woman): framing and pose correct, sheet and gown in place; hands rest on/beside the sheet (V-HANDSHEET fixed) |
| 1440x900/screening-female/shots/048-feet__seated__covered.png | a2f94e774df9 | 383637c | — | feet — seated (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/049-overview__sitting_dangling__covered.png | d716aac7eeca | 383637c | — | overview — sitting_dangling (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/050-seated__sitting_dangling__covered.png | 324fc33298b1 | 383637c | — | seated — sitting_dangling (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/051-head_neck__sitting_dangling__covered.png | 8743d6e81715 | 383637c | V-GOWNFIT | head_neck — sitting_dangling (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/052-ear_left__sitting_dangling__covered.png | c3b7ab9cac49 | 383637c | — | ear_left — sitting_dangling (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/053-ear_right__sitting_dangling__covered.png | f96322946995 | 383637c | — | ear_right — sitting_dangling (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/054-chest_front__sitting_dangling__covered.png | f9c2012fa4e1 | 383637c | V-GOWNFIT | chest_front — sitting_dangling (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/055-chest_back__sitting_dangling__covered.png | 225d8dab768c | 383637c | — | chest_back — sitting_dangling (woman): framing and pose correct, sheet and gown in place; back fully under the gown (V-GOWNBACK fixed) |
| 1440x900/screening-female/shots/056-abdomen__sitting_dangling__covered.png | 89d285a74b46 | 383637c | V-GOWNFIT | abdomen — sitting_dangling (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/057-arms__sitting_dangling__covered.png | 9081e7088109 | 383637c | V-GOWNFIT | arms — sitting_dangling (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/058-hands__sitting_dangling__covered.png | 80f59c5a1dfa | 383637c | — | hands — sitting_dangling (woman): framing and pose correct, sheet and gown in place; hands rest on/beside the sheet (V-HANDSHEET fixed) |
| 1440x900/screening-female/shots/059-legs__sitting_dangling__covered.png | 7f6868641e2e | 383637c | — | legs — sitting_dangling (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/060-feet__sitting_dangling__covered.png | 0951addce5c7 | 383637c | — | feet — sitting_dangling (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/061-overview__left_lateral_decubitus__covered.png | 3870d1b31197 | 383637c | — | overview — left_lateral_decubitus (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/062-seated__left_lateral_decubitus__covered.png | e85be88c8774 | 383637c | — | seated — left_lateral_decubitus (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/063-head_neck__left_lateral_decubitus__covered.png | 03dc7dcf4e8d | 383637c | V-GOWNFIT | head_neck — left_lateral_decubitus (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/064-ear_left__left_lateral_decubitus__covered.png | a21671352558 | 383637c | — | ear_left — left_lateral_decubitus (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/065-ear_right__left_lateral_decubitus__covered.png | ef103f8fd43f | 383637c | — | ear_right — left_lateral_decubitus (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/066-chest_front__left_lateral_decubitus__covered.png | f3b7c2f60a26 | 383637c | V-GOWNFIT | chest_front — left_lateral_decubitus (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/067-chest_back__left_lateral_decubitus__covered.png | 5eaa870f5a2f | 383637c | — | chest_back — left_lateral_decubitus (woman): framing and pose correct, sheet and gown in place; back fully under the gown (V-GOWNBACK fixed) |
| 1440x900/screening-female/shots/068-abdomen__left_lateral_decubitus__covered.png | b5513ed11476 | 383637c | V-GOWNFIT | abdomen — left_lateral_decubitus (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/069-arms__left_lateral_decubitus__covered.png | 289bcda840b6 | 383637c | V-GOWNFIT | arms — left_lateral_decubitus (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/070-hands__left_lateral_decubitus__covered.png | a0a50153db0e | 383637c | — | hands — left_lateral_decubitus (woman): framing and pose correct, sheet and gown in place; hands rest on/beside the sheet (V-HANDSHEET fixed) |
| 1440x900/screening-female/shots/071-legs__left_lateral_decubitus__covered.png | 0668beeca179 | 383637c | — | legs — left_lateral_decubitus (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/shots/072-feet__left_lateral_decubitus__covered.png | 555850b1633c | 383637c | — | feet — left_lateral_decubitus (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/views/01-face__seated__covered.png | ad76feae1ffe | 383637c | — | face — seated (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/views/02-neck_back__seated__covered.png | a47c172a51eb | 383637c | — | neck_back — seated (woman): framing and pose correct, sheet and gown in place; back fully under the gown (V-GOWNBACK fixed) |
| 1440x900/screening-female/views/03-head_top__seated__covered.png | 0a4999bf80d3 | 383637c | — | head_top — seated (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/views/04-arms_left__seated__covered.png | 1ec520efa4c9 | 383637c | V-GOWNFIT | arms_left — seated (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/views/05-elbow_right__seated__covered.png | 85f64f43caff | 383637c | — | elbow_right — seated (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/views/06-elbow_left__seated__covered.png | 9a7680a97871 | 383637c | — | elbow_left — seated (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/views/07-chest_right__seated__covered.png | fadab2801143 | 383637c | V-GOWNFIT | chest_right — seated (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/views/08-chest_left__seated__covered.png | 8133b19e88ea | 383637c | V-GOWNFIT | chest_left — seated (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/views/09-ankle_right__sitting_dangling__covered.png | a0970d4452fe | 383637c | — | ankle_right — sitting_dangling (woman): framing and pose correct, sheet and gown in place |
| 1440x900/screening-female/views/10-ankle_left__sitting_dangling__covered.png | 4d0863747dcd | 383637c | — | ankle_left — sitting_dangling (woman): framing and pose correct, sheet and gown in place |
