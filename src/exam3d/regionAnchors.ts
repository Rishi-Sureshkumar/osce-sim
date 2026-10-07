/**
 * 3D anchors for the canonical regions (content/catalog/regions.json). The 3D view never invents
 * region ids: every collider maps to one of these, and a hit emits the same `examine` Action as the Examine… menu.
 *
 * Coordinate frame ("body frame", metres): the patient lies supine on the bed, hinge at the hips (origin).
 *   +Y = the patient's front (up when supine)     -X = the patient's RIGHT, +X = LEFT
 *   -Z = toward the head                          +Z = toward the feet
 * Upper-body anchors (segment "upper") rotate with the backrest angle; lower-body ones don't.
 * A tests/regionAnchors.test.ts check keeps this in sync with regions.json.
 *
 * Swapping in a real model (public/models/patient.glb): keep this file as the contract and move the
 * points onto the model's surface (or parent them to bones via `bone`). Region ids never change.
 */
export type Vec3 = [number, number, number];
export type Segment = "upper" | "lower";

export interface RegionAnchor {
  regionId: string;
  segment: Segment;
  /** One point per side for bilateral regions (e.g. lymph node groups). */
  points: Vec3[];
  /** Hit radius (m). Smaller anchors win when colliders overlap. */
  radius: number;
  /** Outward surface normal in the body frame, for camera focus and tool placement. */
  normal: Vec3;
  /** Bone to parent to when a rigged GLB is used. */
  bone?: string;
}

export interface Landmark {
  id: string;
  regionId: string;
  segment: Segment;
  point: Vec3;
  normal: Vec3;
}

const FRONT: Vec3 = [0, 1, 0];
const BACK: Vec3 = [0, -1, 0];
const RIGHT: Vec3 = [-1, 0, 0];
const LEFT: Vec3 = [1, 0, 0];
const HEAD: Vec3 = [0, 0, -1];
const FEET: Vec3 = [0, 0, 1];

const a = (regionId: string, segment: Segment, points: Vec3[], radius: number, normal: Vec3 = FRONT, bone?: string): RegionAnchor => ({
  regionId,
  segment,
  points,
  radius,
  normal,
  ...(bone ? { bone } : {}),
});
/** Mirror a right-side point to the left (x → -x). */
const L = ([x, y, z]: Vec3): Vec3 => [-x, y, z];
const both = (p: Vec3): Vec3[] => [p, L(p)];

