import { describe, expect, it } from "vitest";
import { loadContentFromDisk } from "@/content/loadFromDisk";
import { buildCaseBlock, buildMessages, PATIENT_RULES } from "@/server/ai/patientPrompt";
import { findingValueText } from "@/engine/resolveFinding";
import { mockPatientReply } from "@/server/ai/mock";
import { passesWordingGuard } from "@/server/ai/wordingGuard";
import { makeLog, say } from "./helpers";

const hf = loadContentFromDisk().caseById.get("hf-decompensated-01")!;

describe("patient prompt", () => {
  const block = buildCaseBlock(hf);

  it("includes history facts, negatives and the unknown policy", () => {
    expect(block).toContain("three pillows");
    expect(block).toContain("[only if asked]");
    expect(block).toContain(hf.history.unknownPolicy.unknownReply);
  });

  it("never includes exam findings, vitals or the expected differential (invariant 1)", () => {
    const prompt = PATIENT_RULES + block;
    for (const findings of Object.values(hf.abnormalFindings)) {
      for (const v of Object.values(findings)) expect(prompt).not.toContain(findingValueText(v));
    }
    for (const d of hf.expectedDifferential) expect(prompt).not.toContain(d.diagnosis);
    expect(prompt).not.toContain(String(hf.vitals.spo2) + "%");
  });

  it("builds alternating messages from the log, starting with the student", () => {
    const log = makeLog([
      { type: "patient_say", source: "system", payload: { text: "stray" } },
      say("Hello"),
      say("What brings you in?"),
      { type: "patient_say", source: "system", payload: { text: "I can't breathe." } },
      { type: "examine", source: "click", payload: { regionId: "cardiac_mitral", maneuverId: "auscultate_heart_bell" } },
      say("How long?"),
    ]);
    expect(buildMessages(log)).toEqual([
      { role: "user", content: "Hello\nWhat brings you in?" },
      { role: "assistant", content: "I can't breathe." },
      { role: "user", content: "How long?" },
    ]);
  });
});

describe("mock patient", () => {
  it("answers from case facts by keyword, else the unknown policy", () => {
    expect(mockPatientReply(hf, "What brings you in today?", 0)).toBe(hf.history.openingStatement);
    expect(mockPatientReply(hf, "Can you lie flat at night?", 2)).toContain("three pillows");
    expect(mockPatientReply(hf, "Any chest pain?", 3)).toContain("No chest pain");
    expect(mockPatientReply(hf, "Have you ever been to Mars?", 4)).toBe(hf.history.unknownPolicy.unknownReply);
  });
});

describe("wording guard", () => {
  const raw = "3+ pitting edema extending to mid-shin.";
  it("accepts faithful rewording", () => {
    expect(passesWordingGuard(raw, "You find 3+ pitting edema that reaches the mid-shin.")).toBe(true);
  });
  it("rejects new numbers or sides", () => {
    expect(passesWordingGuard(raw, "You find 2+ pitting edema to the mid-shin.")).toBe(false);
    expect(passesWordingGuard(raw, "You find 3+ pitting edema on the left shin.")).toBe(false);
    expect(passesWordingGuard(raw, "")).toBe(false);
  });
});
