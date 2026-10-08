/**
 * Resolves a pointer ray's hits on the patient to a BodyHit (pure; extracted from Patient3D).
 * Hits on the gown measure from the skin underneath; hits on an eye measure at the eye (the penlight
 * and eye exams aim at the pupil); a region is assigned only within reach of its tolerance boundary.
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

const isPatient = (k: string | undefined) => k === "body" || k === "eye" || (!!k && k.startsWith("gown:"));

/**
 * `examinableRegionIds` (plain clicks): the pickable regions that are not excluded exams. A click is
 * never taken as an excluded exam (e.g. the breast) when an examinable target is nearer and within its
 * tolerance (the male apex lies ~1 cm from the nipple: a click just off the apex is the apex).
 */
export function resolveHit(hits: readonly RawHit[], pickableRegionIds: readonly string[], pose: Pose, reachCm = REACH_CM, examinableRegionIds?: readonly string[]): BodyHit | null {
  const first = hits.find((h) => isPatient(h.kind));
  if (!first) return null;
  // on the gown, measure from the skin under it; on an eye, at the eye (behind it is the socket)
  const skin = hits.find((h) => h.kind === "body");
  const measure: Vec3 = first.kind === "eye" ? first.point : skin ? skin.point : first.point;
  let snap = snapToAnchor(measure, pickableRegionIds, pose);
  if (snap && examinableRegionIds && !examinableRegionIds.includes(snap.regionId)) {
    const alt = snapToAnchor(measure, examinableRegionIds, pose);
    if (alt && alt.error <= 1 && alt.distanceCm < snap.distanceCm) snap = alt;
  }
  const regionId = snap && snap.distanceCm - snap.toleranceCm <= reachCm ? snap.regionId : null;
  return { point: measure, normal: first.normal, kind: String(first.kind), regionId };
}
