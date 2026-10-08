/**
 * Pure pose maths for the patient rig (no React, no WebGL), shared by the 3D scene, the hidden
 * exam anchors, the camera shots and the unit tests.
 *
 * The GLB's bones have identity rest rotation, so a pose is just a local rotation per bone and
 * forward kinematics is: world(bone) = placement · Π(T(head − parentHead) · R(bone)).
 * The scene applies exactly the same rotations to the GLB bones, so these matrices match what
 * is drawn.
 */
import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { Position } from "@/domain/schemas";
import { PATIENT_VARIANTS, type PatientVariant, type RigBone } from "./patientRig.generated";

export type Vec3 = [number, number, number];
export type VariantId = keyof typeof PATIENT_VARIANTS;

/** Exam table geometry (world metres). The table's long axis is Z; the head end is toward −Z. */
export const TABLE = {
  /** top surface of the mattress */
  topY: 0.78,
  /** where the head section hinges (patient's hip level), on the long axis */
  hingeZ: 0,
  length: 1.9,
  /** foot section length from the hinge (its end is where a patient sits with the legs dangling) */
  footLen: 1.0,
  width: 0.7,
  /** world X of the table centre line */
  x: 0,
};

type Rot = [number, number, number]; // XYZ Euler, radians, in the bone's local (body-aligned) frame
export type BoneRotations = Record<string, Rot>;
const DEG = Math.PI / 180;

/**
 * Local bone rotations for a position. Trunk elevation is spread over the lumbar spine (the
 * hinge is at the hips); arms rest at the sides and the legs lie together.
 */
export function poseRotations(position: Position, bedAngleDeg: number): BoneRotations {
  const a = bedAngleDeg * DEG;
  // 0 lying flat, 1 sitting up (≥ 80°): reclined, the forearms already rest partly on the thighs
  // (hanging by the sides of a reclined trunk, the hands slid under the thighs out of sight — V-HANDS)
  const t = Math.min(1, Math.max(0, (bedAngleDeg - 10) / 70));
  const lap = t * t * (3 - 2 * t);
  const r: BoneRotations = {
    // trunk flexion relative to the lying body (raises the torso off the table)
    spine05: [a * 0.55, 0, 0],
    spine04: [a * 0.3, 0, 0],
    spine03: [a * 0.15, 0, 0],
    // keep the face looking forward-ish: a pillow when flat, upright when seated
    neck01: [position === "supine" || a < 20 ? 12 * DEG : -a * 0.08, 0, 0],
    // arms by the sides; as the trunk comes up the forearms come to rest on the thighs (seated,
    // hands by the hips are hidden behind the thighs). For a hanging limb −X is flexion; +Y on the
    // right upper arm (−Y on the left) turns it inward so the forearm lies across the thigh.
    "upperarm01_L": [6 * (1 - lap) * DEG, -40 * lap * DEG, -38 * DEG],
    "upperarm01_R": [6 * (1 - lap) * DEG, 40 * lap * DEG, 38 * DEG],
    "lowerarm01_L": [(18 - 63 * lap) * DEG, 0, 0],
    "lowerarm01_R": [(18 - 63 * lap) * DEG, 0, 0],
    // legs together
    "upperleg01_L": [0, 0, -3.5 * DEG],
    "upperleg01_R": [0, 0, 3.5 * DEG],
  };
  if (position === "seated_leaning_forward") {
    r.spine03 = [a * 0.15 + 18 * DEG, 0, 0];
    r.spine02 = [10 * DEG, 0, 0];
    // leaning in, the upper arms come forward so the forearms clear the belly
    r["upperarm01_L"] = [-15 * DEG, -35 * DEG, -38 * DEG];
    r["upperarm01_R"] = [-15 * DEG, 35 * DEG, 38 * DEG];
  }
  if (position === "left_lateral_decubitus") {
    // knees and hips bent, both arms in front of the body (for a limb hanging from its joint, −X
    // flexes the hip and shoulder and +X flexes the knee; Phase 3 had these signs reversed, so the
    // hips and shoulders were extended and the knees hyperextended)
    r["upperleg01_L"] = [-35 * DEG, 0, -3 * DEG];
    r["upperleg01_R"] = [-45 * DEG, 0, 6 * DEG];
    r["lowerleg01_L"] = [55 * DEG, 0, 0];
    r["lowerleg01_R"] = [65 * DEG, 0, 0];
    r["upperarm01_R"] = [-55 * DEG, 0, 20 * DEG];
    r["upperarm01_L"] = [-70 * DEG, 0, -10 * DEG];
  }
  if (position === "sitting_dangling") {
    // sitting upright at the foot end of the table, knees over the edge, shanks hanging (knee flexion +X)
    r["lowerleg01_L"] = [90 * DEG, 0, 0];
    r["lowerleg01_R"] = [90 * DEG, 0, 0];
  }
  return r;
}

/** Hip-to-knee length of a body model (metres), from its rig. */
function thighLength(variant: VariantId): number {
  const { heads } = rigOf(variant);
  return heads.get("upperleg01_L")!.distanceTo(heads.get("lowerleg01_L")!);
}

