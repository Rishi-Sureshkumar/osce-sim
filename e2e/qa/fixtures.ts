/**
 * Playwright fixtures shared by every e2e/QA spec.
 *
 * Console guard: a test fails if the page logs a console warning or error, throws an uncaught
 * exception, has a request fail, or gets an HTTP response >= 400, unless the test allowlisted it
 * with `consoleAllow(page, /pattern/)`, matched against "<kind>: <text>" — e.g.
 * "response: 403: POST /api/..." or "console.warning: THREE...".
 */
import { test as base, expect, type Page } from "@playwright/test";

export interface ConsoleIssue {
  kind: "console.warning" | "console.error" | "pageerror" | "requestfailed" | "response";
  text: string;
}

/** Issues that are expected in every run (none yet: add sparingly, with a reason). */
const GLOBAL_ALLOW: RegExp[] = [
  // navigating away cancels in-flight fetches/media; that is not a failure
  /^requestfailed: .*net::ERR_ABORTED/,
];

export const test = base.extend<{ consoleIssues: ConsoleIssue[] }>({
  consoleIssues: async ({}, provide) => {
    await provide([]);
  },
  page: async ({ page, consoleIssues }, provide, testInfo) => {
    const allow: RegExp[] = [...GLOBAL_ALLOW];
    (page as Page & { __consoleAllow?: RegExp[] }).__consoleAllow = allow;
    const push = (kind: ConsoleIssue["kind"], text: string) => consoleIssues.push({ kind, text });
    page.on("console", (m) => {
      if (m.type() === "warning") push("console.warning", m.text());
      else if (m.type() === "error") push("console.error", m.text());
    });
    page.on("pageerror", (e) => push("pageerror", `${e.name}: ${e.message}`));
    page.on("requestfailed", (r) => push("requestfailed", `${r.method()} ${new URL(r.url()).pathname} ${r.failure()?.errorText ?? ""}`));
    page.on("response", (r) => {
      if (r.status() >= 400) push("response", `${r.status()}: ${r.request().method()} ${new URL(r.url()).pathname}`);
    });
    await provide(page);
    const left = consoleIssues.filter((i) => !allow.some((re) => re.test(`${i.kind}: ${i.text}`)));
    if (left.length) {
      await testInfo.attach("console-issues.json", { body: JSON.stringify(left, null, 2), contentType: "application/json" });
      // a failing test already reports its own error; only fail clean tests on console issues
      if (testInfo.status === testInfo.expectedStatus) {
        expect(left, "console guard: unexpected warnings/errors/failed requests (see console-issues.json)").toEqual([]);
      }
    }
  },
});

/** Allowlist an expected console issue for the current test (see the module comment). */
export function consoleAllow(page: Page, re: RegExp) {
  (page as Page & { __consoleAllow?: RegExp[] }).__consoleAllow?.push(re);
}

/** Wait until the 3D view reports it is settled (camera, table, door, proxies, gown; not busy). */
export async function waitSettled(page: Page, timeout = 15_000) {
  await page.waitForFunction(() => window.__osce3d?.settled() === true, null, { timeout, polling: 50 });
}

/**
 * Reload the station in a QA mode (`?qa=fast`, `?qa=fast,freeze`) and wait for the 3D view. The
 * first load finishes its models before the reload: leaving the page mid-decode logs
 * "GLTFLoader: Couldn't load texture blob" from the abandoned page, which the console guard fails on.
 */
export async function reloadInQaMode(page: Page, qa = "fast") {
  await page.waitForFunction(() => window.__osce3d?.ready, null, { timeout: 60_000 });
  await page.goto(`${page.url()}?qa=${qa}`);
  await page.waitForFunction(() => window.__osce3d?.ready, null, { timeout: 60_000 });
}

export { expect };
