/**
 * Clinical definitions of the hidden exam anchors, in patient-local real-world units.
 *
 * Landmarks are found on the MakeHuman mesh by the asset build (scripts/assets/build-patient.ts):
 * each searches a box near a rig joint and picks the vertex furthest along a direction (e.g. the
 * most forward point at nipple height). Region anchors are then "landmark + offset in cm"
 * (x = toward the patient's LEFT, y = toward the head, z = toward the front), projected onto the
 * skin, with a per-anchor tolerance in cm. The build writes the projected points to
 * src/scene/patientRig.generated.ts; src/exam3d/regionAnchors.ts serves them at runtime.
 *
 * Pure data, no imports beyond types, so both the build script and the app can read it.
 */

export type Facing = "front" | "back" | "left" | "right" | "up" | "down" | "any";

export interface LandmarkDef {
  id: string;
  /** search origin: a rig joint (bone head or tail), or the midpoint of two bone heads */
  ref: { kind: "joint"; bone: string; end?: "head" | "tail" } | { kind: "mid"; bone: string; other: string };
  /** search box around the origin, per axis [centre, half-width] in metres */
  box?: [[number, number], [number, number], [number, number]];
  /** pick the vertex furthest along this direction */
  pick: [number, number, number];
  /**
   * instead: pick the deepest dimple on the front surface — the vertex sunk furthest below the
   * front skin this many metres around it (e.g. the navel); `pick` is then ignored
   */
  dimple?: number;
  /** instead: the centre of this side's rendered pupil, carried by the eye bone (not on the skin) */
  pupil?: boolean;
  /** instead: the skin (never the ear) nearest to another landmark + an offset in cm (the mastoid from the ear canal) */
  near?: { landmark: string; offsetCm: [number, number, number] };
  /** label for the practice-mode "Show landmarks" hint (own words) */
  label?: string;
}

export interface AnchorDef {
  regionId: string;
  landmark: string;
  /** cm: [toward patient's left, toward head, toward front] */
  offsetCm: [number, number, number];
  /**
   * measure from a point between two landmarks instead: `landmark` + t × (`to` − `landmark`), then
   * the offset (e.g. intercostal spaces as fractions of the sternal notch → xiphoid length, which
   * scale with the body)
   */
  between?: { to: string; t: number };
  /** use the landmark point itself, not projected onto the skin (the pupils) */
  onLandmark?: boolean;
  /** per body model: replaces offsetCm (calibrated with `npm run qa:calibrate-anchors`) */
  offsetCmBy?: Partial<Record<"male" | "female", [number, number, number]>>;
  facing: Facing;
  /** two points: the landmark side and its mirror (unsided regions such as lymph node groups) */
  bilateral?: boolean;
  /** only project onto skin dominated by bones starting with one of these names */
  bones?: string[];
  /** a finding is recorded only within this distance of the anchor */
  toleranceCm: number;
  /** practice-mode landmark label */
  label?: string;
  /** set on generated right-side twins */
  mirror?: boolean;
}

