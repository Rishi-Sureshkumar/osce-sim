import { describe, expect, it } from "vitest";
import { loadContentFromDisk } from "@/content/loadFromDisk";
import type { Action, ItemScore } from "@/domain/schemas";
import { penCheck, splitClaims } from "@/engine/penCheck";
import { CASE_PE_SHEET, PEN_CONSISTENCY_ITEM, PEN_SHEET } from "@/engine/penItems";
import { applyPenCheck, domainTotals, scoreDeterministicItems, stationPass } from "@/engine/scoring";
import { sheetsForCase } from "@/engine/sheets";

const c = loadContentFromDisk();
const hf = c.caseById.get("hf-decompensated-01")!;
let n = 0;
const exam = (maneuverId: string, regionId: string): Action => ({ id: `e${n++}`, sessionId: "s", t: n * 1000, type: "examine", source: "click", payload: { maneuverId, regionId } });
const pen = (examText: string): Extract<Action, { type: "submit_pen" }> => ({
  id: "pen1",
  sessionId: "s",
  t: 900_000,
  type: "submit_pen",
  source: "text",
  payload: { history: "Two weeks of worsening SOB, orthopnea.", exam: examText, diagnoses: [{ diagnosis: "Acute decompensated heart failure" }] },
});

describe("post-encounter note cross-check (penCheck)", () => {
  it("splits the exam section into claims (lines, bullets, sentences)", () => {
    expect(splitClaims("- JVP raised.\n- S3 at apex. Fine crackles at both bases\n2) Pitting edema")).toEqual(["JVP raised.", "S3 at apex.", "Fine crackles at both bases", "Pitting edema"]);
  });

  it("definition of done: a reported finding whose exam was never performed is flagged; performed ones link to the log", () => {
    const log = [exam("jvp_inspection", "neck_jvp_right"), exam("auscultate_lungs", "lung_post_rl")];
    const r = penCheck("JVP raised to the angle of the jaw.\nPositive hepatojugular reflux.\nBibasal crackles.\nPatient comfortable at rest.", c.maneuvers, hf.penKey!.exam, log);
    expect(r.claims.map((x) => x.status)).toEqual(["linked", "flagged", "linked", "unmatched"]);
    expect(r.claims[0]!.actionIds).toEqual([log[0]!.id]);
    expect(r.claims[1]!.maneuverIds).toContain("hepatojugular_reflux");
    expect(r.flagged).toBe(1);
  });

  it("an S3 heard with either stethoscope head counts; on-target tool contacts count too", () => {
    const contact: Action = { id: "tc", sessionId: "s", t: 5, type: "tool_contact", source: "click", payload: { tool: "stethoscope", toolMode: "bell", maneuverId: "auscultate_heart_bell", nearestRegionId: "cardiac_mitral", distanceCm: 1, toleranceCm: 2.5, durationMs: 3200, outcome: "finding" } };
    expect(penCheck("S3 gallop", c.maneuvers, hf.penKey!.exam, [contact]).claims[0]!.status).toBe("linked");
    const near = { ...contact, payload: { ...contact.payload, outcome: "near" as const } } as Action;
    expect(penCheck("S3 gallop", c.maneuvers, hf.penKey!.exam, [near]).claims[0]!.status).toBe("flagged");
  });

  it("the consistency item loses half its credit per flagged claim and quotes the claim", () => {
    const sheets = sheetsForCase(hf, c.markSheetById);
    const p = pen("JVP raised.\nPositive hepatojugular reflux.");
    const log = [exam("jvp_inspection", "neck_jvp_right"), p];
    const det = sheets.flatMap((s) => scoreDeterministicItems(s, log, "exam"));
    const scored = applyPenCheck(det, penCheck(p.payload.exam, c.maneuvers, hf.penKey!.exam, log), p);
    const item = scored.find((s) => s.markSheetId === PEN_SHEET && s.itemId === PEN_CONSISTENCY_ITEM)!;
    expect(item.value).toBe(0.5);
    expect(item.evidence[0]).toMatchObject({ actionId: "pen1", quote: "Positive hepatojugular reflux.", verified: true });
    expect(item.rationale).toMatch(/hepatojugular/);
  });
});

describe("1B sheets and two-domain totals", () => {
  const sheets = sheetsForCase(hf, c.markSheetById);

  it("HF scores communication-1b and encounter-1b, plus its peChecklist and generated PEN items", () => {
    expect(sheets.map((s) => s.id)).toEqual(["communication-1b", "encounter-1b", CASE_PE_SHEET, PEN_SHEET]);
    const penItems = sheets.find((s) => s.id === PEN_SHEET)!.items.map((i) => i.id);
    expect(penItems).toEqual(expect.arrayContaining(["pen-hx-orthopnea", "pen-ex-s3", "pen-dx-adhf", "pen-justification", PEN_CONSISTENCY_ITEM]));
    expect(sheets.find((s) => s.id === "communication-1b")!.attribution).toBe("Courtesy of Rebecca Kowalski");
    expect(sheets.filter((s) => s.id !== "communication-1b").every((s) => s.domain === "patient_encounter" && s.passThreshold === 0.7)).toBe(true);
  });

  it("passes only when every domain reaches its threshold; not-assessable items don't count", () => {
    const row = (markSheetId: string, itemId: string, points: number, maxPoints = 1, status: ItemScore["status"] = "scored"): ItemScore => ({ markSheetId, itemId, scoring: "auto", status, value: maxPoints ? points / maxPoints : 0, points, maxPoints, rationale: "", evidence: [] });
    const scores = [row("communication-1b", "a", 1), row("communication-1b", "b", 1), row("communication-1b", "c", 0, 0, "not_assessable"), row(CASE_PE_SHEET, "x", 1), row(PEN_SHEET, "y", 0, 2)];
    const d = domainTotals(scores, sheets);
    expect(d.map((x) => [x.domain, x.points, x.maxPoints, x.pass])).toEqual([
      ["patient_encounter", 1, 3, false],
      ["communication", 2, 2, true],
    ]);
    expect(d[1]!.notAssessable).toBe(1);
    expect(stationPass(d)).toBe(false);
    expect(stationPass(domainTotals([...scores, row(PEN_SHEET, "z", 2, 2), row(CASE_PE_SHEET, "w", 2, 2)], sheets))).toBe(true);
  });

  it("remove-barriers is scored from sitting down", () => {
    const comm = sheets.find((s) => s.id === "communication-1b")!;
    const sit: Action = { id: "sd", sessionId: "s", t: 1, type: "sit_down", source: "click", payload: {} };
    expect(scoreDeterministicItems(comm, [sit]).find((s) => s.itemId === "remove-barriers")!.value).toBe(1);
    expect(scoreDeterministicItems(comm, []).find((s) => s.itemId === "remove-barriers")!.value).toBe(0);
  });
});
