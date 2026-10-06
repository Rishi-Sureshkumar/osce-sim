import type { Action, Position } from "@/domain/schemas";
import type { PublicCatalog } from "@/content/types";

export const POSITION_LABELS: Record<Position, string> = {
  seated: "Seated upright",
  seated_leaning_forward: "Seated, leaning forward",
  supine: "Supine (flat)",
  reclined_30: "Reclined to 30°",
  left_lateral_decubitus: "Left lateral decubitus",
  prone: "Prone",
  standing: "Standing",
};

export const COURTESY_LABELS = {
  hand_hygiene: "Washed hands",
  introduce: "Introduced self",
  consent: "Obtained consent",
  drape: "Draped patient",
  position: "Positioned patient",
  close_encounter: "Closed the encounter",
} as const;

export function mmss(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export interface Labels {
  maneuver: (id: string) => string;
  region: (id: string) => string;
}

export function labelsFrom(catalog: PublicCatalog): Labels {
  const m = new Map(catalog.maneuvers.map((x) => [x.id, x.label]));
  const r = new Map(catalog.regions.map((x) => [x.id, x.label]));
  return { maneuver: (id) => m.get(id) ?? id, region: (id) => r.get(id) ?? id };
}

/** One-line description of an action, used by the live log and the coach timeline. */
export function describeAction(a: Action, L: Labels): { who: "student" | "patient" | "system"; text: string } {
  switch (a.type) {
    case "say":
      return { who: "student", text: a.payload.text };
    case "patient_say":
      return { who: "patient", text: a.payload.text };
    case "examine":
      return { who: "student", text: `${L.maneuver(a.payload.maneuverId)} — ${L.region(a.payload.regionId)}` };
    case "courtesy":
      return {
        who: "student",
        text: a.payload.kind === "position" && a.payload.position ? `Positioned patient: ${POSITION_LABELS[a.payload.position]}` : COURTESY_LABELS[a.payload.kind],
      };
    case "note":
      return { who: "student", text: `Note: ${a.payload.text}` };
    case "submit_ddx":
      return { who: "student", text: `Submitted differential: ${a.payload.differential.join("; ")}` };
    case "session_start":
      return { who: "system", text: "Session started" };
    case "session_end":
      return { who: "system", text: `Session ended (${a.payload.reason})` };
  }
}

/** Shown to the student: AI wording when available, otherwise the deterministic text. */
export function findingDisplay(a: Extract<Action, { type: "examine" }>): string {
  return a.result?.wording || a.result?.findingText || "";
}
