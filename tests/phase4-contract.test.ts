import { describe, expect, it } from "vitest";
import { loadContentFromDisk } from "@/content/loadFromDisk";
import { eventRefError, mistakeRuleErrors } from "@/content/validate";
import { Action, ActionInput, AudioSpec, Case, MarkSheetItem, MistakeRuleSchema, MistakesFile, Position, SessionSettings, Session } from "@/domain/schemas";
import { allowedInPhase } from "@/engine/encounter";
import { quotableText } from "@/engine/evidence";
import { patientState, sectionsForRegion } from "@/engine/patientState";
import { evaluateRule, findEvent } from "@/engine/rules";
import { anchorsFor } from "@/exam3d/regionAnchors";

const c = loadContentFromDisk();
let n = 0;
const A = (type: string, payload: object, t = n * 1000, extra: object = {}): Action =>
  Action.parse({ id: `a${n++}`, sessionId: "s", t, type, source: type === "mistake" ? "system" : "click", payload, ...extra });

describe("Phase 4 schema contract", () => {
  it("adds the sitting-with-legs-dangling position, new tools and audio generators", () => {
    expect(Position.parse("sitting_dangling")).toBe("sitting_dangling");
    expect(AudioSpec.parse({ generator: "korotkoff", params: {} })).toMatchObject({ params: { muffleMmHg: 6 } });
    expect(AudioSpec.parse({ generator: "percussion", params: { note: "dull" } })).toBeTruthy();
    expect(AudioSpec.parse({ generator: "voice", params: { phrase: "ee", egophony: true } })).toMatchObject({ params: { transmission: "normal" } });
    expect(AudioSpec.parse({ generator: "heart", params: { s2Intensity: 0.3 } })).toBeTruthy();
    expect(() => AudioSpec.parse({ generator: "percussion", params: { note: "boom" } })).toThrow();
  });

  it("reads legacy 'ai' items as 'match'; match items carry a MatchSpec", () => {
    const legacy = MarkSheetItem.parse({ id: "x", section: "S", label: "L", weight: 1, scoring: "ai", guidance: "g", mockKeywords: ["hello"] });
    expect(legacy.scoring).toBe("match");
    const m = MarkSheetItem.parse({ id: "y", section: "S", label: "L", weight: 1, scoring: "match", guidance: "g", match: { exemplars: ["Nice to meet you"] } });
    expect(m.match).toMatchObject({ sources: ["say"], form: "any", minMatches: 1 });
    // every content item loads
    expect(c.markSheets.flatMap((s) => s.items).every((i) => i.scoring !== ("ai" as string))).toBe(true);
  });

  it("drape changes name a zone (legacy) or a section; pelvis is never uncovered", () => {
    expect(ActionInput.parse({ type: "state_change", source: "click", payload: { drape: { section: "chest_left", covered: false }, via: "direct" } })).toBeTruthy();
    expect(ActionInput.parse({ type: "state_change", source: "click", payload: { drape: { zone: "legs", covered: false }, via: "direct" } })).toBeTruthy();
    expect(() => ActionInput.parse({ type: "state_change", source: "click", payload: { drape: { covered: false }, via: "direct" } })).toThrow();
    const log = [
      A("state_change", { drape: { section: "chest_left", covered: false }, via: "direct" }, 1000),
      A("state_change", { drape: { zone: "legs", covered: false }, via: "direct" }, 2000),
      A("state_change", { drape: { section: "pelvis", covered: false }, via: "direct" }, 3000),
    ];
    const st = patientState(log);
    expect(st.sections).toMatchObject({ chest_left: false, chest_right: true, leg_left: false, leg_right: false, pelvis: true });
    expect(st.drape).toMatchObject({ chest: false, legs: false, abdomen: true }); // legacy zones derived
    expect(st.exposedSince).toMatchObject({ chest_left: 1000, leg_left: 2000 });
    expect(sectionsForRegion("cardiac_mitral")).toEqual(["chest_left"]);
    expect(sectionsForRegion("lung_post_rl")).toEqual(["back"]);
    expect(sectionsForRegion("shin_right")).toEqual(["leg_right"]);
    expect(sectionsForRegion("knee_left", { knee_left: ["leg_left"] })).toEqual(["leg_left"]);
  });

  it("new rule kinds: state at the event, drape discipline, unperformed PEN claims", () => {
    const expose = A("state_change", { drape: { section: "chest_left", covered: false }, via: "direct" }, 1000);
    const exam = A("examine", { regionId: "cardiac_mitral", maneuverId: "auscultate_heart_bell", touch: true }, 2000);
    const cover = A("state_change", { drape: { section: "chest_left", covered: true }, via: "direct" }, 5000);
    const log = [expose, exam, cover];
    expect(evaluateRule({ state: { handsClean: false } }, log, { eventActionId: exam.id }).value).toBe(1);
    expect(evaluateRule({ state: { exposedAny: ["chest_left"] } }, log, { eventActionId: exam.id }).value).toBe(1);
    expect(evaluateRule({ state: { exposedAny: ["chest_left"] } }, log).value).toBe(0); // re-covered by the end
    expect(evaluateRule({ state: { eventRegionCovered: true } }, log, { eventActionId: exam.id }).value).toBe(0);
    expect(evaluateRule({ drapeDiscipline: {} }, log).value).toBe(1);
    expect(evaluateRule({ drapeDiscipline: { recoverWithinMs: 2000 } }, log).value).toBe(0); // 3 s after the exam
    expect(evaluateRule({ penUnperformed: {} }, log, { penFlagged: 1 }).value).toBe(1);
    expect(evaluateRule({ penUnperformed: { atLeast: 2 } }, log, { penFlagged: 1 }).value).toBe(0);
  });

  it("new event refs resolve and validate", () => {
    const m = A("mistake", { ruleId: "no-hygiene", severity: "major", message: "Clean your hands", alerted: true });
    const ex = A("examine", { regionId: "knee_left", maneuverId: "reflex_patellar" });
    const dr = A("state_change", { drape: { section: "leg_left", covered: false }, via: "direct" });
    const log = [m, ex, dr];
    expect(findEvent(log, "mistake:no-hygiene")?.id).toBe(m.id);
    expect(findEvent(log, "region:knee_left")?.id).toBe(ex.id);
    expect(findEvent(log, "drape:expose:leg_left")?.id).toBe(dr.id);
    expect(findEvent(log, "drape:expose")?.id).toBe(dr.id);
    for (const ref of ["mistake:no-hygiene", "region:knee_left", "drape:expose:leg_left", "drape:cover:pelvis", "interpretation", "settings", "first:mistake"]) {
      expect(eventRefError(ref, c), ref).toBeNull();
    }
    expect(eventRefError("drape:expose:elbow", c)).toMatch(/unknown drape/);
    expect(eventRefError("region:nowhere", c)).toMatch(/unknown region/);
  });

  it("mistake rules, settings and the new actions", () => {
    const rule = MistakeRuleSchema.parse({
      id: "no-hygiene",
      label: "Touched without hand hygiene",
      message: "Clean your hands before touching the patient.",
      severity: "major",
      trigger: { on: { type: "touch" }, when: { state: { handsClean: false } } },
    });
    expect(rule).toMatchObject({ modes: ["practice", "exam"], once: true, anchor: "exam_view" });
    expect(mistakeRuleErrors("r", { ...rule, trigger: { on: { maneuver: "nope" } } }, c)).toEqual(expect.arrayContaining([expect.stringMatching(/needs a type or a ref/), expect.stringMatching(/unknown maneuver/)]));
    expect(MistakesFile.parse({ mistakes: [rule] }).mistakes).toHaveLength(1);
    expect(SessionSettings.parse({})).toEqual({ findingsDisplay: "show", alerts: "default", enhancedPatient: false });
    // the browser can't send a mistake or set findingsDisplay mid-session
    expect(ActionInput.safeParse({ type: "mistake", source: "system", payload: {} }).success).toBe(false);
    expect(ActionInput.safeParse({ type: "settings", source: "click", payload: { findingsDisplay: "hide" } }).success).toBe(false);
    const interp = A("interpretation", { examActionId: "a1", regionId: "cardiac_mitral", maneuverId: "auscultate_heart_bell", text: "S3 gallop" });
    expect(quotableText(interp)).toBe("S3 gallop");
    expect(allowedInPhase("pen", "interpretation")).toBe(true);
    expect(allowedInPhase("corridor", "settings")).toBe(true);
    expect(allowedInPhase("submitted", "settings")).toBe(false);
  });

  it("cases accept intents, follow-ups, conversation, acceptable diagnoses; sessions without token usage", () => {
    const hf = c.caseById.get("hf-decompensated-01")!;
    const ext = Case.parse({
      ...hf,
      history: {
        ...hf.history,
        facts: [{ ...hf.history.facts[0]!, intents: { canonical: "When did the breathlessness start?", paraphrases: ["How long has this been going on?"] }, followUps: [], emotion: "worried" }],
        conversation: [{ kind: "greeting", replies: ["Hello, {student.name}."] }],
      },
      acceptableDiagnoses: [{ id: "adhf", diagnosis: "Acute decompensated heart failure", synonyms: ["CHF exacerbation"], satisfies: ["adhf"] }],
    });
    expect(ext.history.facts[0]!.intents?.keywords).toEqual([]);
    expect(ext.mistakes).toEqual([]);
    expect(Session.parse({ id: "s", caseId: "x", studentLabel: "T", status: "active", startedAt: "2026-01-01", endedAt: null, patientTurns: 0, gradingRuns: 0 })).toBeTruthy();
  });

  it("18 new canonical regions, each with an anchor on both models", () => {
    const ids = ["upper_arm", "biceps_tendon", "triceps_tendon", "brachioradialis", "patellar_tendon", "leg_medial", "achilles", "sole", "foot_lateral"].flatMap((b) => [`${b}_left`, `${b}_right`]);
    for (const id of ids) expect(c.regionById.has(id), id).toBe(true);
    for (const v of ["male", "female"] as const) {
      const have = new Set(anchorsFor(v).map((a) => a.regionId));
      for (const id of ids) expect(have.has(id), `${v} ${id}`).toBe(true);
    }
  });
});
