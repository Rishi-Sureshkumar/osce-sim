/**
 * M1: deterministic grading agrees with the labelled transcripts (tests/fixtures/grading):
 * ≥ 90% agreement on decided items and ≤ 10% sent to needs_review (npm run lang:calibrate prints the detail).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadContentFromDisk } from "@/content/loadFromDisk";
import { sheetsForCase } from "@/engine/sheets";
import { calibrate, type LabelledTranscript } from "@/lang/calibrate";
import { embedTexts } from "@/lang/embed/node";
import { makeNormalizer } from "@/lang/normalize";

const DIR = path.join(process.cwd(), "tests/fixtures/grading");
const content = loadContentFromDisk();

describe("grading calibration against labelled transcripts", () => {
  for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith(".json"))) {
    const fx = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8")) as { caseId: string; transcripts: LabelledTranscript[] };
    it(`${fx.caseId}: ≥ 90% agreement, ≤ 10% needs_review`, async () => {
      const kase = content.caseById.get(fx.caseId)!;
      const r = await calibrate({ kase, lang: content.lang, sheets: sheetsForCase(kase, content.markSheetById), transcripts: fx.transcripts, normalize: makeNormalizer(content.lang.synonyms), embed: embedTexts });
      const misses = r.items.filter((i) => !i.agree && !i.borderline && !i.review).map((i) => `${i.transcript} ${i.itemId}: label ${i.expected}, graded ${i.predicted}`);
      expect(r.agreement, misses.join("\n")).toBeGreaterThanOrEqual(0.9);
      expect(r.reviewRate).toBeLessThanOrEqual(0.1);
    }, 300_000);
  }
});
