import type { Page } from "@playwright/test";
import { expect, test, waitSettled } from "./qa/fixtures";
import { enterCode } from "./qa/openers";

/** Phase 4 M4: hide-findings mode (interpret what you hear) and mistake alerts, through to the results page. */

async function camera(page: Page, shot: string) {
  await page.getByLabel("Camera shot").selectOption(shot);
  await expect(page.locator('[data-testid="exam3d"]')).toHaveAttribute("data-camera", shot);
  await waitSettled(page);
}

async function examine(page: Page, region: string, maneuver: string) {
  await page.getByRole("button", { name: /^Examine…/ }).click();
  await page.getByRole("dialog", { name: "Examine" }).locator(`[data-region="${region}"]`).click();
  await page.locator(`[data-maneuver="${maneuver}"]`).click();
  await expect(page.locator('[data-testid="perform-finding"] .font-medium')).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
}

test("hide findings: the student hears the S3, writes what they noticed; mistakes alert and are listed in results", async ({ page }) => {
  await page.goto("/");
  await enterCode(page, "student-e2e");
  await page.getByLabel(/Practice \(untimed\)/).check();
  await page.getByLabel(/Hide findings/).check();
  await page.locator('[data-case="hf-decompensated-01"]').click();
  await expect(page).toHaveURL(/\/station\//);
  await expect(page.getByTestId("findings-hidden-chip")).toBeVisible();
  await page.waitForFunction(() => window.__osce3d?.ready, null, { timeout: 60_000 });
  await page.getByRole("button", { name: "Knock and enter" }).click();
  await expect(page.locator('[data-testid="corridor"]')).toHaveCount(0, { timeout: 10_000 });
  await waitSettled(page);

  // touching the patient before introducing yourself or asking permission: two alerts (practice)
  await examine(page, "shin_right", "edema_assessment");
  await expect(page.locator('[data-testid="mistake-alert"][data-rule="exam_before_introduction"]')).toBeVisible();
  await expect(page.locator('[data-testid="mistake-alert"][data-rule="exam_without_consent"]')).toBeVisible();
  // a text-only ("reported") finding is still shown
  await expect(page.locator('[data-testid="findings"]')).toContainText("pitting edema");
  await page.locator('[data-testid="mistake-alert"][data-rule="exam_without_consent"]').getByRole("button", { name: "Dismiss" }).click();
  await expect(page.locator('[data-testid="mistake-alert"][data-rule="exam_without_consent"]')).toHaveCount(0);

  // the S3: the sound plays, but neither the caption nor the findings say what it is
  await page.getByRole("button", { name: "Tools…" }).click();
  await page.locator('[role=menuitem][data-tool="stethoscope"]').click();
  await page.getByRole("radio", { name: "Bell" }).click();
  await camera(page, "chest_front");
  const pt = await page.evaluate(() => window.__osce3d!.project("cardiac_mitral"));
  await page.mouse.move(pt!.x, pt!.y);
  await page.mouse.down();
  await expect(page.locator('[data-testid="sound-caption"]')).toContainText("Listening…", { timeout: 3_000 });
  await page.waitForTimeout(3_300);
  await page.mouse.up();
  const latest = page.locator('[data-testid="findings"] li').first();
  await expect(latest.getByTestId("interpret")).toContainText("Mitral area");
  await expect(page.locator('[data-testid="findings"]')).not.toContainText("S3");
  await latest.getByRole("textbox").fill("Extra low-pitched S3 gallop at the apex");
  await latest.getByRole("button", { name: "Save" }).click();
  await expect(latest.getByTestId("interpretation")).toContainText("You noted: Extra low-pitched S3 gallop at the apex");

  // leave without closing → the PEN → results list the recognition and every mistake
  await page.getByRole("button", { name: "Put down" }).click();
  await camera(page, "overview");
  await page.getByRole("button", { name: "Leave the room" }).click();
  await page.getByRole("dialog", { name: "Leave the room?" }).getByRole("button", { name: "Leave" }).click();
  // practice: a reminder to close and clean hands first
  await page.getByRole("status").filter({ hasText: "Before you leave" }).getByRole("button", { name: "Leave anyway" }).click();
  await expect(page.getByRole("heading", { name: "Post-encounter note" })).toBeVisible();
  await page.getByLabel("History").fill("Breathless.");
  await page.getByLabel("Physical examination").fill("S3 at the apex. Pitting edema.");
  await page.getByLabel("Diagnosis 1").fill("Heart failure");
  await page.getByRole("button", { name: "Submit note" }).click();
  await expect(page).toHaveURL(/\/results\//);
  await expect(page.locator('[data-testid="summary"]')).toBeVisible({ timeout: 30_000 });
  const recognition = page.getByTestId("recognition");
  await expect(recognition).toContainText("S3 gallop");
  await expect(recognition.locator('[data-verdict="recognized"]')).toHaveCount(1);
  const mistakes = page.getByTestId("mistakes");
  await expect(mistakes).toContainText("Introduce yourself");
  await expect(mistakes).toContainText("Ask the patient's permission");
  await expect(mistakes).toContainText("You left without closing");
});
