/**
 * Gown handles shared by the renderer (Drapes.tsx) and QA: where the gown's pull tabs and folded
 * edges sit for a pose. The leg sheet itself is built from the posed skin in sheetGeometry.ts.
 *
 * Phase 4 M3: the pull tabs used to sit on the xiphoid and the umbilicus, over the exam targets, and
 * took clicks meant for them; they now sit on the patient's right flank (anterior axillary line), and
 * the folded edges are drawn but never take a click (cover again with the tab or the encounter bar).
 */
import { Quaternion, Vector3 } from "three";
import { anchorWorldPoints, skinLandmark, type Pose, type Vec3 } from "@/exam3d/regionAnchors";
import type { SkinData } from "./sheetGeometry";

/** Bind-space points (model space, metres) on the right flank for the gown's pull tabs. */
export const TAB_BIND = {
  chest: [-0.165, 0.27, 0.07] as Vec3,
  abdomen: [-0.16, 0.1, 0.09] as Vec3,
};

/** Index of the skin vertex nearest a bind-space point. */
export function nearestVertex(skin: SkinData, p: Vec3): number {
  let best = -1;
  let bd = Infinity;
  for (let i = 0; i < skin.count; i++) {
    const d = (skin.bind[i * 3]! - p[0]) ** 2 + (skin.bind[i * 3 + 1]! - p[1]) ** 2 + (skin.bind[i * 3 + 2]! - p[2]) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

/** The patient's left, head-ward and forward directions in world space. */
export function bodyAxes(pose: Pose): { left: Vector3; up: Vector3; front: Vector3 } {
  const m = pose.world.get("spine03") ?? pose.world.get("root")!;
  return {
    left: new Vector3(1, 0, 0).transformDirection(m),
    up: new Vector3(0, 1, 0).transformDirection(m),
    front: new Vector3(0, 0, 1).transformDirection(m),
  };
}

const groinMid = (pose: Pose): Vec3 => {
  const r = anchorWorldPoints("groin_right", pose)[0]!;
  const l = anchorWorldPoints("groin_left", pose)[0]!;
  return [(r[0] + l[0]) / 2, (r[1] + l[1]) / 2, (r[2] + l[2]) / 2];
};

/** Where the folded gown edges sit when a section is uncovered (drawn only; they never take a click). */
export function gownRollFrames(pose: Pose): Record<"chest" | "abdomen" | "sternum", { pos: Vec3; q: Quaternion; len: number }> {
  const nr = skinLandmark("nipple_r", pose).point;
  const nl = skinLandmark("nipple_l", pose).point;
  const xiph = skinLandmark("xiphoid", pose);
  const notch = skinLandmark("sternal_notch", pose);
  const umb = skinLandmark("umbilicus", pose);
  const { up } = bodyAxes(pose);
  const across = new Vector3(nl[0] - nr[0], nl[1] - nr[1], nl[2] - nr[2]).normalize();
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), across);
  const at = (p: Vec3, n: Vec3, out: number): Vec3 => [p[0] + n[0] * out, p[1] + n[1] * out, p[2] + n[2] * out];
  const g = groinMid(pose);
  // the chest gown rolled down to the xiphoid line
  const sternumDir = new Vector3(notch.point[0] - xiph.point[0], notch.point[1] - xiph.point[1], notch.point[2] - xiph.point[2]);
  const sternumLen = sternumDir.length();
  const mid: Vec3 = [(notch.point[0] + xiph.point[0]) / 2, (notch.point[1] + xiph.point[1]) / 2, (notch.point[2] + xiph.point[2]) / 2];
  return {
    chest: { pos: at(xiph.point, xiph.normal, 0.018), q, len: 0.24 },
    // rolled down onto the top edge of the sheet (clear of the lower quadrants above it)
    abdomen: { pos: at([g[0] - up.x * 0.005, g[1] - up.y * 0.005, g[2] - up.z * 0.005], umb.normal, 0.02), q, len: 0.26 },
    // one side of the chest uncovered: the gown is gathered along the sternum
    sternum: { pos: at(mid, notch.normal, 0.014), q: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), sternumDir.normalize()), len: sternumLen * 0.9 },
  };
}
