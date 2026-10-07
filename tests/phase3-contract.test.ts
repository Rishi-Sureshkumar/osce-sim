import { describe, expect, it } from "vitest";
import { ActionInput, Case, MarkSheet, type Action, type ActionInput as AI } from "@/domain/schemas";
import { evaluateRule } from "@/engine/rules";
import { quotableText, verifyEvidence } from "@/engine/evidence";
import { loadContentFromDisk } from "@/content/loadFromDisk";
import { makeLog } from "./helpers";

const c = loadContentFromDisk();
const examineAt = (maneuverId: string, regionId: string, distanceCm?: number, toleranceCm?: number): AI =>
  ({ type: "examine", source: "click", payload: { maneuverId, regionId, ...(distanceCm !== undefined ? { distanceCm, toleranceCm } : {}) } }) as AI;

describe("phase 3 schema contract", () => {
  it("every region has a 3D group; mouth and nose are verbal; 2D aliases are hidden", () => {
    for (const r of c.regions) expect(r.group, r.id).toBeTruthy();
    expect(c.regionById.get("mouth")!.verbal).toBe(true);
    expect(c.regionById.get("nose")!.verbal).toBe(true);
    expect(c.regionById.get("head")!.hidden).toBe(true);
    for (const id of ["breast_left", "breast_right", "pelvic"]) expect(c.regionById.has(id), id).toBe(true);
  });

  it("new action inputs parse", () => {
    const inputs = [
      { type: "sit_down", source: "click", payload: {} },
      { type: "describe_exam", source: "voice", payload: { regionId: "mouth", text: "I would look at the tongue and tonsils with a light." } },
      { type: "prohibited_attempt", source: "click", payload: { regionId: "breast_left" } },
      { type: "tool_contact", source: "click", payload: { tool: "stethoscope", toolMode: "bell", nearestRegionId: "cardiac_mitral", distanceCm: 4, toleranceCm: 2.5, durationMs: 3200, outcome: "near" } },
      { type: "submit_pen", source: "text", payload: { history: "orthopnea", exam: "S3", diagnoses: [{ diagnosis: "HF" }] } },
      { type: "timer", source: "system", payload: { event: "begin" } },
    ];
    for (const i of inputs) expect(ActionInput.safeParse(i).success, i.type).toBe(true);
    expect(ActionInput.safeParse({ type: "submit_pen", source: "text", payload: { history: "", exam: "", diagnoses: [1, 2, 3, 4].map((n) => ({ diagnosis: `d${n}` })) } }).success).toBe(false);
  });

  it("placedWithin credits only findings recorded inside the tolerance, in the right position", () => {
    const pos = (p: string): AI => ({ type: "state_change", source: "click", payload: { position: p, via: "direct" } }) as AI;
    const rule = { placedWithin: { maneuver: "auscultate_heart_bell", regions: ["cardiac_mitral"], position: "left_lateral_decubitus" as const } };
    expect(evaluateRule(rule, makeLog([pos("left_lateral_decubitus"), examineAt("auscultate_heart_bell", "cardiac_mitral", 1.2, 2.5)])).value).toBe(1);
    expect(evaluateRule(rule, makeLog([pos("supine"), examineAt("auscultate_heart_bell", "cardiac_mitral", 1.2, 2.5)])).value).toBe(0);
    expect(evaluateRule(rule, makeLog([pos("left_lateral_decubitus"), examineAt("auscultate_heart_bell", "cardiac_mitral", 4, 2.5)])).value).toBe(0);
  });

  it("event refs for sitting, verbal exams and prohibited attempts", () => {
    const log = makeLog([
      { type: "sit_down", source: "click", payload: {} },
      { type: "describe_exam", source: "text", payload: { regionId: "mouth", text: "inspect the oropharynx" } },
      { type: "prohibited_attempt", source: "click", payload: { regionId: "pelvic" } },
    ] as AI[]);
    expect(evaluateRule({ happened: "sit_down" }, log).value).toBe(1);
    expect(evaluateRule({ happened: "describe:mouth" }, log).value).toBe(1);
    expect(evaluateRule({ happened: "describe:nose" }, log).value).toBe(0);
    expect(evaluateRule({ happened: "prohibited:pelvic" }, log).value).toBe(1);
  });

  it("verbal exams and the PEN are quotable evidence", () => {
    const log = makeLog([
      { type: "describe_exam", source: "text", payload: { regionId: "nose", text: "Look inside the nares for swelling." } },
      { type: "submit_pen", source: "text", payload: { history: "- 3-pillow orthopnea", exam: "- S3 at apex", diagnoses: [{ diagnosis: "Heart failure", support: "S3, edema" }] } },
    ] as AI[]) as Action[];
    expect(quotableText(log[1]!)).toContain("S3 at apex");
    const ev = verifyEvidence([{ actionId: log[0]!.id, quote: "nares for swelling" }, { actionId: log[1]!.id, quote: "3-pillow orthopnea" }], log);
    expect(ev.every((e) => e.verified)).toBe(true);
  });

  it("domain mark sheets and case 1B fields parse", () => {
    expect(MarkSheet.safeParse({ id: "x", title: "X", kind: "history", domain: "communication", passThreshold: 0.7, attribution: "Courtesy of someone", sourceNote: "", items: [{ id: "a", section: "S", label: "L", weight: 1, scoring: "not_assessable", notAssessableReason: "r" }] }).success).toBe(true);
    const hf = structuredClone(c.caseById.get("hf-decompensated-01")!) as Record<string, unknown>;
    hf.doorInstructions = { reasonForVisit: "breathless", task: "history and focused exam", prohibitedExams: [{ label: "Breast exam", regionIds: ["breast_left", "breast_right"] }] };
    hf.timeLimits = { encounterMin: 15, penMin: 10 };
    hf.peChecklist = [{ id: "jvp", section: "Cardiovascular", label: "JVP", weight: 1, scoring: "auto", rule: { performed: "jvp_inspection" } }];
    hf.penKey = { history: [{ id: "orthopnea", text: "Orthopnea", kind: "positive" }], exam: [{ id: "s3", text: "S3", maneuverIds: ["auscultate_heart_bell"] }], differential: [{ id: "adhf", diagnosis: "Heart failure", rank: 1, rationale: "S3" }] };
    expect(Case.safeParse(hf).success).toBe(true);
  });
});
