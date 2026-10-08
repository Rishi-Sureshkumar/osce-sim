import { describe, expect, it } from "vitest";
import { loadContentFromDisk } from "@/content/loadFromDisk";
import type { Action, ActionInput, MarkSheet, Session } from "@/domain/schemas";
import { alertsOn, detectMistakes } from "@/engine/mistakes";
import { PEN_JUSTIFICATION_ITEM } from "@/engine/penItems";
import { recognitionRows, scoreInterpretation } from "@/engine/recognition";
import { gradeMatchItems } from "@/lang/grade";
import { makeNormalizer } from "@/lang/normalize";
import { doneTextFor, redactForStudent, visibleToStudent } from "@/server/session";
import { courtesy, examine, makeLog, say } from "./helpers";

const c = loadContentFromDisk();
const kase = c.caseById.get("hf-decompensated-01")!;
const rules = c.mistakes;
const tagged = (text: string, ...tags: string[]) => ({ type: "say", source: "text", payload: { text, tags: tags.map((tag) => ({ tag, evidence: text, via: "regex" })) } }) as const;
const fired = (log: Action[], a: Action, mode: "practice" | "exam" = "practice") => detectMistakes(rules, log, a, { mode, sex: kase.patient.sex, caseMode: kase.mode }).map((h) => h.rule.id);
const mistake = (ruleId: string, alerted = true): Action => ({ id: `m-${ruleId}`, sessionId: "s1", t: 0, type: "mistake", source: "system", payload: { ruleId, severity: "minor", message: "m", alerted } });

describe("mistake rules (content/mistakes.json)", () => {
  it("validates and loads the global rules", () => {
    expect(rules.map((r) => r.id)).toEqual(expect.arrayContaining(["exam_before_introduction", "exam_without_consent", "excluded_exam_attempted", "reflex_legs_not_hanging", "left_without_closing"]));
  });

  it("a touch exam before introduction and consent fires both, once", () => {
    const log = makeLog([courtesy("hand_hygiene"), examine("pmi_palpation", "cardiac_mitral")]);
    expect(fired(log, log[1]!).sort()).toEqual(["exam_before_introduction", "exam_without_consent"]);
    const again = [...log, mistake("exam_before_introduction"), mistake("exam_without_consent"), ...makeLog([examine("pmi_palpation", "cardiac_mitral")]).map((a) => ({ ...a, id: "late" }))];
    expect(fired(again, again.at(-1)!)).toEqual([]);
  });

  it("nothing fires when the student introduced themselves and asked consent first", () => {
    const log = makeLog([tagged("Hi, I'm Sam, a medical student.", "introduced_name"), tagged("May I examine you?", "asked_consent_exam"), examine("pmi_palpation", "cardiac_mitral")]);
    expect(fired(log, log[2]!)).toEqual([]);
  });

  it("inspection (no touch) is not an exam before introduction", () => {
    const log = makeLog([examine("jvp_inspection", "neck_jvp_right")]);
    const a = { ...log[0]!, payload: { ...(log[0] as Extract<Action, { type: "examine" }>).payload, touch: false } } as Action;
    expect(fired([a], a)).toEqual([]);
  });

  it("knee jerk supine fires the legs-hanging hint; dangling does not", () => {
    const intro = [tagged("Hi, I'm Sam.", "introduced_name"), tagged("Is it OK if I examine you?", "asked_consent_exam")];
    const supine = makeLog([...intro, courtesy("position", "supine"), examine("reflex_patellar", "patellar_tendon_right")]);
    expect(fired(supine, supine.at(-1)!)).toEqual(["reflex_legs_not_hanging"]);
    const dangling = makeLog([...intro, courtesy("position", "sitting_dangling"), examine("reflex_patellar", "patellar_tendon_right")]);
    expect(fired(dangling, dangling.at(-1)!)).toEqual([]);
  });

  it("leaving without closing fires in exam mode too; saying goodbye first does not", () => {
    const exit = { type: "room", source: "click", payload: { event: "exit" } } as const;
    const bare = makeLog([exit]);
    expect(fired(bare, bare[0]!, "exam")).toEqual(["left_without_closing"]);
    const closed = makeLog([tagged("Thank you, any questions before I go?", "closing"), exit]);
    expect(fired(closed, closed[1]!, "exam")).toEqual([]);
  });

  it("alerts: shown in practice by default, silent in exam unless switched on", () => {
    expect(alertsOn(undefined, "practice")).toBe(true);
    expect(alertsOn({ alerts: "default" }, "exam")).toBe(false);
    expect(alertsOn({ alerts: "on" }, "exam")).toBe(true);
    expect(alertsOn({ alerts: "off" }, "practice")).toBe(false);
  });

  it("an unalerted mistake is hidden from the student while active and listed afterwards", () => {
    const active = { status: "active" } as Session;
    expect(visibleToStudent(mistake("x", false), active)).toBe(false);
    expect(visibleToStudent(mistake("x", true), active)).toBe(true);
    expect(visibleToStudent(mistake("x", false), { status: "submitted" } as Session)).toBe(true);
  });
});

