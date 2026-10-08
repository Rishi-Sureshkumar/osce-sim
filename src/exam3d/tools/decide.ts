/**
 * Where a tool placement lands relative to the hidden anchors, and what it records (pure;
 * extracted from Exam3DView so the catalog harness and regression tests share the real logic).
 */
import type { ContactOutcome, ExamManeuver, Tool, ToolMode } from "@/domain/schemas";
import type { Pose, Vec3 } from "../regionAnchors";
import { ANCHOR_BY_REGION, snapToAnchor } from "../regionAnchors";
import { contactOutcome } from "./contact";
import { candidatesFor, stepForPlacement } from "./toolLogic";

type M = Pick<ExamManeuver, "id" | "tool" | "toolMode" | "technique" | "allowedRegions" | "interaction" | "steps">;

export interface PlacementDecision {
  regionId: string;
  /** maneuvers this tool+mode can do here (several = the student is asked) */
  candidates: string[];
  /** the first candidate */
  maneuverId: string;
  /** sequence step matched (e.g. Rinne "bone" / "air") */
  stepId?: string;
  /** distance / tolerance */
  error: number;
  distanceCm: number;
  toleranceCm: number;
  outcome: ContactOutcome;
}

export function decidePlacement(a: { point: Vec3; tool: Tool; mode?: ToolMode; maneuvers: readonly M[]; toolRegions: readonly string[]; pose: Pose }): PlacementDecision | null {
  const s = snapToAnchor(a.point, a.toolRegions, a.pose, { tool: true });
  if (!s) return null;
  const cands = candidatesFor(a.maneuvers as M[], a.tool, a.mode, s.regionId);
  if (!cands.length) return null;
  const m0 = cands[0]!;
  // sequences measure placement against the step's landmark (e.g. mastoid vs ear canal)
  const seqStep = m0.interaction === "sequence" && m0.steps ? stepForPlacement(m0.steps, s.regionId, a.point, a.pose, ANCHOR_BY_REGION.get(s.regionId)?.radius) : undefined;
  const distanceCm = seqStep ? seqStep.error * s.toleranceCm : s.distanceCm;
  return {
    regionId: s.regionId,
    candidates: cands.map((c) => c.id),
    maneuverId: m0.id,
    ...(seqStep ? { stepId: seqStep.id } : {}),
    error: seqStep?.error ?? s.error,
    distanceCm,
    toleranceCm: s.toleranceCm,
    outcome: contactOutcome(distanceCm, s.toleranceCm, s.regionId),
  };
}

/** The student's last pick among several exams that fit the same hold, and where it was already used. */
export interface RememberedHold {
  maneuverId: string;
  /** regions where it has been recorded since it was picked (a new hold there asks again) */
  done: string[];
}

export type HoldChoice = { maneuverId: string } | { ask: string[] } | null;

/** Identifies a set of competing exams (bowel sounds + bruits on the abdomen), for remembering the pick. */
export function holdKey(maneuvers: readonly M[], tool: Tool, mode: ToolMode | undefined, regionId: string): string {
  return candidatesFor(maneuvers as M[], tool, mode, regionId)
    .map((c) => c.id)
    .sort()
    .join("|");
}

/**
 * The exam a stethoscope hold records on a region: the only one that fits; or, when several fit,
 * the student's last pick (on a region where it hasn't been recorded yet); otherwise ask.
 * (Phase 3 always took the first candidate, so abdominal bruits could never be recorded — bug 10.)
 */
export function holdCandidate(maneuvers: readonly M[], tool: Tool, mode: ToolMode | undefined, regionId: string, remembered?: RememberedHold): HoldChoice {
  const ids = candidatesFor(maneuvers as M[], tool, mode, regionId).map((c) => c.id);
  if (!ids.length) return null;
  if (ids.length === 1) return { maneuverId: ids[0]! };
  if (remembered && ids.includes(remembered.maneuverId) && !remembered.done.includes(regionId)) return { maneuverId: remembered.maneuverId };
  return { ask: ids };
}
