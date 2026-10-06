import type { ActionInput, CourtesyKind, Position } from "@/domain/schemas";

export function courtesyFromToolbar(kind: CourtesyKind, position?: Position): ActionInput {
  return { type: "courtesy", source: "toolbar", payload: position ? { kind, position } : { kind } };
}
