/**
 * M1: the deterministic patient understands the blind chat fixtures (tests/fixtures/chat) — at
 * least 90% of questions answered from the right fact/negative/conversation target, with the real
 * embedding model (vendored by `npm run lang:vendor`, which `npm test` runs first).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadContentFromDisk } from "@/content/loadFromDisk";
import { ChatFixtureFile } from "@/domain/schemas";
import { buildBank } from "@/lang/bank";
import { embedTexts, modelAvailable } from "@/lang/embed/node";
import { confusion, scoreItem } from "@/lang/evalFixture";
import { matchClause } from "@/lang/matcher";
import { splitClauses } from "@/lang/split";

const MIN_ACCURACY = 0.9;
const DIR = path.join(process.cwd(), "tests/fixtures/chat");
const content = loadContentFromDisk();

describe("chat fixtures (blind) — intent accuracy", () => {
  it("the embedding model is vendored", () => {
    expect(modelAvailable(), "run npm run lang:vendor").toBe(true);
  });
  for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith(".json"))) {
    const fx = ChatFixtureFile.parse(JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8")));
    it(`${fx.caseId}: ≥ ${MIN_ACCURACY * 100}% of ${fx.items.length} questions`, async () => {
      const kase = content.caseById.get(fx.caseId);
      expect(kase, fx.caseId).toBeDefined();
      const bank = buildBank(kase!, content.lang);
      const phrases = [...new Set(bank.targets.flatMap((t) => t.phrases))];
      const clauses = fx.items.map((it) => splitClauses(it.q, bank.normalize));
      const flat = [...new Set(clauses.flat())];
      const vecs = (await embedTexts([...phrases, ...flat]))!;
      const pv = new Map(phrases.map((p, i) => [p, vecs[i]!] as const));
      const cv = new Map(flat.map((c, i) => [c, vecs[phrases.length + i]!] as const));
      const results = fx.items.map((it, i) => scoreItem(it, clauses[i]!.map((c) => matchClause(c, bank, { clauseVector: cv.get(c), phraseVector: (p) => pv.get(p) })), bank));
      const acc = results.filter((r) => r.ok).length / results.length;
      expect(acc, `${(acc * 100).toFixed(1)}% — misses:\n${confusion(results)}`).toBeGreaterThanOrEqual(MIN_ACCURACY);
    }, 120_000);
  }
});
