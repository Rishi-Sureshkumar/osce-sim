/**
 * Exam-table dimensions shared by the renderer (ExamRoom) and the Node intersection check
 * (scripts/qa/intersections.ts). World frame: the table's long axis is Z (head toward −Z), the
 * head section hinges at z = TABLE.hingeZ at the patient's hips.
 */
import { TABLE, type VariantId } from "../rig";

export const TABLE_PARTS = {
  headLen: 0.85,
  footLen: TABLE.footLen,
  mattress: 0.12,
  cabinet: { width: 0.56, depth: 1.4, z: 0.15 },
  step: { width: 0.5, height: 0.06, depth: 0.3, y: 0.16 },
} as const;

export interface OrientedBox {
  name: string;
  /** centre, world metres */
  center: [number, number, number];
  /** full size along the box's local x, y, z */
  size: [number, number, number];
  /** rotation about the world X axis (radians), applied about `center` */
  rotX: number;
}

/**
 * The table's head-section angle for a patient position (degrees from flat): lying and side-lying
 * flat, dangling at the foot end flat, sitting up against the raised backrest at 50°; reclined
 * positions follow the trunk.
 */
export function tableAngle(position: string, bedAngle: number): number {
  if (position === "left_lateral_decubitus" || position === "prone" || position === "sitting_dangling") return 0;
  if (position === "seated" || position === "seated_leaning_forward" || position === "standing") return 50;
  return bedAngle;
}

/**
 * Where the head section pivots, relative to its hinge line (y = top − 6 cm, z = hingeZ). The patient's
 * trunk bends about the lumbar spine, well above and behind the table's hinge, so a backrest raised
 * about the hinge swings 7–11 cm into the patient's back (V-BACKREST). Pivoting it here keeps the
 * backrest under the back as it rises; fitted per body model (.cache/lab/pivot.ts, Phase 4 M3).
 */
export const HEAD_PIVOT: Record<VariantId, { dy: number; dz: number }> = {
  male: { dy: 0.02, dz: -0.14 },
  female: { dy: 0, dz: -0.095 },
};

/** Solid boxes of the table at a head-section angle (degrees from flat). */
export function tableBoxes(headAngleDeg: number, variant: VariantId = "male"): OrientedBox[] {
  const top = TABLE.topY;
  const { headLen, footLen, mattress, cabinet, step } = TABLE_PARTS;
  const a = (headAngleDeg * Math.PI) / 180;
  const hingeY = top - 0.06;
  // the head mattress box centre sits headLen/2 toward −Z from the hinge at rest, rotated up by `a` about the pivot
  const { dy, dz } = HEAD_PIVOT[variant];
  const py = hingeY + dy;
  const pz = TABLE.hingeZ + dz;
  const ry = hingeY - py;
  const rz = TABLE.hingeZ - headLen / 2 - pz;
  const headCenter: [number, number, number] = [TABLE.x, py + ry * Math.cos(a) - rz * Math.sin(a), pz + ry * Math.sin(a) + rz * Math.cos(a)];
  return [
    { name: "cabinet", center: [TABLE.x, (top - 0.12) / 2, TABLE.hingeZ + cabinet.z], size: [cabinet.width, top - 0.12, cabinet.depth], rotX: 0 },
    { name: "foot-mattress", center: [TABLE.x, hingeY, TABLE.hingeZ + footLen / 2], size: [TABLE.width, mattress, footLen], rotX: 0 },
    { name: "head-mattress", center: headCenter, size: [TABLE.width, mattress, headLen], rotX: a },
    { name: "step", center: [TABLE.x, step.y, TABLE.hingeZ + footLen + 0.18], size: [step.width, step.height, step.depth], rotX: 0 },
  ];
}

/** Is a world point inside an oriented box (with `slack` metres of tolerance)? */
export function insideBox(p: readonly number[], b: OrientedBox, slack = 0): boolean {
  const dx = p[0]! - b.center[0];
  const dy = p[1]! - b.center[1];
  const dz = p[2]! - b.center[2];
  // rotate the offset into the box frame (inverse rotation about X)
  const c = Math.cos(-b.rotX);
  const s = Math.sin(-b.rotX);
  const ly = dy * c - dz * s;
  const lz = dy * s + dz * c;
  return Math.abs(dx) < b.size[0] / 2 - slack && Math.abs(ly) < b.size[1] / 2 - slack && Math.abs(lz) < b.size[2] / 2 - slack;
}
