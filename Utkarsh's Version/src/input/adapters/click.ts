import type { ActionInput } from "@/domain/schemas";

/** A click on a region followed by choosing a maneuver from the menu. */
export function examineFromClick(regionId: string, maneuverId: string): ActionInput {
  return { type: "examine", source: "click", payload: { regionId, maneuverId } };
}
