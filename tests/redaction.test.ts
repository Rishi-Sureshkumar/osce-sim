import { describe, expect, it } from "vitest";
import { loadContentFromDisk } from "@/content/loadFromDisk";
import type { Action, Session } from "@/domain/schemas";
import { redactForStudent, visibleToStudent } from "@/server/session";

const kase = loadContentFromDisk().caseById.get("hf-decompensated-01")!;
const session = { status: "active" } as Session;
const exam: Action = {
  id: "a1",
  sessionId: "s",
  t: 1,
  type: "examine",
  source: "click",
  payload: { regionId: "neck_jvp_right", maneuverId: "jvp_inspection" },
  result: { findingText: "JVP clearly elevated", resolvedFrom: "case_default", wording: "You see a raised JVP." },
};

describe("findingsVisibility", () => {
  it("immediate (default): findings go to the student as resolved", () => {
    expect(redactForStudent(exam, kase, session)).toEqual(exam);
  });
  it('"end": text is withheld from the student until the station ends', () => {
    const endCase = { ...kase, findingsVisibility: "end" as const };
    const r = redactForStudent(exam, endCase, session);
    expect(r.type === "examine" && r.result).toMatchObject({ findingText: "", hidden: true });
    expect(r.type === "examine" && r.result?.wording).toBeUndefined();
    expect(redactForStudent(exam, endCase, { status: "submitted" } as Session)).toBe(exam);
  });
});

describe("hidden anchors stay hidden while the station is active", () => {
  const toolExam: Action = { ...exam, payload: { regionId: "cardiac_mitral", maneuverId: "auscultate_heart_bell", tool: "stethoscope", toolMode: "bell", placementError: 0.6, distanceCm: 1.5, toleranceCm: 2.5, durationMs: 3000 } } as Action;
  const contact: Action = { id: "c1", sessionId: "s", t: 2, type: "tool_contact", source: "click", payload: { tool: "stethoscope", nearestRegionId: "cardiac_mitral", distanceCm: 4, toleranceCm: 2.5, durationMs: 3200, outcome: "near" } };
  it("strips placement distances from tool exams and hides tool contacts from the student log", () => {
    const r = redactForStudent(toolExam, kase, session);
    expect(r.type === "examine" && r.payload).toEqual({ regionId: "cardiac_mitral", maneuverId: "auscultate_heart_bell", tool: "stethoscope", toolMode: "bell", durationMs: 3000 });
    expect(visibleToStudent(contact, session)).toBe(false);
    const c = redactForStudent(contact, kase, session);
    expect(c.type === "tool_contact" && [c.payload.distanceCm, c.payload.toleranceCm]).toEqual([0, 0]);
  });
  it("after the station they are shown in full (results and coach)", () => {
    const done = { status: "submitted" } as Session;
    expect(redactForStudent(toolExam, kase, done)).toBe(toolExam);
    expect(visibleToStudent(contact, done)).toBe(true);
  });
});
