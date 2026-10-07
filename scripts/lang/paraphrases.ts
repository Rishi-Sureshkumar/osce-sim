/**
 * npm run case:paraphrases <caseId> — authoring report for a case's intents (Phase 4 M1):
 *   - facts / negatives / follow-ups with fewer than 5 paraphrases
 *   - near-duplicate phrasings across different targets (cosine > 0.9): the matcher can't tell them apart
 *   - targets the chat fixture never asks about
 */
import fs from "node:fs";
import path from "node:path";
import { loadContentFromDisk } from "@/content/loadFromDisk";
import { ChatFixtureFile } from "@/domain/schemas";
import { buildBank } from "@/lang/bank";
import { embedTexts } from "@/lang/embed/node";
import { cosine } from "@/lang/embed/vectors";

async function main() {
  const caseId = process.argv[2];
  const content = loadContentFromDisk();
  const kase = caseId ? content.caseById.get(caseId) : undefined;
  if (!kase) {
    console.error(`usage: npm run case:paraphrases -- <caseId>\ncases: ${content.cases.map((c) => c.id).join(", ")}`);
    process.exit(2);
  }
  const bank = buildBank(kase, content.lang);
  const own = bank.targets.filter((t) => t.kind === "fact" || t.kind === "negative" || t.kind === "follow_up");
  console.log(`${kase.id}: ${own.length} targets, ${own.reduce((n, t) => n + t.phrases.length, 0)} phrases`);
  const thin = own.filter((t) => t.intent.paraphrases.length < 5);
  console.log(`\nfewer than 5 paraphrases (${thin.length}):`);
  for (const t of thin) console.log(`  ${t.id} — ${t.intent.paraphrases.length}`);

  const items = own.flatMap((t) => t.phrases.map((p) => ({ t, p })));
  const vecs = await embedTexts(items.map((x) => x.p));
  console.log("\nnear-duplicates across targets (cosine > 0.90):");
  if (!vecs) console.log("  (embedding model not available: npm run lang:vendor)");
  else {
    let n = 0;
    for (let i = 0; i < items.length; i++)
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]!;
        const b = items[j]!;
        if (a.t.id === b.t.id || a.t.parent === b.t.id || b.t.parent === a.t.id) continue;
        const c = cosine(vecs[i]!, vecs[j]!);
        if (c > 0.9) {
          n++;
          console.log(`  ${c.toFixed(3)}  ${a.t.id}: "${a.p}"  ⟷  ${b.t.id}: "${b.p}"`);
        }
      }
    if (!n) console.log("  none");
  }
  const fx = path.join(process.cwd(), "tests/fixtures/chat", `${kase.id}.json`);
  console.log("\nnot asked in the chat fixture:");
  if (!fs.existsSync(fx)) console.log("  (no fixture yet: tests/fixtures/chat/<caseId>.json)");
  else {
    const asked = new Set(ChatFixtureFile.parse(JSON.parse(fs.readFileSync(fx, "utf8"))).items.flatMap((i) => i.expect));
    const missing = own.filter((t) => t.kind !== "follow_up" && !asked.has(t.id));
    for (const t of missing) console.log(`  ${t.id}`);
    if (!missing.length) console.log("  none");
  }
}

void main();