/** World transform of the patient's root (pelvis) for a position: lying on the table, head toward −Z. */
export function placement(position: Position, variant: VariantId = "male"): Matrix4 {
  // standing bind pose → lying supine: body +Y (head) → world −Z, body front (+Z) → world +Y
  const lie = new Matrix4().makeRotationX(-Math.PI / 2);
  // sitting with the legs dangling: at the foot end, the knees just past the edge (the trunk is raised by the spine)
  const z = position === "sitting_dangling" ? TABLE.hingeZ + TABLE.footLen - thighLength(variant) + 0.04 : TABLE.hingeZ;
  let m = new Matrix4().makeTranslation(TABLE.x, TABLE.topY + 0.012, z).multiply(lie);
  if (position === "left_lateral_decubitus") {
    // roll onto the left side about the table's long axis, lifted by the half-width of the trunk
    const roll = new Matrix4().makeRotationZ(-78 * DEG);
    m = new Matrix4().makeTranslation(TABLE.x - 0.02, TABLE.topY + 0.17, TABLE.hingeZ).multiply(roll).multiply(lie);
  }
  if (position === "prone") {
    const flip = new Matrix4().makeRotationZ(Math.PI);
    m = new Matrix4().makeTranslation(TABLE.x, TABLE.topY + 0.22, TABLE.hingeZ).multiply(flip).multiply(lie);
  }
  return m;
}

export interface Pose {
  variant: VariantId;
  position: Position;
  bedAngle: number;
  rotations: BoneRotations;
  /** world matrices per bone (placement included) */
  world: Map<string, Matrix4>;
  /** bind-pose head per bone (model space) */
  heads: Map<string, Vector3>;
}

const rigCache = new Map<VariantId, { bones: RigBone[]; heads: Map<string, Vector3> }>();
function rigOf(variant: VariantId) {
  let r = rigCache.get(variant);
  if (!r) {
    const v: PatientVariant = PATIENT_VARIANTS[variant];
    r = { bones: v.rig, heads: new Map(v.rig.map((b) => [b.name, new Vector3(...b.head)])) };
    rigCache.set(variant, r);
  }
  return r;
}

/** Forward kinematics with optional extra rotations layered on top (breathing, head turn…). */
export function computePose(variant: VariantId, position: Position, bedAngle: number, extra: BoneRotations = {}): Pose {
  const { bones, heads } = rigOf(variant);
  const rotations = poseRotations(position, bedAngle);
  for (const [b, e] of Object.entries(extra)) {
    const base = rotations[b] ?? [0, 0, 0];
    rotations[b] = [base[0] + e[0], base[1] + e[1], base[2] + e[2]];
  }
  const world = new Map<string, Matrix4>();
  const root = placement(position, variant);
  for (const b of bones) {
    const head = heads.get(b.name)!;
    const parentHead = b.parent ? heads.get(b.parent)! : new Vector3();
    const local = new Matrix4().compose(head.clone().sub(parentHead), rotationOf(rotations[b.name]), new Vector3(1, 1, 1));
    const parentWorld = b.parent ? world.get(b.parent)! : root;
    world.set(b.name, parentWorld.clone().multiply(local));
  }
  return { variant, position, bedAngle, rotations, world, heads };
}

export function rotationOf(r?: Rot): Quaternion {
  return r ? new Quaternion().setFromEuler(new Euler(r[0], r[1], r[2], "XYZ")) : new Quaternion();
}

/** A bind-pose model-space point carried by `bone` → world. */
export function toWorld(point: Vec3, bone: string, pose: Pose): Vec3 {
  const m = pose.world.get(bone) ?? pose.world.get("root")!;
  const head = pose.heads.get(bone) ?? new Vector3();
  const v = new Vector3(point[0] - head.x, point[1] - head.y, point[2] - head.z).applyMatrix4(m);
  return [v.x, v.y, v.z];
}

/** A bind-pose direction (e.g. a surface normal) carried by `bone` → world. */
export function dirToWorld(dir: Vec3, bone: string, pose: Pose): Vec3 {
  const m = pose.world.get(bone) ?? pose.world.get("root")!;
  const v = new Vector3(...dir).transformDirection(m);
  return [v.x, v.y, v.z];
}

/** Bone weights of a skin vertex: [bone, weight] pairs (up to 4, summing to ~1). */
export type SkinWeights = readonly (readonly [string, number])[];

/**
 * A bind-pose skin point carried exactly like a skin vertex (Phase 4 M2 bug 5): the linear blend
 * of its bones, Σ wᵢ · Mᵢ · (p − headᵢ), as the GPU skins the visible surface. Without weights it
 * rides `bone` rigidly (the old behaviour).
 */
export function skinToWorld(point: Vec3, weights: SkinWeights | undefined, bone: string, pose: Pose): Vec3 {
  if (!weights?.length) return toWorld(point, bone, pose);
  let x = 0;
  let y = 0;
  let z = 0;
  let total = 0;
  for (const [b, w] of weights) {
    const p = toWorld(point, b, pose);
    x += p[0] * w;
    y += p[1] * w;
    z += p[2] * w;
    total += w;
  }
  return total > 0 ? [x / total, y / total, z / total] : toWorld(point, bone, pose);
}

/** A bind-pose direction blended the same way as `skinToWorld` (renormalised). */
export function skinDirToWorld(dir: Vec3, weights: SkinWeights | undefined, bone: string, pose: Pose): Vec3 {
  if (!weights?.length) return dirToWorld(dir, bone, pose);
  const v = new Vector3();
  for (const [b, w] of weights) v.addScaledVector(new Vector3(...dirToWorld(dir, b, pose)), w);
  if (v.lengthSq() < 1e-12) return dirToWorld(dir, bone, pose);
  v.normalize();
  return [v.x, v.y, v.z];
}

export function variantFor(sex: "female" | "male" | "intersex"): VariantId {
  return sex === "female" ? "female" : "male";
}

export function variantInfo(variant: VariantId): PatientVariant {
  return PATIENT_VARIANTS[variant];
}
