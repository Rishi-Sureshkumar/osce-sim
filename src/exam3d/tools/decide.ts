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
  const s = snapToAnchor(a.point, a.toolRegions, a.pose);
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

/** The maneuver a stethoscope hold records on a region (Phase 3: always the first candidate). */
export function holdCandidate(maneuvers: readonly M[], tool: Tool, mode: ToolMode | undefined, regionId: string): string | null {
  return candidatesFor(maneuvers as M[], tool, mode, regionId)[0]?.id ?? null;
}
