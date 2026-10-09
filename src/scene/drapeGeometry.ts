/**
 * Gown handles shared by the renderer (Drapes.tsx) and QA: where the gown's pull tabs and folded
 * edges sit for a pose. The leg sheet itself is built from the posed skin in sheetGeometry.ts.
 *
 * Phase 4 M3: the pull tabs used to sit on the xiphoid and the umbilicus, over the exam targets, and
 * took clicks meant for them; they now sit on the patient's right flank (anterior axillary line), and
 * the folded edges are drawn but never take a click (cover again with the tab or the encounter bar).
 */
import { Quaternion, Vector3 } from "three";
import { anchorWorldNormals, anchorWorldPoints, skinLandmark, type Pose, type Vec3 } from "@/exam3d/regionAnchors";
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

/** The patient's left, head-ward and forward directions in world space (of the chest, or another bone). */
export function bodyAxes(pose: Pose, bone = "spine03"): { left: Vector3; up: Vector3; front: Vector3 } {
  const m = pose.world.get(bone) ?? pose.world.get("root")!;
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

/**
 * A folded gown edge lying on the body (V-ROD: straight capsules floated over the curved trunk): the
 * outermost skin points where a plane cuts the front of the body, binned every 2 cm along `across`
 * within ±half of the plane's point, smoothed and lifted off the skin by `lift`.
 */
export function surfaceLine(
  world: Float32Array,
  point: Vec3,
  normal: Vector3,
  across: Vector3,
  front: Vector3,
  half: number,
  lift: number,
  normalOf?: (i: number) => Vector3 | null,
  clear?: Float32Array,
): Vec3[] {
  const BIN = 0.02;
  const nb = Math.max(2, Math.round((2 * half) / BIN));
  const best: (Vec3 | null)[] = new Array(nb).fill(null);
  const depth: number[] = new Array(nb).fill(-Infinity);
  for (let i = 0; i < world.length / 3; i++) {
    const x = world[i * 3]!;
    if (Number.isNaN(x)) continue;
    const d0 = x - point[0];
    const d1 = world[i * 3 + 1]! - point[1];
    const d2 = world[i * 3 + 2]! - point[2];
    if (Math.abs(d0 * normal.x + d1 * normal.y + d2 * normal.z) > 0.012) continue;
    const a = d0 * across.x + d1 * across.y + d2 * across.z;
    if (Math.abs(a) >= half) continue;
    const f = d0 * front.x + d1 * front.y + d2 * front.z;
    if (f < -0.06) continue; // the front of the body only
    const b = Math.min(nb - 1, Math.floor((a + half) / BIN));
    if (f > depth[b]!) {
      depth[b] = f;
      best[b] = [x, world[i * 3 + 1]!, world[i * 3 + 2]!];
    }
  }
  let pts = best.filter((q): q is Vec3 => !!q);
  for (let pass = 0; pass < 2; pass++)
    pts = pts.map((q, i) => {
      const a = pts[Math.max(0, i - 1)]!;
      const c = pts[Math.min(pts.length - 1, i + 1)]!;
      return [(a[0] + 2 * q[0] + c[0]) / 4, (a[1] + 2 * q[1] + c[1]) / 4, (a[2] + 2 * q[2] + c[2]) / 4] as Vec3;
    });
  // back onto the skin after smoothing (across a crease the average can float), then lift off it
  return pts.map((q) => {
    let bi = -1;
    let bd = Infinity;
    for (let i = 0; i < world.length / 3; i++) {
      const x = world[i * 3]!;
      if (Number.isNaN(x)) continue;
      const d = (x - q[0]) ** 2 + (world[i * 3 + 1]! - q[1]) ** 2 + (world[i * 3 + 2]! - q[2]) ** 2;
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    const v: Vec3 = bi < 0 ? q : [world[bi * 3]!, world[bi * 3 + 1]!, world[bi * 3 + 2]!];
    // along the skin's normal where known (out of a crease, not into the fold above it), else forward
    const n = (bi >= 0 && normalOf?.(bi)) || front;
    return [v[0] + n.x * lift, v[1] + n.y * lift, v[2] + n.z * lift] as Vec3;
  }).filter((p) => {
    // keep clear of other skin (an arm lying against the trunk)
    if (!clear) return true;
    for (let i = 0; i < clear.length / 3; i++) if ((clear[i * 3]! - p[0]) ** 2 + (clear[i * 3 + 1]! - p[1]) ** 2 + (clear[i * 3 + 2]! - p[2]) ** 2 < (lift * 0.5) ** 2) return false;
    return true;
  });
}

/** Skin vertices of the trunk (not the arms or hands), for the folded edges to lie on. */
export function trunkMask(skin: SkinData): Uint8Array {
  const out = new Uint8Array(skin.count);
  for (let i = 0; i < skin.count; i++) {
    let best = 0;
    let bone = "";
    for (let k = 0; k < 4; k++)
      if (skin.weights[i * 4 + k]! > best) {
        best = skin.weights[i * 4 + k]!;
        bone = skin.jointNames[skin.joints[i * 4 + k]!]!;
      }
    out[i] = /^(upperarm|lowerarm|wrist|hand|finger|metacarpal|thumb)/.test(bone) ? 0 : 1;
  }
  return out;
}

/** The folded gown edges as lines on the skin (see gownRollFrames for where each one lies); `world` is the posed trunk skin. */
export function gownRollLines(
  pose: Pose,
  world: Float32Array,
  normalOf?: (i: number) => Vector3 | null,
  clear?: Float32Array,
): Record<"chest" | "abdomen" | "sternum", Vec3[]> {
  const f = gownRollFrames(pose);
  const { up, left, front } = bodyAxes(pose);
  const notch = skinLandmark("sternal_notch", pose).point;
  const xiph = skinLandmark("xiphoid", pose).point;
  const along = new Vector3(notch[0] - xiph[0], notch[1] - xiph[1], notch[2] - xiph[2]);
  const len = along.length();
  along.normalize();
  const mid: Vec3 = [(notch[0] + xiph[0]) / 2, (notch[1] + xiph[1]) / 2, (notch[2] + xiph[2]) / 2];
  // the frames' points are lifted off the skin: step back onto the plane through the skin point
  const base = (p: Vec3, lift: number): Vec3 => [p[0] - front.x * lift, p[1] - front.y * lift, p[2] - front.z * lift];
  const LIFT = 0.02; // gown offset + the roll's radius
  return {
    chest: surfaceLine(world, base(f.chest.pos, 0.02), up, left, front, 0.13, LIFT, normalOf, clear),
    // the abdomen gown pulled up to the chest panel's edge, just below the xiphoid line: at the groin it lay
    // over the femoral pulse points (4 cm below the lower quadrants: nothing fits between them); here it
    // keeps 2.5 cm from the breasts above and 3.5 cm from the epigastrium below
    abdomen: surfaceLine(world, [xiph[0] - up.x * 0.012, xiph[1] - up.y * 0.012, xiph[2] - up.z * 0.012], up, left, front, 0.13, LIFT, normalOf, clear),
    sternum: surfaceLine(world, mid, left, along, front, len * 0.45, LIFT * 0.85, normalOf, clear),
  };
}

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
  const sternumDir = new Vector3(notch.point[0] - xiph.point[0], notch.point[1] - xiph.point[1], notch.point[2] - xiph.point[2]);
  const sternumLen = sternumDir.length();
  const mid: Vec3 = [(notch.point[0] + xiph.point[0]) / 2, (notch.point[1] + xiph.point[1]) / 2, (notch.point[2] + xiph.point[2]) / 2];
  // below the costal margin, on the abdomen panel: at the xiphoid line it lay across the lower anterior
  // lung zones (lung_ant_rl/ll) and took clicks meant for them
  // (the epigastric target is on the skin; it is under the abdomen panel whenever this roll is drawn)
  const low = anchorWorldPoints("abd_epigastric", pose)[0]!;
  const lowN = anchorWorldNormals("abd_epigastric", pose)[0]!;
  return {
    chest: { pos: at(low, lowN, 0.02), q, len: 0.24 },
    // rolled down onto the top edge of the sheet (clear of the lower quadrants above it)
    abdomen: { pos: at([g[0] - up.x * 0.005, g[1] - up.y * 0.005, g[2] - up.z * 0.005], umb.normal, 0.02), q, len: 0.26 },
    // one side of the chest uncovered: the gown is gathered along the sternum
    sternum: { pos: at(mid, notch.normal, 0.014), q: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), sternumDir.normalize()), len: sternumLen * 0.9 },
  };
}
