/**
 * npm run qa — the Phase 4 QA gate, in order:
 *   validate · typecheck · lint · test · test:anchors · test:intersections
 *   then ONE production build and ONE server (QA_HOOKS=true, the e2e env), reused by
 *   test:catalog · test:visual · e2e (each with the console guard)
 *   then qa:review-check.
 * Stops at the first failing step. `--skip <step,step>` skips steps (e.g. --skip catalog,visual).
 * After it passes, open every new or changed PNG listed by qa:review-check and record the review.
 */
import { spawn, spawnSync } from "node:child_process";

const SERVER_ENV: Record<string, string> = {
  AI_MOCK: "true",
  ANTHROPIC_API_KEY: "",
  DATABASE_URL: "",
  FILE_STORE_PATH: "test-results/e2e-store.json",
  ACCESS_CODE: "student-e2e",
  COACH_ACCESS_CODE: "coach-e2e",
  AUTH_SECRET: "e2e-secret-not-for-production",
  RATE_LIMIT_PER_MINUTE: "1000",
  TIME_LIMIT_SECONDS_OVERRIDE: "25",
  ENCOUNTER_SECONDS_OVERRIDE: "25",
  PEN_SECONDS_OVERRIDE: "20",
  QA_HOOKS: "true",
};

const skip = new Set((process.argv.find((a, i) => process.argv[i - 1] === "--skip") ?? "").split(",").filter(Boolean));

function step(name: string, cmd: string, args: string[], env: Record<string, string> = {}) {
  if (skip.has(name)) {
    console.log(`\n── ${name}: skipped`);
    return;
  }
  console.log(`\n── ${name}: ${cmd} ${args.join(" ")}`);
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { stdio: "inherit", env: { ...process.env, ...env } });
  if (r.status !== 0) {
    console.error(`\n✗ qa gate stopped at ${name} (exit ${r.status})`);
    process.exit(r.status ?? 1);
  }
  console.log(`✓ ${name} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

async function waitFor(url: string, ms: number) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server did not come up at ${url}`);
}

async function main() {
  step("validate", "npm", ["run", "validate"]);
  step("typecheck", "npm", ["run", "typecheck"]);
  step("lint", "npm", ["run", "lint"]);
  step("test", "npm", ["test"]);
  step("anchors", "npm", ["run", "test:anchors"]);
  step("intersections", "npm", ["run", "test:intersections"]);

  const browserSteps = ["catalog", "visual", "e2e"].filter((s) => !skip.has(s));
  if (browserSteps.length) {
    step("build", "npm", ["run", "build"]);
    console.log("\n── server: next start -p 3200 (QA_HOOKS=true)");
    const server = spawn("npx", ["next", "start", "-p", "3200"], { env: { ...process.env, ...SERVER_ENV }, stdio: "ignore", detached: true });
    const stop = () => {
      try {
        process.kill(-server.pid!, "SIGTERM");
      } catch {
        /* already gone */
      }
    };
    process.on("exit", stop);
    process.on("SIGINT", () => process.exit(130));
    await waitFor("http://localhost:3200/gate", 120_000);
    const reuse = { PW_REUSE: "1" };
    step("catalog", "npm", ["run", "test:catalog"], reuse);
    step("visual", "npm", ["run", "test:visual"], reuse);
    step("e2e", "npx", ["playwright", "test"], reuse);
    stop();
  }
  step("review", "npm", ["run", "qa:review-check"]);
  console.log("\n✓ qa gate passed. Now open every new or changed screenshot and record it in qa/REVIEW.md.");
}

void main();
