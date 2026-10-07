/**
 * Exam-table dimensions shared by the renderer (ExamRoom) and the Node intersection check
 * (scripts/qa/intersections.ts). World frame: the table's long axis is Z (head toward −Z), the
 * head section hinges at z = TABLE.hingeZ at the patient's hips.
 */
import { TABLE } from "../rig";

export const TABLE_PARTS = {
  headLen: 0.85,
  footLen: 1.0,
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

/** Solid boxes of the table at a head-section angle (degrees from flat). */
export function tableBoxes(headAngleDeg: number): OrientedBox[] {
  const top = TABLE.topY;
  const { headLen, footLen, mattress, cabinet, step } = TABLE_PARTS;
  const a = (headAngleDeg * Math.PI) / 180;
  const hingeY = top - 0.06;
  // the head mattress box centre sits headLen/2 toward −Z from the hinge, rotated up by `a`
  const headCenter: [number, number, number] = [TABLE.x, hingeY + Math.sin(a) * (headLen / 2), TABLE.hingeZ - Math.cos(a) * (headLen / 2)];
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
