/**
 * Proves a regression test catches its bug: runs the NEW test against the OLD code (a git worktree
 * at the commit before the fix) and expects it to FAIL, then runs it on the current tree and
 * expects it to PASS. Writes the evidence to qa/regressions/<bug>.txt.
 *
 *   npm run qa:prove-regression -- <bug> [--commit <sha>]
 *
 * `commit` defaults to the registry entry, else HEAD (M2 workflow: the fix is still uncommitted,
 * so HEAD is the fix's parent).
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

interface Proof {
  kind: "e2e" | "vitest";
  /** test files (repo-relative) copied into the old tree and run there */
  tests: string[];
  /** extra files the tests import (copied too) */
  support?: string[];
  /** default "old code" commit */
  commit?: string;
  description: string;
}

/** One entry per proven bug. M2 adds its bugs here as each fix lands. */
export const PROOFS: Record<string, Proof> = {
  bug8: {
    kind: "e2e",
    tests: ["e2e/regressions/bug8-stuck-popup.spec.ts"],
    support: ["e2e/qa/fixtures.ts"],
    commit: "be1700b",
    description: "Achilles reflex result card on the left ankle could not be closed (no ✕, Esc or outside click)",
  },
  bug1: {
    kind: "vitest",
    tests: ["tests/regressions/bug1-penlight.test.ts"],
    description: "the penlight hit area was far too large: the eye target sat on the lids 1.4–1.9 cm from the pupil with a 1.5 cm tolerance, and only one eye could be lit per click (no sweep, no swinging-light test)",
  },
  bug2: {
    kind: "vitest",
    tests: ["tests/regressions/bug2-mastoid.test.ts"],
    description: "the mastoid was not detected: its landmark sat ~5 cm behind the ear canal under the hair cap, so the Rinne bone step and the post-auricular nodes were not where a clinician puts them",
  },
  bug3: {
    kind: "e2e",
    tests: ["e2e/regressions/bug3-sink.spec.ts"],
    support: ["e2e/qa/fixtures.ts", "e2e/qa/openers.ts"],
    description: "the sink had no basin, soap or towels, and washing showed the hands in front of the camera instead of over a basin",
  },
  bug4: {
    kind: "vitest",
    tests: ["tests/regressions/bug4-shots.test.ts"],
    description: "no front view of the face; the head & neck shot looked down on the scalp so the chin hid the neck; the head swayed and turned during the eye exam",
  },
  bug5: {
    kind: "vitest",
    tests: ["tests/regressions/bug5-skinned-anchors.test.ts"],
    description: "exam landmarks drifted between views: each anchor rode one bone rigidly while the skin blends several, so near joints the targets floated off the skin and slid along it from pose to pose",
  },
  bug7: {
    kind: "vitest",
    tests: ["tests/regressions/bug7-reflexes.test.ts"],
    description: "reflexes didn't move the leg: every jerk flexed the same small amount from the elbow/knee/ankle regions (triceps and Achilles moved the wrong way), there was no legs-dangling position, left lateral bent the hips and knees backwards, and the reflex sites were off the tendons",
  },
  bug9: {
    kind: "e2e",
    tests: ["e2e/regressions/bug9-bp.spec.ts"],
    support: ["e2e/qa/fixtures.ts", "e2e/qa/openers.ts"],
    description: "the BP cuff recorded nothing: no cuff site, no gauge, no Korotkoff sounds, so no blood pressure could be taken",
  },
  bug10: {
    kind: "vitest",
    tests: ["tests/regressions/bug10-hold-choice.test.ts"],
    description: "a stethoscope hold always recorded the first fitting exam, so abdominal bruits could never be recorded (bowel sounds won)",
  },
  "begin-race": {
    kind: "e2e",
    tests: ["e2e/regressions/begin-race.spec.ts"],
    support: ["e2e/qa/fixtures.ts", "e2e/qa/openers.ts"],
    commit: "7ef0418",
    description: "a station reloaded right after opening read the log before the first load's begin landed; its own begin was refused and the door stayed shut",
  },
  "m2-review": {
    kind: "vitest",
    tests: ["tests/m2-review.test.ts"],
    commit: "0de4946",
    description: "M2 review findings: the Achilles close-up camera inside the table when the legs lie on it; a hands clonus test that never moved the foot; a wobble hiding the swinging-light test; touching the upper arm with the hands logging a cuff placement; a click just off the male apex logged as a prohibited breast exam",
  },
};

const ROOT = process.cwd();
const git = (...args: string[]) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();

function run(cmd: string, args: string[], cwd: string, env: Record<string, string> = {}) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", env: { ...process.env, ...env }, maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

/**
 * The old app was green at its commit; the only new files in its tree are the copied tests, which
 * use QA hooks the old code doesn't declare. Don't let `next build` typecheck/lint them.
 */
