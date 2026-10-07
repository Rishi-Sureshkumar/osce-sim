import { describe, expect, it } from "vitest";
import type { Action } from "@/domain/schemas";
import { allowedInPhase, dueTimerEvents, encounterState, remainingMs } from "@/engine/encounter";

const L = { encounterSeconds: 15 * 60, penSeconds: 10 * 60 };
let seq = 0;
const timer = (t: number, event: string): Action => ({ id: `a${seq++}`, sessionId: "s", t, type: "timer", source: "system", payload: { event } }) as Action;
const room = (t: number, event: "knock" | "enter" | "exit"): Action => ({ id: `a${seq++}`, sessionId: "s", t, type: "room", source: "click", payload: { event } });
const MIN = 60_000;

describe("1B encounter flow", () => {
  it("corridor until 'You may begin'; nothing but notes and the timer before it", () => {
    const s = encounterState([], "exam", L, 5_000);
    expect(s.phase).toBe("corridor");
    expect(allowedInPhase("corridor", "room")).toBe(false);
    expect(allowedInPhase("corridor", "say")).toBe(false);
    expect(allowedInPhase("corridor", "note")).toBe(true);
    expect(allowedInPhase("corridor", "timer")).toBe(true);
  });

  it("exam: 15 minutes from begin, warning when 5 remain (10:00 elapsed), then the PEN", () => {
    const log = [timer(10_000, "begin"), room(20_000, "enter")];
    const at9 = encounterState(log, "exam", L, 10_000 + 9 * MIN);
    expect(at9.phase).toBe("encounter");
    expect(dueTimerEvents(at9, 10_000 + 9 * MIN)).toEqual([]);
    expect(remainingMs(at9, 10_000 + 9 * MIN)).toBe(6 * MIN);
    const at10 = encounterState(log, "exam", L, 10_000 + 10 * MIN);
    expect(dueTimerEvents(at10, 10_000 + 10 * MIN)).toEqual(["encounter_warning"]);
    const warned = [...log, timer(10_000 + 10 * MIN, "encounter_warning")];
    expect(dueTimerEvents(encounterState(warned, "exam", L, 10_000 + 11 * MIN), 10_000 + 11 * MIN)).toEqual([]);
    // the deadline passing ends the encounter even before anything is logged
    const late = encounterState(warned, "exam", L, 10_000 + 15 * MIN + 1);
    expect(late).toMatchObject({ phase: "pen", endedAt: 10_000 + 15 * MIN, endReason: "time_up", penDeadline: 10_000 + 25 * MIN });
  });

  it("leaving the room ends the encounter at once: no re-entry, only the note", () => {
    const log = [timer(0, "begin"), room(1_000, "enter"), room(4 * MIN, "exit")];
    const s = encounterState(log, "exam", L, 4 * MIN + 1);
    expect(s).toMatchObject({ phase: "pen", endReason: "exit", endedAt: 4 * MIN, penDeadline: 14 * MIN });
    expect(allowedInPhase("pen", "room")).toBe(false);
    expect(allowedInPhase("pen", "examine")).toBe(false);
    expect(allowedInPhase("pen", "say")).toBe(false);
    expect(allowedInPhase("pen", "submit_pen")).toBe(true);
  });

  it("PEN: warning at 2 minutes left, locked at time-up", () => {
    const log = [timer(0, "begin"), room(1_000, "exit")];
    expect(dueTimerEvents(encounterState(log, "exam", L, 1_000 + 8 * MIN), 1_000 + 8 * MIN)).toEqual(["pen_warning"]);
    expect(encounterState(log, "exam", L, 1_000 + 10 * MIN - 1).locked).toBe(false);
    expect(encounterState(log, "exam", L, 1_000 + 10 * MIN).locked).toBe(true);
    const sub = [...log, { id: "p", sessionId: "s", t: 1_000 + 5 * MIN, type: "submit_pen", source: "text", payload: { history: "h", exam: "e", diagnoses: [{ diagnosis: "HF" }] } } as Action];
    expect(encounterState(sub, "exam", L, 1_000 + 6 * MIN).phase).toBe("submitted");
  });

  it("practice: no deadlines, no warnings, no lock", () => {
    const log = [timer(0, "begin")];
    const s = encounterState(log, "practice", L, 60 * MIN);
    expect(s).toMatchObject({ phase: "encounter", encounterDeadline: null });
    expect(dueTimerEvents(s, 60 * MIN)).toEqual([]);
    expect(remainingMs(s, 60 * MIN)).toBeNull();
    expect(encounterState([...log, room(61 * MIN, "exit")], "practice", L, 200 * MIN)).toMatchObject({ phase: "pen", locked: false, penDeadline: null });
  });
});
