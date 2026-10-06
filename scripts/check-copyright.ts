/**
 * `npm run check:copyright` — flags any run of 7+ consecutive words shared between the repo's
 * content/UI and the local, git-ignored source documents in /source (*.txt; extract with
 * `pdftotext -layout` / `pandoc -t plain`). Skips silently when /source has no .txt files.
 */
import fs from "node:fs";
import path from "node:path";

const N = 7;
const words = (s: string) => s.toLowerCase().replace(/[’']/g, "'").match(/[a-z0-9']+/g) ?? [];
const grams = (ws: string[]) => {
  const out = new Set<string>();
  for (let i = 0; i + N <= ws.length; i++) out.add(ws.slice(i, i + N).join(" "));
  return out;
};

const sourceDir = "source";
const sources = fs.existsSync(sourceDir) ? fs.readdirSync(sourceDir).filter((f) => f.endsWith(".txt")) : [];
if (!sources.length) {
  console.log("check:copyright skipped (no /source/*.txt)");
  process.exit(0);
}
const sourceGrams = new Set<string>();
for (const f of sources) for (const g of grams(words(fs.readFileSync(path.join(sourceDir, f), "utf8")))) sourceGrams.add(g);

const files: string[] = [];
const walk = (d: string) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(json|tsx?|md)$/.test(p)) files.push(p);
  }
};
["content", "src", "docs"].forEach((d) => fs.existsSync(d) && walk(d));

let hits = 0;
for (const f of files) {
  const g = grams(words(fs.readFileSync(f, "utf8")));
  const shared = [...g].filter((x) => sourceGrams.has(x));
  if (shared.length) {
    hits += shared.length;
    console.log(`${f}:\n  ${shared.slice(0, 5).join("\n  ")}${shared.length > 5 ? `\n  …and ${shared.length - 5} more` : ""}`);
  }
}
if (hits) {
  console.error(`\n${hits} shared ${N}-word sequence(s) with /source — reword them (framework text is not copyright-cleared).`);
  process.exit(1);
}
console.log(`check:copyright OK (${files.length} files vs ${sources.length} source text(s))`);
