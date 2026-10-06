// One-off authoring helper that generated content/marksheets/exam-fcm1.json.
// After generation the JSON file is the source of truth — edit it directly.
// Labels are our own words; framework text is not copied (sourceText stays "").
import fs from "node:fs";

const items = [];
const add = (section, id, fcmId, label, scoring, extra = {}) =>
  items.push({ id, ...(fcmId ? { fcmId } : {}), section, label, weight: 1, scoring, ...extra, sourceText: "" });
const auto = (section, id, fcmId, label, rule, weight = 1) => add(section, id, fcmId, label, "auto", { rule, weight });
const did = (m, regions, partial = true) => (regions ? { performed: m, regions, partial } : { performed: m });
const both = (base) => [`${base}_right`, `${base}_left`];

// --- Clinical courtesy (#1–4)
let S = "Clinical courtesy";
auto(S, "fcm-01-hand-hygiene", 1, "Washes hands before touching the patient", { before: ["hand_hygiene", "first:examine"] });
add(S, "fcm-02-notes", 2, "Note-taking does not interfere with rapport", "not_assessable", {
  notAssessableReason: "Note-taking behaviour and eye contact are not visible in this interface.",
});
auto(S, "fcm-03-drape", 3, "Drapes the patient appropriately", { courtesy: "drape" });
add(S, "fcm-04-comfort", 4, "Verbally checks the patient's comfort during the exam", "ai", {
  guidance: "Credit if the student, during the physical exam, says something that shows attention to the patient's comfort or dignity: asks if they are comfortable, warns before touching/cold stethoscope, asks them to say if anything hurts, offers help repositioning.",
  mockKeywords: ["comfortable", "let me know if", "hurt", "cold", "okay if i"],
});

// --- Vital signs (#5–9)
S = "Vital signs";
auto(S, "fcm-05-pulse", 5, "Radial pulse rate and rhythm", did("pulse_radial"));
auto(S, "fcm-06-resp-rate", 6, "Respiratory rate at rest", did("respiratory_rate"));
auto(S, "fcm-07-bp-cuff", 7, "BP: correct cuff, placed over the brachial artery", did("bp_cuff_placement"));
auto(S, "fcm-08-bp-arm", 8, "BP: arm flexed and supported", did("bp_arm_support"));
auto(S, "fcm-09-bp", 9, "BP measured after cuff placement (palpatory then auscultatory)", {
  all: [did("blood_pressure"), { before: ["maneuver:bp_cuff_placement", "maneuver:blood_pressure"] }],
});

// --- General appearance (#10)
S = "General appearance";
auto(S, "fcm-10-general", 10, "Comments on general appearance", did("general_appearance"));

// --- HEENT (#11–32)
S = "Head, neck and eyes";
const nodes = [
  [11, "occipital"], [12, "post_auricular"], [13, "pre_auricular"], [14, "submandibular"],
  [15, "post_cervical"], [16, "ant_cervical"], [17, "submental"], [18, "supraclavicular"],
];
for (const [n, k] of nodes) auto(S, `fcm-${n}-ln-${k.replace("_", "-")}`, n, `Palpates ${k.replace("_", " ")} lymph nodes`, did(`ln_${k}_palpation`));
auto(S, "fcm-19-trachea", 19, "Palpates trachea position", did("trachea_palpation"));
auto(S, "fcm-20-thyroid", 20, "Palpates thyroid (from behind, with swallow)", did("thyroid_palpation"));
const eyes = both("eye");
auto(S, "fcm-21-eye-inspection", 21, "Inspects both eyes", did("eye_inspection", eyes));
auto(S, "fcm-22-visual-fields", 22, "Visual fields by confrontation", did("visual_fields_confrontation"));
auto(S, "fcm-23-pupils", 23, "Pupils: size and light reflexes, both eyes", did("pupils_light_reflex", eyes));
auto(S, "fcm-24-eom", 24, "Extraocular movements and accommodation", did("eom_accommodation"));
auto(S, "fcm-25-ophthalmoscopy", 25, "Ophthalmoscopy, both eyes", did("ophthalmoscopy", eyes));
auto(S, "fcm-26-otoscopy", 26, "Otoscopy, both ears", did("otoscopy", both("ear")));
auto(S, "fcm-27-weber", 27, "Weber test", did("weber_test"));
auto(S, "fcm-28-rinne", 28, "Rinne test", did("rinne_test"));
auto(S, "fcm-29-nares", 29, "Inspects nares", did("nares_inspection"));
auto(S, "fcm-30-mouth", 30, "Inspects mouth and pharynx", did("mouth_throat_inspection"));
auto(S, "fcm-31-floor-mouth", 31, "Inspects tongue and floor of mouth", did("floor_of_mouth_tongue"));
auto(S, "fcm-32-teeth", 32, "Inspects teeth and gums", did("teeth_gums_inspection"));

