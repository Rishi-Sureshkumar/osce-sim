/**
 * Cinematic navigation: the camera moves between named shots, defined here as data.
 * Each shot has a camera framing, a parent (Back/Esc goes there), the shots it can move to,
 * and a small amount of free look (yaw and zoom only).
 *
 * Room shots are fixed in world space. Patient shots are framed on skin landmarks/anchors, so
 * they follow the patient's position (reclined, seated, left lateral…).
 */
import type { Position, RegionGroup } from "@/domain/schemas";
import { anchorWorldNormals, anchorWorldPoints, skinLandmark, type Pose, type Vec3 } from "@/exam3d/regionAnchors";
import { TABLE, dirToWorld } from "./rig";
import { DISPENSER_POS } from "./room/Dispenser";
import { SINK } from "./room/sinkGeometry";
import { TOOL_TABLE_POS, TOOL_TABLE_TOP } from "./room/ToolTable";
import { ROOM } from "./room/ExamRoom";
import { insideBox, tableAngle, tableBoxes } from "./room/tableGeometry";

export type FocusShotId = Exclude<RegionGroup, "whole" | "neuro">;
export type ShotId = "corridor" | "overview" | "sink" | "tool_table" | "seated" | FocusShotId | "face" | "ear_left" | "ear_right" | "ankle_left" | "ankle_right" | "arms_left" | "elbow_left" | "elbow_right" | "chest_left" | "chest_right" | "neck_back" | "legs_left" | "head_top";

type Framing =
  /** fixed camera in the room; `follow`: moves with the patient along the table (sitting at its foot end) */
  | { kind: "fixed"; position: Vec3; target: Vec3; follow?: boolean }
  /** framed on the patient: target = mean of landmark/anchor points, camera along their outward normal */
  | {
      kind: "patient";
      on: { landmark?: string; anchor?: string }[];
      normalFrom: { landmark?: string; anchor?: string };
      distance: number;
      lift?: number;
      side?: number;
      normalBlendUp?: number;
      /** look along this bone's forward axis instead of a skin normal (the face: the head's +Z) */
      forwardBone?: string;
      /** the bone-frame axis to look along with forwardBone (default +Z; the ears: lateral and a little back) */
      forwardAxis?: Vec3;
      /** move the camera this far toward the feet along the body axis (look slightly up, under the chin) */
      down?: number;
      /** raise the camera until neither it nor its line of sight is inside the table (a limb view along a
       *  bone's axis points under the table when the limb lies on it) */
      clearTable?: boolean;
    };

export interface Shot {
  id: ShotId;
  label: string;
  parent: ShotId | null;
  framing: Framing;
  fov: number;
  /** free look: ± yaw in degrees around the target, and the zoom range (distance factor) */
  freeLook: { yawDeg: number; zoomMin: number; zoomMax: number };
  transitions: ShotId[];
}

const FOCUS: FocusShotId[] = ["head_neck", "chest_front", "chest_back", "abdomen", "arms", "hands", "legs", "feet"];
const ROOM_SHOTS: ShotId[] = ["overview", "sink", "tool_table", "seated", ...FOCUS, "face", "ear_left", "ear_right", "ankle_left", "ankle_right", "arms_left", "elbow_left", "elbow_right", "chest_left", "chest_right", "neck_back", "legs_left", "head_top"];
const look = (yawDeg: number, zoomMin = 0.8, zoomMax = 1.25) => ({ yawDeg, zoomMin, zoomMax });

