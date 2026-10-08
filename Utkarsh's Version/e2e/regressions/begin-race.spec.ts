/**
 * Found by the M2 gate diagnostics: a practice station reloaded straight after opening read the log
 * before the first load's "begin" reached the server. Its own "begin" was then refused ("That timer
 * event is not due") and the door stayed shut ("Wait for the announcement…") for good. Now a refused
 * begin re-reads the server's log, which already has the encounter running.
 */
import { consoleAllow, expect, test } from "../qa/fixtures";
import { enterCode } from "../qa/openers";

test("a refused begin (another load got there first) still opens the door", async ({ page }) => {
  await page.goto("/");
  await enterCode(page, "student-e2e");
  await page.getByLabel("Your name or alias").fill("Begin race");
  await page.getByLabel(/Practice \(untimed\)/).check();

  // the earlier load's "begin" lands first: post it ourselves just before the page's own one
  let raced = false;
  await page.route("**/api/sessions/*/actions", async (route) => {
    const body = route.request().postDataJSON() as { type?: string; payload?: { event?: string } } | null;
    if (!raced && body?.type === "timer" && body.payload?.event === "begin") {
      raced = true;
      const res = await page.context().request.post(route.request().url(), { data: body });
      expect(res.ok(), "the other load's begin").toBe(true);
    }
    await route.continue();
  });
  consoleAllow(page, /^response: 409: POST \/api\/sessions\/[^/]+\/actions$/);
  consoleAllow(page, /^console\.error: Failed to load resource: the server responded with a status of 409/);

  await page.locator('[data-case="hf-decompensated-01"]').click();
  await expect(page).toHaveURL(/\/station\//);
  await page.waitForFunction(() => window.__osce3d?.ready, null, { timeout: 60_000 });
  await expect.poll(() => raced, { timeout: 15_000 }).toBe(true);
  await expect(page.getByRole("button", { name: "Knock and enter" })).toBeEnabled({ timeout: 10_000 });
  await expect(page.getByText("That timer event is not due.")).toHaveCount(0);
});