// --- Cardiovascular (#33–40)
S = "Cardiovascular";
auto(S, "fcm-33-jvp", 33, "Inspects the jugular venous pressure", did("jvp_inspection"));
auto(S, "fcm-33-jvp-position", 33, "Technique: JVP assessed with patient reclined to ~30°", {
  performedIn: { maneuver: "jvp_inspection", position: "reclined_30" },
});
auto(S, "fcm-34-carotid-palpation", 34, "Palpates both carotids (one side at a time)", did("carotid_palpation", both("carotid")));
auto(S, "fcm-34-carotid-bruit", 34, "Auscultates both carotids for bruits", did("carotid_auscultation", both("carotid")));
auto(S, "fcm-35-precordium-inspect", 35, "Inspects the precordium", did("precordial_inspection"));
auto(S, "fcm-36-heaves-thrills", 36, "Palpates for heaves and thrills (sternal border and base)", did("precordial_palpation", ["precordium_lsb", "cardiac_aortic", "cardiac_pulmonic"]));
auto(S, "fcm-37-pmi", 37, "Locates the point of maximal impulse", did("pmi_palpation"));
auto(S, "fcm-37-pmi-position", 37, "Technique: PMI with patient supine or left lateral", {
  performedIn: { maneuver: "pmi_palpation", position: ["supine", "left_lateral_decubitus"] },
});
auto(S, "fcm-38-heart-diaphragm", 38, "Auscultates all five areas with the diaphragm", did("auscultate_heart_diaphragm", ["cardiac_aortic", "cardiac_pulmonic", "cardiac_erbs", "cardiac_tricuspid", "cardiac_mitral"]));
auto(S, "fcm-38-heart-bell", 38, "Listens at the apex with the bell for extra heart sounds", did("auscultate_heart_bell", ["cardiac_mitral"]));
auto(S, "fcm-38-bell-lld", 38, "Technique: bell at apex with patient in left lateral decubitus", {
  performedIn: { maneuver: "auscultate_heart_bell", position: "left_lateral_decubitus" },
});
auto(S, "fcm-39-pedal-pulses", 39, "Palpates pedal pulses bilaterally", did("peripheral_pulses", both("foot")));
auto(S, "fcm-40-edema", 40, "Assesses lower-limb edema bilaterally", {
  any: [did("edema_assessment", both("shin"), false), did("edema_assessment", both("ankle"), false), did("edema_assessment", both("foot"), false)],
});

// --- Pulmonary (#41–45)
S = "Pulmonary";
const ant = ["lung_ant_ru", "lung_ant_lu", "lung_ant_rl", "lung_ant_ll"];
const post = ["lung_post_ru", "lung_post_lu", "lung_post_rl", "lung_post_ll"];
const lat = ["lung_lat_r", "lung_lat_l"];
auto(S, "fcm-41-chest-inspection", 41, "Inspects the chest and work of breathing", did("chest_inspection"));
auto(S, "fcm-42-lung-ausc", 42, "Auscultates front, sides and back, comparing sides", did("auscultate_lungs", [...ant, ...lat, ...post]));
auto(S, "fcm-42-lung-position", 42, "Technique: posterior chest auscultated with patient sitting up", {
  performedIn: { maneuver: "auscultate_lungs", position: ["seated", "seated_leaning_forward"] },
});
auto(S, "fcm-43-vocal-resonance", 43, "Vocal resonance / egophony over the posterior chest", did("vocal_resonance", ["lung_post_rl", "lung_post_ll"]));
auto(S, "fcm-44-fremitus", 44, "Tactile fremitus, comparing sides", did("tactile_fremitus", post));
auto(S, "fcm-45-percussion", 45, "Percusses front and back, comparing sides", did("chest_percussion", [...ant, ...post]));

