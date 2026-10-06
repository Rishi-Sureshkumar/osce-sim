import type { Action, Position, SequenceStep } from "@/domain/schemas";
import { MIN_LISTEN_MS } from "@/exam3d/tools/toolLogic";
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
  expose: "Exposed a region",
  cover: "Covered a region",
} as const;

export const HINT_LABELS = { hint: "Hint used", nudge: "Nudge shown", show_me: "“Show me how” used", section_check: "Section check used" } as const;
export const TIMER_LABELS = { pause: "Timer paused", resume: "Timer resumed", warning: "2-minute warning", auto_end: "Time up — station ended" } as const;
export const ROOM_LABELS = { knock: "Knocked", enter: "Entered the room", exit: "Left the room" } as const;

/** Display a log time. Always floors to the whole second (the one formatter used everywhere). */
export function mmss(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export interface Labels {
  maneuver: (id: string) => string;
  region: (id: string) => string;
  steps?: (id: string) => SequenceStep[] | undefined;
}

export function labelsFrom(catalog: PublicCatalog): Labels {
  const m = new Map(catalog.maneuvers.map((x) => [x.id, x.label]));
  const r = new Map(catalog.regions.map((x) => [x.id, x.label]));
  const st = new Map(catalog.maneuvers.map((x) => [x.id, x.steps]));
  return { maneuver: (id) => m.get(id) ?? id, region: (id) => r.get(id) ?? id, steps: (id) => st.get(id) };
}

/** One-line description of an action, used by the live log and the coach timeline. */
export function describeAction(a: Action, L: Labels): { who: "student" | "patient" | "system"; text: string } {
  switch (a.type) {
    case "say":
      return { who: "student", text: a.payload.text };
    case "patient_say":
      return { who: "patient", text: a.payload.text };
    case "examine": {
      const p = a.payload;
      const step = p.step ? ` (step: ${p.step})` : "";
      const tech = techniqueSummary(a);
      return { who: "student", text: `${L.maneuver(p.maneuverId)} — ${L.region(p.regionId)}${step}${tech ? ` · ${tech}` : ""}` };
    }
    case "courtesy":
      return {
        who: "student",
        text:
          a.payload.kind === "position" && a.payload.position
            ? `Positioned patient: ${POSITION_LABELS[a.payload.position]}`
            : `${COURTESY_LABELS[a.payload.kind]}${a.payload.regionId ? `: ${L.region(a.payload.regionId)}` : ""}`,
      };
    case "state_change": {
      const p = a.payload;
      const parts = [
        p.position ? `patient ${POSITION_LABELS[p.position].toLowerCase()}` : "",
        p.drape ? `${p.drape.zone} ${p.drape.covered ? "covered" : "uncovered"}` : "",
      ].filter(Boolean);
      return { who: "student", text: `Changed ${parts.join(", ")} (${p.via})` };
    }
    case "hint":
      return { who: "system", text: `${HINT_LABELS[a.payload.kind]}: ${a.payload.text}` };
    case "timer":
      return { who: "system", text: TIMER_LABELS[a.payload.event] };
    case "room":
      return { who: "student", text: ROOM_LABELS[a.payload.event] };
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

/**
 * Shown to the student: AI wording when available, otherwise the deterministic text.
 * A stethoscope held for less than the minimum listen time, and the intermediate steps of a
 * sequence (e.g. Rinne), show what was done instead of the finding.
 */
export function findingDisplay(a: Extract<Action, { type: "examine" }>, labels?: Pick<Labels, "steps">): string {
  const p = a.payload;
  if (p.tool === "stethoscope" && p.durationMs !== undefined && p.durationMs < MIN_LISTEN_MS) {
    return `Listened for ${(p.durationMs / 1000).toFixed(1)} s — hold the stethoscope still for at least ${MIN_LISTEN_MS / 1000} s to describe what you hear.`;
  }
  const steps = p.step ? labels?.steps?.(p.maneuverId) : undefined;
  if (steps && p.step !== steps.at(-1)?.id) {
    return `Step done: ${steps.find((s) => s.id === p.step)?.label ?? p.step}`;
  }
  return a.result?.wording || a.result?.findingText || "";
}

/** Technique summary of a tool use, for the log and the coach timeline. */
export function techniqueSummary(a: Extract<Action, { type: "examine" }>): string {
  const p = a.payload;
  if (!p.tool) return "";
  const parts = [p.toolMode ? `${p.tool.replace("_", " ")} (${p.toolMode})` : p.tool.replace("_", " ")];
  if (p.placementError !== undefined) parts.push(p.placementError <= 1 ? `on target (${p.placementError.toFixed(2)} r)` : p.placementError <= 1.5 ? `edge of target (${p.placementError.toFixed(2)} r)` : `off target (${p.placementError.toFixed(2)} r)`);
  if (p.durationMs !== undefined) parts.push(`held ${(p.durationMs / 1000).toFixed(1)} s`);
  return parts.join(" · ");
}
