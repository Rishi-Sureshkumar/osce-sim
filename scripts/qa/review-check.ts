/**
 * Visual review bookkeeping (Phase 4 M0.5) for qa/REVIEW.md.
 *
 *   npm run qa:review-check            every PNG in qa/screens/manifest.json has a reviewed row at its
 *                                      current sha; defect ids exist; no open high defect without an
 *                                      owner (QA_STRICT_OWNER=M3 / QA_FINAL=1 also fail that owner's / all)
 *   npm run qa:review-check -- --scaffold   add UNREVIEWED rows for new or changed screenshots
 *                                      (unchanged shas keep their review)
 *
 * Rows: | file | sha256 (12) | reviewed@ | defects | notes |   — "reviewed@" is a commit or UNREVIEWED.
 * Defects: | id | severity (high/medium/low) | category | owner | status (open/fixed/wontfix) | description |
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const REVIEW = path.join(ROOT, "qa/REVIEW.md");
const MANIFEST = path.join(ROOT, "qa/screens/manifest.json");

interface Row {
  file: string;
  sha: string;
  reviewed: string;
  defects: string[];
  notes: string;
}
interface Defect {
  id: string;
  severity: string;
  category: string;
  owner: string;
  status: string;
  description: string;
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

function section(md: string, heading: string): string[] {
  const i = md.indexOf(`## ${heading}`);
  if (i < 0) return [];
  const rest = md.slice(i).split("\n").slice(1);
  const end = rest.findIndex((l) => l.startsWith("## "));
  return (end < 0 ? rest : rest.slice(0, end)).filter((l) => l.trim().startsWith("|") && !/^\|\s*-/.test(l.trim()));
}

export function parseReview(md: string) {
  const defects: Defect[] = section(md, "Defects")
    .slice(1)
    .map(cells)
    .map(([id, severity, category, owner, status, description]) => ({ id: id!, severity: severity!, category: category!, owner: owner!, status: status!, description: description! }));
  const rows: Row[] = section(md, "Screenshots")
    .slice(1)
    .map(cells)
    .map(([file, sha, reviewed, defects, notes]) => ({ file: file!.replace(/`/g, ""), sha: sha!, reviewed: reviewed!, defects: defects && defects !== "—" && defects !== "-" ? defects.split(/[,\s]+/).filter(Boolean) : [], notes: notes ?? "" }));
  return { defects, rows };
}

function renderRows(rows: Row[]): string {
  return ["| file | sha256 | reviewed@ | defects | notes |", "|---|---|---|---|---|", ...rows.map((r) => `| ${r.file} | ${r.sha} | ${r.reviewed} | ${r.defects.length ? r.defects.join(", ") : "—"} | ${r.notes} |`)].join("\n");
}

function main() {
  const scaffold = process.argv.includes("--scaffold");
  if (!fs.existsSync(MANIFEST)) {
    console.error("qa/screens/manifest.json is missing: run npm run test:visual first");
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8")) as { file: string; sha256: string }[];
  const md = fs.existsSync(REVIEW) ? fs.readFileSync(REVIEW, "utf8") : "# Visual review\n\n## Defects\n\n| id | severity | category | owner | status | description |\n|---|---|---|---|---|---|\n\n## Screenshots\n\n";
  const { defects, rows } = parseReview(md);
  const byFile = new Map(rows.map((r) => [r.file, r]));

  if (scaffold) {
    const out: Row[] = manifest.map((m) => {
      const r = byFile.get(m.file);
      const sha = m.sha256.slice(0, 12);
      return r && r.sha === sha ? r : { file: m.file, sha, reviewed: "UNREVIEWED", defects: r?.defects ?? [], notes: r ? `changed (was ${r.sha})` : "new" };
    });
    const i = md.indexOf("## Screenshots");
    const head = i < 0 ? `${md.trimEnd()}\n\n` : md.slice(0, i);
    fs.writeFileSync(REVIEW, `${head}## Screenshots\n\n${renderRows(out)}\n`);
    console.log(`qa/REVIEW.md: ${out.filter((r) => r.reviewed === "UNREVIEWED").length} screenshots to review, ${out.length} total`);
    return;
  }

  const problems: string[] = [];
  const defectIds = new Set(defects.map((d) => d.id));
  for (const m of manifest) {
    const r = byFile.get(m.file);
    if (!r) problems.push(`no review row: ${m.file}`);
    else if (r.sha !== m.sha256.slice(0, 12)) problems.push(`changed since review (${r.sha} → ${m.sha256.slice(0, 12)}): ${m.file}`);
    else if (r.reviewed === "UNREVIEWED") problems.push(`not reviewed yet: ${m.file}`);
    for (const d of r?.defects ?? []) if (!defectIds.has(d)) problems.push(`${m.file}: unknown defect ${d}`);
  }
  const files = new Set(manifest.map((m) => m.file));
  for (const r of rows) if (!files.has(r.file)) console.log(`note: review row for a screenshot that no longer exists: ${r.file}`);
  for (const f of manifest) if (!fs.existsSync(path.join(ROOT, "qa/screens", f.file))) console.log(`note: ${f.file} is in the manifest but not on disk (run npm run test:visual)`);
  const strict = process.env.QA_STRICT_OWNER;
  const final = process.env.QA_FINAL === "1";
  for (const d of defects) {
    if (d.severity !== "high" || d.status !== "open") continue;
    if (!d.owner || d.owner === "—" || final || d.owner === strict) problems.push(`open high defect ${d.id} (${d.owner || "no owner"}): ${d.description}`);
  }
  let head = "";
  try {
    head = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    /* not a git checkout */
  }
  const open = defects.filter((d) => d.status === "open");
  console.log(`qa:review-check @${head}: ${manifest.length} screenshots, ${rows.filter((r) => r.reviewed !== "UNREVIEWED").length} reviewed; defects open: ${open.filter((d) => d.severity === "high").length} high, ${open.filter((d) => d.severity === "medium").length} medium, ${open.filter((d) => d.severity === "low").length} low`);
  for (const p of problems.slice(0, 60)) console.log(`  ✗ ${p}`);
  if (problems.length > 60) console.log(`  … and ${problems.length - 60} more`);
  process.exitCode = problems.length ? 1 : 0;
}

main();