// --- Abdomen (#46–55)
S = "Abdomen";
const quads = ["abd_ruq", "abd_luq", "abd_rlq", "abd_llq"];
auto(S, "fcm-46-abd-inspection", 46, "Inspects the abdomen", did("abd_inspection"));
auto(S, "fcm-47-bowel-sounds", 47, "Auscultates bowel sounds in all four quadrants", did("bowel_sounds", quads));
auto(S, "abd-order", undefined, "Technique: auscultates before palpating", { before: ["maneuver:bowel_sounds", "maneuver:abd_light_palpation"] });
auto(S, "fcm-48-bruits", 48, "Auscultates for abdominal bruits", did("abd_bruits"));
auto(S, "fcm-49-light-palpation", 49, "Light palpation, all quadrants", did("abd_light_palpation", quads));
auto(S, "fcm-49-deep-palpation", 49, "Deep palpation, all quadrants", did("abd_deep_palpation", quads));
auto(S, "fcm-50-murphy", 50, "Murphy's sign", did("murphys_sign"));
auto(S, "fcm-51-mcburney", 51, "McBurney point tenderness", did("mcburney_point"));
auto(S, "fcm-52-cva", 52, "CVA tenderness, both sides", did("cva_tenderness", ["cva_right", "cva_left"]));
auto(S, "fcm-53-liver", 53, "Palpates the liver edge", did("liver_palpation"));
auto(S, "fcm-54-spleen", 54, "Palpates for the spleen", did("spleen_palpation"));
auto(S, "fcm-55-aorta", 55, "Palpates the abdominal aorta", did("aorta_palpation"));

// --- Neuro (#56–87)
S = "Neurological";
const neuro = [
  [56, "orientation", "Assesses orientation"],
  [57, "cn_i_smell", "CN I (smell), when indicated"],
  [58, "cn_ii_acuity", "CN II (visual acuity)"],
  [59, "cn_iii_iv_vi_eom", "CN III, IV, VI (eye movements)"],
  [60, "cn_v_trigeminal", "CN V (facial sensation / jaw)"],
  [61, "cn_vii_facial", "CN VII (facial movement)"],
  [62, "cn_ix_x_palate", "CN IX, X (palate / gag)"],
  [63, "cn_xii_tongue", "CN XII (tongue)"],
  [64, "cn_xi_shrug", "CN XI (shoulder shrug)"],
  [65, "cn_viii_hearing", "CN VIII (hearing)"],
  [66, "motor_tone", "Assesses tone"],
  [67, "strength_c5_shoulder_abduction", "Strength C5: shoulder abduction"],
  [68, "strength_c5_6_elbow_flexion", "Strength C5–6: elbow flexion"],
  [69, "strength_c5_7_elbow_extension", "Strength C5–7: elbow extension"],
  [70, "strength_c6_8_wrist_extension", "Strength C6–8: wrist extension"],
  [71, "strength_c8_t1_finger_abduction", "Strength C8–T1: finger abduction"],
  [72, "strength_c7_t1_grip", "Strength C7–T1: grip"],
  [73, "strength_l2_4_hip_flexion", "Strength L2–4: hip flexion"],
  [74, "strength_l2_4_knee_extension", "Strength L2–4: knee extension"],
  [75, "strength_l4_s2_knee_flexion", "Strength L4–S2: knee flexion"],
  [76, "strength_l4_s1_ankle", "Strength L4–S1: ankle dorsi/plantar flexion"],
  [77, "sensation_light_touch", "Sensation: light touch"],
  [78, "sensation_pin_prick", "Sensation: pin prick"],
  [79, "sensation_proprioception", "Sensation: proprioception"],
  [80, "sensation_vibration", "Sensation: vibration"],
];
for (const [n, m, label] of neuro) auto(S, `fcm-${n}-${m.replace(/_/g, "-")}`, n, label, did(m));
for (const r of ["biceps", "triceps", "brachioradialis", "patellar", "achilles"]) {
  auto(S, `fcm-81-reflex-${r}`, 81, `Reflex: ${r}`, did(`reflex_${r}`), 0.2);
}
for (const [n, m, label] of [
  [82, "babinski", "Plantar response (Babinski)"],
  [83, "finger_nose_finger", "Finger–nose–finger"],
  [84, "heel_knee_shin", "Heel–knee–shin"],
  [85, "romberg", "Romberg test"],
  [86, "gait", "Observes gait"],
  [87, "nuchal_rigidity", "Meningeal signs / neck stiffness"],
]) auto(S, `fcm-${n}-${m.replace(/_/g, "-")}`, n, label, did(m));

