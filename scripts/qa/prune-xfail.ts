/**
 * npm run qa:prune-xfail — drop qa/xfail.json entries whose checks all pass now, using the last
 * results in qa/anchors.json, qa/catalog.json and qa/intersections.json (run those first). An entry
 * is removed only when every check it covers (first match wins, as in classify) is XPASS; an entry
 * that still covers an XFAIL, or matches nothing in these files, stays.
 */
import fs from "node:fs";
import path from "node:path";
import { loadXfail, toRegex } from "./lib/xfail";

const ROOT = process.cwd();
const FILES = ["qa/anchors.json", "qa/catalog.json", "qa/intersections.json"];

const results = FILES.filter((f) => fs.existsSync(path.join(ROOT, f))).flatMap(
  (f) => (JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8")) as { results: { id: string; status: string }[] }).results,
);
const entries = loadXfail();
const matchers = entries.map((e) => ({ e, re: toRegex(e.id), statuses: [] as string[] }));
for (const r of results) matchers.find((m) => m.re.test(r.id))?.statuses.push(r.status);
const keep = matchers.filter((m) => !(m.statuses.length && m.statuses.every((s) => s === "XPASS")));
const removed = matchers.filter((m) => !keep.includes(m));
for (const m of removed) console.log(`  - ${m.e.id} (${m.e.owner}; ${m.statuses.length} check${m.statuses.length === 1 ? "" : "s"} pass)`);
fs.writeFileSync(path.join(ROOT, "qa/xfail.json"), JSON.stringify(keep.map((m) => m.e), null, 1));
console.log(`removed ${removed.length} of ${entries.length} xfail entries`);
