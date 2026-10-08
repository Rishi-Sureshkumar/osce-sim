import { describe, expect, it } from "vitest";
import { loadContentFromDisk } from "@/content/loadFromDisk";
import { applyOverrides, scoreAiItems, scoreDeterministicItems, totals } from "@/engine/scoring";
import { sheetsForCase } from "@/engine/sheets";
import { gradeMatchItems } from "@/lang/grade";
import { makeNormalizer } from "@/lang/normalize";
import { courtesy, examine, makeLog, say } from "./helpers";

const c = loadContentFromDisk();
const exam = c.markSheetById.get("exam-fcm1")!;
const history = c.markSheetById.get("communication-1b")!;

const log = makeLog([
  say("Hello Mr. Bennett, my name is Sam Patel and I'm a medical student. What brings you in today?"),
  { type: "patient_say", source: "system", payload: { text: "I can't catch my breath." } },
  say("Tell me more about that. Do you get short of breath when you lie flat?"),
  courtesy("hand_hygiene"),
  courtesy("position", "reclined_30"),
  examine("jvp_inspection", "neck_jvp_right"),
  courtesy("position", "left_lateral_decubitus"),
  examine("auscultate_heart_bell", "cardiac_mitral"),
  ...["cardiac_aortic", "cardiac_pulmonic", "cardiac_erbs", "cardiac_tricuspid", "cardiac_mitral"].map((r) => examine("auscultate_heart_diaphragm", r)),
  examine("auscultate_lungs", "lung_post_rl"),
]);

/** keyword/pattern-only grading (no embedding model): deterministic and fast */
const grade = (sheet: typeof history) =>
  gradeMatchItems({ kase: c.caseById.get("hf-decompensated-01")!, sheets: [sheet], log, check: null, normalize: makeNormalizer(c.lang.synonyms), embed: () => null });

describe("grading pipeline (rules + deterministic language matching)", () => {
  const det = scoreDeterministicItems(exam, log);
  const by = Object.fromEntries(det.map((s) => [s.itemId, s]));

  it("scores auto items from the log", () => {
    expect(by["fcm-01-hand-hygiene"]!.value).toBe(1);
  });

  it("hand hygiene before first exam, JVP at 30°, bell in LLD, all five diaphragm areas", () => {
    expect(by["fcm-33-jvp"]!.value).toBe(1);
    expect(by["fcm-33-jvp-position"]!.value).toBe(1);
    expect(by["fcm-38-bell-lld"]!.value).toBe(1);
    expect(by["fcm-38-heart-diaphragm"]!.value).toBe(1);
    expect(by["fcm-42-lung-ausc"]!.value).toBeCloseTo(0.1);
    expect(by["fcm-03-drape"]!.value).toBe(0);
    expect(by["fcm-02-notes"]!.status).toBe("not_assessable");
  });

  it("language-matched items quote the student's own sentence verbatim and pass verification", () => {
    const ai = scoreAiItems(history, grade(history), log);
    const intro = ai.find((s) => s.itemId === "greet-by-name")!;
    expect(intro.status).toBe("scored");
    expect(intro.value).toBe(1);
    expect(intro.evidence[0]!.verified).toBe(true);
    expect(intro.evidence[0]!.quote).toMatch(/Mr\. Bennett/);
    const enc = c.markSheetById.get("encounter-1b")!;
    const ros = scoreAiItems(enc, grade(enc), log).find((s) => s.itemId === "ros-gu")!;
    expect(ros.value).toBe(0);
    expect(ros.status).toBe("scored");
  });

  it("overrides replace points but keep the original", () => {
    const s = det.find((x) => x.itemId === "fcm-03-drape")!;
    const [eff] = applyOverrides([s], [
      { id: "o1", sessionId: "s1", gradingRunId: "g1", markSheetId: exam.id, itemId: s.itemId, coach: "Dr C", originalPoints: 0, newPoints: 1, reason: "Draped verbally", createdAt: "2026-01-01T00:00:00Z" },
    ]);
    expect(eff!.points).toBe(1);
    expect(eff!.override?.originalPoints).toBe(0);
    expect(totals([eff!]).points).toBe(1);
  });
});

describe("note items respect polarity", () => {
  const kase = c.caseById.get("hf-decompensated-01")!;
  const penSheet = sheetsForCase(kase, c.markSheetById).find((s) => s.items.some((i) => i.id.startsWith("pen-ex-")))!;
  const gradeNote = (exam: string, history = "") =>
    gradeMatchItems({
      kase,
      sheets: [penSheet],
      log: makeLog([examine("jvp_inspection", "neck_jvp_right"), { type: "submit_pen", source: "text", payload: { history, exam, diagnoses: [] } }]),
      check: null,
      normalize: makeNormalizer(c.lang.synonyms),
      embed: () => null,
    });
  const score = (js: ReturnType<typeof gradeNote>, id: string) => js.find((j) => j.itemId === id)?.score;
  it("a denied finding earns no credit for the positive item; a stated one does", () => {
    const jvpId = penSheet.items.find((i) => i.id.startsWith("pen-ex-") && i.id.includes("jvp"))!.id;
    expect(score(gradeNote("JVP not raised."), jvpId)).toBe(0);
    expect(score(gradeNote("JVP raised to the jaw."), jvpId)).toBe(1);
  });
  it("a pertinent negative needs to be negated", () => {
    const negId = penSheet.items.find((i) => i.id.includes("no-chest-pain"))!.id;
    expect(score(gradeNote("", "Has chest pain."), negId)).toBe(0);
    expect(score(gradeNote("", "Denies chest pain."), negId)).toBe(1);
  });
});

