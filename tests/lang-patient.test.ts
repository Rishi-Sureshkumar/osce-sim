import { describe, expect, it } from "vitest";
import { loadContentFromDisk } from "@/content/loadFromDisk";
import type { Action } from "@/domain/schemas";
import { buildBank } from "@/lang/bank";
import { understandTurn } from "@/lang/understand";

// The deterministic patient without embeddings: exact and keyword matching only, so these tests
// pin behaviour that never depends on the model.
const content = loadContentFromDisk();
const kase = content.caseById.get("hf-decompensated-01")!;
const bank = buildBank(kase, content.lang);
const fact = (id: string) => kase.history.facts.find((f) => f.id === id)!;
const neg = (id: string) => kase.history.pertinentNegatives.find((n) => n.id === id)!;

let t = 0;
function turn(log: Action[], text: string, studentName: string | null = null) {
  const r = understandTurn(kase, bank, log, text, null, { studentName });
  log.push({ id: `s${++t}`, sessionId: "s", t, type: "say", source: "text", payload: { text } });
  log.push({ id: `p${t}`, sessionId: "s", t, type: "patient_say", source: "system", payload: { text: r.reply.text, match: r.reply.match } });
  return r;
}

describe("deterministic patient", () => {
  it("opens with the case's opening statement", () => {
    expect(turn([], "What brings you in today?").reply.text).toBe(kase.history.openingStatement);
  });

  it("answers a history question with the case fact verbatim and logs what was matched", () => {
    const r = turn([], fact("orthopnea").intents!.canonical);
    expect(r.reply.text).toBe(fact("orthopnea").answer);
    expect(r.reply.match.clauses[0]).toMatchObject({ target: "fact:orthopnea", kind: "fact" });
    expect(r.reply.match.topics.length).toBeGreaterThan(0);
  });

  it("answers each part of a bundled question once, in order", () => {
    const r = turn([], `${fact("orthopnea").intents!.canonical} And ${neg("neg-chest-pain-pressure").intents!.canonical}`);
    expect(r.reply.text).toBe(`${fact("orthopnea").answer} ${neg("neg-chest-pain-pressure").answer}`);
  });

  it("anything else? volunteers an unasked fact once, then the bank reply", () => {
    const log: Action[] = [];
    const volunteer = kase.history.facts.find((f) => !f.revealOnlyIfAsked)!;
    expect(turn(log, "Is there anything else you'd like to tell me?").reply.text).toBe(volunteer.answer);
    const again = turn(log, "Is there anything else you'd like to tell me?").reply.text;
    expect(again).not.toBe(volunteer.answer);
    expect(content.lang.conversation.find((c) => c.kind === "anything_else")!.replies).toContain(again);
  });

  it("asked to repeat, the patient says their last line again", () => {
    const log: Action[] = [];
    turn(log, fact("orthopnea").intents!.canonical);
    expect(turn(log, "Sorry, could you say that again?").reply.text).toContain(fact("orthopnea").answer);
  });

  it("an unrelated question gets the case's unknown reply; never invented text", () => {
    expect(turn([], "Which football team do you support?").reply.text).toBe(kase.history.unknownPolicy.unknownReply);
  });

  it("fills placeholders: the student's name from their introduction, never a raw {token}", () => {
    const r = turn([], "My name is Sam and I'm a medical student.", "Sam");
    expect(r.reply.text).toContain("Sam");
    expect(r.reply.text).not.toMatch(/[{}]/);
    expect(turn([], "My name is Sam and I'm a medical student.", null).reply.text).not.toMatch(/[{}]|\s,/);
  });

  it("follow-ups resolve against the last fact discussed (from the log)", () => {
    const withFollowUps = kase.history.facts.find((f) => f.followUps.length)!;
    const log: Action[] = [];
    turn(log, withFollowUps.intents!.canonical);
    const fu = withFollowUps.followUps[0]!;
    expect(turn(log, fu.intents.canonical).reply.text).toBe(fu.answer);
  });

  it("every reply in a long scripted interview is case or bank text", () => {
    const allowed = new Set<string>([
      kase.history.openingStatement,
      kase.history.unknownPolicy.unknownReply,
      kase.history.unknownPolicy.negativeReply,
      ...kase.history.facts.flatMap((f) => [f.answer, ...f.followUps.map((u) => u.answer)]),
      ...kase.history.pertinentNegatives.map((n) => n.answer ?? ""),
      ...kase.history.emotionCues.map((e) => e.acknowledgement),
      ...content.lang.conversation.flatMap((c) => c.replies),
      ...content.lang.history.map((h) => h.reply ?? ""),
    ]);
    const log: Action[] = [];
    for (const q of [...kase.history.facts.map((f) => f.intents!.canonical), ...kase.history.pertinentNegatives.map((n) => n.intents!.canonical), "How was the traffic?", "Thanks, take care."]) {
      const { reply } = turn(log, q);
      // a reply joins whole answers; each must be an allowed text (after placeholder filling)
      let rest = reply.text;
      for (const a of [...allowed].filter(Boolean).map((s) => s.replace(/\{patient\.name\}/g, kase.patient.name)).sort((x, y) => y.length - x.length)) rest = rest.split(a).join("");
      expect(rest.trim(), `"${q}" → "${reply.text}"`).toBe("");
    }
  });
});
