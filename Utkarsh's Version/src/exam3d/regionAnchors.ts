/**
 * Hidden exam anchors for the canonical regions (content/catalog/regions.json), on the rigged
 * patient. The 3D view never invents region ids: every anchor maps to one of these, and a hit
 * emits the same `examine` Action as the Examine… menu.
 *
 * Anchors are defined clinically in src/exam3d/anchorDefs.ts (landmark + offset in cm, tolerance
 * in cm) and projected onto the skin by the asset build (src/scene/patientRig.generated.ts).
 * Each point carries its skin vertex's bone weights and is skinned like the visible surface, so it
 * stays on the skin in every pose (reclined, seated, dangling, left lateral…).
 * tests/regionAnchors.test.ts keeps this in sync with regions.json.
 */
import type { Position } from "@/domain/schemas";
import { ANCHOR_DEFS, type AnchorDef } from "./anchorDefs";
import { PATIENT_VARIANTS } from "@/scene/patientRig.generated";
import { computePose, skinDirToWorld, skinToWorld, type BoneRotations, type Pose, type SkinWeights, type VariantId, type Vec3 } from "@/scene/rig";

export type { Pose, Vec3 } from "@/scene/rig";

export interface RegionAnchor {
  regionId: string;
  /** bind-pose skin points (one per side for unsided groups such as lymph nodes) */
  points: Vec3[];
  normals: Vec3[];
  bones: string[];
  /** per point: the snapped skin vertex's bone weights (skinned like the surface) */
  weights: SkinWeights[];
  /** a finding is recorded within this distance */
  toleranceCm: number;
  /** collider / hit radius in metres (= tolerance) */
  radius: number;
  /** practice-mode anatomical label */
  label?: string;
}

const DEF_BY_REGION = new Map<string, AnchorDef>(ANCHOR_DEFS.map((d) => [d.regionId, d]));

const cache = new Map<VariantId, RegionAnchor[]>();
export function anchorsFor(variant: VariantId = "male"): RegionAnchor[] {
  let list = cache.get(variant);
  if (!list) {
    list = PATIENT_VARIANTS[variant].anchors.map((g) => {
      const def = DEF_BY_REGION.get(g.regionId)!;
      return { regionId: g.regionId, points: g.points, normals: g.normals, bones: g.bones, weights: g.weights, toleranceCm: def.toleranceCm, radius: def.toleranceCm / 100, ...(def.label ? { label: def.label } : {}) };
    });
    cache.set(variant, list);
  }
  return list;
}

/** Default-variant lookup (tolerances and ids are the same for every variant). */
export const REGION_ANCHORS = anchorsFor("male");
export const ANCHOR_BY_REGION = new Map(REGION_ANCHORS.map((x) => [x.regionId, x]));
export function anchorFor(regionId: string, variant: VariantId = "male"): RegionAnchor | undefined {
  return anchorsFor(variant).find((a) => a.regionId === regionId);
}

/** World positions of a region's anchor point(s) in a pose. */
export function anchorWorldPoints(regionId: string, pose: Pose): Vec3[] {
  const a = anchorFor(regionId, pose.variant);
  return a ? a.points.map((p, i) => skinToWorld(p, a.weights[i], a.bones[i]!, pose)) : [];
}
export function anchorWorldNormals(regionId: string, pose: Pose): Vec3[] {
  const a = anchorFor(regionId, pose.variant);
  return a ? a.normals.map((n, i) => skinDirToWorld(n, a.weights[i], a.bones[i]!, pose)) : [];
}

// ---------------------------------------------------------------- sequence landmarks
/** Named landmarks used by tool sequences (catalog `steps[].landmark`), per region side. */
const SEQUENCE_LANDMARKS: { id: string; regionId: string; landmark: string }[] = [
  { id: "mastoid", regionId: "ear_right", landmark: "mastoid_r" },
  { id: "mastoid", regionId: "ear_left", landmark: "mastoid_l" },
  { id: "ear_canal", regionId: "ear_right", landmark: "ear_canal_r" },
  { id: "ear_canal", regionId: "ear_left", landmark: "ear_canal_l" },
  { id: "vertex", regionId: "scalp", landmark: "vertex" },
  { id: "apex", regionId: "cardiac_mitral", landmark: "nipple_l" },
  // the brachial artery in the elbow crease, below a cuff on that upper arm (BP: palpate, then listen)
  { id: "brachial", regionId: "upper_arm_right", landmark: "antecubital_r" },
  { id: "brachial", regionId: "upper_arm_left", landmark: "antecubital_l" },
];
export const LANDMARK_IDS = [...new Set(SEQUENCE_LANDMARKS.map((l) => l.id))];

