import { describe, expect, it } from "vitest";
import { loadContentFromDisk } from "@/content/loadFromDisk";
import type { Action, Session } from "@/domain/schemas";
import { redactForStudent } from "@/server/session";

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
    expect(redactForStudent(exam, kase, session)).toBe(exam);
  });
  it('"end": text is withheld from the student until the station ends', () => {
    const endCase = { ...kase, findingsVisibility: "end" as const };
    const r = redactForStudent(exam, endCase, session);
    expect(r.type === "examine" && r.result).toMatchObject({ findingText: "", hidden: true });
    expect(r.type === "examine" && r.result?.wording).toBeUndefined();
    expect(redactForStudent(exam, endCase, { status: "submitted" } as Session)).toBe(exam);
  });
});
