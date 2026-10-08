import { describe, expect, it } from "vitest";
import type { Action, MarkSheet } from "@/domain/schemas";
import { activeElapsed, isPaused, nextHint, sectionProgress, timeIsUp } from "@/engine/practice";
import { evaluateRule } from "@/engine/rules";

let n = 0;
const act = (a: Record<string, unknown>, t: number) => ({ id: `a${++n}`, sessionId: "s", t, source: "system", ...a }) as Action;
const timer = (event: string, t: number) => act({ type: "timer", source: "click", payload: { event } }, t);

describe("practice timer", () => {
  it("subtracts paused time", () => {
    const log = [timer("pause", 10_000), timer("resume", 25_000), timer("pause", 40_000)];
    expect(activeElapsed(log, 30_000)).toBe(15_000);
    expect(activeElapsed(log, 50_000)).toBe(25_000); // still paused since 40 s
    expect(isPaused(log)).toBe(true);
    expect(isPaused(log.slice(0, 2))).toBe(false);
  });
  it("detects auto-end and scores the exam-only time item", () => {
    const log = [timer("warning", 780_000), timer("auto_end", 900_000)];
    expect(timeIsUp(log)).toBe(true);
    expect(evaluateRule({ not: { happened: "timer:auto_end" } }, log).value).toBe(0);
    expect(evaluateRule({ not: { happened: "timer:auto_end" } }, [timer("warning", 1)]).value).toBe(1);
  });
});

describe("hints and section checks", () => {
  const sheet: MarkSheet = {
    id: "m",
    title: "M",
    kind: "exam",
    sourceNote: "",
    items: [
      { id: "hh", section: "Courtesy", label: "Washes hands", weight: 1, scoring: "auto", rule: { courtesy: "hand_hygiene" }, sourceText: "" },
      { id: "jvp", section: "CV", label: "Inspects JVP", weight: 1, scoring: "auto", rule: { performed: "jvp_inspection" }, sourceText: "" },
      { id: "time", section: "CV", label: "On time", weight: 1, scoring: "auto", rule: { not: { happened: "timer:auto_end" } }, modes: ["exam"], sourceText: "" },
      { id: "talk", section: "CV", label: "Explains", weight: 1, scoring: "match", guidance: "g", sourceText: "" },
    ],
  };
  const log = [act({ type: "courtesy", source: "toolbar", payload: { kind: "hand_hygiene" } }, 1000)];
  it("next hint is the first unmet auto item", () => {
    expect(nextHint([sheet], log, "practice")).toEqual({ itemId: "jvp", text: "Consider: Inspects JVP" });
    expect(nextHint([sheet], [], "practice")?.itemId).toBe("hh");
  });
  it("section progress counts auto items for the mode only", () => {
    expect(sectionProgress([sheet], log, "practice")).toEqual([
      { markSheetId: "m", section: "Courtesy", done: 1, total: 1, missing: [] },
      { markSheetId: "m", section: "CV", done: 0, total: 1, missing: ["Inspects JVP"] },
    ]);
    expect(sectionProgress([sheet], log, "exam").find((s) => s.section === "CV")!.total).toBe(2);
  });
});
