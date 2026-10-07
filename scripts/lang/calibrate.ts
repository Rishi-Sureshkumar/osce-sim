/**
 * npm run lang:calibrate [-- --verbose] [-- --check]
 * Grades the labelled transcripts in tests/fixtures/grading with the deterministic grader and
 * compares with the human labels (Phase 4 M1 targets: ≥ 90% agreement, ≤ 10% needs_review).
 * --verbose lists every disagreement with the grader's quote; --check exits 1 below target.
 */
import fs from "node:fs";
import path from "node:path";
import { loadContentFromDisk } from "@/content/loadFromDisk";
import { sheetsForCase } from "@/engine/sheets";
import { calibrate, type LabelledTranscript } from "@/lang/calibrate";
import { embedTexts } from "@/lang/embed/node";
import { makeNormalizer } from "@/lang/normalize";

export const TARGET = { agreement: 0.9, reviewRate: 0.1 };
const DIR = path.join(process.cwd(), "tests/fixtures/grading");

async function main() {
  const verbose = process.argv.includes("--verbose");
  const check = process.argv.includes("--check");
  const content = loadContentFromDisk();
  const normalize = makeNormalizer(content.lang.synonyms);
  const cache = new Map<string, Float32Array>();
  const embed = async (texts: string[]) => {
    const missing = [...new Set(texts.filter((t) => !cache.has(t)))];
    if (missing.length) {
      const v = await embedTexts(missing);
      if (!v) return null;
      missing.forEach((t, i) => cache.set(t, v[i]!));
    }
    return texts.map((t) => cache.get(t)!);
  };
  let ok = true;
  for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith(".json"))) {
    const fx = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8")) as { caseId: string; transcripts: LabelledTranscript[] };
    const kase = content.caseById.get(fx.caseId);
    if (!kase) throw new Error(`${file}: unknown case ${fx.caseId}`);
    const r = await calibrate({ kase, lang: content.lang, sheets: sheetsForCase(kase, content.markSheetById), transcripts: fx.transcripts, normalize, embed });
    const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
    console.log(`\n${fx.caseId}: ${r.items.length} labels over ${fx.transcripts.length} transcripts`);
    console.log(`  agreement ${pct(r.agreement)} (target ≥ ${pct(TARGET.agreement)}) · needs_review ${pct(r.reviewRate)} (target ≤ ${pct(TARGET.reviewRate)}) · false credit ${r.falseCredit} · missed credit ${r.missedCredit}`);
    const byItem = new Map<string, { n: number; bad: number }>();
    for (const i of r.items) {
      const e = byItem.get(i.itemId) ?? { n: 0, bad: 0 };
      e.n++;
      if (!i.agree && !i.borderline) e.bad++;
      byItem.set(i.itemId, e);
    }
    const worst = [...byItem].filter(([, e]) => e.bad).sort((a, b) => b[1].bad - a[1].bad);
    if (worst.length) console.log(`  items with disagreements: ${worst.map(([id, e]) => `${id} ${e.bad}/${e.n}`).join(", ")}`);
    if (verbose)
      for (const i of r.items.filter((x) => !x.agree))
        console.log(`  ${i.borderline ? "(borderline) " : ""}${i.transcript} ${i.itemId}: label ${i.expected}, graded ${i.predicted}${i.review ? " [review]" : ""} — ${i.quote ? `“${i.quote}”` : "no quote"} · ${i.rationale}`);
    if (r.agreement < TARGET.agreement || r.reviewRate > TARGET.reviewRate) ok = false;
  }
  if (check && !ok) process.exit(1);
}

if (process.argv[1]?.endsWith("calibrate.ts")) void main();