function oldBuildIgnoresNewFiles(wt: string) {
  const cfg = ["next.config.ts", "next.config.mjs", "next.config.js"].map((f) => path.join(wt, f)).find((f) => fs.existsSync(f));
  if (!cfg) return;
  const src = fs.readFileSync(cfg, "utf8");
  const patched = src.replace(/const nextConfig(: NextConfig)? = \{/, (m) => `${m}\n  typescript: { ignoreBuildErrors: true },\n  eslint: { ignoreDuringBuilds: true },`);
  if (patched === src) throw new Error(`could not patch ${cfg} to skip typechecking the copied tests`);
  fs.writeFileSync(cfg, patched);
}

/** a run that failed before any test body ran proves nothing */
function infraFailure(out: string): string | null {
  if (/was not able to start|webServer|EADDRINUSE|Cannot find module|Error: No tests found/.test(out) && !/\d+ failed/.test(out)) return "the old code's test run did not start (build/server error)";
  return null;
}

function testCommand(p: Proof): [string, string[]] {
  return p.kind === "e2e" ? ["npx", ["playwright", "test", ...p.tests, "--reporter=line"]] : ["npx", ["vitest", "run", ...p.tests]];
}

/** the lines that say why a run failed (assertion messages, expected/received) */
function failureSummary(out: string): string {
  const keep = out
    .split("\n")
    .map((l) => l.replace(/\x1b\[[0-9;]*[A-Za-z]/g, ""))
    .filter((l) => /Error:|expect\(|Expected|Received|AssertionError|✘|×|FAIL|failed|passed/.test(l));
  return keep.slice(0, 40).join("\n");
}

function main() {
  const args = process.argv.slice(2);
  const bug = args.find((a) => !a.startsWith("--"));
  if (!bug || !PROOFS[bug]) {
    console.error(`usage: prove-regression <bug> [--commit <sha>]\nknown: ${Object.keys(PROOFS).join(", ")}`);
    process.exit(2);
  }
  const proof = PROOFS[bug]!;
  const ci = args.indexOf("--commit");
  const commit = git("rev-parse", "--short", ci >= 0 ? args[ci + 1]! : (proof.commit ?? "HEAD"));
  const head = git("rev-parse", "--short", "HEAD");
  const wt = path.join(path.dirname(ROOT), ".osce-prove", `${bug}-${commit}`);
  fs.rmSync(wt, { recursive: true, force: true });
  try {
    git("worktree", "prune");
    git("worktree", "add", "--detach", wt, commit);
    // hard-linked node_modules: same packages, no download, no extra disk
    execFileSync("cp", ["-al", path.join(ROOT, "node_modules"), path.join(wt, "node_modules")]);
    for (const f of [...proof.tests, ...(proof.support ?? [])]) {
      fs.mkdirSync(path.dirname(path.join(wt, f)), { recursive: true });
      fs.copyFileSync(path.join(ROOT, f), path.join(wt, f));
    }
    if (proof.kind === "e2e") oldBuildIgnoresNewFiles(wt);
    const [cmd, cmdArgs] = testCommand(proof);
    console.log(`old code (${commit}): ${cmd} ${cmdArgs.join(" ")}`);
    const old = run(cmd, cmdArgs, wt);
    console.log(`  exit ${old.code}`);
    console.log(`new code (${head} + working tree): ${cmd} ${cmdArgs.join(" ")}`);
    const now = run(cmd, cmdArgs, ROOT);
    console.log(`  exit ${now.code}`);

    const infra = infraFailure(old.out);
    if (infra) console.log(`  ${infra}`);
    const ok = old.code !== 0 && !infra && now.code === 0;
    const report = [
      `# Regression proof: ${bug}`,
      ``,
      `${proof.description}`,
      ``,
      `test:      ${proof.tests.join(", ")}`,
      `command:   ${cmd} ${cmdArgs.join(" ")}`,
      `old code:  ${commit} (git worktree)  → exit ${old.code} ${infra ? `(INVALID: ${infra})` : old.code !== 0 ? "(FAILS, as it must)" : "(PASSED — the test does not catch the bug!)"}`,
      `new code:  ${head} + working tree     → exit ${now.code} ${now.code === 0 ? "(passes)" : "(FAILS)"}`,
      `result:    ${ok ? "PROVEN" : "NOT PROVEN"}`,
      `date:      ${new Date().toISOString()}`,
      ``,
      `## Old code: why it fails`,
      "```",
      failureSummary(old.out) || old.out.slice(-3000),
      "```",
      ``,
      `## New code`,
      "```",
      failureSummary(now.out),
      "```",
      ``,
    ].join("\n");
    fs.mkdirSync(path.join(ROOT, "qa/regressions"), { recursive: true });
    fs.writeFileSync(path.join(ROOT, "qa/regressions", `${bug}.txt`), report);
    console.log(`${ok ? "PROVEN" : "NOT PROVEN"} → qa/regressions/${bug}.txt`);
    process.exitCode = ok ? 0 : 1;
  } finally {
    try {
      git("worktree", "remove", "--force", wt);
    } catch {
      fs.rmSync(wt, { recursive: true, force: true });
      git("worktree", "prune");
    }
  }
}

main();