export const SHOTS: Record<ShotId, Shot> = {
  corridor: {
    id: "corridor",
    label: "Corridor",
    parent: null,
    framing: { kind: "fixed", position: [-1.15, 1.6, ROOM.doorZ + 1.75], target: [-1.15, 1.35, ROOM.doorZ] },
    fov: 45,
    freeLook: look(12, 0.9, 1.1),
    transitions: ["overview"],
  },
  overview: {
    id: "overview",
    label: "Room",
    parent: null,
    framing: { kind: "fixed", position: [0.45, 1.72, 2.3], target: [-0.65, 0.98, 0.0] },
    fov: 55,
    freeLook: look(25, 0.85, 1.2),
    transitions: ROOM_SHOTS,
  },
  sink: {
    id: "sink",
    label: "Sink",
    parent: "overview",
    // the basin (washing under the tap) and the sanitiser beside it
    framing: { kind: "fixed", position: [SINK.x + 0.8, 1.6, (SINK.z + DISPENSER_POS[2]) / 2 + 0.6], target: [SINK.x - 0.05, 1.0, (SINK.z + DISPENSER_POS[2]) / 2] },
    fov: 45,
    freeLook: look(10),
    transitions: ROOM_SHOTS,
  },
  tool_table: {
    id: "tool_table",
    label: "Tool table",
    parent: "overview",
    framing: { kind: "fixed", position: [TOOL_TABLE_POS[0] - 0.05, TOOL_TABLE_TOP + 0.62, TOOL_TABLE_POS[2] + 0.5], target: [TOOL_TABLE_POS[0], TOOL_TABLE_TOP, TOOL_TABLE_POS[2]] },
    fov: 40,
    freeLook: look(10, 0.85, 1.15),
    transitions: ROOM_SHOTS,
  },
  seated: {
    id: "seated",
    label: "Seated",
    parent: "overview",
    framing: { kind: "fixed", position: [-1.05, 1.12, 0.65], target: [0, 1.0, -0.35], follow: true },
    fov: 45,
    freeLook: look(30, 0.85, 1.2),
    transitions: ROOM_SHOTS,
  },
  head_neck: {
    id: "head_neck",
    label: "Head & neck",
    parent: "overview",
    // in front of the neck and a little below it, so the chin doesn't hide the JVP, carotids and thyroid (bug 4)
    framing: { kind: "patient", on: [{ landmark: "chin" }, { landmark: "sternal_notch" }], normalFrom: { landmark: "chin" }, forwardBone: "head", distance: 0.55, down: 0.08, side: 0.08 },
    fov: 40,
    freeLook: look(30, 0.7, 1.3),
    transitions: ROOM_SHOTS,
  },
  face: {
    id: "face",
    label: "Face",
    parent: "head_neck",
    // straight in front of the eyes (eyes, pupils, nose, mouth) — bug 4
    framing: { kind: "patient", on: [{ landmark: "eye_l" }, { landmark: "eye_r" }], normalFrom: { landmark: "nose_tip" }, forwardBone: "head", distance: 0.4 },
    fov: 35,
    freeLook: look(15, 0.8, 1.2),
    transitions: ROOM_SHOTS,
  },
  // the back of the neck and head from behind and above (the posterior triangles and the occiput, both
  // sides at once): the front view sees the posterior cervical nodes edge-on behind the neck muscles
  neck_back: {
    id: "neck_back",
    label: "Neck (back)",
    parent: "head_neck",
    framing: { kind: "patient", on: [{ landmark: "c7" }, { landmark: "occiput" }], normalFrom: { landmark: "c7" }, forwardBone: "neck01", forwardAxis: [0, 0.5, -1], distance: 0.5, clearTable: true },
    fov: 40,
    freeLook: look(30, 0.7, 1.3),
    transitions: ROOM_SHOTS,
  },
  // the top of the head from above and a little in front (the vertex, for the Weber test): from the
  // front views it is out of sight, and from behind it is on the head's outline
  head_top: {
    id: "head_top",
    label: "Top of the head",
    parent: "head_neck",
    framing: { kind: "patient", on: [{ anchor: "scalp" }], normalFrom: { anchor: "scalp" }, forwardBone: "head", forwardAxis: [0, 1, 0.35], distance: 0.45, clearTable: true },
    fov: 40,
    freeLook: look(30, 0.7, 1.3),
    transitions: ROOM_SHOTS,
  },
  ear_left: {
    id: "ear_left",
    label: "Left ear",
    parent: "head_neck",
    // from the side and a little behind, on the head's own axes, so the ear and the mastoid behind it fill the view
    framing: { kind: "patient", on: [{ landmark: "ear_canal_l" }, { landmark: "mastoid_l" }], normalFrom: { landmark: "ear_canal_l" }, forwardBone: "head", forwardAxis: [0.98, 0, -0.2], distance: 0.34, clearTable: true },
    fov: 35,
    freeLook: look(30, 0.7, 1.3),
    transitions: ROOM_SHOTS,
  },
  ear_right: {
    id: "ear_right",
    label: "Right ear",
    parent: "head_neck",
    // from the side and a little behind, on the head's own axes, so the ear and the mastoid behind it fill the view
    framing: { kind: "patient", on: [{ landmark: "ear_canal_r" }, { landmark: "mastoid_r" }], normalFrom: { landmark: "ear_canal_r" }, forwardBone: "head", forwardAxis: [-0.98, 0, -0.2], distance: 0.34, clearTable: true },
    fov: 35,
    freeLook: look(30, 0.7, 1.3),
    transitions: ROOM_SHOTS,
  },
  chest_front: {
    id: "chest_front",
    label: "Chest (front)",
    parent: "overview",
    framing: { kind: "patient", on: [{ anchor: "cardiac_erbs" }], normalFrom: { landmark: "sternal_notch" }, distance: 0.75, side: 0.18 },
    fov: 40,
    freeLook: look(35, 0.7, 1.3),
    transitions: ROOM_SHOTS,
  },
  chest_back: {
    id: "chest_back",
    label: "Chest (back)",
    parent: "overview",
    framing: { kind: "patient", on: [{ anchor: "lung_post_rl" }, { anchor: "lung_post_ll" }], normalFrom: { anchor: "lung_post_rl" }, distance: 0.6, lift: 0.45 },
    fov: 40,
    freeLook: look(30, 0.75, 1.25),
    transitions: ROOM_SHOTS,
  },
  abdomen: {
    id: "abdomen",
    label: "Abdomen",
    parent: "overview",
    framing: { kind: "patient", on: [{ landmark: "umbilicus" }], normalFrom: { landmark: "umbilicus" }, distance: 0.75, side: 0.15 },
    fov: 40,
    freeLook: look(35, 0.7, 1.3),
    transitions: ROOM_SHOTS,
  },
  arms: {
    id: "arms",
    label: "Arms",
    parent: "overview",
    framing: { kind: "patient", on: [{ anchor: "arm_right" }, { anchor: "elbow_right" }], normalFrom: { landmark: "sternal_notch" }, distance: 0.75, side: 0.3 },
    fov: 40,
    freeLook: look(35, 0.7, 1.3),
    transitions: ROOM_SHOTS,
  },
  hands: {
    id: "hands",
    label: "Hands",
    parent: "overview",
    framing: { kind: "patient", on: [{ anchor: "hand_right" }, { anchor: "hand_left" }], normalFrom: { landmark: "umbilicus" }, distance: 0.8, normalBlendUp: 0.6 },
    fov: 40,
    freeLook: look(30, 0.7, 1.3),
    transitions: ROOM_SHOTS,
  },
  legs: {
    id: "legs",
    label: "Legs",
    parent: "overview",
    framing: { kind: "patient", on: [{ anchor: "knee_right" }, { anchor: "shin_left" }], normalFrom: { anchor: "shin_right" }, distance: 0.85, side: 0.25, normalBlendUp: 0.5 },
    fov: 40,
    freeLook: look(35, 0.7, 1.3),
    transitions: ROOM_SHOTS,
  },
  // the legs from the patient's left (the legs shot leans to the right: the left hip is on the far outline)
  legs_left: {
    id: "legs_left",
    label: "Legs (left side)",
    parent: "legs",
    framing: { kind: "patient", on: [{ anchor: "knee_left" }, { anchor: "shin_right" }], normalFrom: { anchor: "shin_left" }, distance: 0.85, side: -0.25, normalBlendUp: 0.5 },
    fov: 40,
    freeLook: look(35, 0.7, 1.3),
    transitions: ROOM_SHOTS,
  },
  // the left arm from the patient's left (the arms shot looks at the right arm from the right; the
  // left arm is behind the body from there)
  arms_left: {
    id: "arms_left",
    label: "Left arm",
    parent: "overview",
    framing: { kind: "patient", on: [{ anchor: "arm_left" }, { anchor: "elbow_left" }], normalFrom: { landmark: "sternal_notch" }, distance: 0.75, side: -0.3 },
    fov: 40,
    freeLook: look(35, 0.7, 1.3),
    transitions: ROOM_SHOTS,
  },
  // the back of each elbow (the olecranon), from above, behind and outside it: seated with the hands in
  // the lap, the olecranon faces back and the front views see only the upper arm (while the seated patient
  // sits into the backrest, V-BACKREST, the backrest edge crowds this view; a view along the arm is worse)
  elbow_left: {
    id: "elbow_left",
    label: "Left elbow (back)",
    parent: "arms_left",
    framing: { kind: "patient", on: [{ anchor: "elbow_left" }], normalFrom: { anchor: "elbow_left" }, distance: 0.55, normalBlendUp: 0.6 },
    fov: 40,
    freeLook: look(30, 0.7, 1.3),
    transitions: ROOM_SHOTS,
  },
  elbow_right: {
    id: "elbow_right",
    label: "Right elbow (back)",
    parent: "arms",
    framing: { kind: "patient", on: [{ anchor: "elbow_right" }], normalFrom: { anchor: "elbow_right" }, distance: 0.55, normalBlendUp: 0.6 },
    fov: 40,
    freeLook: look(30, 0.7, 1.3),
    transitions: ROOM_SHOTS,
  },
  // each side of the chest (the mid-axillary line) from in front and outside, in front of the hanging
  // upper arm: the front view sees the far side edge-on, and a view straight from the side meets the arm
  chest_left: {
    id: "chest_left",
    label: "Chest (left side)",
    parent: "chest_front",
    framing: { kind: "patient", on: [{ anchor: "lung_lat_l" }], normalFrom: { landmark: "sternal_notch" }, distance: 0.6, side: -0.4 },
    fov: 40,
    freeLook: look(30, 0.7, 1.3),
    transitions: ROOM_SHOTS,
  },
  chest_right: {
    id: "chest_right",
    label: "Chest (right side)",
    parent: "chest_front",
    framing: { kind: "patient", on: [{ anchor: "lung_lat_r" }], normalFrom: { landmark: "sternal_notch" }, distance: 0.6, side: 0.4 },
    fov: 40,
    freeLook: look(30, 0.7, 1.3),
    transitions: ROOM_SHOTS,
  },
  // the back of each ankle (the Achilles tendon), from the side and a little behind, on the shank's
  // own axes: legs hanging over the table's end, the front views see only the shins
  ankle_left: {
    id: "ankle_left",
    label: "Left ankle (back)",
    parent: "feet",
    framing: { kind: "patient", on: [{ anchor: "achilles_left" }], normalFrom: { anchor: "achilles_left" }, forwardBone: "lowerleg02_L", forwardAxis: [0.8, 0, -0.6], distance: 0.45, clearTable: true },
    fov: 40,
    freeLook: look(30, 0.7, 1.3),
    transitions: ROOM_SHOTS,
  },
  ankle_right: {
    id: "ankle_right",
    label: "Right ankle (back)",
    parent: "feet",
    framing: { kind: "patient", on: [{ anchor: "achilles_right" }], normalFrom: { anchor: "achilles_right" }, forwardBone: "lowerleg02_R", forwardAxis: [-0.8, 0, -0.6], distance: 0.45, clearTable: true },
    fov: 40,
    freeLook: look(30, 0.7, 1.3),
    transitions: ROOM_SHOTS,
  },
  feet: {
    id: "feet",
    label: "Feet",
    parent: "overview",
    framing: { kind: "patient", on: [{ anchor: "foot_right" }, { anchor: "foot_left" }], normalFrom: { anchor: "foot_right" }, distance: 0.6, lift: 0.15, side: 0.1 },
    fov: 40,
    freeLook: look(30, 0.7, 1.3),
    transitions: ROOM_SHOTS,
  },
};