describe("hide-findings mode", () => {
  const heard: Action = {
    id: "e1",
    sessionId: "s1",
    t: 1,
    type: "examine",
    source: "click",
    payload: { regionId: "cardiac_mitral", maneuverId: "auscultate_heart_bell", tool: "stethoscope", toolMode: "bell" },
    result: { findingText: "S3 gallop at the apex", resolvedFrom: "case_region", audio: { generator: "heart", params: { s3: 0.6 } }, doneText: "Heart auscultation — Mitral area, left lateral decubitus" },
  } as Action;
  const reported: Action = { ...heard, id: "e2", payload: { regionId: "neck_jvp_right", maneuverId: "jvp_inspection" }, result: { findingText: "JVP raised to 9 cm", resolvedFrom: "case_default", doneText: "JVP — Right neck, reclined 30", reported: true } } as Action;
  const hide = { status: "active", settings: { findingsDisplay: "hide" } } as unknown as Session;

  it("doneText says what was done, never the finding", () => {
    const m = c.maneuverById.get("auscultate_heart_bell")!;
    expect(doneTextFor(m, "Mitral area", "left_lateral_decubitus")).toBe(`${m.label} — Mitral area, left lateral decubitus`);
  });

  it("an exam with a sound shows only what was done (audio kept); a reported finding is shown", () => {
    const r = redactForStudent(heard, kase, hide);
    expect(r.type === "examine" && r.result?.findingText).toBe("Heart auscultation — Mitral area, left lateral decubitus");
    expect(r.type === "examine" && r.result?.audio).toBeTruthy();
    const p = redactForStudent(reported, kase, hide);
    expect(p.type === "examine" && p.result?.findingText).toBe("JVP raised to 9 cm");
  });

  it("show mode and ended sessions are unchanged", () => {
    expect(redactForStudent(heard, kase, { status: "active" } as Session)).toMatchObject({ result: { findingText: "S3 gallop at the apex" } });
    expect(redactForStudent(heard, kase, { ...hide, status: "submitted" } as Session)).toBe(heard);
  });

  it("recognition: scores the latest interpretation against the finding; reported findings are skipped", () => {
    const interp = (text: string, id: string): Action => ({ id, sessionId: "s1", t: 5, type: "interpretation", source: "text", payload: { examActionId: "e1", regionId: "cardiac_mitral", maneuverId: "auscultate_heart_bell", text } });
    expect(recognitionRows([heard, reported]).map((r) => [r.examActionId, r.verdict])).toEqual([["e1", "not_attempted"]]);
    const rows = recognitionRows([heard, reported, interp("normal heart sounds", "i1"), { ...interp("an S3 gallop", "i2"), t: 6 }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ verdict: "recognized", interpretation: "an S3 gallop", interpretationActionId: "i2" });
    expect(scoreInterpretation("Fine bibasal crackles that do not clear with coughing", "crackles").verdict).toBe("partial");
    expect(scoreInterpretation("Fine bibasal crackles", "fine crackles at both bases").verdict).toBe("recognized");
    expect(scoreInterpretation("S3 gallop at the apex", "murmur").verdict).toBe("missed");
  });
});

describe("V-JUSTIFY: diagnosis support counts only findings elicited in the encounter", () => {
  const sheet: MarkSheet = { id: "pen", title: "pen", kind: "history", domain: "patient_encounter", items: [{ id: PEN_JUSTIFICATION_ITEM, section: "PEN", label: "j", weight: 2, scoring: "match", sourceText: "" }] } as unknown as MarkSheet;
  const pen = (support: string): ActionInput => ({ type: "submit_pen", source: "text", payload: { history: "", exam: "", diagnoses: [{ diagnosis: "Heart failure", support }] } });
  const grade = (log: Action[]) => gradeMatchItems({ kase, sheets: [sheet], log, check: null, normalize: makeNormalizer(c.lang.synonyms), embed: () => null })[0]!;

  it("no credit for 'raised JVP, orthopnea' when the neck veins were never examined and orthopnea never came up", () => {
    expect(grade(makeLog([say("What brings you in?"), pen("raised JVP, orthopnea")])).score).toBe(0);
  });

  it("credit once the JVP was examined, or orthopnea was discussed", () => {
    expect(grade(makeLog([examine("jvp_inspection", "neck_jvp_right"), pen("raised JVP")])).score).toBe(1);
    expect(grade(makeLog([say("How many pillows do you sleep on?"), { type: "patient_say", source: "system", payload: { text: "Three pillows now." } }, pen("needs three pillows")])).score).toBe(1);
  });
});
