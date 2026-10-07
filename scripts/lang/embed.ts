/**
 * npm run lang:embed — precomputes the phrase vectors the matcher compares against (Phase 4 M1):
 *   src/lang/generated/banks.json     conversation + history-bank phrases (shared by every case)
 *   src/lang/generated/<caseId>.json  that case's facts, follow-ups and negatives
 * int8 + scale per vector (src/lang/embed/vectors.ts). Each file records a hash of the model,
 * the normaliser version and its phrases; tests/lang-generated.test.ts fails when content changed
 * and this wasn't re-run (it doesn't need the model).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { loadContentFromDisk } from "@/content/loadFromDisk";
import { buildBank } from "@/lang/bank";
import { embedTexts } from "@/lang/embed/node";
import { EMBED_MODEL, pack, type PackedVector } from "@/lang/embed/vectors";
import { NORMALIZER_VERSION } from "@/lang/normalize";

const OUT = path.join(process.cwd(), "src/lang/generated");

export function phraseHash(phrases: string[]): string {
  return crypto.createHash("sha256").update(`${EMBED_MODEL}\n${NORMALIZER_VERSION}\n${[...phrases].sort().join("\n")}`).digest("hex").slice(0, 16);
}

/** The phrases each generated file must hold, from content alone. */
export function expectedPhrases(): Map<string, string[]> {
  const content = loadContentFromDisk();
  const out = new Map<string, string[]>();
  const shared = new Set<string>();
  for (const kase of content.cases) {
    const bank = buildBank(kase, content.lang);
    const own = new Set<string>();
    for (const t of bank.targets) for (const p of t.phrases) (t.kind === "conversation" || t.kind === "bank" ? shared : own).add(p);
    out.set(`${kase.id}.json`, [...own].sort());
  }
  out.set("banks.json", [...shared].sort());
  return out;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [file, phrases] of expectedPhrases()) {
    const vecs = await embedTexts(phrases);
    if (!vecs) {
      console.error("lang:embed: the embedding model isn't available (npm run lang:vendor)");
      process.exit(1);
    }
    const packed: Record<string, PackedVector> = {};
    phrases.forEach((p, i) => (packed[p] = pack(vecs[i]!)));
    fs.writeFileSync(path.join(OUT, file), JSON.stringify({ model: EMBED_MODEL, normalizer: NORMALIZER_VERSION, hash: phraseHash(phrases), count: phrases.length, phrases: packed }) + "\n");
    console.log(`lang:embed: ${file} — ${phrases.length} phrases`);
  }
}

if (process.argv[1]?.endsWith("embed.ts")) void main();
