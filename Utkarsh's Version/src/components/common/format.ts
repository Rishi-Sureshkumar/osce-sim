import type { Action, CourtesyTag, Position, SequenceStep } from "@/domain/schemas";
import { MIN_LISTEN_MS } from "@/exam3d/tools/toolLogic";
import type { PublicCatalog } from "@/content/types";

export const POSITION_LABELS: Record<Position, string> = {
  seated: "Seated upright",
  seated_leaning_forward: "Seated, leaning forward",
  supine: "Supine (flat)",
  reclined_30: "Reclined to 30°",
  reclined_45: "Reclined to 45°",
  left_lateral_decubitus: "Left lateral decubitus",
  prone: "Prone",
  standing: "Standing",
  sitting_dangling: "Sitting, legs dangling",
};

export const COURTESY_LABELS = {
  hand_hygiene: "Cleaned hands",
  introduce: "Introduced self",
  consent: "Obtained consent",
  drape: "Draped patient",
  position: "Positioned patient",
  close_encounter: "Closed the encounter",
  expose: "Exposed a region",
  cover: "Covered a region",
} as const;

/** Badge text for a session mode (phase-1 sessions without a mode were exams). */
export const modeLabel = (mode: "practice" | "exam" | undefined) => (mode === "practice" ? "Practice" : "Exam");

export const HINT_LABELS = { hint: "Hint used", nudge: "Nudge shown", show_me: "“Show me how” used", section_check: "Section check used" } as const;
export const TIMER_LABELS = {
  pause: "Timer paused",
  resume: "Timer resumed",
  warning: "2-minute warning",
  auto_end: "Time up — station ended",
  begin: "“You may begin” — encounter timer started",
  encounter_warning: "5 minutes remaining in the encounter",
  encounter_end: "Encounter time is up",
  pen_warning: "2 minutes remaining for the note",
  pen_lock: "Note time is up — note locked",
} as const;
export const OUTCOME_LABELS = { finding: "on target", near: "near the target", background: "off target", nothing: "no target nearby" } as const;
export const TAG_LABELS: Record<CourtesyTag, string> = {
  introduced_name: "Introduced name",
  stated_role: "Stated role",
  confirmed_patient_identity: "Confirmed identity",
  asked_consent_exam: "Asked consent",
  explained_procedure: "Explained procedure",
  asked_comfort: "Checked comfort",
  offered_questions: "Offered questions",
  closing: "Closing",
  requested_position: "Asked to change position",
  shared_impression: "Shared impression",
};
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
        p.drape ? `${(p.drape.section ?? p.drape.zone ?? "").replace("_", " ")} ${p.drape.covered ? "covered" : "uncovered"}` : "",
      ].filter(Boolean);
      const how = p.via === "verbal" ? "asked verbally" : p.via === "menu" ? "from the menu" : "directly";
      return { who: "student", text: `Changed ${parts.join(", ")} (${how})` };
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
    case "submit_pen":
      return { who: "student", text: `Submitted post-encounter note${a.payload.locked ? " (locked at time-up)" : ""}: ${a.payload.diagnoses.map((d) => d.diagnosis).join("; ")}` };
    case "sit_down":
      return { who: "student", text: "Sat down" };
    case "describe_exam":
      return { who: "student", text: `Described exam of ${L.region(a.payload.regionId)}: ${a.payload.text}` };
    case "prohibited_attempt":
      return { who: "student", text: `Attempted an exam not allowed in this encounter: ${L.region(a.payload.regionId)}` };
    case "tool_contact": {
      const p = a.payload;
      const where = p.nearestRegionId ? L.region(p.nearestRegionId) : "body";
      return {
        who: "student",
        text: `${p.tool}${p.toolMode ? ` (${p.toolMode})` : ""} placed near ${where} · ${p.distanceCm.toFixed(1)} cm (tolerance ${p.toleranceCm} cm) · ${(p.durationMs / 1000).toFixed(1)} s · ${OUTCOME_LABELS[p.outcome]}`,
      };
    }
    case "interpretation":
      return { who: "student", text: `Interpretation (${L.maneuver(a.payload.maneuverId)} — ${L.region(a.payload.regionId)}): ${a.payload.text}` };
    case "settings":
      return {
        who: "student",
        text: `Changed settings: ${[a.payload.alerts ? `alerts ${a.payload.alerts}` : "", a.payload.enhancedPatient !== undefined ? `enhanced patient ${a.payload.enhancedPatient ? "on" : "off"}` : ""].filter(Boolean).join(", ")}`,
      };
    case "mistake":
      return { who: "system", text: `Mistake (${a.payload.severity}): ${a.payload.message}` };
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
  if (a.result?.hidden) return "Recorded. Findings for this case are revealed when you finish.";
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
  if (p.distanceCm !== undefined && p.toleranceCm !== undefined) parts.push(`${p.distanceCm.toFixed(1)} cm from the landmark (tolerance ${p.toleranceCm} cm)`);
  else if (p.placementError !== undefined) parts.push(p.placementError <= 1 ? `on target (${p.placementError.toFixed(2)} r)` : `off target (${p.placementError.toFixed(2)} r)`);
  if (p.durationMs !== undefined) parts.push(`held ${(p.durationMs / 1000).toFixed(1)} s`);
  return parts.join(" · ");
}
