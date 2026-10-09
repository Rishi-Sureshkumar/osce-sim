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
 * Elbow angle (degrees, −X flexes) as the trunk comes up: straight on the mattress lying flat, then
 * bending so the forearms rest on the lap ~2 cm above the thighs (on the gown and sheet) instead of
 * sinking into them — fitted at 30°, 45° and 80° (Phase 4 M3 lab).
 */
const ELBOW_KNOTS: Record<VariantId, [number, number][]> = {
  male: [
    [0, 32],
    [0.2, 4],
    [0.5, -21],
    [1, -55],
  ],
  female: [
    [0, 32],
    [0.2, 6],
    [0.5, -19],
    [1, -60],
  ],
};
function elbowForLap(lap: number, variant: VariantId): number {
  const k = ELBOW_KNOTS[variant];
  for (let i = 1; i < k.length; i++) {
    const [x1, y1] = k[i]!;
    const [x0, y0] = k[i - 1]!;
    if (lap <= x1) return y0 + ((lap - x0) / (x1 - x0)) * (y1 - y0);
  }
  return k[k.length - 1]![1];
}

/**
 * Shoulder extension, wrist angle and arm-to-body angle (degrees) that lay each body's arms on the mattress
 * when flat, the hands beside the gown (lab-fitted); sitting up the arms come in to 38° and turn inward
 * so the forearms lie on the thighs (clear of the lateral hip).
 */
const ARM_REST: Record<VariantId, { shoulder: number; wrist: number; abduct: number; inward: number }> = {
  male: { shoulder: 19, wrist: -10, abduct: 30, inward: 46 },
  female: { shoulder: 16, wrist: -14, abduct: 24, inward: 40 },
};

/** Arms resting on the lap, per sitting position and body: shoulder [flex, inward turn, adduction], elbow, wrist (degrees). */
const LAP_ARMS: Record<"seated_leaning_forward" | "sitting_dangling", Record<VariantId, { shoulder: [number, number, number]; elbow: number; wrist: number }>> = {
  seated_leaning_forward: {
    male: { shoulder: [-25, 20, 38], elbow: -45, wrist: 20 },
    female: { shoulder: [-15, 20, 30], elbow: -45, wrist: 20 },
  },
  sitting_dangling: {
    male: { shoulder: [5, 30, 34], elbow: -55, wrist: 10 },
    female: { shoulder: [5, 20, 38], elbow: -55, wrist: 20 },
  },
};

/** Left lateral decubitus per body: lumbar side bend per bone (degrees) and the lower arm's abduction. */
const LLD_POSE: Record<VariantId, { bend: number; armZ: number }> = {
  male: { bend: 2.5, armZ: -23 },
  female: { bend: 1.8, armZ: -25 },
};

/**
 * Local bone rotations for a position. Trunk elevation is spread over the lumbar spine (the
 * hinge is at the hips); arms rest at the sides and the legs lie together.
 */
