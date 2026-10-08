/**
 * Expected failures for the QA harness (qa/xfail.json): `{ id, owner, reason }`, where `id` may
 * use `*` wildcards. A known-bad check is XFAIL (allowed) until its owner milestone fixes it; a
 * listed check that now passes is XPASS (an error: remove the entry). QA_STRICT_OWNER=M2 (or M3…)
 * ignores that owner's entries, so a milestone proves it emptied its part of the list.
 */
import fs from "node:fs";
import path from "node:path";

export interface XfailEntry {
  id: string;
  owner: string;
  reason: string;
}
export type Status = "PASS" | "FAIL" | "XFAIL" | "XPASS";
export interface CheckResult {
  id: string;
  pass: boolean;
  detail?: string;
}

const FILE = path.join(process.cwd(), "qa/xfail.json");

export function loadXfail(): XfailEntry[] {
  if (!fs.existsSync(FILE)) return [];
  return JSON.parse(fs.readFileSync(FILE, "utf8")) as XfailEntry[];
}

export const toRegex = (glob: string) => new RegExp(`^${glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);

export function classify(results: CheckResult[], entries = loadXfail(), strictOwner = process.env.QA_STRICT_OWNER) {
  const active = entries.filter((e) => !strictOwner || e.owner !== strictOwner);
  const matchers = active.map((e) => ({ e, re: toRegex(e.id), used: false }));
  const out = results.map((r) => {
    const m = matchers.find((x) => x.re.test(r.id));
    if (m) m.used = true;
    const status: Status = m ? (r.pass ? "XPASS" : "XFAIL") : r.pass ? "PASS" : "FAIL";
    return { ...r, status, xfail: m?.e };
  });
  return { results: out, unused: matchers.filter((m) => !m.used).map((m) => m.e) };
}

/** Print a summary; returns true when there is no FAIL and no XPASS. */
export function report(title: string, classified: ReturnType<typeof classify>, opts: { prefix?: string } = {}): boolean {
  const n = (s: Status) => classified.results.filter((r) => r.status === s);
  const fails = n("FAIL");
  const xpass = n("XPASS");
  console.log(`\n${title}: PASS ${n("PASS").length} · XFAIL ${n("XFAIL").length} · XPASS ${xpass.length} · FAIL ${fails.length}`);
  for (const r of fails) console.log(`  FAIL  ${r.id}${r.detail ? ` — ${r.detail}` : ""}`);
  for (const r of xpass) console.log(`  XPASS ${r.id} (now passes: remove it from qa/xfail.json, owner ${r.xfail?.owner})`);
  const stale = classified.unused.filter((e) => !opts.prefix || e.id.startsWith(opts.prefix));
  for (const e of stale) console.log(`  note: xfail entry matches nothing: ${e.id} (${e.owner})`);
  return !fails.length && !xpass.length;
}