const add = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

function pointOf(ref: { landmark?: string; anchor?: string }, pose: Pose): { point: Vec3; normal: Vec3 } {
  if (ref.landmark) return skinLandmark(ref.landmark, pose);
  const p = anchorWorldPoints(ref.anchor!, pose)[0] ?? [0, 1, 0];
  const n = anchorWorldNormals(ref.anchor!, pose)[0] ?? [0, 1, 0];
  return { point: p, normal: n };
}

/** Pure: the camera for a shot in a given patient pose. */
export function shotCamera(id: ShotId, pose: Pose): { position: Vec3; target: Vec3; fov: number } {
  const shot = SHOTS[id];
  const f = shot.framing;
  if (f.kind === "fixed") {
    if (!f.follow) return { position: f.position, target: f.target, fov: shot.fov };
    // how far the patient's pelvis has moved along the table from where it lies (the hinge)
    const root = pose.world.get("root");
    const dz = root ? root.elements[14]! - TABLE.hingeZ : 0;
    return { position: [f.position[0], f.position[1], f.position[2] + dz], target: [f.target[0], f.target[1], f.target[2] + dz], fov: shot.fov };
  }
  const pts = f.on.map((r) => pointOf(r, pose).point);
  const target: Vec3 = [0, 1, 2].map((k) => pts.reduce((s, p) => s + p[k]!, 0) / pts.length) as Vec3;
  let n = f.forwardBone ? norm(dirToWorld(f.forwardAxis ?? [0, 0, 1], f.forwardBone, pose)) : pointOf(f.normalFrom, pose).normal;
  if (f.normalBlendUp) n = norm(add(scaleV(n, 1 - f.normalBlendUp), [0, f.normalBlendUp, 0]));
  // never put the camera under the table: a surface facing down (the back of a lying patient) is viewed from above
  // (the face always has room in front of it, even leaning forward)
  if (n[1] < -0.3 && !f.forwardBone) n = norm([n[0], 0.6, n[2] - 0.4]);
  let position = add(target, n, f.distance);
  if (f.clearTable) {
    const boxes = tableBoxes(tableAngle(pose.position, pose.bedAngle));
    for (let k = 0; k < 8 && blockedByTable(position, target, boxes); k++) {
      n = norm(add(n, [0, 0.3, 0]));
      position = add(target, n, f.distance);
    }
  }
  if (f.down) position = add(position, norm(dirToWorld([0, 1, 0], "neck01", pose)), -f.down);
  if (f.lift) position = add(position, [0, 1, 0], f.lift);
  if (f.side) position = add(position, [-1, 0, 0], f.side); // lean toward the examiner's side (patient's right)
  return { position, target, fov: shot.fov };
}
/** the camera, or its line of sight short of the last 3 cm (the target may rest on the mattress), inside a table box */
function blockedByTable(from: Vec3, to: Vec3, boxes: ReturnType<typeof tableBoxes>): boolean {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (t * len > len - 0.03) break;
    const p = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t];
    if (boxes.some((b) => insideBox(p, b))) return true;
  }
  return false;
}
function scaleV(a: Vec3, k: number): Vec3 {
  return [a[0] * k, a[1] * k, a[2] * k];
}

