/**
 * npm run lang:eval — chat fixture accuracy per case (keyword-only unless vectors are available).
 *   npm run lang:eval -- hf-decompensated-01 [--verbose]
 */
import fs from "node:fs";
import path from "node:path";
import { loadContentFromDisk } from "@/content/loadFromDisk";
import { ChatFixtureFile, ConversationBankFile, HistoryBankFile, SynonymsFile } from "@/domain/schemas";
import { buildBank, type BankSources } from "@/lang/bank";
import { confusion, scoreItem } from "@/lang/evalFixture";
import { matchClause } from "@/lang/matcher";
import { splitClauses } from "@/lang/split";
import { embedTexts } from "@/lang/embed/node";

const read = <T>(f: string, s: { parse: (x: unknown) => T }, fallback: T): T => (fs.existsSync(f) ? s.parse(JSON.parse(fs.readFileSync(f, "utf8"))) : fallback);

export function bankSources(): BankSources {
  const dir = path.join(process.cwd(), "content/lang");
  return {
    synonyms: read(path.join(dir, "synonyms.json"), SynonymsFile, { entries: [] }).entries,
    conversation: read(path.join(dir, "conversation.json"), ConversationBankFile, { replies: [] }).replies,
    history: read(path.join(dir, "history-bank.json"), HistoryBankFile, { entries: [] }).entries,
  };
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const verbose = process.argv.includes("--verbose");
  const content = loadContentFromDisk();
  const src = bankSources();
  for (const file of fs.readdirSync("tests/fixtures/chat").filter((f) => f.endsWith(".json"))) {
    const fx = ChatFixtureFile.parse(JSON.parse(fs.readFileSync(path.join("tests/fixtures/chat", file), "utf8")));
    if (only.length && !only.includes(fx.caseId)) continue;
    const kase = content.caseById.get(fx.caseId);
    if (!kase) continue;
    const bank = buildBank(kase, src);
    const phrases = [...new Set(bank.targets.flatMap((t) => t.phrases))];
    const clauses = fx.items.map((it) => splitClauses(it.q, bank.normalize));
    const allClauses = [...new Set(clauses.flat())];
    const vecs = process.argv.includes("--keywords") ? null : await embedTexts([...phrases, ...allClauses]);
    const pv = new Map(vecs ? phrases.map((p, i) => [p, vecs[i]!] as const) : []);
    const cv = new Map(vecs ? allClauses.map((c, i) => [c, vecs[phrases.length + i]!] as const) : []);
    const results = fx.items.map((it, i) => scoreItem(it, clauses[i]!.map((c) => matchClause(c, bank, vecs ? { clauseVector: cv.get(c), phraseVector: (p) => pv.get(p) } : {})), bank));
    const ok = results.filter((r) => r.ok).length;
    console.log(`${fx.caseId}: ${ok}/${results.length} = ${((100 * ok) / results.length).toFixed(1)}% (${vecs ? "embeddings" : "keyword-only"})`);
    if (verbose) console.log(confusion(results));
  }
}

void main();
