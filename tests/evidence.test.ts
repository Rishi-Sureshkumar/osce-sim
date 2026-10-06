import { describe, expect, it } from "vitest";
import { verifyEvidence } from "@/engine/evidence";
import { scoreAiItems } from "@/engine/scoring";
import type { MarkSheet } from "@/domain/schemas";
import { examine, makeLog, say } from "./helpers";

const log = makeLog([
  say("Hi Mr. Bennett, my name is Sam Patel, I'm a medical student."),
  { type: "patient_say", source: "system", payload: { text: "Nice to meet you." } },
  say("Is it OK if I listen to your heart?  Let me know if anything hurts."),
  examine("jvp_inspection", "neck_jvp_right"),
]);

describe("verifyEvidence", () => {
  it("accepts a verbatim quote from the cited action", () => {
    expect(verifyEvidence([{ actionId: "a1", quote: "my name is Sam Patel" }], log)[0]!.verified).toBe(true);
  });
  it("normalises whitespace and curly quotes only", () => {
    expect(verifyEvidence([{ actionId: "a1", quote: "I’m a medical student" }], log)[0]!.verified).toBe(true);
    expect(verifyEvidence([{ actionId: "a3", quote: "your heart? Let me know" }], log)[0]!.verified).toBe(true);
  });
  it("rejects paraphrases", () => {
    expect(verifyEvidence([{ actionId: "a1", quote: "my name is Samuel Patel" }], log)[0]!.verified).toBe(false);
  });
  it("rejects quotes attributed to the wrong action", () => {
    expect(verifyEvidence([{ actionId: "a3", quote: "my name is Sam Patel" }], log)[0]!.verified).toBe(false);
  });
  it("rejects unknown actions, non-quotable actions and empty quotes", () => {
    expect(verifyEvidence([{ actionId: "nope", quote: "Hi" }], log)[0]!.verified).toBe(false);
    expect(verifyEvidence([{ actionId: "a4", quote: "jvp" }], log)[0]!.verified).toBe(false);
    expect(verifyEvidence([{ actionId: "a1", quote: "   " }], log)[0]!.verified).toBe(false);
  });
});

describe("scoreAiItems", () => {
  const sheet: MarkSheet = {
    id: "h",
    title: "H",
    kind: "history",
    sourceNote: "",
    items: [
      { id: "intro", section: "S", label: "Introduces self", weight: 2, scoring: "ai", guidance: "g", sourceText: "" },
      { id: "comfort", section: "S", label: "Comfort", weight: 1, scoring: "ai", guidance: "g", sourceText: "" },
      { id: "empathy", section: "S", label: "Empathy", weight: 1, scoring: "ai", guidance: "g", sourceText: "" },
      { id: "missing", section: "S", label: "Missing", weight: 1, scoring: "ai", guidance: "g", sourceText: "" },
    ],
  };
  const scores = scoreAiItems(
    sheet,
    [
      { itemId: "intro", score: 1, rationale: "Introduced.", evidence: [{ actionId: "a1", quote: "my name is Sam Patel" }] },
      { itemId: "comfort", score: 1, rationale: "Checked comfort.", evidence: [{ actionId: "a3", quote: "tell me if it hurts" }] },
      { itemId: "empathy", score: 0.5, rationale: "Some empathy.", evidence: [] },
    ],
    log,
  );
  const by = Object.fromEntries(scores.map((s) => [s.itemId, s]));

  it("scores verified items", () => {
    expect(by.intro).toMatchObject({ status: "scored", points: 2, maxPoints: 2 });
  });
  it("flags unverifiable quotes as needs_review", () => {
    expect(by.comfort!.status).toBe("needs_review");
    expect(by.comfort!.evidence[0]!.verified).toBe(false);
  });
  it("flags credit without evidence as needs_review", () => {
    expect(by.empathy!.status).toBe("needs_review");
  });
  it("flags items the grader skipped as needs_review", () => {
    expect(by.missing).toMatchObject({ status: "needs_review", points: 0 });
  });
});
