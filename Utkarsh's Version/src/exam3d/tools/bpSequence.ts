/**
 * The blood-pressure sequence (Phase 4 M2 bug 9), pure. Its steps are the catalog's
 * (blood_pressure.steps in content/catalog/maneuvers/general.json): wrap the cuff on the upper arm
 * (BP cuff), support the arm (a control), feel the brachial pulse in the elbow crease (hands),
 * listen there (stethoscope), then read the gauge (a control). This module says which step a
 * placement completes; Exam3DView logs it and runs the gauge.
 */
import type { SequenceStep, Tool } from "@/domain/schemas";
import { distance, landmarkWorld, type Pose, type Vec3 } from "../regionAnchors";

export interface BpState {
  /** the upper arm wearing the cuff (upper_arm_right / upper_arm_left) */
  regionId: string;
  /** step ids done, in order */
  done: string[];
}

/** The next step not yet done, in the catalog's order. */
export function bpNext(steps: readonly SequenceStep[], state: BpState): SequenceStep | undefined {
  return steps.find((s) => !state.done.includes(s.id));
}

/**
 * A placement with `tool` at `point`: the landmark step it completes on the cuffed arm (the
 * brachial artery for the hands and the stethoscope), if it lands within the step's tolerance.
 */
export function bpTouch(steps: readonly SequenceStep[], state: BpState, tool: Tool, point: Vec3, pose: Pose): { step: SequenceStep; distanceCm: number } | null {
  let best: { step: SequenceStep; distanceCm: number } | null = null;
  for (const step of steps) {
    if (step.kind !== "place" || !step.landmark || step.tool !== tool) continue;
    const at = landmarkWorld(step.landmark, state.regionId, pose);
    if (!at) continue;
    const cm = distance(at, point) * 100;
    if (cm <= (step.toleranceCm ?? 2.5) && (!best || cm < best.distanceCm)) best = { step, distanceCm: cm };
  }
  return best;
}

/** Steps done out of the catalog's order (e.g. listening before feeling the pulse). */
export function bpOutOfOrder(steps: readonly SequenceStep[], state: BpState): boolean {
  const order = steps.map((s) => s.id);
  const idx = state.done.map((id) => order.indexOf(id)).filter((i) => i >= 0);
  return idx.some((i, k) => k > 0 && i < idx[k - 1]!);
}
