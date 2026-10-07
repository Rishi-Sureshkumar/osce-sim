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
      log: makeLog([{ type: "submit_pen", source: "text", payload: { history, exam, diagnoses: [] } }]),
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