export const REGION_ANCHORS: RegionAnchor[] = [
  // ---- head & neck (upper) ----
  a("scalp", "upper", [[0, 0.03, -0.875]], 0.045, HEAD, "Head"),
  a("eye_right", "upper", [[-0.036, 0.1, -0.795]], 0.017, FRONT, "Head"),
  a("eye_left", "upper", [L([-0.036, 0.1, -0.795])], 0.017, FRONT, "Head"),
  a("nose", "upper", [[0, 0.123, -0.772]], 0.016, FRONT, "Head"),
  a("mouth", "upper", [[0, 0.1, -0.728]], 0.018, FRONT, "Head"),
  a("face", "upper", both([-0.058, 0.085, -0.755]), 0.02, FRONT, "Head"),
  a("ear_right", "upper", [[-0.108, 0.015, -0.78]], 0.022, RIGHT, "Head"),
  a("ear_left", "upper", [L([-0.108, 0.015, -0.78])], 0.022, LEFT, "Head"),
  a("ln_pre_auricular", "upper", both([-0.1, 0.05, -0.77]), 0.011, FRONT, "Head"),
  a("ln_post_auricular", "upper", both([-0.098, -0.03, -0.752]), 0.011, RIGHT, "Head"),
  a("ln_occipital", "upper", both([-0.04, -0.085, -0.73]), 0.012, BACK, "Head"),
  a("ln_submandibular", "upper", both([-0.052, 0.068, -0.69]), 0.011, FRONT, "Neck"),
  a("ln_submental", "upper", [[0, 0.08, -0.682]], 0.011, FRONT, "Neck"),
  a("ln_ant_cervical", "upper", both([-0.05, 0.052, -0.635]), 0.011, FRONT, "Neck"),
  a("ln_post_cervical", "upper", both([-0.068, -0.01, -0.63]), 0.011, RIGHT, "Neck"),
  a("ln_supraclavicular", "upper", both([-0.075, 0.075, -0.567]), 0.013, FRONT, "Neck"),
  a("neck_trachea", "upper", [[0, 0.064, -0.645]], 0.01, FRONT, "Neck"),
  a("neck_thyroid", "upper", [[0, 0.062, -0.612]], 0.012, FRONT, "Neck"),
  a("carotid_right", "upper", [[-0.032, 0.058, -0.625]], 0.01, FRONT, "Neck"),
  a("carotid_left", "upper", [L([-0.032, 0.058, -0.625])], 0.01, FRONT, "Neck"),
  a("neck_jvp_right", "upper", [[-0.046, 0.04, -0.6]], 0.011, RIGHT, "Neck"),

  // ---- precordium landmarks (upper, front of chest) ----
  a("cardiac_aortic", "upper", [[-0.03, 0.124, -0.468]], 0.014),
  a("cardiac_pulmonic", "upper", [[0.03, 0.124, -0.468]], 0.014),
  a("cardiac_erbs", "upper", [[0.034, 0.124, -0.425]], 0.013),
  a("cardiac_tricuspid", "upper", [[0.026, 0.122, -0.36]], 0.014),
  a("cardiac_mitral", "upper", [[0.088, 0.114, -0.332]], 0.016),
  a("precordium_lsb", "upper", [[0.02, 0.124, -0.398]], 0.01),
  a("precordium_wall", "upper", [[0.055, 0.118, -0.4]], 0.06),

  // ---- lungs (upper): anterior, lateral, posterior by zone & side ----
  a("lung_ant_ru", "upper", [[-0.095, 0.115, -0.455]], 0.04),
  a("lung_ant_lu", "upper", [L([-0.095, 0.115, -0.455])], 0.04),
  a("lung_ant_rl", "upper", [[-0.105, 0.11, -0.3]], 0.04),
  a("lung_ant_ll", "upper", [L([-0.125, 0.105, -0.29])], 0.03),
  a("lung_lat_r", "upper", [[-0.178, 0.0, -0.33]], 0.045, RIGHT),
  a("lung_lat_l", "upper", [L([-0.178, 0.0, -0.33])], 0.045, LEFT),
  a("lung_post_ru", "upper", [[-0.09, -0.118, -0.45]], 0.042, BACK),
  a("lung_post_lu", "upper", [L([-0.09, -0.118, -0.45])], 0.042, BACK),
  a("lung_post_rl", "upper", [[-0.1, -0.114, -0.29]], 0.042, BACK),
  a("lung_post_ll", "upper", [L([-0.1, -0.114, -0.29])], 0.042, BACK),

  // ---- back (upper) ----
  a("spine_cervical", "upper", [[0, -0.045, -0.63]], 0.02, BACK, "Neck"),
  a("spine_thoracic", "upper", [[0, -0.125, -0.38]], 0.022, BACK, "Spine"),
  a("spine_lumbar", "upper", [[0, -0.105, -0.13]], 0.035, BACK, "Spine"),
  a("cva_right", "upper", [[-0.075, -0.1, -0.175]], 0.025, BACK),
  a("cva_left", "upper", [L([-0.075, -0.1, -0.175])], 0.025, BACK),

  // ---- abdomen (upper, near the hinge) ----
  a("abd_epigastric", "upper", [[0, 0.112, -0.24]], 0.022),
  // prohibited-exam targets (clicking logs a prohibited_attempt; never examined)
  a("breast_right", "upper", [[-0.1, 0.122, -0.38]], 0.045),
  a("breast_left", "upper", [L([-0.1, 0.122, -0.38])], 0.045),
  a("pelvic", "upper", [[0, 0.085, 0.0]], 0.05),
  a("abd_ruq", "upper", [[-0.075, 0.1, -0.185]], 0.04),
  a("abd_luq", "upper", [L([-0.075, 0.1, -0.185])], 0.04),
  a("abd_rlq", "upper", [[-0.075, 0.092, -0.07]], 0.04),
  a("abd_llq", "upper", [L([-0.075, 0.092, -0.07])], 0.04),

  // ---- arms (upper; they rest at the sides and tilt with the backrest) ----
  ...(["right", "left"] as const).flatMap((side) => {
    const m = (p: Vec3): Vec3 => (side === "right" ? p : L(p));
    const out: Vec3 = side === "right" ? RIGHT : LEFT;
    return [
      a(`shoulder_${side}`, "upper", [m([-0.225, 0.03, -0.52])], 0.035, out, side === "right" ? "RightShoulder" : "LeftShoulder"),
      a(`arm_${side}`, "upper", [m([-0.245, 0.045, -0.36])], 0.03, FRONT, side === "right" ? "RightArm" : "LeftArm"),
      a(`elbow_${side}`, "upper", [m([-0.255, 0.03, -0.25])], 0.025, FRONT, side === "right" ? "RightForeArm" : "LeftForeArm"),
      a(`wrist_${side}`, "upper", [m([-0.262, 0.04, -0.03])], 0.022, FRONT, side === "right" ? "RightHand" : "LeftHand"),
      a(`hand_${side}`, "upper", [m([-0.262, 0.03, 0.06])], 0.03, FRONT, side === "right" ? "RightHand" : "LeftHand"),
    ];
  }),

  // ---- pelvis & legs (lower; flat on the bed) ----
  a("sacrum", "lower", [[0, -0.08, 0.02]], 0.03, BACK, "Hips"),
  ...(["right", "left"] as const).flatMap((side) => {
    const m = (p: Vec3): Vec3 => (side === "right" ? p : L(p));
    const out: Vec3 = side === "right" ? RIGHT : LEFT;
    const leg = side === "right" ? "RightLeg" : "LeftLeg";
    return [
      a(`groin_${side}`, "lower", [m([-0.075, 0.085, 0.07])], 0.025, FRONT, side === "right" ? "RightUpLeg" : "LeftUpLeg"),
      a(`hip_${side}`, "lower", [m([-0.165, 0.0, 0.06])], 0.035, out, side === "right" ? "RightUpLeg" : "LeftUpLeg"),
      a(`knee_${side}`, "lower", [m([-0.1, 0.065, 0.46])], 0.035, FRONT, leg),
      a(`shin_${side}`, "lower", [m([-0.1, 0.055, 0.66])], 0.035, FRONT, leg),
      a(`calf_${side}`, "lower", [m([-0.1, -0.055, 0.63])], 0.035, BACK, leg),
      a(`ankle_${side}`, "lower", [m([-0.1, 0.03, 0.855])], 0.026, FRONT, side === "right" ? "RightFoot" : "LeftFoot"),
      a(`foot_${side}`, "lower", [m([-0.1, 0.075, 0.92])], 0.03, FEET, side === "right" ? "RightFoot" : "LeftFoot"),
      a(`toe_great_${side}`, "lower", [m([-0.085, 0.165, 0.935])], 0.015, FEET, side === "right" ? "RightToeBase" : "LeftToeBase"),
    ];
  }),
];

