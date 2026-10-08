import type { ActionInput, ContactOutcome, Tool, ToolMode } from "@/domain/schemas";

export interface ToolUse {
  regionId: string;
  maneuverId: string;
  tool: Tool;
  toolMode?: ToolMode;
  /** distance from the target / the target's tolerance (≤ 1 = inside) */
  placementError?: number;
  /** distance from the hidden anchor in cm, and that anchor's tolerance */
  distanceCm?: number;
  toleranceCm?: number;
  durationMs?: number;
  step?: string;
  /** the blood-pressure reading taken from the gauge (bug 9) */
  bpReading?: NonNullable<Extract<ActionInput, { type: "examine" }>["payload"]["bpReading"]>;
}

/** A tool placed (and possibly held) on the 3D patient. Same `examine` Action as a click, plus technique. */
export function examineFromTool(u: ToolUse): ActionInput {
  const payload: Extract<ActionInput, { type: "examine" }>["payload"] = { regionId: u.regionId, maneuverId: u.maneuverId, tool: u.tool };
  if (u.toolMode) payload.toolMode = u.toolMode;
  if (u.placementError !== undefined) payload.placementError = Math.round(u.placementError * 100) / 100;
  if (u.durationMs !== undefined) payload.durationMs = Math.round(u.durationMs);
  if (u.step) payload.step = u.step;
  if (u.distanceCm !== undefined) payload.distanceCm = Math.round(u.distanceCm * 10) / 10;
  if (u.toleranceCm !== undefined) payload.toleranceCm = u.toleranceCm;
  if (u.bpReading) payload.bpReading = u.bpReading;
  return { type: "examine", source: "click", payload };
}

export interface ToolContact {
  tool: Tool;
  toolMode?: ToolMode;
  maneuverId?: string;
  nearestRegionId: string | null;
  distanceCm: number;
  toleranceCm: number;
  durationMs: number;
  outcome: ContactOutcome;
}

/** Every placement of a tool on the body, on target or not (hidden-anchor distance; never shown to the student). */
export function contactFromTool(c: ToolContact): ActionInput {
  return {
    type: "tool_contact",
    source: "click",
    payload: {
      tool: c.tool,
      ...(c.toolMode ? { toolMode: c.toolMode } : {}),
      ...(c.maneuverId ? { maneuverId: c.maneuverId } : {}),
      nearestRegionId: c.nearestRegionId,
      distanceCm: Math.min(500, Math.round(c.distanceCm * 10) / 10),
      toleranceCm: c.toleranceCm,
      durationMs: Math.min(600_000, Math.round(c.durationMs)),
      outcome: c.outcome,
    },
  };
}
