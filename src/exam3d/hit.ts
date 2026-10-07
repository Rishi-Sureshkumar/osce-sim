/**
 * Resolves a pointer ray's hits on the patient to a BodyHit (pure; extracted from Patient3D).
 * Hits on the gown measure from the skin underneath; a region is assigned only within reach of
 * its tolerance boundary.
 */
import { snapToAnchor, type Pose, type Vec3 } from "./regionAnchors";

export interface BodyHit {
  point: Vec3;
  normal: Vec3;
  /** "body", or "gown:<zone>" when the click landed on the gown */
  kind: string;
  /** nearest region anchor (by tolerance boundary), when within reach */
  regionId: string | null;
}

export interface RawHit {
  kind: string | undefined;
  point: Vec3;
  normal: Vec3;
}

/** A body hit is only resolved to a region when it lands this close to the region's tolerance boundary. */
export const REACH_CM = 9;

const isPatient = (k: string | undefined) => k === "body" || (!!k && k.startsWith("gown:"));

export function resolveHit(hits: readonly RawHit[], pickableRegionIds: readonly string[], pose: Pose, reachCm = REACH_CM): BodyHit | null {
  const first = hits.find((h) => isPatient(h.kind));
  if (!first) return null;
  const skin = hits.find((h) => h.kind === "body");
  const measure: Vec3 = skin ? skin.point : first.point;
  const snap = snapToAnchor(measure, pickableRegionIds, pose);
  const regionId = snap && snap.distanceCm - snap.toleranceCm <= reachCm ? snap.regionId : null;
  return { point: measure, normal: first.normal, kind: String(first.kind), regionId };
}
