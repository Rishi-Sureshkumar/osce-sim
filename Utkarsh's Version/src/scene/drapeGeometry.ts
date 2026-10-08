/**
 * Drape geometry shared by the renderer (Drapes.tsx) and the Node intersection check
 * (scripts/qa/intersections.ts): the leg sheet is an open cylinder segment whose axis runs down the
 * middle of the legs; gown folds/rolls sit just off the skin at the xiphoid and umbilicus.
 */
import { Matrix4, Quaternion, Vector3 } from "three";
import { anchorWorldPoints, skinLandmark, type Pose, type Vec3 } from "@/exam3d/regionAnchors";

export const LEG_SHEET = { radius: 0.24, thetaStart: -Math.PI * 0.4, thetaLength: Math.PI * 0.8, segments: 24 } as const;

export interface CylinderFrame {
  mid: Vector3;
  q: Quaternion;
  len: number;
  up: Vector3;
}

/** Frame for a cylinder whose axis runs from a to b, with its +Z side facing `up`. */
export function frameBetween(a: Vec3, b: Vec3, up: Vec3): CylinderFrame {
  const va = new Vector3(...a);
  const vb = new Vector3(...b);
  const y = vb.clone().sub(va);
  const len = y.length();
  y.normalize();
  const z = new Vector3(...up).sub(y.clone().multiplyScalar(new Vector3(...up).dot(y))).normalize();
  const x = y.clone().cross(z).normalize();
  const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
  return { mid: va.add(vb).multiplyScalar(0.5), q, len, up: z };
}

/** The leg sheet's cylinder frame for a pose (the sheet is hidden in left lateral decubitus). */
export function legSheetFrame(pose: Pose): CylinderFrame {
  // the greater trochanters (the hip exam targets sit a little in front of them)
  const hip = skinLandmark("hip_r", pose).point;
  const hipL = skinLandmark("hip_l", pose).point;
  const ankle = anchorWorldPoints("ankle_right", pose)[0]!;
  const ankleL = anchorWorldPoints("ankle_left", pose)[0]!;
  // the sheet's axis runs down the middle of the legs, ~20 cm below the top of the arc
  const top: Vec3 = [(hip[0] + hipL[0]) / 2, Math.max(hip[1], hipL[1]) - 0.17, (hip[2] + hipL[2]) / 2];
  const bottom: Vec3 = [(ankle[0] + ankleL[0]) / 2, Math.max(ankle[1], ankleL[1]) - 0.16, (ankle[2] + ankleL[2]) / 2 + 0.12];
  return frameBetween(top, bottom, [0, 1, 0]);
}

const groinMid = (pose: Pose): Vec3 => {
  const r = anchorWorldPoints("groin_right", pose)[0]!;
  const l = anchorWorldPoints("groin_left", pose)[0]!;
  return [(r[0] + l[0]) / 2, (r[1] + l[1]) / 2, (r[2] + l[2]) / 2];
};
/** `p` moved `m` metres down the body (toward the feet). */
const below = (p: Vec3, pose: Pose, m: number): Vec3 => {
  const d = new Vector3(0, -1, 0).transformDirection(pose.world.get("root")!);
  return [p[0] + d.x * m, p[1] + d.y * m, p[2] + d.z * m];
};

/** Where the gown's fold tabs / rolled edges sit for the chest and abdomen. */
export function gownRollFrames(pose: Pose): Record<"chest" | "abdomen", { pos: Vec3; q: Quaternion }> {
  const nr = skinLandmark("nipple_r", pose).point;
  const nl = skinLandmark("nipple_l", pose).point;
  const xiph = skinLandmark("xiphoid", pose);
  const umb = skinLandmark("umbilicus", pose);
  const across = new Vector3(nl[0] - nr[0], nl[1] - nr[1], nl[2] - nr[2]).normalize();
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), across);
  const at = (p: Vec3, n: Vec3, out: number): Vec3 => [p[0] + n[0] * out, p[1] + n[1] * out, p[2] + n[2] * out];
  return {
    chest: { pos: at(xiph.point, xiph.normal, 0.035), q },
    // rolled down to the top of the thighs, clear of the groin (femoral pulses)
    abdomen: { pos: at(below(groinMid(pose), pose, 0.06), umb.normal, 0.03), q },
  };
}

/**
 * Signed distance of a world point from the leg sheet's inner surface: > 0 means the point is
 * outside the cylinder (poking through the sheet) within the sheet's angular span and length.
 * Returns null when the point is outside the sheet's span (not covered by it).
 */
export function legSheetPenetration(p: readonly number[], f: CylinderFrame): number | null {
  const local = new Vector3(p[0]!, p[1]!, p[2]!).sub(f.mid).applyQuaternion(f.q.clone().invert());
  if (Math.abs(local.y) > f.len / 2) return null;
  // three's CylinderGeometry: theta measured from +Z toward +X
  const theta = Math.atan2(local.x, local.z);
  if (theta < LEG_SHEET.thetaStart || theta > LEG_SHEET.thetaStart + LEG_SHEET.thetaLength) return null;
  return Math.hypot(local.x, local.z) - LEG_SHEET.radius;
}
