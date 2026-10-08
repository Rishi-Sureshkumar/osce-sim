import { describe, expect, it } from "vitest";
import { loadContentFromDisk } from "@/content/loadFromDisk";
import { resolveFinding } from "@/engine/resolveFinding";

describe("content", () => {
  const c = loadContentFromDisk();

  it("loads and cross-validates every content file", () => {
    expect(c.maneuvers.length).toBeGreaterThan(100);
    expect(c.caseById.get("hf-decompensated-01")).toBeDefined();
    expect(c.markSheetById.get("exam-fcm1")).toBeDefined();
    expect(c.markSheetById.get("communication-1b")).toBeDefined();
  });

  it("maps every FCM item 1–120 that the framework numbers to a mark-sheet item", () => {
    const fcm = new Set(c.markSheetById.get("exam-fcm1")!.items.map((i) => i.fcmId).filter(Boolean));
    const missing = Array.from({ length: 120 }, (_, i) => i + 1).filter((n) => !fcm.has(n));
    expect(missing).toEqual([]);
  });

  it("every maneuver resolves a finding on every allowed region of every case", () => {
    for (const kase of c.cases) {
      for (const m of c.maneuvers) {
        for (const r of m.allowedRegions) {
          const f = resolveFinding(kase, m, r);
          expect(f.findingText).not.toMatch(/\{vitals\./);
          expect(f.findingText.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("the HF case has the core decompensated-HF findings", () => {
    const hf = c.caseById.get("hf-decompensated-01")!;
    for (const m of ["jvp_inspection", "hepatojugular_reflux", "pmi_palpation", "auscultate_heart_bell", "auscultate_lungs", "chest_percussion", "edema_assessment"]) {
      expect(hf.abnormalFindings[m], m).toBeDefined();
    }
  });

  it("keeps sourceText empty everywhere (copyright not cleared)", () => {
    expect(c.maneuvers.every((m) => m.sourceText === "")).toBe(true);
    expect(c.markSheets.every((s) => s.items.every((i) => i.sourceText === ""))).toBe(true);
  });
});