// ---------------------------------------------------------------- landmarks
const L_LANDMARKS: LandmarkDef[] = [
  // on the midclavicular line (midpoint of the clavicle) at the 4th intercostal space
  { id: "nipple_l", ref: { kind: "mid", bone: "clavicle.L", other: "upperarm01.L" }, box: [[0, 0.008], [-0.15, 0.025], [0, 0.3]], pick: [0, 0, 1], label: "Nipple (midclavicular line)" },
  { id: "asis_l", ref: { kind: "joint", bone: "root" }, box: [[0.11, 0.035], [0.06, 0.05], [0.1, 0.1]], pick: [0.2, 0, 1], label: "Anterior superior iliac spine" },
  { id: "ear_canal_l", ref: { kind: "joint", bone: "head" }, box: [[0.07, 0.04], [0.04, 0.025], [0, 0.03]], pick: [1, 0, 0], label: "Ear" },
  // the mastoid process: ~2 cm behind and ~1.5 cm below the ear canal, on the skin behind the ear
  { id: "mastoid_l", ref: { kind: "joint", bone: "head" }, pick: [0, 0, -1], near: { landmark: "ear_canal_l", offsetCm: [0, -1.5, -2] }, label: "Mastoid process" },
  // the pupil itself (the penlight must land on it; the skin around the eye is the lids)
  { id: "eye_l", ref: { kind: "joint", bone: "eye.L", end: "tail" }, pick: [0, 0, 1], pupil: true, label: "Eye" },
  { id: "jaw_angle_l", ref: { kind: "joint", bone: "jaw" }, box: [[0.05, 0.025], [-0.04, 0.025], [-0.02, 0.035]], pick: [1, -0.3, 0], label: "Angle of the jaw" },
  { id: "shoulder_l", ref: { kind: "joint", bone: "upperarm01.L" }, box: [[0, 0.06], [0, 0.06], [0, 0.06]], pick: [1, 1, 0], label: "Shoulder" },
  { id: "antecubital_l", ref: { kind: "joint", bone: "lowerarm01.L" }, box: [[0, 0.04], [0, 0.04], [0, 0.05]], pick: [0, 0, 1], label: "Antecubital fossa" },
  { id: "olecranon_l", ref: { kind: "joint", bone: "lowerarm01.L" }, box: [[0, 0.04], [0, 0.04], [0, 0.05]], pick: [0, 0, -1], label: "Elbow" },
  { id: "radial_l", ref: { kind: "joint", bone: "wrist.L" }, box: [[0, 0.03], [0.02, 0.03], [0, 0.04]], pick: [0, 0, 1], label: "Radial pulse" },
  { id: "knuckle_l", ref: { kind: "joint", bone: "finger3-1.L" }, box: [[0, 0.02], [0, 0.02], [0, 0.03]], pick: [0, 0, 1], label: "Knuckles" },
  { id: "hip_l", ref: { kind: "joint", bone: "upperleg01.L" }, box: [[0.04, 0.06], [-0.05, 0.06], [0, 0.08]], pick: [1, 0, 0], label: "Greater trochanter" },
  { id: "patella_l", ref: { kind: "joint", bone: "lowerleg01.L" }, box: [[0, 0.05], [0.02, 0.05], [0, 0.08]], pick: [0, 0, 1], label: "Patella" },
  { id: "shin_l", ref: { kind: "joint", bone: "lowerleg02.L" }, box: [[0, 0.04], [0, 0.05], [0, 0.08]], pick: [0, 0, 1], label: "Shin" },
  { id: "calf_l", ref: { kind: "joint", bone: "lowerleg02.L" }, box: [[0, 0.05], [0.04, 0.05], [0, 0.08]], pick: [0, 0, -1], label: "Calf" },
  { id: "ankle_l", ref: { kind: "joint", bone: "foot.L" }, box: [[0, 0.04], [0, 0.03], [0, 0.04]], pick: [-1, 0, 0], label: "Medial malleolus" },
  { id: "dorsum_l", ref: { kind: "joint", bone: "foot.L" }, box: [[0, 0.03], [-0.03, 0.03], [0.05, 0.04]], pick: [0, 1, 0.6], label: "Dorsum of the foot" },
  { id: "toe_l", ref: { kind: "joint", bone: "toe1-1.L", end: "tail" }, box: [[0, 0.015], [0, 0.02], [0, 0.02]], pick: [0, 1, 0.4], label: "Great toe" },
];

