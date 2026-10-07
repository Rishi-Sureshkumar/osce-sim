/**
 * The 1B OSCE encounter flow, derived only from the log (pure, unit-tested):
 *
 *   corridor ──timer:begin──▶ encounter ──room:exit | timer:encounter_end──▶ pen ──submit_pen──▶ submitted
 *
 * Exam mode: the encounter ends `encounterSeconds` after begin (warning when 5 minutes remain);
 * the PEN locks `penSeconds` after the encounter ended (warning at 2 minutes). Practice mode has
 * no deadlines. Times are ms since session start, like `Action.t`.
 */
import type { Action, SessionMode } from "@/domain/schemas";
import { orderLog } from "./order";

export type EncounterPhase = "corridor" | "encounter" | "pen" | "submitted";

export interface FlowLimits {
  encounterSeconds: number;
  penSeconds: number;
}

export const ENCOUNTER_WARNING_LEFT_MS = 5 * 60_000;
export const PEN_WARNING_LEFT_MS = 2 * 60_000;
/** server grace for a client submitting right at the deadline */
export const DEADLINE_GRACE_MS = 5_000;

export interface EncounterState {
  phase: EncounterPhase;
  beganAt: number | null;
  /** when the encounter ended (exit or time-up), i.e. when the PEN started */
  endedAt: number | null;
  endReason: "exit" | "time_up" | null;
  /** exam mode only */
  encounterDeadline: number | null;
  penDeadline: number | null;
  warned: { encounter: boolean; pen: boolean };
  locked: boolean;
}

const timerAt = (log: readonly Action[], event: string) => log.find((a) => a.type === "timer" && a.payload.event === event)?.t ?? null;

export function encounterState(log: readonly Action[], mode: SessionMode, limits: FlowLimits, nowT: number): EncounterState {
  const ordered = orderLog(log);
  const beganAt = timerAt(ordered, "begin");
  const exitAt = ordered.find((a) => a.type === "room" && a.payload.event === "exit")?.t ?? null;
  const endAt = timerAt(ordered, "encounter_end");
  const exam = mode === "exam";
  const encounterDeadline = exam && beganAt !== null ? beganAt + limits.encounterSeconds * 1000 : null;
  // the encounter ends at whichever comes first: leaving, the logged time-up, or (exam) the deadline passing
  const candidates = [exitAt, endAt, encounterDeadline !== null && nowT >= encounterDeadline ? encounterDeadline : null].filter((x): x is number => x !== null);
  const endedAt = beganAt === null && exitAt === null ? null : candidates.length ? Math.min(...candidates) : null;
  const endReason = endedAt === null ? null : exitAt !== null && exitAt === endedAt ? "exit" : "time_up";
  const penDeadline = exam && endedAt !== null ? endedAt + limits.penSeconds * 1000 : null;
  const submitted = ordered.some((a) => a.type === "submit_pen" || a.type === "submit_ddx" || a.type === "session_end");
  const phase: EncounterPhase = submitted ? "submitted" : endedAt !== null ? "pen" : beganAt !== null ? "encounter" : "corridor";
  return {
    phase,
    beganAt,
    endedAt,
    endReason,
    encounterDeadline,
    penDeadline,
    warned: { encounter: timerAt(ordered, "encounter_warning") !== null, pen: timerAt(ordered, "pen_warning") !== null },
    locked: timerAt(ordered, "pen_lock") !== null || (penDeadline !== null && nowT >= penDeadline),
  };
}

/** Which action types the student may add in each phase (the server enforces this). */
export function allowedInPhase(phase: EncounterPhase, type: Action["type"]): boolean {
  if (type === "note" || type === "timer") return phase !== "submitted";
  if (phase === "corridor") return false;
  if (phase === "encounter") return type !== "submit_pen" && type !== "submit_ddx";
  if (phase === "pen") return type === "submit_pen";
  return false;
}

/** Timer events now due (in order), given what is already logged. Exam mode only. */
export function dueTimerEvents(s: EncounterState, nowT: number): ("encounter_warning" | "encounter_end" | "pen_warning" | "pen_lock")[] {
  const out: ("encounter_warning" | "encounter_end" | "pen_warning" | "pen_lock")[] = [];
  if (s.phase === "encounter" && s.encounterDeadline !== null) {
    if (!s.warned.encounter && nowT >= s.encounterDeadline - ENCOUNTER_WARNING_LEFT_MS) out.push("encounter_warning");
  }
  if (s.phase === "pen" && s.penDeadline !== null) {
    if (!s.warned.pen && nowT >= s.penDeadline - PEN_WARNING_LEFT_MS) out.push("pen_warning");
  }
  return out;
}

/** Remaining ms of the current timed phase (exam), or null when untimed. */
export function remainingMs(s: EncounterState, nowT: number): number | null {
  if (s.phase === "encounter" && s.encounterDeadline !== null) return Math.max(0, s.encounterDeadline - nowT);
  if (s.phase === "pen" && s.penDeadline !== null) return Math.max(0, s.penDeadline - nowT);
  return null;
}
