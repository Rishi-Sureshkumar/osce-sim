import { describe, expect, it } from "vitest";
import type { Action } from "@/domain/schemas";
import { evaluateRule } from "@/engine/rules";
import { mmss } from "@/components/common/format";
import { courtesy, examine } from "./helpers";

/** Builds a log in the given ARRAY order with explicit t values (simulates out-of-order appends). */
const logOf = (entries: [ReturnType<typeof examine>, number][]): Action[] =>
  entries.map(([a, t], i) => ({ ...a, id: `a${i}`, sessionId: "s", t, seq: i + 1 }) as Action);

describe("M0 regression: scoring follows t, not array position", () => {
  // Reproduces the phase-1 bug: JVP examined at 00:03, hands washed at 00:04,
  // but the wash was appended to the log before the exam.
  const log = logOf([
    [courtesy("position", "reclined_30"), 3_100],
    [courtesy("hand_hygiene"), 4_200],
    [examine("jvp_inspection", "neck_jvp_right"), 3_600],
  ]);

  it("hand hygiene after the first exam (by t) scores 0", () => {
    expect(evaluateRule({ before: ["hand_hygiene", "first:examine"] }, log).value).toBe(0);
  });

  it("position is resolved by t order too", () => {
    expect(evaluateRule({ performedIn: { maneuver: "jvp_inspection", position: "reclined_30" } }, log).value).toBe(1);
    const late = logOf([
      [examine("jvp_inspection", "neck_jvp_right"), 2_000],
      [courtesy("position", "reclined_30"), 3_000],
    ]);
    // array order puts the position after; t order also does → not positioned
    expect(evaluateRule({ performedIn: { maneuver: "jvp_inspection", position: "reclined_30" } }, late).value).toBe(0);
    const swapped = logOf([
      [examine("jvp_inspection", "neck_jvp_right"), 5_000],
      [courtesy("position", "reclined_30"), 3_000],
    ]);
    // array says exam first, t says position first → positioned
    expect(evaluateRule({ performedIn: { maneuver: "jvp_inspection", position: "reclined_30" } }, swapped).value).toBe(1);
  });

  it("ties on t are broken by seq", () => {
    const tie = logOf([
      [examine("jvp_inspection", "neck_jvp_right"), 1_000],
      [courtesy("hand_hygiene"), 1_000],
    ]);
    expect(evaluateRule({ before: ["hand_hygiene", "first:examine"] }, tie).value).toBe(0);
  });
});

describe("mmss", () => {
  it("floors to the whole second everywhere", () => {
    expect(mmss(3_999)).toBe("00:03");
    expect(mmss(4_000)).toBe("00:04");
    expect(mmss(59_999)).toBe("00:59");
    expect(mmss(61_500)).toBe("01:01");
    expect(mmss(0)).toBe("00:00");
  });
});