const MID_LANDMARKS: LandmarkDef[] = [
  { id: "sternal_notch", ref: { kind: "joint", bone: "clavicle.L" }, box: [[-0.0266, 0.008], [-0.01, 0.025], [0, 0.08]], pick: [0, 0, 1], label: "Sternal notch" },
  { id: "xiphoid", ref: { kind: "joint", bone: "clavicle.L" }, box: [[-0.0266, 0.008], [-0.17, 0.015], [0, 0.25]], pick: [0, 0, 1], label: "Xiphoid" },
  // the navel: the deepest dimple on the front midline between the hips and the lower ribs
  { id: "umbilicus", ref: { kind: "joint", bone: "root" }, box: [[0, 0.008], [0.12, 0.07], [0.18, 0.09]], pick: [0, 0, 1], dimple: 0.02, label: "Umbilicus" },
  { id: "c7", ref: { kind: "joint", bone: "neck01" }, box: [[0, 0.008], [-0.01, 0.03], [0, 0.2]], pick: [0, 0, -1], label: "C7 spinous process" },
  { id: "sacrum_pt", ref: { kind: "joint", bone: "root" }, box: [[0, 0.01], [-0.04, 0.05], [0.0, 0.08]], pick: [0, 0, -1], label: "Sacrum" },
  { id: "vertex", ref: { kind: "joint", bone: "head", end: "tail" }, box: [[0, 0.012], [0, 0.12], [0, 0.12]], pick: [0, 1, 0], label: "Vertex" },
  { id: "occiput", ref: { kind: "joint", bone: "head" }, box: [[0, 0.01], [0.0, 0.025], [-0.08, 0.05]], pick: [0, 0, -1], label: "Occiput" },
  { id: "nose_tip", ref: { kind: "joint", bone: "head" }, box: [[0, 0.006], [0.01, 0.035], [0, 0.2]], pick: [0, 0, 1], label: "Nose" },
  { id: "mouth", ref: { kind: "joint", bone: "jaw" }, box: [[0, 0.006], [-0.03, 0.008], [0, 0.2]], pick: [0, 0, 1], label: "Mouth" },
  { id: "chin", ref: { kind: "joint", bone: "jaw", end: "tail" }, box: [[0, 0.01], [0, 0.02], [0, 0.04]], pick: [0, -0.5, 1], label: "Chin" },
];

const mirrorBone = (b: string) => b.replace(/\.L$/, ".R");
function mirrorLandmark(l: LandmarkDef): LandmarkDef {
  return {
    ...l,
    id: l.id.replace(/_l$/, "_r"),
    ref: l.ref.kind === "mid" ? { ...l.ref, bone: mirrorBone(l.ref.bone), other: mirrorBone(l.ref.other) } : { ...l.ref, bone: mirrorBone(l.ref.bone) },
    box: l.box ? [[-l.box[0][0], l.box[0][1]], l.box[1], l.box[2]] : undefined,
    pick: [-l.pick[0], l.pick[1], l.pick[2]],
    ...(l.near ? { near: { landmark: l.near.landmark.replace(/_l$/, "_r"), offsetCm: [-l.near.offsetCm[0], l.near.offsetCm[1], l.near.offsetCm[2]] as [number, number, number] } } : {}),
  };
}

export const LANDMARK_DEFS: LandmarkDef[] = [...MID_LANDMARKS, ...L_LANDMARKS, ...L_LANDMARKS.map(mirrorLandmark)];