/** Named landmarks used by tool sequences (catalog `steps[].landmark`). Side comes from the region. */
export const LANDMARKS: Landmark[] = [
  { id: "mastoid", regionId: "ear_right", segment: "upper", point: [-0.1, -0.035, -0.76], normal: RIGHT },
  { id: "mastoid", regionId: "ear_left", segment: "upper", point: L([-0.1, -0.035, -0.76]), normal: LEFT },
  { id: "ear_canal", regionId: "ear_right", segment: "upper", point: [-0.125, 0.015, -0.78], normal: RIGHT },
  { id: "ear_canal", regionId: "ear_left", segment: "upper", point: L([-0.125, 0.015, -0.78]), normal: LEFT },
  { id: "vertex", regionId: "scalp", segment: "upper", point: [0, 0.03, -0.885], normal: HEAD },
  { id: "apex", regionId: "cardiac_mitral", segment: "upper", point: [0.088, 0.114, -0.332], normal: FRONT },
];

export const ANCHOR_BY_REGION = new Map(REGION_ANCHORS.map((x) => [x.regionId, x]));

export function landmarkFor(id: string, regionId: string): Landmark | undefined {
  return LANDMARKS.find((l) => l.id === id && l.regionId === regionId);
}

// ---------------------------------------------------------------------------
// Pose: where the body-frame points end up in the world for a given patient position.
// Pure math shared by the scene, camera presets, tool snapping and the e2e test hook.
// ---------------------------------------------------------------------------