/** World position of a sequence landmark (e.g. "mastoid" on ear_left) in a pose. */
export function landmarkWorld(id: string, regionId: string, pose: Pose): Vec3 | null {
  const entry = SEQUENCE_LANDMARKS.find((l) => l.id === id && l.regionId === regionId);
  if (!entry) return null;
  if (id === "apex") return anchorWorldPoints("cardiac_mitral", pose)[0] ?? null;
  const lm = PATIENT_VARIANTS[pose.variant].landmarks[entry.landmark];
  return lm ? skinToWorld(lm.point, lm.weights, lm.bone, pose) : null;
}
export function hasLandmark(id: string, regionId: string): boolean {
  return SEQUENCE_LANDMARKS.some((l) => l.id === id && l.regionId === regionId);
}

/** World position of any named skin landmark (sternal_notch, umbilicus, c7…). */
export function skinLandmarkWorld(name: string, pose: Pose): Vec3 | null {
  const lm = PATIENT_VARIANTS[pose.variant].landmarks[name];
  return lm ? skinToWorld(lm.point, lm.weights, lm.bone, pose) : null;
}
/** World position and outward normal of a named skin landmark. */
export function skinLandmark(name: string, pose: Pose): { point: Vec3; normal: Vec3 } {
  const lm = PATIENT_VARIANTS[pose.variant].landmarks[name];
  if (!lm) throw new Error(`unknown landmark ${name}`);
  return { point: skinToWorld(lm.point, lm.weights, lm.bone, pose), normal: skinDirToWorld(lm.normal, lm.weights, lm.bone, pose) };
}

// ---------------------------------------------------------------- pose + geometry helpers
export function poseFor(position: Position | string, bedAngleDeg: number, variant: VariantId = "male", extra?: BoneRotations): Pose {
  return computePose(variant, position as Position, bedAngleDeg, extra);
}

export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * Among colliders hit by a ray, pick the intended region: the nearest hit wins, except that a
 * tighter anchor within 2 cm behind it takes precedence (landmarks sit on top of broad zones).
 */
export function pickRegion(hits: { regionId: string; distance: number }[]): string | null {
  if (!hits.length) return null;
  const nearest = Math.min(...hits.map((h) => h.distance));
  const close = hits.filter((h) => h.distance - nearest <= 0.02);
  close.sort((x, y) => (ANCHOR_BY_REGION.get(x.regionId)?.radius ?? 1) - (ANCHOR_BY_REGION.get(y.regionId)?.radius ?? 1));
  return close[0]!.regionId;
}

export interface Snap {
  regionId: string;
  /** distance / tolerance (≤ 1 = inside the tolerance) */
  error: number;
  distanceCm: number;
  toleranceCm: number;
  point: Vec3;
}

/**
 * Nearest allowed anchor to a world point (where a tool touches the body), chosen by distance to
 * each anchor's tolerance boundary (so a wide zone doesn't swallow a nearby tight landmark).
 */
export function snapToAnchor(world: Vec3, allowedRegionIds: readonly string[], pose: Pose, opts: { tool?: boolean } = {}): Snap | null {
  let best: Snap | null = null;
  let bestScore = Infinity;
  for (const id of allowedRegionIds) {
    const a = anchorFor(id, pose.variant);
    if (!a) continue;
    for (const w of anchorWorldPoints(id, pose)) {
      const cm = distance(w, world) * 100;
      // inside one or more tolerances the most central wins (relative distance, so a broad zone
      // never swallows a landmark at its edge); outside them, the nearest tolerance boundary wins.
      // A tool aims at a landmark: within half its tolerance (its core) an anchor beats any broader
      // zone, tightest first (the apex can lie on the nipple, inside the breast zone). A plain
      // click picks a body area, so there the most central zone still wins (the nipple → breast).
      const core = opts.tool && cm <= a.toleranceCm / 2;
      const score = core ? -1000 + a.toleranceCm * 10 + cm / a.toleranceCm : cm <= a.toleranceCm ? cm / a.toleranceCm - 1 : cm - a.toleranceCm;
      if (score < bestScore) {
        bestScore = score;
        best = { regionId: id, error: cm / a.toleranceCm, distanceCm: cm, toleranceCm: a.toleranceCm, point: w };
      }
    }
  }
  return best;
}

/** A placement counts as on target within this many tolerances. */
export const SNAP_TOLERANCE = 1;

/** Region groups shown as buttons (exam domains, whole-patient), not as places on the body. */
export const PANEL_GROUPS = new Set<string>(["whole", "neuro"]);