// ---------------------------------------------------------------- region anchors
type Def = Omit<AnchorDef, "mirror">;
const LEFT: Def[] = [
  // neck and head (sided)
  { regionId: "carotid_left", landmark: "sternal_notch", offsetCm: [3.5, 7.5, 0], facing: "any", toleranceCm: 2, label: "Carotid pulse" },
  { regionId: "eye_left", landmark: "eye_l", offsetCm: [0, 0, 0], onLandmark: true, facing: "front", toleranceCm: 1.5 },
  { regionId: "ear_left", landmark: "ear_canal_l", offsetCm: [0, 0, 0], facing: "any", toleranceCm: 1.5 },
  // chest
  { regionId: "lung_ant_lu", landmark: "sternal_notch", offsetCm: [7, -6, 0], facing: "front", toleranceCm: 4, label: "2nd intercostal space, midclavicular line" },
  { regionId: "lung_ant_ll", landmark: "nipple_l", offsetCm: [3, -7, 0], facing: "front", toleranceCm: 4, label: "6th intercostal space" },
  // just in front of the mid-axillary line (within its tolerance): with the arms down the line itself is
  // at the edge of the hanging upper arm, and breathing moves the arm over it
  { regionId: "lung_lat_l", landmark: "nipple_l", offsetCm: [9, -6, -7], facing: "left", toleranceCm: 4, label: "Mid-axillary line" },
  { regionId: "lung_post_lu", landmark: "c7", offsetCm: [5, -10, 0], facing: "back", toleranceCm: 4, label: "Upper back, beside the scapula" },
  { regionId: "lung_post_ll", landmark: "c7", offsetCm: [7, -25, 0], facing: "back", toleranceCm: 4, label: "Lung base, below the scapula" },
  { regionId: "cva_left", landmark: "c7", offsetCm: [7, -31, 0], facing: "back", toleranceCm: 3, label: "Costovertebral angle" },
  { regionId: "breast_left", landmark: "nipple_l", offsetCm: [0, 0, 0], facing: "front", toleranceCm: 6 },
  // abdomen
  { regionId: "abd_luq", landmark: "umbilicus", offsetCm: [7, 6, 0], facing: "front", toleranceCm: 4 },
  { regionId: "abd_llq", landmark: "umbilicus", offsetCm: [7, -6, 0], facing: "front", toleranceCm: 4 },
  // the femoral pulse: just below the mid-inguinal point (halfway from the ASIS to the pubic
  // tubercle), clear of the towel the sheet keeps over the genitals (Phase 4 M3)
  { regionId: "groin_left", landmark: "asis_l", offsetCm: [-2, -6.5, 0], facing: "front", toleranceCm: 3, label: "Femoral pulse" },
  // limbs
  // the front of the shoulder: the top-lateral point is on the body's outline from most cameras
  { regionId: "shoulder_left", landmark: "shoulder_l", offsetCm: [0, -1, 3], facing: "front", toleranceCm: 5 },
  { regionId: "arm_left", landmark: "antecubital_l", offsetCm: [0, 0, 0], facing: "any", toleranceCm: 3.5, label: "Antecubital fossa (brachial pulse)" },
  { regionId: "elbow_left", landmark: "olecranon_l", offsetCm: [0, 0, 0], facing: "any", toleranceCm: 3.5 },
  // radial pulse ~2 cm above the wrist crease, thumb side (the radial landmark is on the thumb base)
  { regionId: "wrist_left", landmark: "radial_l", offsetCm: [0, 0, 0], offsetCmBy: { male: [-4.4, 2, -3.6], female: [-0.7, 1.8, -3.7] }, facing: "any", toleranceCm: 2.5, label: "Radial pulse" },
  { regionId: "hand_left", landmark: "knuckle_l", offsetCm: [0, 0, 0], facing: "any", toleranceCm: 4 },
  // the greater trochanter; on the female model it is on the body's outline from the side views, so
  // the target sits a little above it (still within the tolerance of the trochanter)
  { regionId: "hip_left", landmark: "hip_l", offsetCm: [0, 0, 0], offsetCmBy: { female: [0, 4, 1] }, facing: "any", toleranceCm: 6 },
  { regionId: "knee_left", landmark: "patella_l", offsetCm: [0, 0, 0], facing: "any", toleranceCm: 4.5 },
  { regionId: "shin_left", landmark: "shin_l", offsetCm: [0, -6, 0], facing: "front", toleranceCm: 6, label: "Lower shin (pitting edema)" },
  { regionId: "calf_left", landmark: "calf_l", offsetCm: [0, 0, 0], facing: "back", toleranceCm: 6 },
  { regionId: "ankle_left", landmark: "ankle_l", offsetCm: [0, 0, 0], facing: "any", toleranceCm: 3.5 },
  { regionId: "foot_left", landmark: "dorsum_l", offsetCm: [0, 0, 0], facing: "any", toleranceCm: 3, label: "Dorsalis pedis pulse" },
  { regionId: "toe_great_left", landmark: "toe_l", offsetCm: [0, 0, 0], facing: "any", toleranceCm: 2 },
  // Phase 4 (schema commit): rough placements, recalibrated against the anatomy oracle in M2
  { regionId: "upper_arm_left", landmark: "antecubital_l", offsetCm: [1, 10, 0], offsetCmBy: { male: [-1.8, 8.7, 1.4] }, facing: "any", toleranceCm: 3, label: "Upper arm, 2–3 cm above the antecubital fossa (cuff)" },
  { regionId: "biceps_tendon_left", landmark: "antecubital_l", offsetCm: [0, 0, 0], offsetCmBy: { male: [0.6, -1.6, 0.8], female: [-1, 0.3, -1] }, facing: "front", toleranceCm: 2, label: "Biceps tendon in the antecubital fossa" },
  { regionId: "triceps_tendon_left", landmark: "olecranon_l", offsetCm: [0, 2.5, 0], offsetCmBy: { male: [1.3, -0.8, 0.2], female: [2.3, -0.7, 0.4] }, facing: "back", toleranceCm: 2, label: "Triceps tendon just above the olecranon" },
  { regionId: "brachioradialis_left", landmark: "radial_l", offsetCm: [0, 4, 0], offsetCmBy: { male: [-5.1, 4.5, -3.1], female: [-1.8, 4.6, -2.7] }, facing: "any", toleranceCm: 2, label: "Distal radius, 3–5 cm above the wrist" },
  { regionId: "patellar_tendon_left", landmark: "patella_l", offsetCm: [0, -4, 0], offsetCmBy: { male: [-0.1, -11.3, -2.4], female: [2.7, -9.1, -3.3] }, facing: "front", toleranceCm: 2, label: "Patellar tendon below the kneecap" },
  { regionId: "leg_medial_left", landmark: "shin_l", offsetCm: [-3, 0, 0], offsetCmBy: { male: [-5.9, -2, 3.1] }, facing: "any", toleranceCm: 4, label: "Medial lower leg (L4)" },
  { regionId: "achilles_left", landmark: "ankle_l", offsetCm: [1.5, 3, -4], offsetCmBy: { male: [2.5, 4.8, -8] }, facing: "back", toleranceCm: 2, label: "Achilles tendon above the heel" },
  { regionId: "sole_left", landmark: "dorsum_l", offsetCm: [0, -3, -4], facing: "down", toleranceCm: 3, label: "Sole of the foot" },
  { regionId: "foot_lateral_left", landmark: "dorsum_l", offsetCm: [3, 0, -2], offsetCmBy: { male: [4.8, 0.9, 1.1] }, facing: "left", toleranceCm: 3, label: "Lateral border of the foot (S1)" },
];