/** Regions with a closer shot of their own (the ears need a side view for the mastoid; the eyes and face a front view; the elbows a view from behind; the mid-axillary lines a side view). */
const REGION_SHOT: Record<string, ShotId> = {
  ear_left: "ear_left",
  ear_right: "ear_right",
  // two-sided groups need a view that sees both sides: behind the head (the frontal head & neck shot
  // can't see them; one ear view sees only its own side), and the face for the pre-auricular nodes
  ln_post_auricular: "neck_back",
  ln_occipital: "neck_back",
  ln_post_cervical: "neck_back",
  ln_pre_auricular: "face",
  // the back of the limb: the Achilles from beside the ankle; the triceps tendon from behind the elbow
  // (from the back view it is on the arm's outline, and seated the backrest is in the way)
  achilles_left: "ankle_left",
  achilles_right: "ankle_right",
  triceps_tendon_left: "elbow_left",
  shoulder_left: "arms_left",
  arm_left: "arms_left",
  elbow_left: "elbow_left",
  hip_left: "legs_left",
  elbow_right: "elbow_right",
  // the mid-axillary line: from in front of the hanging arm on that side
  lung_lat_l: "chest_left",
  lung_lat_r: "chest_right",
  upper_arm_left: "arms_left",
  biceps_tendon_left: "arms_left",
  triceps_tendon_right: "elbow_right",
  // the vertex (Weber): from above
  scalp: "head_top",
  eye_left: "face",
  eye_right: "face",
  nose: "face",
  mouth: "face",
  face: "face",
};

