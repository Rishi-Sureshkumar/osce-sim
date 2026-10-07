/**
 * What a tool touching the body produces, from its distance to the nearest hidden anchor.
 * Pure (no React / three) and unit-tested; the 3D view, logging and technique scoring share it.
 *
 *   inside the tolerance       → "finding": the case's sound/finding at full fidelity
 *   up to 2× the tolerance     → "near": sound attenuated and band-limited, no finding
 *   elsewhere on chest or back → "background": generic normal heart/breath sounds, no finding
 *   anywhere else              → "nothing"
 */
import type { ContactOutcome } from "@/domain/schemas";
import { MIN_LISTEN_MS } from "./toolLogic";

export { MIN_LISTEN_MS };

export const NEAR_FACTOR = 2;

/** Regions whose surroundings carry a generic background sound when the stethoscope is off target. */
const TORSO = /^(cardiac_|precordium|lung_|breast_|abd_epigastric|spine_thoracic|cva_)/;

export function isTorsoRegion(regionId: string | null | undefined): boolean {
  return !!regionId && TORSO.test(regionId);
}

export function contactOutcome(distanceCm: number, toleranceCm: number, nearestRegionId?: string | null): ContactOutcome {
  if (distanceCm <= toleranceCm) return "finding";
  if (distanceCm <= toleranceCm * NEAR_FACTOR) return "near";
  return isTorsoRegion(nearestRegionId) ? "background" : "nothing";
}

/** Playback for an outcome: loudness and low-pass (band-limiting) as the stethoscope approaches. */
export function contactSound(outcome: ContactOutcome, distanceCm: number, toleranceCm: number): { attenuation: number; lowpassHz: number } | null {
  if (outcome === "finding") return { attenuation: 1, lowpassHz: 8000 };
  if (outcome === "near") {
    // fades from 0.7 at the tolerance edge to 0.25 at twice the tolerance, ever more muffled
    const k = Math.min(1, Math.max(0, (distanceCm - toleranceCm) / (toleranceCm * (NEAR_FACTOR - 1))));
    return { attenuation: 0.7 - 0.45 * k, lowpassHz: 1600 - 1100 * k };
  }
  if (outcome === "background") return { attenuation: 0.35, lowpassHz: 900 };
  return null;
}

/** Background sound family for an off-target torso placement. */
export function backgroundKind(nearestRegionId: string | null | undefined): "heart" | "breath" {
  return nearestRegionId && /^(cardiac_|precordium)/.test(nearestRegionId) ? "heart" : "breath";
}


/** A stethoscope contact records a finding only when it stayed inside the tolerance long enough. */
export function recordsFinding(outcome: ContactOutcome, durationMs: number, tool: string): boolean {
  if (outcome !== "finding") return false;
  return tool === "stethoscope" ? durationMs >= MIN_LISTEN_MS : true;
}
