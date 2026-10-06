import { describe, expect, it } from "vitest";
import { ActionInput, type Action, type ExamManeuver, type MarkSheet } from "@/domain/schemas";
import { isTouch, resolveFinding } from "@/engine/resolveFinding";
import { evaluateRule } from "@/engine/rules";
import { patientState } from "@/engine/patientState";
import { scoreDeterministicItems } from "@/engine/scoring";
import { loadContentFromDisk } from "@/content/loadFromDisk";
import { validateContentGraph } from "@/content/validate";

let n = 0;
const act = (a: Record<string, unknown>, t: number): Action => ({ id: `a${++n}`, sessionId: "s", t, seq: n, source: "click", ...a }) as Action;
const exam = (maneuverId: string, regionId: string, t: number, extra: Record<string, unknown> = {}) =>
  act({ type: "examine", payload: { maneuverId, regionId, touch: true, ...extra } }, t);
const say = (text: string, t: number, tags: string[] = []) =>
  act({ type: "say", source: "voice", payload: { text, tags: tags.map((tag) => ({ tag, evidence: text, via: "regex" })) } }, t);
const courtesy = (kind: string, t: number, extra: Record<string, unknown> = {}) => act({ type: "courtesy", payload: { kind, ...extra } }, t);

describe("finding values with audio and position variants", () => {
  const m: ExamManeuver = {
    id: "auscultate_heart_bell",
    fcmId: 38,
    label: "Bell",
    system: "cardiovascular",
    technique: "auscultate",
    allowedRegions: ["cardiac_mitral", "cardiac_tricuspid"],
    normalFinding: { default: { text: "No S3 or S4.", audio: { generator: "heart", params: { intensity: 0.8, s2SplitMs: 0 } } } },
    demo: { steps: ["x"] },
    sourceText: "",
  };
  const kase = {
    vitals: { hr: 104, rr: 24, bpSystolic: 1, bpDiastolic: 1, tempC: 37, spo2: 90, spo2Context: "" },
    abnormalFindings: {
      auscultate_heart_bell: {
        cardiac_mitral: {
          text: "Soft S3 at the apex.",
          audio: { generator: "heart" as const, params: { s3: 0.3, intensity: 0.8, s2SplitMs: 0 } },
          byPosition: { left_lateral_decubitus: { text: "Loud S3 at the apex.", audio: { generator: "heart" as const, params: { s3: 0.9, intensity: 0.8, s2SplitMs: 0 } } } },
        },
      },
    },
  };

  it("returns audio from the case entry", () => {
    const r = resolveFinding(kase, m, "cardiac_mitral", { position: "supine" });
    expect(r.findingText).toBe("Soft S3 at the apex.");
    expect(r.audio).toMatchObject({ generator: "heart", params: { s3: 0.3 } });
  });
  it("applies the byPosition variant for the current position", () => {
    const r = resolveFinding(kase, m, "cardiac_mitral", { position: "left_lateral_decubitus" });
    expect(r.findingText).toBe("Loud S3 at the apex.");
    expect(r.audio).toMatchObject({ params: { s3: 0.9 } });
  });
  it("falls back to the catalog normal with its normal audio", () => {
    const r = resolveFinding(kase, m, "cardiac_tricuspid");
    expect(r).toMatchObject({ findingText: "No S3 or S4.", resolvedFrom: "catalog_default", audio: { generator: "heart" } });
  });
  it("touch defaults from technique", () => {
    expect(isTouch(m)).toBe(true);
    expect(isTouch({ technique: "inspect" })).toBe(false);
    expect(isTouch({ technique: "inspect", touch: true })).toBe(true);
  });
});