/** The focus shot for a region group (whole-patient and neuro panels stay on the current shot). */
export function focusShotFor(group: RegionGroup, regionId?: string): ShotId | null {
  if (regionId && REGION_SHOT[regionId]) return REGION_SHOT[regionId]!;
  return group === "whole" || group === "neuro" ? null : group;
}

/** positions in which the patient lies back on the table (the back is out of reach) */
const BACK_ON_TABLE: readonly Position[] = ["supine", "reclined_30", "reclined_45"];
/** positions in which the legs lie along the table (the back of the ankle rests on it) */
const LEGS_ON_TABLE: readonly Position[] = ["supine", "reclined_30", "reclined_45", "seated", "seated_leaning_forward"];

/** A hint when a shot shows a part the patient is lying on (it can't be examined in this position). */
export function shotHint(id: ShotId, position: Position): string | null {
  if ((id === "chest_back" || id === "neck_back") && BACK_ON_TABLE.includes(position))
    return "The back is against the table. Ask the patient to sit up or lean forward to examine it.";
  // sitting back against the raised head of the table: the student asks the patient to lean forward
  if (id === "chest_back" && position === "seated") return "The back rests on the raised head of the table. Ask the patient to lean forward to examine it.";
  if (id === "ear_left" && position === "left_lateral_decubitus") return "The left ear is against the table. Ask the patient to sit up or turn to examine it.";
  if ((id === "ankle_left" || id === "ankle_right") && LEGS_ON_TABLE.includes(position))
    return "The back of the ankle rests on the table. Sit the patient with the legs dangling to examine it.";
  return null;
}

