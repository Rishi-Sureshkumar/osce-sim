/**
 * Bug 3 regression (Phase 4 M2): the sink was a flat slab with a tap — no basin to wash in, no soap
 * or towels — and washing showed the hands floating in front of the camera. Now the basin is at
 * least 8 cm deep and washing at the sink happens over it (with the water running).
 */
import type { Page } from "@playwright/test";
import { expect, test, waitSettled } from "../qa/fixtures";
import { enterCode } from "../qa/openers";

type Box = { min: [number, number, number]; max: [number, number, number]; center: [number, number, number] } | null;
const box = (page: Page, name: string) => page.evaluate((n) => window.__osce3d!.objectState(n) as Box, name);

test("bug 3: the sink has a real basin, and washing at the sink happens over it", async ({ page }) => {
  await page.goto("/");
  await enterCode(page, "student-e2e");
  await page.getByLabel("Your name or alias").fill("Bug 3");
  await page.getByLabel(/Practice \(untimed\)/).check();
  await page.locator('[data-case="screening-normal"]').click();
  await expect(page).toHaveURL(/\/station\//);
  await page.goto(`${page.url()}?qa=freeze`);
  await page.waitForFunction(() => window.__osce3d?.ready, null, { timeout: 60_000 });
  await page.getByRole("button", { name: "Knock and enter" }).click();
  await expect(page.locator('[data-testid="exam3d"]')).toHaveAttribute("data-camera", "overview", { timeout: 15_000 });
  await waitSettled(page);

  const basin = await box(page, "sink-basin");
  expect(basin, "a sink basin exists").not.toBeNull();
  expect(basin!.max[1] - basin!.min[1], "basin depth (m)").toBeGreaterThanOrEqual(0.08);
  for (const prop of ["towel-dispenser", "sanitiser-dispenser"]) expect(await box(page, prop), prop).not.toBeNull();

  // click the sink itself (not the sanitiser): hands wash over the basin
  const p = await page.evaluate(() => window.__osce3d!.projectObject("sink-basin"));
  expect(p).not.toBeNull();
  await page.mouse.click(p!.x, p!.y);
  await expect(page.locator('[data-testid="washing"]')).toContainText("Cleaning hands");
  await page.waitForTimeout(500);
  const hands = await box(page, "hand-wash");
  expect(hands, "washing hands are drawn").not.toBeNull();
  const [hx, hy, hz] = hands!.center;
  expect(hx, "hands over the basin (x)").toBeGreaterThan(basin!.min[0]);
  expect(hx).toBeLessThan(basin!.max[0]);
  expect(hz, "hands over the basin (z)").toBeGreaterThan(basin!.min[2]);
  expect(hz).toBeLessThan(basin!.max[2]);
  expect(hy, "hands just above the drain, below head height").toBeGreaterThan(basin!.min[1]);
  expect(hy).toBeLessThan(basin!.max[1] + 0.25);
  await expect(page.locator('[data-testid="hands-status"]')).toHaveText("Hands: clean", { timeout: 10_000 });
});
