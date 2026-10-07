/**
 * Bug 8 regression (Phase 4 M0.2): the Achilles reflex result on the left ankle opened a result
 * card with no ✕ that ignored Esc and outside clicks, so it stayed over the 3D view.
 * Written to run on the Phase 3 code too (no `settled`/QA hooks there), so
 * `npm run qa:prove-regression -- bug8` can show it fails on be1700b.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "../qa/fixtures";

async function settle(page: Page) {
  const has = await page.evaluate(() => typeof (window.__osce3d as { settled?: unknown } | undefined)?.settled === "function");
  if (has) await page.waitForFunction(() => window.__osce3d!.settled(), null, { timeout: 15_000 });
  else await page.waitForTimeout(1600);
}

test("bug 8: the Achilles reflex result card can be closed (✕, Esc, outside click)", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Access code").fill("student-e2e");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).not.toHaveURL(/\/gate/);
  await page.getByLabel("Your name or alias").fill("Bug 8");
  await page.getByLabel(/Practice \(untimed\)/).check();
  await page.locator('[data-case="screening-normal"]').click();
  await expect(page).toHaveURL(/\/station\//);
  await page.waitForFunction(() => window.__osce3d?.ready, null, { timeout: 60_000 });
  await page.getByRole("button", { name: "Knock and enter" }).click();
  await expect(page.locator('[data-testid="exam3d"]')).toHaveAttribute("data-camera", "overview", { timeout: 10_000 });
  await settle(page);

  await page.getByRole("button", { name: "Tools…" }).click();
  await page.locator('[role=menuitem][data-tool="reflex_hammer"]').click();
  await page.getByLabel("Camera shot").selectOption("feet");
  await expect(page.locator('[data-testid="exam3d"]')).toHaveAttribute("data-camera", "feet");

  const tap = async () => {
    await settle(page);
    const p = await page.evaluate(() => window.__osce3d!.project("ankle_left"));
    await page.mouse.click(p!.x, p!.y);
    await expect(page.locator('[data-testid="findings"]')).toContainText(/Achilles/i);
  };
  const card = () => page.locator("section, div").filter({ has: page.getByRole("heading", { name: /Achilles/i }) }).last();

  await tap();
  await expect(card()).toBeVisible();
  // 1) a visible ✕
  const close = card().getByRole("button", { name: "Close", exact: true });
  await expect(close, "the result card has a visible ✕").toBeVisible({ timeout: 3_000 });
  await close.click();
  await expect(page.getByRole("heading", { name: /Achilles/i })).toHaveCount(0);
  // 2) Esc
  await tap();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: /Achilles/i }), "Esc closes the result card").toHaveCount(0);
  // 3) a click outside (the page header)
  await tap();
  await page.mouse.click(6, 6);
  await expect(page.getByRole("heading", { name: /Achilles/i }), "an outside click closes the result card").toHaveCount(0);
});
