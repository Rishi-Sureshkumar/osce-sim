/**
 * Bug 10 (found by the catalog harness): with two stethoscope exams on the same region (bowel sounds
 * and renal/aortic bruits on the abdomen), the hold always recorded the first one, so bruits could
 * never be recorded. The hold must ask which exam when several fit, then remember the choice.
 */
import { describe, expect, it } from "vitest";
import { loadContentFromDisk } from "@/content/loadFromDisk";
import { holdCandidate } from "@/exam3d/tools/decide";

const maneuvers = loadContentFromDisk().maneuvers;

describe("bug 10: stethoscope hold with several fitting exams", () => {
  it("asks which exam instead of always taking the first", () => {
    const r = holdCandidate(maneuvers, "stethoscope", "diaphragm", "abd_ruq");
    expect(r).toEqual({ ask: expect.arrayContaining(["bowel_sounds", "abd_bruits"]) });
  });
  it("uses the student's last choice on a region not yet listened to, and asks again where it was used", () => {
    const remembered = { maneuverId: "abd_bruits", done: ["abd_ruq"] };
    expect(holdCandidate(maneuvers, "stethoscope", "diaphragm", "abd_luq", remembered)).toEqual({ maneuverId: "abd_bruits" });
    expect(holdCandidate(maneuvers, "stethoscope", "diaphragm", "abd_ruq", remembered)).toEqual({ ask: expect.arrayContaining(["bowel_sounds", "abd_bruits"]) });
  });
  it("a single fitting exam needs no question", () => {
    expect(holdCandidate(maneuvers, "stethoscope", "bell", "cardiac_mitral")).toEqual({ maneuverId: "auscultate_heart_bell" });
  });
});
