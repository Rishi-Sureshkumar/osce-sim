/** Pure rules for tool interactions (no React / three), shared by the 3D view, Station and tests. */
import type { ExamManeuver, SequenceStep, Tool, ToolMode } from "@/domain/schemas";
import { LANDMARKS, distance, toWorld, type Pose, type Vec3 } from "../regionAnchors";

/** Minimum time the stethoscope must stay in place before the finding is described. */
export const MIN_LISTEN_MS = 3000;

type M = Pick<ExamManeuver, "id" | "tool" | "toolMode" | "technique" | "allowedRegions" | "interaction" | "steps">;

/** The tray tool a maneuver uses. Palpation/percussion without a named tool use "hands". */
export function toolFor(m: Pick<M, "tool" | "technique">): Tool | undefined {
  return m.tool ?? (m.technique === "palpate" || m.technique === "percuss" ? "hands" : undefined);
}

/** Regions the tool can be used on (drives highlighting and snapping). */
export function regionsForTool(maneuvers: readonly M[], tool: Tool): string[] {
  return [...new Set(maneuvers.filter((m) => toolFor(m) === tool).flatMap((m) => m.allowedRegions))];
}

/**
 * Maneuvers a tool placement could mean on this region. Matching the tool setting wins; if none
 * match (e.g. bell over the lungs) the tool-only matches are returned so the attempt is still
 * logged with the wrong setting, and technique rules can mark it down.
 */
export function candidatesFor(maneuvers: readonly M[], tool: Tool, mode: ToolMode | undefined, regionId: string): M[] {
  const onRegion = maneuvers.filter((m) => toolFor(m) === tool && m.allowedRegions.includes(regionId));
  const exact = onRegion.filter((m) => !m.toolMode || m.toolMode === mode);
  return exact.length ? exact : onRegion;
}

/** Loudness/muffling from placement error (in anchor radii). */
export function placementSound(error: number, tolerance = 1.5): { attenuation: number; lowpassHz: number; onTarget: boolean } {
  if (error <= 1) return { attenuation: 1, lowpassHz: 8000, onTarget: true };
  if (error <= tolerance) return { attenuation: 1 - 0.5 * ((error - 1) / (tolerance - 1)), lowpassHz: 2500, onTarget: true };
  return { attenuation: 0.25, lowpassHz: 350, onTarget: false };
}

export interface SequenceProgress {
  /** next expected step (undefined when complete) */
  next?: SequenceStep;
  complete: boolean;
  /** steps done in an order other than the defined one */
  outOfOrder: boolean;
}

/** Progress through a sequence given the step ids logged so far (in order). */
export function sequenceProgress(steps: readonly SequenceStep[], done: readonly string[]): SequenceProgress {
  let expected = 0;
  let outOfOrder = false;
  for (const id of done) {
    const idx = steps.findIndex((s) => s.id === id);
    if (idx < 0) continue;
    if (idx === expected) expected++;
    else if (idx > expected) {
      outOfOrder = true;
      expected = idx + 1;
    }
  }
  return { next: steps[expected], complete: expected >= steps.length, outOfOrder };
}

/**
 * Which sequence step a placement is (the nearest landmark among the "place" steps), with the
 * placement error measured from that landmark in units of `radius` (the region's anchor radius).
 */
export function stepForPlacement(
  steps: readonly SequenceStep[],
  regionId: string,
  world: Vec3,
  pose: Pose,
  radius = 0.022,
): (SequenceStep & { error: number; point: Vec3 }) | undefined {
  let best: { step: SequenceStep; d: number; point: Vec3 } | undefined;
  for (const step of steps) {
    if (step.kind !== "place" || !step.landmark) continue;
    const lm = LANDMARKS.find((l) => l.id === step.landmark && l.regionId === regionId);
    if (!lm) continue;
    const point = toWorld(lm.point, lm.segment, pose);
    const d = distance(point, world);
    if (!best || d < best.d) best = { step, d, point };
  }
  return best ? { ...best.step, error: best.d / radius, point: best.point } : undefined;
}
