import { describe, expect, it } from "vitest";
import { FakeEngine } from "@/lang/webllm/engine";
import { faithful, passesWordingGuard } from "@/lang/webllm/guard";
import { rephrase } from "@/lang/webllm/rephrase";
import { secondOpinion } from "@/lang/webllm/secondOpinion";

const LINE = "I sleep on three pillows now, and I don't have any chest pain.";

describe("WebLLM faithfulness guard", () => {
  it("accepts a rewording that keeps facts, numbers and negations", () => {
    expect(faithful(LINE, "These days I sleep on three pillows, and no, I don't get chest pain.").ok).toBe(true);
  });
  it("rejects new or dropped numbers, sides and flipped negation", () => {
    expect(faithful("My left ankle has been swollen for 2 weeks.", "My left ankle has been swollen for 3 weeks.").reason).toMatch(/number/);
    expect(faithful("My left ankle has been swollen for 2 weeks.", "My right ankle has been swollen for 2 weeks.").reason).toMatch(/side/);
    expect(faithful("I don't have chest pain.", "I have chest pain.").reason).toBe("negation changed");
  });
  it("rejects invented content and empty or bloated output", () => {
    expect(faithful(LINE, "").ok).toBe(false);
    expect(faithful("I get breathless climbing stairs.", "I get breathless climbing stairs, and I also cough blood, have fevers, night sweats and lost weight recently.").ok).toBe(false);
    expect(faithful("Yes.", "Yes. ".repeat(40)).reason).toBe("too long");
  });
  it("finding guard: numbers and sides only", () => {
    expect(passesWordingGuard("JVP 8 cm above the sternal angle, right side.", "The JVP is 8 cm on the right.")).toBe(true);
    expect(passesWordingGuard("JVP 8 cm.", "JVP 9 cm.")).toBe(false);
    expect(passesWordingGuard("Crackles at the right base.", "Crackles at the left base.")).toBe(false);
  });
});

describe("rephrase (display only, falls back to the original)", () => {
  it("is off without an engine", async () => {
    expect(await rephrase(null, LINE)).toEqual({ text: LINE, rephrased: false, reason: "off" });
  });
  it("uses a faithful rewording", async () => {
    const r = await rephrase(new FakeEngine(() => "These days I sleep on three pillows, and no, I don't get chest pain."), LINE);
    expect(r.rephrased).toBe(true);
  });
  it("rejects an unfaithful rewording", async () => {
    const r = await rephrase(new FakeEngine(() => "I sleep on four pillows and I have chest pain."), LINE);
    expect(r).toMatchObject({ text: LINE, rephrased: false });
  });
  it("times out and aborts a slow engine", async () => {
    const r = await rephrase(new FakeEngine(() => "too late", { delayMs: 500 }), LINE, 30);
    expect(r).toMatchObject({ text: LINE, rephrased: false, reason: "timeout" });
  });
  it("survives an engine error", async () => {
    const r = await rephrase(new FakeEngine(() => "x", { fail: true }), LINE);
    expect(r).toMatchObject({ text: LINE, rephrased: false, reason: "engine failed" });
  });
});

describe("secondOpinion (advisory, verbatim quote only)", () => {
  const item = { label: "Asks about orthopnea" };
  const lines = ["How many pillows do you sleep on?", "Any chest pain?"];
  it("credit cites one of the given lines verbatim", async () => {
    const r = await secondOpinion(new FakeEngine(() => "CREDIT 1 | asks about pillows"), item, lines);
    expect(r).toEqual({ verdict: "likely_credit", quote: lines[0], note: "asks about pillows" });
  });
  it("a cited line that doesn't exist is unsure", async () => {
    expect((await secondOpinion(new FakeEngine(() => "CREDIT 7"), item, lines)).verdict).toBe("unsure");
  });
  it("no credit, unreadable, timeout and error", async () => {
    expect((await secondOpinion(new FakeEngine(() => "NO CREDIT - never asked"), item, lines)).verdict).toBe("likely_no_credit");
    expect((await secondOpinion(new FakeEngine(() => "maybe?"), item, lines)).note).toMatch(/couldn't be read/);
    expect((await secondOpinion(new FakeEngine(() => "CREDIT 1", { delayMs: 200 }), item, lines, 20)).note).toMatch(/timeout/);
    expect((await secondOpinion(new FakeEngine(() => "", { fail: true }), item, lines)).verdict).toBe("unsure");
    expect((await secondOpinion(null, item, lines)).verdict).toBe("unsure");
  });
});
