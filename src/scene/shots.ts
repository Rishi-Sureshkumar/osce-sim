/**
 * Cinematic navigation: the camera moves between named shots, defined here as data.
 * Each shot has a camera framing, a parent (Back/Esc goes there), the shots it can move to,
 * and a small amount of free look (yaw and zoom only).
 *
 * Room shots are fixed in world space. Patient shots are framed on skin landmarks/anchors, so
 * they follow the patient's position (reclined, seated, left lateral…).
 */
import type { RegionGroup } from "@/domain/schemas";
import { anchorWorldNormals, anchorWorldPoints, skinLandmark, type Pose, type Vec3 } from "@/exam3d/regionAnchors";
import { DISPENSER_POS } from "./room/Dispenser";
import { TOOL_TABLE_POS, TOOL_TABLE_TOP } from "./room/ToolTable";
import { ROOM } from "./room/ExamRoom";

export type FocusShotId = Exclude<RegionGroup, "whole" | "neuro">;
export type ShotId = "corridor" | "overview" | "sink" | "tool_table" | "seated" | FocusShotId | "ear_left" | "ear_right";

type Framing =
  /** fixed camera in the room */
  | { kind: "fixed"; position: Vec3; target: Vec3 }
  /** framed on the patient: target = mean of landmark/anchor points, camera along their outward normal */
  | { kind: "patient"; on: { landmark?: string; anchor?: string }[]; normalFrom: { landmark?: string; anchor?: string }; distance: number; lift?: number; side?: number; normalBlendUp?: number };

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
const ROOM_SHOTS: ShotId[] = ["overview", "sink", "tool_table", "seated", ...FOCUS, "ear_left", "ear_right"];
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
    framing: { kind: "fixed", position: [DISPENSER_POS[0] + 1.1, 1.5, DISPENSER_POS[2] + 0.45], target: [DISPENSER_POS[0], 1.05, DISPENSER_POS[2] + 0.3] },
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
    framing: { kind: "fixed", position: [-1.05, 1.12, 0.65], target: [0, 1.0, -0.35] },
    fov: 45,
    freeLook: look(30, 0.85, 1.2),
    transitions: ROOM_SHOTS,
  },
  head_neck: {
    id: "head_neck",
    label: "Head & neck",
    parent: "overview",
    framing: { kind: "patient", on: [{ landmark: "vertex" }, { landmark: "sternal_notch" }], normalFrom: { landmark: "sternal_notch" }, distance: 0.62, lift: 0.12, side: 0.12 },
    fov: 40,
    freeLook: look(35, 0.7, 1.3),
    transitions: ROOM_SHOTS,
  },
  ear_left: {
    id: "ear_left",
    label: "Left ear",
    parent: "head_neck",
    framing: { kind: "patient", on: [{ landmark: "ear_canal_l" }, { landmark: "mastoid_l" }], normalFrom: { landmark: "ear_canal_l" }, distance: 0.5, lift: 0.05 },
    fov: 40,
    freeLook: look(30, 0.7, 1.3),
    transitions: ROOM_SHOTS,
  },
  ear_right: {
    id: "ear_right",
    label: "Right ear",
    parent: "head_neck",
    framing: { kind: "patient", on: [{ landmark: "ear_canal_r" }, { landmark: "mastoid_r" }], normalFrom: { landmark: "ear_canal_r" }, distance: 0.5, lift: 0.05 },
    fov: 40,
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
  if (f.kind === "fixed") return { position: f.position, target: f.target, fov: shot.fov };
  const pts = f.on.map((r) => pointOf(r, pose).point);
  const target: Vec3 = [0, 1, 2].map((k) => pts.reduce((s, p) => s + p[k]!, 0) / pts.length) as Vec3;
  let n = pointOf(f.normalFrom, pose).normal;
  if (f.normalBlendUp) n = norm(add(scaleV(n, 1 - f.normalBlendUp), [0, f.normalBlendUp, 0]));
  // never put the camera under the table: a surface facing down (the back of a lying patient) is viewed from above
  if (n[1] < -0.3) n = norm([n[0], 0.6, n[2] - 0.4]);
  let position = add(target, n, f.distance);
  if (f.lift) position = add(position, [0, 1, 0], f.lift);
  if (f.side) position = add(position, [-1, 0, 0], f.side); // lean toward the examiner's side (patient's right)
  return { position, target, fov: shot.fov };
}
function scaleV(a: Vec3, k: number): Vec3 {
  return [a[0] * k, a[1] * k, a[2] * k];
}

/** Regions with a closer shot of their own (the ears need a side view for the mastoid). */
const REGION_SHOT: Record<string, ShotId> = { ear_left: "ear_left", ear_right: "ear_right" };

/** The focus shot for a region group (whole-patient and neuro panels stay on the current shot). */
export function focusShotFor(group: RegionGroup, regionId?: string): ShotId | null {
  if (regionId && REGION_SHOT[regionId]) return REGION_SHOT[regionId]!;
  return group === "whole" || group === "neuro" ? null : group;
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