// ---------------------------------------------------------------- state machine (pure)
export interface ShotState {
  current: ShotId;
  /** where the camera came from (for returning after picking up a tool) */
  previous: ShotId | null;
}

export function canGo(from: ShotId, to: ShotId): boolean {
  return from === to || SHOTS[from].transitions.includes(to);
}

export function go(state: ShotState, to: ShotId): ShotState {
  if (!canGo(state.current, to) || state.current === to) return state;
  return { current: to, previous: state.current };
}

/** Back / Esc: to the parent shot (the corridor and the room overview have none). */
export function back(state: ShotState): ShotState {
  const parent = SHOTS[state.current].parent;
  return parent ? { current: parent, previous: state.current } : state;
}

/** Breadcrumb labels from the root to the current shot. */
export function breadcrumb(id: ShotId): string[] {
  const out: string[] = [];
  let cur: ShotId | null = id;
  while (cur) {
    out.unshift(SHOTS[cur].label);
    cur = SHOTS[cur].parent;
  }
  return out;
}

/** Tween duration: 0.6–1.2 s, longer for longer camera moves. */
export function tweenSeconds(fromPos: Vec3, toPos: Vec3): number {
  const d = Math.hypot(fromPos[0] - toPos[0], fromPos[1] - toPos[1], fromPos[2] - toPos[2]);
  return Math.min(1.2, Math.max(0.6, 0.55 + d * 0.3));
}

/** easeInOutCubic */
export function ease(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