const SINGLE: Def[] = [
  // precordium (the apex is on the patient's left)
  { regionId: "cardiac_aortic", landmark: "sternal_notch", between: { to: "xiphoid", t: 0.27 }, offsetCm: [-2.5, 0, 0], facing: "front", toleranceCm: 2, label: "2nd intercostal space, right sternal border" },
  { regionId: "cardiac_pulmonic", landmark: "sternal_notch", between: { to: "xiphoid", t: 0.27 }, offsetCm: [2.5, 0, 0], facing: "front", toleranceCm: 2, label: "2nd intercostal space, left sternal border" },
  { regionId: "cardiac_erbs", landmark: "sternal_notch", between: { to: "xiphoid", t: 0.45 }, offsetCm: [2.5, 0, 0], facing: "front", toleranceCm: 2, label: "3rd intercostal space, left sternal border" },
  { regionId: "cardiac_tricuspid", landmark: "sternal_notch", between: { to: "xiphoid", t: 0.8 }, offsetCm: [2, 0, 0], facing: "front", toleranceCm: 2, label: "4th–5th intercostal space, left lower sternal border" },
  // on the female model, 1 cm from the anatomical apex (which lies under the breast fold, hidden from the
  // front views): close enough that a click on the true apex wins over the breast, still in view
  { regionId: "cardiac_mitral", landmark: "sternal_notch", between: { to: "xiphoid", t: 0.95 }, offsetCm: [9, 0, 0], offsetCmBy: { female: [10.1, -0.2, -0.6] }, facing: "front", toleranceCm: 2.5, label: "5th intercostal space, midclavicular line (apex)" },
  { regionId: "precordium_lsb", landmark: "sternal_notch", between: { to: "xiphoid", t: 0.65 }, offsetCm: [1.5, 0, 0], facing: "front", toleranceCm: 3 },
  { regionId: "precordium_wall", landmark: "sternal_notch", offsetCm: [4, -10, 0], facing: "front", toleranceCm: 6 },
  // neck
  { regionId: "neck_trachea", landmark: "sternal_notch", offsetCm: [0, 2.5, 0], facing: "front", toleranceCm: 2, label: "Trachea above the sternal notch" },
  { regionId: "neck_thyroid", landmark: "sternal_notch", offsetCm: [0, 5, 0], facing: "front", toleranceCm: 2.5, label: "Thyroid isthmus" },
  { regionId: "neck_jvp_right", landmark: "sternal_notch", offsetCm: [-4.5, 5, -1], facing: "any", toleranceCm: 3, label: "Right internal jugular vein, between the heads of the sternocleidomastoid" },
  // head
  { regionId: "scalp", landmark: "vertex", offsetCm: [0, 0, 0], facing: "up", toleranceCm: 4, label: "Vertex of the skull" },
  { regionId: "nose", landmark: "nose_tip", offsetCm: [0, 0, 0], facing: "front", toleranceCm: 2.5 },
  { regionId: "mouth", landmark: "mouth", offsetCm: [0, 0, 0], facing: "front", toleranceCm: 2.5 },
  { regionId: "face", landmark: "nose_tip", offsetCm: [-4, -1, -1.5], facing: "front", toleranceCm: 4 },
  // lymph node groups (both sides)
  { regionId: "ln_occipital", landmark: "occiput", offsetCm: [3, -2, 0], facing: "back", bilateral: true, toleranceCm: 2.5 },
  // over the back of the mastoid: on the mastoid itself the target sat on the head's outline from behind the neck
  { regionId: "ln_post_auricular", landmark: "mastoid_l", offsetCm: [-0.4, 0, -1.2], facing: "any", bilateral: true, toleranceCm: 2 },
  { regionId: "ln_pre_auricular", landmark: "ear_canal_l", offsetCm: [-0.5, 0, 2], facing: "left", bilateral: true, toleranceCm: 2 },
  // under the body of the mandible; on the male model the jaw overhangs the angle, so the target sits
  // further forward along it (still the submandibular triangle)
  { regionId: "ln_submandibular", landmark: "jaw_angle_l", offsetCm: [-1.5, -1, 2.5], offsetCmBy: { male: [-1, -2.5, 4.5] }, facing: "any", bilateral: true, toleranceCm: 2.5 },
  { regionId: "ln_submental", landmark: "chin", offsetCm: [0, -1.5, -1], facing: "any", toleranceCm: 2 },
  { regionId: "ln_ant_cervical", landmark: "sternal_notch", offsetCm: [4, 6, -0.5], facing: "any", bilateral: true, toleranceCm: 3 },
  { regionId: "ln_post_cervical", landmark: "c7", offsetCm: [5.5, 4, 3], facing: "left", bilateral: true, toleranceCm: 3 },
  { regionId: "ln_supraclavicular", landmark: "sternal_notch", offsetCm: [5, 1.5, -0.5], facing: "front", bilateral: true, toleranceCm: 2.5 },
  // back and abdomen midline
  { regionId: "spine_cervical", landmark: "c7", offsetCm: [0, 4, 0], facing: "back", toleranceCm: 3 },
  { regionId: "spine_thoracic", landmark: "c7", offsetCm: [0, -15, 0], facing: "back", toleranceCm: 5 },
  { regionId: "spine_lumbar", landmark: "sacrum_pt", offsetCm: [0, 12, 0], facing: "back", toleranceCm: 6 },
  // over S2 (the sacral dimples): the landmark is the lowest sacrum, at seat level when sitting (Phase 4 M3)
  { regionId: "sacrum", landmark: "sacrum_pt", offsetCm: [0, 6, 0], facing: "back", toleranceCm: 4 },
  { regionId: "abd_epigastric", landmark: "umbilicus", offsetCm: [0, 9, 0], facing: "front", toleranceCm: 3.5 },
  { regionId: "pelvic", landmark: "umbilicus", offsetCm: [0, -11, 0], facing: "front", toleranceCm: 6 },
];

function rightOf(d: Def): AnchorDef {
  return { ...d, regionId: d.regionId.replace(/_left$/, "_right").replace(/_lat_l$/, "_lat_r").replace(/_lu$/, "_ru").replace(/_ll$/, "_rl").replace(/_luq$/, "_ruq").replace(/_llq$/, "_rlq"), mirror: true };
}

export const ANCHOR_DEFS: AnchorDef[] = [...SINGLE, ...LEFT, ...LEFT.map(rightOf)];