describe("new rules", () => {
  it("hygieneBeforeTouch: inspection doesn't count as contact; hygiene must precede first touch", () => {
    const ok = [exam("general_appearance", "general", 1000, { touch: false }), courtesy("hand_hygiene", 2000), exam("pulse_radial", "wrist_right", 3000)];
    expect(evaluateRule({ hygieneBeforeTouch: true }, ok).value).toBe(1);
    const bad = [exam("pulse_radial", "wrist_right", 1000), courtesy("hand_hygiene", 2000)];
    expect(evaluateRule({ hygieneBeforeTouch: true }, bad).value).toBe(0);
    expect(evaluateRule({ hygieneBeforeTouch: true }, [courtesy("hand_hygiene", 1)]).value).toBe(0);
  });

  it("said: matches classifier tags", () => {
    const log = [say("Hi, I'm Sam, a medical student", 1000, ["introduced_name", "stated_role"])];
    expect(evaluateRule({ said: "stated_role" }, log)).toEqual({ value: 1, actionIds: [log[0]!.id] });
    expect(evaluateRule({ said: ["asked_consent_exam"] }, log).value).toBe(0);
  });

  it("before with tag: and first:touch refs", () => {
    const log = [say("May I examine you?", 1000, ["asked_consent_exam"]), exam("pulse_radial", "wrist_right", 2000)];
    expect(evaluateRule({ before: ["tag:asked_consent_exam", "first:touch"] }, log).value).toBe(1);
    expect(evaluateRule({ before: ["first:touch", "tag:asked_consent_exam"] }, log).value).toBe(0);
  });

  it("technique: tool, mode, placement, duration and position", () => {
    const log = [
      courtesy("position", 500, { position: "left_lateral_decubitus" }),
      exam("auscultate_heart_bell", "cardiac_mitral", 1000, { tool: "stethoscope", toolMode: "bell", placementError: 0.4, durationMs: 3500 }),
    ];
    const rule = { maneuver: "auscultate_heart_bell", tool: "stethoscope" as const, toolMode: "bell" as const, maxPlacementError: 1, minDurationMs: 3000, position: "left_lateral_decubitus" as const };
    expect(evaluateRule({ technique: rule }, log).value).toBe(1);
    expect(evaluateRule({ technique: { ...rule, maxPlacementError: 0.2 } }, log).value).toBe(0);
    expect(evaluateRule({ technique: { ...rule, minDurationMs: 5000 } }, log).value).toBe(0);
    expect(evaluateRule({ technique: { ...rule, position: "supine" } }, log).value).toBe(0);
  });

  it("performedIn honours state_change positions", () => {
    const log = [act({ type: "state_change", payload: { position: "reclined_30", via: "direct" } }, 500), exam("jvp_inspection", "neck_jvp_right", 1000)];
    expect(evaluateRule({ performedIn: { maneuver: "jvp_inspection", position: "reclined_30" } }, log).value).toBe(1);
  });
});

describe("patientState", () => {
  it("folds position, drape, hygiene and room events in t order", () => {
    const log = [
      act({ type: "room", payload: { event: "knock" } }, 100),
      act({ type: "room", payload: { event: "enter" } }, 200),
      exam("pulse_radial", "wrist_right", 300),
      courtesy("hand_hygiene", 400),
      act({ type: "state_change", payload: { position: "reclined_30", via: "verbal" } }, 500),
      courtesy("expose", 600, { regionId: "cardiac_mitral" }),
      act({ type: "state_change", payload: { drape: { zone: "legs", covered: false }, via: "direct" } }, 700),
    ];
    const s = patientState(log);
    expect(s).toMatchObject({ knocked: true, inRoom: true, handsClean: true, uncleanTouches: 1, position: "reclined_30", bedAngle: 30 });
    expect(s.drape).toEqual({ chest: false, abdomen: true, legs: false });
    expect(patientState(log, 350).handsClean).toBe(false);
  });
});

describe("mode-scoped mark-sheet items", () => {
  const sheet: MarkSheet = {
    id: "m",
    title: "M",
    kind: "exam",
    sourceNote: "",
    items: [{ id: "timed", section: "S", label: "Finishes in time", weight: 1, scoring: "auto", rule: { submitted: "submit_ddx" }, modes: ["exam"], sourceText: "" }],
  };
  it("is not assessable in practice mode", () => {
    expect(scoreDeterministicItems(sheet, [], "practice")[0]).toMatchObject({ status: "not_assessable", maxPoints: 0 });
    expect(scoreDeterministicItems(sheet, [], "exam")[0]).toMatchObject({ status: "scored", maxPoints: 1 });
  });
});

describe("client input cannot set server-owned fields", () => {
  it("strips tags from say and touch from examine", () => {
    const say = ActionInput.parse({ type: "say", source: "text", payload: { text: "hi", tags: [{ tag: "closing" }] } });
    expect(say.payload).toEqual({ text: "hi" });
    const ex = ActionInput.parse({ type: "examine", source: "click", payload: { regionId: "r", maneuverId: "m", touch: false, tool: "stethoscope", placementError: 0.5 } });
    expect(ex.payload).toEqual({ regionId: "r", maneuverId: "m", tool: "stethoscope", placementError: 0.5 });
  });
  it("rejects an empty state_change", () => {
    expect(ActionInput.safeParse({ type: "state_change", source: "click", payload: { via: "direct" } }).success).toBe(false);
  });
});

describe("content validation of phase-2 fields", () => {
  it("flags bad byPosition keys and sequences without steps", () => {
    const c = loadContentFromDisk();
    const m = { ...c.maneuverById.get("rinne_test")!, interaction: "sequence" as const, steps: undefined };
    const kase = { ...c.caseById.get("hf-decompensated-01")!, abnormalFindings: { jvp_inspection: { default: { text: "x", byPosition: { sideways: { text: "y" } } } } } };
    const errors = validateContentGraph({ ...c, maneuvers: [m], maneuverById: new Map([[m.id, m], ["jvp_inspection", c.maneuverById.get("jvp_inspection")!]]), cases: [kase], markSheets: [] });
    expect(errors.some((e) => e.includes("sequence interaction needs steps"))).toBe(true);
    expect(errors.some((e) => e.includes('byPosition key "sideways"'))).toBe(true);
  });
});
