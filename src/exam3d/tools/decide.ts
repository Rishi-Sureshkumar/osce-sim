/**
 * Where a tool placement lands relative to the hidden anchors, and what it records (pure;
 * extracted from Exam3DView so the catalog harness and regression tests share the real logic).
 */
import type { ContactOutcome, ExamManeuver, Tool, ToolMode } from "@/domain/schemas";
import type { Pose, Vec3 } from "../regionAnchors";
import { ANCHOR_BY_REGION, snapToAnchor } from "../regionAnchors";
import { contactOutcome } from "./contact";
import { candidatesFor, stepForPlacement } from "./toolLogic";

type M = Pick<ExamManeuver, "id" | "tool" | "toolMode" | "technique" | "allowedRegions" | "interaction" | "steps" | "toleranceCm">;

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
  // a drag path (the swinging-light test) is recorded by its sweep, never by a single placement
  const cands = candidatesFor(a.maneuvers, a.tool, a.mode, s.regionId).filter((c) => c.interaction !== "drag_path");
  if (!cands.length) return null;
  const m0 = cands[0]!;
  // sequences measure placement against the step's landmark (e.g. mastoid vs ear canal)
  const seqStep = m0.interaction === "sequence" && m0.steps ? stepForPlacement(m0.steps, s.regionId, a.point, a.pose, ANCHOR_BY_REGION.get(s.regionId)?.radius, a.tool) : undefined;
  // the step's own tolerance (Rinne on the mastoid), else the exam's (the penlight must land on the
  // iris), else the anchor's
  const toleranceCm = seqStep?.toleranceCm ?? m0.toleranceCm ?? s.toleranceCm;
  const distanceCm = seqStep ? seqStep.error * s.toleranceCm : s.distanceCm;
  return {
    regionId: s.regionId,
    candidates: cands.map((c) => c.id),
    maneuverId: m0.id,
    ...(seqStep ? { stepId: seqStep.id } : {}),
    error: distanceCm / toleranceCm,
    distanceCm,
    toleranceCm,
    outcome: contactOutcome(distanceCm, toleranceCm, s.regionId),
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

/** An exam recorded by a penlight sweep. */
export interface SweepEvent {
  regionId: string;
  maneuverId: string;
  decision: PlacementDecision;
}

/**
 * Follows one press of the penlight as it is dragged over the face (Phase 4 M2 bug 1): each eye
 * the beam lands on (within its exam's tolerance) records its light reflex once, and a beam that
 * swings between two eyes and back (A → B → A) also records a drag-path exam allowed on both (the
 * swinging-light test). Returns, for each new beam point, the exams it adds.
 */
export type PenlightSweep = ((point: Vec3) => SweepEvent[]) & {
  /** the eye the beam is on now (within its exam's tolerance), if any */
  on: () => string | null;
};

export function penlightSweeper(a: { mode?: ToolMode; maneuvers: readonly M[]; toolRegions: readonly string[]; pose: Pose }): PenlightSweep {
  const entries: string[] = [];
  const logged = new Set<string>();
  let inside: string | null = null;
  const swings = a.maneuvers.filter((m) => m.interaction === "drag_path" && candidatesFor([m], "penlight", a.mode, m.allowedRegions[0] ?? "").length);
  const step = (point: Vec3): SweepEvent[] => {
    const d = decidePlacement({ point, tool: "penlight", mode: a.mode, maneuvers: a.maneuvers, toolRegions: a.toolRegions, pose: a.pose });
    const on = d && d.outcome === "finding" ? d.regionId : null;
    const out: SweepEvent[] = [];
    if (d && on && on !== inside) {
      entries.push(on);
      const key = `${d.maneuverId}@${on}`;
      if (!logged.has(key)) {
        logged.add(key);
        out.push({ regionId: on, maneuverId: d.maneuverId, decision: d });
      }
      const [x, y, z] = entries.slice(-3);
      if (x && y && z && x === z && x !== y)
        for (const m of swings)
          if (m.allowedRegions.includes(x) && m.allowedRegions.includes(y) && !logged.has(m.id)) {
            logged.add(m.id);
            out.push({ regionId: on, maneuverId: m.id, decision: { ...d, maneuverId: m.id, candidates: [m.id] } });
          }
    }
    inside = on;
    return out;
  };
  return Object.assign(step, { on: () => inside });
}
