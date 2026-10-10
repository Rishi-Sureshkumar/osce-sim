/**
 * Dialog contract (Phase 4 M0.2): every dialog in DIALOG_IDS has a visible ✕, closes on Esc,
 * closes on an outside click (except `confirm` dialogs) and keeps Tab focus inside itself.
 * OPENERS must cover every DialogId: adding a dialog without an opener fails typecheck.
 */
import type { Page } from "@playwright/test";
import { DIALOG_IDS, type DialogId } from "../src/components/ui/dialogIds";
import { expect, reloadInQaMode, test, waitSettled } from "./qa/fixtures";
import { OPENERS, enterCode } from "./qa/openers";

/** Screening patient, practice mode, fast QA timings, inside the room. */
async function startStation(page: Page) {
  await page.goto("/");
  await enterCode(page, "student-e2e");
  await expect(page).not.toHaveURL(/\/gate/);
  await page.getByLabel("Your name or alias").fill("Dialog QA");
  await page.getByLabel(/Practice \(untimed\)/).check();
  await page.locator('[data-case="screening-normal"]').click();
  await expect(page).toHaveURL(/\/station\//);
  await reloadInQaMode(page);
  await page.getByRole("button", { name: "Knock and enter" }).click();
  await expect(page.locator('[data-testid="exam3d"]')).toHaveAttribute("data-camera", "overview", { timeout: 10_000 });
  await waitSettled(page);
}

const panel = (page: Page, id: DialogId) => page.locator(`[data-dialog="${id}"]`);

async function focusInside(page: Page, id: DialogId) {
  return page.evaluate((i) => !!document.activeElement?.closest(`[data-dialog="${i}"]`), id);
}

/** Return to a neutral state between checks: nothing open, room overview, nothing in hand. */
async function reset(page: Page) {
  for (let k = 0; k < 3 && (await page.locator("[data-dialog]").count()); k++) await page.keyboard.press("Escape");
  await expect(page.locator("[data-dialog]")).toHaveCount(0);
  if (await page.getByRole("button", { name: "Put down" }).isVisible()) await page.getByRole("button", { name: "Put down" }).click();
}

test.describe.configure({ mode: "serial" });

test("every dialog id has an opener", () => {
  expect(Object.keys(OPENERS).sort()).toEqual([...DIALOG_IDS].sort());
});

test("dialog contract: ✕, Esc, outside click, focus trap — for every dialog", async ({ page }) => {
  test.setTimeout(600_000);
  await startStation(page);
  for (const id of DIALOG_IDS) {
    await test.step(id, async () => {
      const open = async () => {
        await reset(page);
        await OPENERS[id](page);
        await expect(panel(page, id), `${id} opens`).toBeVisible();
      };

      // a visible ✕ closes it
      await open();
      const close = panel(page, id).getByRole("button", { name: "Close", exact: true });
      await expect(close, `${id} has a visible ✕`).toBeVisible();
      await close.click();
      await expect(panel(page, id), `${id} closes with ✕`).toHaveCount(0);

      // Esc closes it
      await open();
      await page.keyboard.press("Escape");
      await expect(panel(page, id), `${id} closes with Esc`).toHaveCount(0);

      // an outside click closes it, except confirmations
      await open();
      const kind = await panel(page, id).getAttribute("data-dialog-kind");
      const box = await panel(page, id).boundingBox();
      // a point outside the panel: top-left corner of the page (backdrop for modals, page header otherwise)
      const pt = box && box.x > 12 && box.y > 12 ? { x: 6, y: 6 } : { x: (page.viewportSize()?.width ?? 1280) - 6, y: (page.viewportSize()?.height ?? 720) - 6 };
      await page.mouse.click(pt.x, pt.y);
      if (kind === "confirm") {
        await expect(panel(page, id), `${id} (confirm) stays open on an outside click`).toBeVisible();
      } else {
        await expect(panel(page, id), `${id} closes on an outside click`).toHaveCount(0);
        await open();
      }

      // focus is inside on open and stays inside for 12 Tabs and 3 Shift+Tabs
      expect(await focusInside(page, id), `${id}: focus moves into the dialog`).toBe(true);
      for (let k = 0; k < 12; k++) {
        await page.keyboard.press("Tab");
        expect(await focusInside(page, id), `${id}: Tab ${k + 1} stays inside`).toBe(true);
      }
      for (let k = 0; k < 3; k++) {
        await page.keyboard.press("Shift+Tab");
        expect(await focusInside(page, id), `${id}: Shift+Tab ${k + 1} stays inside`).toBe(true);
      }
      await page.keyboard.press("Escape");
      await expect(panel(page, id)).toHaveCount(0);
    });
  }
});

test("toasts have a ✕ and dismiss themselves after 6 s", async ({ page }) => {
  await startStation(page);
  const p = await page.evaluate(() => window.__osce3d!.projectObject("sanitiser-dispenser"));
  await page.mouse.click(p!.x, p!.y);
  const toast = page.getByTestId("toast").filter({ hasText: "Hands cleaned." });
  await expect(toast).toBeVisible({ timeout: 8_000 });
  await toast.getByRole("button", { name: "Dismiss" }).click();
  await expect(toast).toHaveCount(0);
  await page.getByRole("button", { name: "Back (Esc)" }).click();
  await waitSettled(page);
  const again = await page.evaluate(() => window.__osce3d!.projectObject("sanitiser-dispenser"));
  await page.mouse.click(again!.x, again!.y);
  await expect(toast).toBeVisible({ timeout: 8_000 });
  await expect(toast).toHaveCount(0, { timeout: 7_500 });
});
