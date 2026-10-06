import type { ActionInput, Tool, ToolMode } from "@/domain/schemas";

export interface ToolUse {
  regionId: string;
  maneuverId: string;
  tool: Tool;
  toolMode?: ToolMode;
  /** distance from the target in anchor radii */
  placementError?: number;
  durationMs?: number;
  step?: string;
}

/** A tool placed (and possibly held) on the 3D patient. Same `examine` Action as a click, plus technique. */
export function examineFromTool(u: ToolUse): ActionInput {
  const payload: Extract<ActionInput, { type: "examine" }>["payload"] = { regionId: u.regionId, maneuverId: u.maneuverId, tool: u.tool };
  if (u.toolMode) payload.toolMode = u.toolMode;
  if (u.placementError !== undefined) payload.placementError = Math.round(u.placementError * 100) / 100;
  if (u.durationMs !== undefined) payload.durationMs = Math.round(u.durationMs);
  if (u.step) payload.step = u.step;
  return { type: "examine", source: "click", payload };
}
