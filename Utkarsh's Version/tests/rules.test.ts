import { describe, expect, it } from "vitest";
import { evaluateRule } from "@/engine/rules";
import { courtesy, examine, makeLog, say } from "./helpers";

const log = makeLog([
  say("Hello Mr. Bennett"),
  courtesy("hand_hygiene"),
  courtesy("position", "reclined_30"),
  examine("jvp_inspection", "neck_jvp_right"),
  courtesy("position", "left_lateral_decubitus"),
  examine("auscultate_heart_bell", "cardiac_mitral"),
  examine("auscultate_heart_diaphragm", "cardiac_mitral"),
  examine("auscultate_heart_diaphragm", "cardiac_aortic"),
]);

describe("rule interpreter", () => {
  it("performed: any matching examine", () => {
    expect(evaluateRule({ performed: "jvp_inspection" }, log)).toEqual({ value: 1, actionIds: ["a4"] });
    expect(evaluateRule({ performed: "pmi_palpation" }, log).value).toBe(0);
    expect(evaluateRule({ performed: ["pmi_palpation", "jvp_inspection"] }, log).value).toBe(1);
  });

  it("performed with regions: all-or-nothing by default, fractional when partial", () => {
    const regions = ["cardiac_aortic", "cardiac_pulmonic", "cardiac_erbs", "cardiac_tricuspid", "cardiac_mitral"];
    expect(evaluateRule({ performed: "auscultate_heart_diaphragm", regions }, log).value).toBe(0);
    const partial = evaluateRule({ performed: "auscultate_heart_diaphragm", regions, partial: true }, log);
    expect(partial.value).toBeCloseTo(0.4);
    expect(partial.actionIds.sort()).toEqual(["a7", "a8"]);
  });

  it("minRegions", () => {
    expect(evaluateRule({ performed: "auscultate_heart_diaphragm", minRegions: 2 }, log).value).toBe(1);
    expect(evaluateRule({ performed: "auscultate_heart_diaphragm", minRegions: 4, partial: true }, log).value).toBe(0.5);
  });

  it("courtesy, with and without position", () => {
    expect(evaluateRule({ courtesy: "hand_hygiene" }, log).value).toBe(1);
    expect(evaluateRule({ courtesy: "drape" }, log).value).toBe(0);
    expect(evaluateRule({ courtesy: "position", position: "reclined_30" }, log).value).toBe(1);
    expect(evaluateRule({ courtesy: "position", position: "prone" }, log).value).toBe(0);
  });

  it("before: ordering of event refs", () => {
    expect(evaluateRule({ before: ["hand_hygiene", "first:examine"] }, log).value).toBe(1);
    expect(evaluateRule({ before: ["first:examine", "hand_hygiene"] }, log).value).toBe(0);
    expect(evaluateRule({ before: ["maneuver:auscultate_heart_diaphragm", "maneuver:auscultate_heart_bell"] }, log).value).toBe(0);
    expect(evaluateRule({ before: ["position:reclined_30", "maneuver:jvp_inspection"] }, log).value).toBe(1);
    expect(evaluateRule({ before: ["drape", "first:examine"] }, log).value).toBe(0); // missing event
    expect(evaluateRule({ before: ["first:say", "last:examine"] }, log).value).toBe(1);
  });

  it("before: hand hygiene after the first exam fails", () => {
    const late = makeLog([examine("jvp_inspection", "neck_jvp_right"), courtesy("hand_hygiene")]);
    expect(evaluateRule({ before: ["hand_hygiene", "first:examine"] }, late).value).toBe(0);
  });

  it("performedIn: position at the time of the maneuver", () => {
    expect(evaluateRule({ performedIn: { maneuver: "jvp_inspection", position: "reclined_30" } }, log).value).toBe(1);
    expect(evaluateRule({ performedIn: { maneuver: "auscultate_heart_bell", position: "left_lateral_decubitus" } }, log).value).toBe(1);
    expect(evaluateRule({ performedIn: { maneuver: "auscultate_heart_bell", position: "reclined_30" } }, log).value).toBe(0);
    expect(evaluateRule({ performedIn: { maneuver: "jvp_inspection", position: ["supine", "reclined_30"] } }, log).value).toBe(1);
    // never positioned at all
    const unpositioned = makeLog([examine("jvp_inspection", "neck_jvp_right")]);
    expect(evaluateRule({ performedIn: { maneuver: "jvp_inspection", position: "reclined_30" } }, unpositioned).value).toBe(0);
  });

  it("all / any / not / submitted", () => {
    expect(evaluateRule({ all: [{ courtesy: "hand_hygiene" }, { performed: "jvp_inspection" }] }, log).value).toBe(1);
    expect(evaluateRule({ all: [{ courtesy: "hand_hygiene" }, { performed: "pmi_palpation" }] }, log).value).toBe(0);
    expect(evaluateRule({ any: [{ courtesy: "drape" }, { performed: "jvp_inspection" }] }, log).value).toBe(1);
    expect(evaluateRule({ not: { courtesy: "drape" } }, log).value).toBe(1);
    expect(evaluateRule({ submitted: "submit_ddx" }, log).value).toBe(0);
  });
});
