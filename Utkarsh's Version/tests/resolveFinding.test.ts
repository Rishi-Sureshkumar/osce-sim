import { describe, expect, it } from "vitest";
import type { Case, ExamManeuver } from "@/domain/schemas";
import { InvalidExamError, resolveFinding } from "@/engine/resolveFinding";

const maneuver: ExamManeuver = {
  id: "auscultate_lungs",
  fcmId: 42,
  label: "Lungs",
  system: "pulmonary",
  technique: "auscultate",
  allowedRegions: ["lung_post_rl", "lung_post_ll", "lung_post_ru"],
  normalFinding: { default: "Vesicular breath sounds.", lung_post_ru: "Vesicular (upper zone)." },
  demo: { steps: ["Listen"] },
  sourceText: "",
};
const vitals = { hr: 104, rr: 24, bpSystolic: 148, bpDiastolic: 92, tempC: 36.8, spo2: 89, spo2Context: "on room air" };
const kase = (abnormalFindings: Case["abnormalFindings"]) => ({ abnormalFindings, vitals });

describe("resolveFinding", () => {
  it("returns the case's region-specific abnormal finding first", () => {
    const r = resolveFinding(kase({ auscultate_lungs: { lung_post_rl: "Crackles R base.", default: "Crackles." } }), maneuver, "lung_post_rl");
    expect(r).toEqual({ findingText: "Crackles R base.", resolvedFrom: "case_region" });
  });

  it("falls back to the case's default abnormal finding for other regions", () => {
    const r = resolveFinding(kase({ auscultate_lungs: { lung_post_rl: "Crackles R base.", default: "Crackles." } }), maneuver, "lung_post_ll");
    expect(r).toEqual({ findingText: "Crackles.", resolvedFrom: "case_default" });
  });

  it("uses the catalog's region-specific normal when the case has no abnormal finding", () => {
    const r = resolveFinding(kase({ auscultate_lungs: { lung_post_rl: "Crackles R base." } }), maneuver, "lung_post_ru");
    expect(r).toEqual({ findingText: "Vesicular (upper zone).", resolvedFrom: "catalog_region" });
  });

  it("falls back to the catalog's default normal finding", () => {
    const r = resolveFinding(kase({ auscultate_lungs: { lung_post_rl: "Crackles R base." } }), maneuver, "lung_post_ll");
    expect(r).toEqual({ findingText: "Vesicular breath sounds.", resolvedFrom: "catalog_default" });
  });

  it("ignores abnormal findings for other maneuvers", () => {
    const r = resolveFinding(kase({ chest_percussion: { default: "Dull." } }), maneuver, "lung_post_ll");
    expect(r.resolvedFrom).toBe("catalog_default");
  });

  it("fills vitals placeholders from the case", () => {
    const pulse = { ...maneuver, id: "pulse_radial", allowedRegions: ["wrist_right"], normalFinding: { default: "HR {vitals.hr}, BP {vitals.bpSystolic}/{vitals.bpDiastolic}, {vitals.spo2}% {vitals.spo2Context}" } };
    expect(resolveFinding(kase({}), pulse, "wrist_right").findingText).toBe("HR 104, BP 148/92, 89% on room air");
  });

  it("rejects a region the maneuver does not allow", () => {
    expect(() => resolveFinding(kase({}), maneuver, "abd_ruq")).toThrow(InvalidExamError);
  });
});