// --- Musculoskeletal (#88–120)
S = "Musculoskeletal";
const msk = [
  [88, "back_inspection", "Back: inspection"], [89, "back_palpation", "Back: palpation"], [90, "back_rom", "Back: range of motion"],
  [91, "straight_leg_raise", "Straight leg raise"], [92, "faber_test", "FABER test"],
  [93, "shoulder_inspection", "Shoulder: inspection"], [94, "shoulder_palpation", "Shoulder: palpation"], [95, "shoulder_rom", "Shoulder: range of motion"],
  [96, "shoulder_hawkins", "Hawkins test"], [97, "shoulder_neer", "Neer test"], [98, "shoulder_empty_can", "Empty can test"], [99, "shoulder_infraspinatus", "Infraspinatus test"],
  [100, "elbow_inspection", "Elbow: inspection"], [101, "elbow_palpation", "Elbow: palpation"], [102, "elbow_rom", "Elbow: range of motion"],
  [103, "wrist_hand_inspection", "Wrist/hand: inspection"], [104, "wrist_hand_palpation", "Wrist/hand: palpation"], [105, "wrist_hand_rom", "Wrist/hand: range of motion"],
  [106, "rise_from_chair", "Rise from chair (proximal hip strength)"], [107, "lower_limb_standing_inspection", "Standing inspection of lower limbs"],
  [108, "hip_palpation", "Hip: palpation"], [109, "hip_extension", "Hip extension"], [110, "hip_flexion", "Hip flexion"],
  [111, "hip_rotation", "Hip internal/external rotation"], [112, "hip_abduction_adduction", "Hip abduction/adduction"],
  [113, "knee_inspection", "Knee: inspection"], [114, "knee_palpation", "Knee: palpation"], [115, "knee_rom", "Knee: range of motion"],
  [116, "knee_varus_valgus", "Knee: varus/valgus stress"], [117, "knee_drawer", "Knee: drawer test"],
  [118, "ankle_foot_inspection", "Ankle/foot: inspection"], [119, "ankle_foot_palpation", "Ankle/foot: palpation"], [120, "ankle_foot_rom", "Ankle/foot: range of motion"],
];
for (const [n, m, label] of msk) auto(S, `fcm-${n}-${m.replace(/_/g, "-")}`, n, label, did(m));

const sheet = {
  id: "exam-fcm1",
  title: "Physical Examination (FCM-1 framework)",
  kind: "exam",
  sourceNote: "Items map to FCM-1 Physical Exam Framework numbers (fcmId). Labels are paraphrased; framework text not reproduced pending copyright clearance.",
  items,
};
fs.writeFileSync("content/marksheets/exam-fcm1.json", JSON.stringify(sheet, null, 2) + "\n");
console.log(items.length, "items");