export function poseRotations(position: Position, bedAngleDeg: number, variant: VariantId = "male"): BoneRotations {
  const a = bedAngleDeg * DEG;
  const arm = ARM_REST[variant];
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
    // Lying flat the arms rest on the mattress (V-ARMS): the bind pose has the elbows and wrists bent,
    // so the shoulder extends and the elbow and wrist straighten until the arm lies on the table, a
    // little away from the body so the hands lie beside the gown, not under its side panel.
    "upperarm01_L": [arm.shoulder * (1 - lap) * DEG, -arm.inward * lap * DEG, -(arm.abduct + (38 - arm.abduct) * lap) * DEG],
    "upperarm01_R": [arm.shoulder * (1 - lap) * DEG, arm.inward * lap * DEG, (arm.abduct + (38 - arm.abduct) * lap) * DEG],
    "lowerarm01_L": [elbowForLap(lap, variant) * DEG, 0, 0],
    "lowerarm01_R": [elbowForLap(lap, variant) * DEG, 0, 0],
    wrist_L: [arm.wrist * (1 - lap) * DEG, 0, 0],
    wrist_R: [arm.wrist * (1 - lap) * DEG, 0, 0],
    // legs together
    "upperleg01_L": [0, 0, -3.5 * DEG],
    "upperleg01_R": [0, 0, 3.5 * DEG],
  };
  if (position === "seated_leaning_forward") {
    r.spine03 = [a * 0.15 + 18 * DEG, 0, 0];
    r.spine02 = [10 * DEG, 0, 0];
  }
  // leaning in (the upper arms come forward so the forearms clear the belly) or sitting on the end of the
  // table: the hands rest on the lap instead of sinking into the thighs (Phase 4 M3 lab fit)
  const lapArm = position === "seated_leaning_forward" || position === "sitting_dangling" ? LAP_ARMS[position][variant] : null;
  if (lapArm) {
    const [sx, sy, sz] = lapArm.shoulder;
    r["upperarm01_L"] = [sx * DEG, -sy * DEG, -sz * DEG];
    r["upperarm01_R"] = [sx * DEG, sy * DEG, sz * DEG];
    r["lowerarm01_L"] = [lapArm.elbow * DEG, 0, 0];
    r["lowerarm01_R"] = [lapArm.elbow * DEG, 0, 0];
    r.wrist_L = [lapArm.wrist * DEG, 0, 0];
    r.wrist_R = [lapArm.wrist * DEG, 0, 0];
  }
  if (position === "left_lateral_decubitus") {
    // knees and hips bent (for a limb hanging from its joint, −X flexes the hip and shoulder and +X
    // flexes the knee; Phase 3 had these signs reversed, so the hips and shoulders were extended and
    // the knees hyperextended)
    r["upperleg01_L"] = [-35 * DEG, 0, -3 * DEG];
    r["upperleg01_R"] = [-45 * DEG, 0, 6 * DEG];
    r["lowerleg01_L"] = [55 * DEG, 0, 0];
    r["lowerleg01_R"] = [65 * DEG, 0, 0];
    // Phase 4 M3 (V-LLD): the waist sags toward the mattress so the patient rests on the lower shoulder
    // and hip (the shoulder sank 6–10 cm into the mattress before); the head tips onto the side pillow.
    const lld = LLD_POSE[variant];
    for (const b of ["spine05", "spine04", "spine03"]) r[b] = [0, 0, lld.bend * DEG];
    r.neck01 = [12 * DEG, 0, -8 * DEG];
    r.neck02 = [0, 0, -8 * DEG];
    // lower (left) arm forward on the mattress, the forearm in front of the face (clear of the apex and
    // on the table); upper (right) arm along the flank with the hand on the hip — fitted with a two-bone
    // IK to world targets (Phase 4 M3 lab), instead of the Phase 3 arm flung up in the air
    r["upperarm01_L"] = [-99 * DEG, -25 * DEG, lld.armZ * DEG];
    r["lowerarm01_L"] = [-49 * DEG, 0, 0];
    r.wrist_L = [0, 0, 0];
    r["upperarm01_R"] = [-14.5 * DEG, -2 * DEG, 43.3 * DEG];
    r["lowerarm01_R"] = [13 * DEG, 0, 0];
    r.wrist_R = [-10 * DEG, 0, 0];
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

/**
 * Height of the pelvis bone above the mattress top when lying on it: the older male's rounded upper back
 * (kyphosis) sank 2.3 cm into the head mattress at the female's lift (bed intersections, Phase 4 M3).
 */
const REST_LIFT: Record<VariantId, number> = { male: 0.025, female: 0.016 };

/** World transform of the patient's root (pelvis) for a position: lying on the table, head toward −Z. */
export function placement(position: Position, variant: VariantId = "male"): Matrix4 {
  // standing bind pose → lying supine: body +Y (head) → world −Z, body front (+Z) → world +Y
  const lie = new Matrix4().makeRotationX(-Math.PI / 2);
  // sitting with the legs dangling: at the foot end, the knees past the edge so the calves hang clear of the
  // mattress (they sank 3.5 cm into its end at +4 cm); the trunk is raised by the spine
  const z = position === "sitting_dangling" ? TABLE.hingeZ + TABLE.footLen - thighLength(variant) + 0.085 : TABLE.hingeZ;
  let m = new Matrix4().makeTranslation(TABLE.x, TABLE.topY + REST_LIFT[variant], z).multiply(lie);
  if (position === "left_lateral_decubitus") {
    // roll onto the left side about the table's long axis, lifted by the half-width of the trunk
    const roll = new Matrix4().makeRotationZ(-78 * DEG);
    // back toward the far edge so the arm in front has room on the table (it hung off the edge)
    m = new Matrix4().makeTranslation(TABLE.x - 0.1, TABLE.topY + 0.155, TABLE.hingeZ).multiply(roll).multiply(lie);
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
  const rotations = poseRotations(position, bedAngle, variant);
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