import { buildBank } from "@/lang/bank";
import { askedTopics } from "@/lang/understand";
describe("history coverage is recomputed from the student's words (M1 review)", () => {
  const kase = c.caseById.get("hf-decompensated-01")!;
  const enc = c.markSheetById.get("communication-1b")!;
  const bank = buildBank(kase, c.lang);
  const spoofed = { clauses: [{ text: "do you have any pets", target: "fact:dyspnea-onset", kind: "fact" as const, score: 0.95, via: "embedding" as const }], topics: ["hpi.onset", "hpi.duration"], embedding: "client" as const };
  const run = (text: string) => {
    const l = makeLog([say(text), { type: "patient_say", source: "system", payload: { text: "It came on gradually.", match: spoofed } }]);
    return gradeMatchItems({ kase, sheets: [enc], log: l, check: null, normalize: makeNormalizer(c.lang.synonyms), embed: () => null, topicsBySay: askedTopics(bank, l, null) });
  };
  it("a match stored at chat time (possibly from browser vectors) earns nothing", () => {
    const j = run("Do you have any pets?");
    for (const id of ["hpi-onset", "hpi-duration", "timeline"]) expect(j.find((x) => x.itemId === id)?.score ?? 0, id).toBe(0);
  });
  it("terse questions count: 'Allergies?' asks about allergies", () => {
    const l = makeLog([say("Allergies?")]);
    const t = askedTopics(bank, l, null);
    expect([...t.values()].flatMap((v) => v.topics).length).toBeGreaterThan(0);
  });
});

describe("note grading edge cases (M1 review)", () => {
  const kase = c.caseById.get("hf-decompensated-01")!;
  const penSheet = sheetsForCase(kase, c.markSheetById).find((s) => s.items.some((i) => i.id.startsWith("pen-ex-")))!;
  const performed = [examine("auscultate_heart_bell", "cardiac_mitral"), examine("jvp_inspection", "neck_jvp_right"), examine("peripheral_edema", "shin_right"), examine("auscultate_lungs", "lung_post_rl")];
  const grade = (pen: { history?: string; exam?: string; diagnoses?: { diagnosis: string; support?: string }[] }, extra = performed) =>
    gradeMatchItems({
      kase,
      sheets: [penSheet],
      log: makeLog([...extra, { type: "submit_pen", source: "text", payload: { history: pen.history ?? "", exam: pen.exam ?? "", diagnoses: (pen.diagnoses ?? []).map((d) => ({ diagnosis: d.diagnosis, support: d.support ?? "" })) } }]),
      check: null,
      normalize: makeNormalizer(c.lang.synonyms),
      embed: () => null,
    });
  const id = (frag: string) => penSheet.items.find((i) => i.id.includes(frag))!.id;
  const score = (js: ReturnType<typeof grade>, frag: string) => js.find((j) => j.itemId === id(frag))?.score;
  it("a comma ends a negation's scope", () => {
    expect(score(grade({ exam: "No murmurs, S3 present." }), "pen-ex-s3")).toBe(1);
    expect(score(grade({ exam: "JVP 10 cm, abdomen normal." }), "pen-ex-jvp")).toBe(1);
    expect(score(grade({ history: "Denies fever, reports calf pain." }), "no-calf")).toBe(0);
  });
  it("short list items after a negated item stay negated", () => {
    expect(score(grade({ history: "Denies fever, chills or chest pain." }), "no-chest-pain")).toBe(1);
  });
  it("an exam finding in the note earns nothing if that exam wasn't performed, however the note is punctuated", () => {
    expect(score(grade({ exam: "General: tired. s3 gallop at apex." }, []), "pen-ex-s3")).toBe(0);
    expect(score(grade({ exam: "S3 gallop at apex! JVP raised" }, []), "pen-ex-jvp")).toBe(0);
  });
  it("another diagnosis's supporting text doesn't earn the heart-failure item", () => {
    const j = grade({ diagnoses: [{ diagnosis: "COPD exacerbation", support: "wheeze; heart failure less likely as no edema" }] });
    expect(j.find((x) => x.itemId.startsWith("pen-dx-adhf"))?.score ?? 0).toBe(0);
  });
});