export const BED_TOP_Y = 0.62;
/** Height of the body-frame origin (hip hinge) above the floor. */
export const HINGE_Y = BED_TOP_Y + 0.12;

export interface Pose {
  /** backrest angle, radians (0 = flat) */
  backrest: number;
  /** roll about the long axis, radians (negative = onto the patient's left side) */
  roll: number;
}

export function poseFor(position: string, bedAngleDeg: number): Pose {
  const roll = position === "left_lateral_decubitus" ? (-70 * Math.PI) / 180 : position === "prone" ? Math.PI : 0;
  return { backrest: (bedAngleDeg * Math.PI) / 180, roll };
}

function rotX([x, y, z]: Vec3, t: number): Vec3 {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [x, y * c - z * s, y * s + z * c];
}
function rotZ([x, y, z]: Vec3, t: number): Vec3 {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [x * c - y * s, x * s + y * c, z];
}

/** Body-frame point → world position. Mirrors the scene graph in Patient3D. */
export function toWorld(p: Vec3, segment: Segment, pose: Pose): Vec3 {
  const q = segment === "upper" ? rotX(p, pose.backrest) : p;
  const r = rotZ(q, pose.roll);
  return [r[0], r[1] + HINGE_Y, r[2]];
}

/** Body-frame direction → world direction (no translation). */
export function dirToWorld(d: Vec3, segment: Segment, pose: Pose): Vec3 {
  const q = segment === "upper" ? rotX(d, pose.backrest) : d;
  return rotZ(q, pose.roll);
}

export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * Among colliders hit by a ray, pick the intended region: the nearest hit wins, except that a
 * smaller anchor within 2 cm behind it takes precedence (landmarks sit on top of broad zones).
 */
export function pickRegion(hits: { regionId: string; distance: number }[]): string | null {
  if (!hits.length) return null;
  const nearest = Math.min(...hits.map((h) => h.distance));
  const close = hits.filter((h) => h.distance - nearest <= 0.02);
  close.sort((x, y) => (ANCHOR_BY_REGION.get(x.regionId)?.radius ?? 1) - (ANCHOR_BY_REGION.get(y.regionId)?.radius ?? 1));
  return close[0]!.regionId;
}

/**
 * Nearest allowed anchor to a world point (e.g. where a tool was dropped). Callers compare
 * `error` with SNAP_TOLERANCE: inside it the tool snaps; outside it the placement is off target.
 * `error` is the distance in anchor radii (0 = centre, 1 = edge of the target).
 */
export function snapToAnchor(world: Vec3, allowedRegionIds: readonly string[], pose: Pose): { regionId: string; error: number; point: Vec3 } | null {
  let best: { regionId: string; error: number; point: Vec3 } | null = null;
  for (const id of allowedRegionIds) {
    const anchor = ANCHOR_BY_REGION.get(id);
    if (!anchor) continue;
    for (const p of anchor.points) {
      const w = toWorld(p, anchor.segment, pose);
      const error = distance(w, world) / anchor.radius;
      if (!best || error < best.error) best = { regionId: id, error, point: w };
    }
  }
  return best;
}

/** A placement counts as on target within this many anchor radii (tools snap inside it). */
export const SNAP_TOLERANCE = 1.5;

/** Region groups shown as buttons (exam domains, whole-patient), not as places on the body. */
export const PANEL_GROUPS = new Set<string>(["whole", "neuro"]);
