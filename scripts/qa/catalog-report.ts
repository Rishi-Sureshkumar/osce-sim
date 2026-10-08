/**
 * npm run qa:catalog-report — merges the catalog harness results (test-results/catalog/*.json)
 * into qa/catalog.json and prints them grouped by cause.
 *   --xfail   also add qa/xfail.json entries for the current FAILs, with an owner by cause
 *             (review them: a FAIL whose cause isn't recognised gets owner "TRIAGE" and must be
 *             looked at before it is accepted).
 *   --prune   also remove the exact-id qa/xfail.json entries for this run's XPASS checks (wildcard
 *             entries are left for a human to narrow).
 */
import fs from "node:fs";
import path from "node:path";
import { classify, type XfailEntry } from "./lib/xfail";
import { buildCatalogPlan } from "../../e2e/qa/catalogPlan";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "test-results/catalog");

interface Row {
  id: string;
  status: "PASS" | "FAIL" | "XFAIL" | "XPASS";
  detail?: string;
}

/** cause → owner and reason, first match wins */
const CAUSES: { re: RegExp; owner: string; reason: string }[] = [
  { re: /\(a\) first hit is bed/, owner: "M3", reason: "the exam table is in front of the target (patient sinks into the table / backrest; M3 hinge and placement)" },
  { re: /\(a\) first hit is drape \((roll|fold)-/, owner: "M3", reason: "the folded gown edge / fold tab lies over the target and takes the click (sectioned drapes, M3)" },
  { re: /\(a\) first hit is drape/, owner: "M3", reason: "a drape lies over the target and takes the click (sectioned drapes, M3)" },
  { re: /\(a\) first hit is hair|the ear \(ear_/, owner: "M2", reason: "bug 2: hair or the ear lies over the target (hair/ear proxies, mastoid recalibration)" },
  { re: /\(a\) the page covers the canvas/, owner: "M6", reason: "page UI covers the 3D view at the target (toasts/overlays over the canvas)" },
  { re: /\(neg\)/, owner: "M2", reason: "a placement at 2× the tolerance still records the exam (bug 1 penlight / tolerances)" },
  { re: /reflex_(biceps|triceps|brachioradialis|patellar|achilles)|placement → (elbow|knee|wrist|ankle)_\w+ nothing/, owner: "M2", reason: "bug 7: reflex sites are not on the tendons (elbow anchor on the olecranon, etc.)" },
  { re: /\(b\) the click resolved to|\(b\) the click never reached|menu did not open|is not in the menu for this region|placement →/, owner: "M2", reason: "bug 5 / shots: the target is hidden or misplaced from its camera shot (occluded by another body part, or the anchor is off)" },
  { re: /\(c\) no examine/, owner: "M2", reason: "the exam is not recorded from the 3D view (bug 5/7/9 depending on the tool)" },
];

function main() {
  if (!fs.existsSync(DIR)) {
    console.error("no catalog results: run npm run test:catalog first");
    process.exit(1);
  }
  const rows: Row[] = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) as Row[]);
  const by = (s: Row["status"]) => rows.filter((r) => r.status === s);
  console.log(`catalog: ${rows.length} checks — PASS ${by("PASS").length} · XFAIL ${by("XFAIL").length} · XPASS ${by("XPASS").length} · FAIL ${by("FAIL").length}`);
  const groups = new Map<string, Row[]>();
  for (const r of by("FAIL")) {
    const c = CAUSES.find((x) => x.re.test(r.detail ?? ""));
    const k = c ? `${c.owner}: ${c.reason}` : "TRIAGE: unrecognised";
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  for (const [k, list] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n${list.length} × ${k}`);
    for (const r of list.slice(0, 12)) console.log(`   ${r.id} — ${r.detail}`);
    if (list.length > 12) console.log(`   … ${list.length - 12} more`);
  }
  // a filtered run (CATALOG_FILTER) updates its own checks and keeps the rest of the last full run
  const file = path.join(ROOT, "qa/catalog.json");
  const merged = new Map<string, Row>((fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as { results: Row[] }).results : []).map((r) => [r.id, r]));
  for (const r of rows) merged.set(r.id, r);
  // drop rows for entries the current catalog no longer has (a maneuver moved region, etc.)
  const planned = new Set(buildCatalogPlan().map((e) => e.id));
  for (const id of [...merged.keys()]) if (!planned.has(id.replace(/^catalog-(oracle|neg):/, "catalog:"))) merged.delete(id);
  // statuses against the current qa/xfail.json (a kept row may predate an entry, or its removal)
  const reclassified = classify([...merged.values()].map((r) => ({ id: r.id, pass: r.status === "PASS" || r.status === "XPASS", detail: r.detail }))).results.map(({ xfail: _x, pass: _p, ...r }) => r as Row);
  merged.clear();
  for (const r of reclassified) merged.set(r.id, r);
  fs.writeFileSync(file, JSON.stringify({ generated: "npm run test:catalog → npm run qa:catalog-report", results: [...merged.values()].sort((a, b) => a.id.localeCompare(b.id)) }, null, 1));

  if (process.argv.includes("--xfail") || process.argv.includes("--prune")) {
    const file = path.join(ROOT, "qa/xfail.json");
    let list = JSON.parse(fs.readFileSync(file, "utf8")) as XfailEntry[];
    if (process.argv.includes("--prune")) {
      const passing = new Set(by("XPASS").map((r) => r.id));
      const before = list.length;
      list = list.filter((e) => !passing.has(e.id));
      console.log(`\nremoved ${before - list.length} xfail entries that now pass`);
    }
    const have = new Set(list.map((e) => e.id));
    let added = 0;
    for (const r of process.argv.includes("--xfail") ? by("FAIL") : []) {
      if (have.has(r.id)) continue;
      const c = CAUSES.find((x) => x.re.test(r.detail ?? ""));
      list.push({ id: r.id, owner: c?.owner ?? "TRIAGE", reason: `${c?.reason ?? "unrecognised failure — triage"} [${(r.detail ?? "").slice(0, 160)}]` });
      added++;
    }
    list.sort((a, b) => a.owner.localeCompare(b.owner) || a.id.localeCompare(b.id));
    fs.writeFileSync(file, JSON.stringify(list, null, 1));
    console.log(`\nadded ${added} xfail entries (qa/xfail.json)`);
  }
}

main();
