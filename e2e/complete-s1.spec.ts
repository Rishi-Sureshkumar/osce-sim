import type { Page } from "@playwright/test";
import { expect, test, waitSettled } from "./qa/fixtures";
import { enterCode } from "./qa/openers";

/**
 * Phase 4 M5: the S1 radiculopathy case end to end, with every off-host request blocked — the
 * ankle jerk with the legs hanging, a cotton swab on the lateral border of the foot, the straight
 * leg raise lying flat, then a note that names the S1 radiculopathy and is credited for it.
 */

async function ask(page: Page, text: string) {
  const before = await page.locator('[data-testid="chat-log"] > div').count();
  await page.locator("#chat-input").fill(text);
  await page.locator("#chat-input").press("Enter");
  await expect(page.locator('[data-testid="chat-log"] > div')).toHaveCount(before + 2);
  await expect(page.locator("[data-streaming]")).toHaveCount(0);
}

async function position(page: Page, label: string) {
  await page.getByRole("button", { name: "Actions ▾" }).click();
  await page.getByRole("menuitem", { name: `Position: ${label}` }).click();
  await expect(page.locator('[data-testid="position-label"]')).toHaveText(label);
  await waitSettled(page);
}

async function camera(page: Page, shot: string) {
  await page.getByLabel("Camera shot").selectOption(shot);
  await expect(page.locator('[data-testid="exam3d"]')).toHaveAttribute("data-camera", shot);
  await waitSettled(page);
}

async function pick(page: Page, tool: string) {
  await page.getByRole("button", { name: "Tools…" }).click();
  await page.locator(`[role=menuitem][data-tool="${tool}"]`).click();
  await waitSettled(page);
}

/** click a region's hidden target (3 mm under the skin) through the real canvas */
async function tap(page: Page, regionId: string) {
  const p = await page.evaluate((r) => {
    const h = window.__osce3d!;
    const w = h.anchor(r);
    const n = h.anchorNormal(r) ?? [0, 0, 0];
    return w ? h.projectPoint([w[0] - n[0] * 0.003, w[1] - n[1] * 0.003, w[2] - n[2] * 0.003]) : null;
  }, regionId);
  expect(p, `${regionId} on screen`).not.toBeNull();
  await page.mouse.click(p!.x, p!.y);
}

async function examine(page: Page, region: string, maneuver: string) {
  await page.getByRole("button", { name: /^Examine…/ }).click();
  await page.getByRole("dialog", { name: "Examine" }).locator(`[data-region="${region}"]`).click();
  await page.locator(`[data-maneuver="${maneuver}"]`).click();
  await expect(page.locator('[data-testid="perform-finding"] .font-medium')).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
}

test("S1 radiculopathy: ankle jerk with the legs hanging, swab on the lateral foot, SLR, credited note (offline)", async ({ page }) => {
  test.setTimeout(240_000);
  const offHost: string[] = [];
  await page.route(/^https?:\/\/(?!localhost[:/]|127\.0\.0\.1[:/])/, (route) => {
    offHost.push(route.request().url());
    return route.abort();
  });

  await page.goto("/");
  await enterCode(page, "student-e2e");
  await page.getByLabel(/Practice \(untimed\)/).check();
  await page.locator('[data-case="s1-radiculopathy-01"]').click();
  await expect(page).toHaveURL(/\/station\//);
  await expect(page.getByTestId("door-placard")).toContainText("Low back pain going down the leg");
  await page.goto(`${page.url()}?qa=fast`);
  await page.waitForFunction(() => window.__osce3d?.ready, null, { timeout: 60_000 });
  await page.getByRole("button", { name: "Knock and enter" }).click();
  await waitSettled(page);

  await ask(page, "Hello Ms Whitfield, my name is Sam Patel and I'm a medical student. What brings you in today?");
  await expect(page.locator('[data-testid="chat-log"]')).toContainText("down my left leg");
  await ask(page, "Have you had any trouble controlling your bladder or bowels?");
  await ask(page, "Is it okay if I examine you now?");

  // the ankle jerk, with the legs hanging over the edge of the table: reduced on the left
  await position(page, "Sitting, legs dangling");
  await pick(page, "reflex_hammer");
  await camera(page, "ankle_left");
  await tap(page, "achilles_left");
  await expect(page.locator('[data-testid="findings"] li').first()).toContainText("Left Achilles reflex reduced (1+)");

  // light touch on the lateral border of the foot (S1), lying flat: duller on the left
  await position(page, "Supine (flat)");
  await pick(page, "cotton_swab");
  await expect(page.locator('[data-testid="tool-in-hand"]')).toContainText("Cotton swab");
  await camera(page, "feet");
  await tap(page, "foot_lateral_left");
  await expect(page.locator('[data-testid="findings"] li').first()).toContainText("duller than on the right");
  await page.getByRole("button", { name: "Put down" }).click();

  // straight leg raise from the keyboard Examine… menu
  await examine(page, "hip_left", "straight_leg_raise");
  await expect(page.locator('[data-testid="findings"] li').first()).toContainText("Positive at about 40°");
  // no alerts: introduced, asked permission, legs hanging for the ankle jerk
  await expect(page.getByTestId("mistake-alert")).toHaveCount(0);

  await camera(page, "overview");
  await page.getByRole("button", { name: "Leave the room" }).click();
  await page.getByRole("dialog", { name: "Leave the room?" }).getByRole("button", { name: "Leave" }).click();
  await page.getByRole("status").filter({ hasText: "Before you leave" }).getByRole("button", { name: "Leave anyway" }).click();
  await expect(page.getByRole("heading", { name: "Post-encounter note" })).toBeVisible();
  await page.getByLabel("History").fill("44-year-old woman with 3 weeks of low back pain after lifting, now shooting down the back of the left leg to the outer foot. No bladder or bowel problems.");
  await page.getByLabel("Physical examination").fill("Left Achilles reflex reduced (1+).\nReduced light touch on the lateral border of the left foot.\nLeft straight leg raise positive at 40 degrees.");
  await page.getByLabel("Diagnosis 1").fill("Left S1 radiculopathy from an L5-S1 disc herniation");
  await page.getByLabel("Supporting findings 1").fill("reduced left ankle reflex, positive straight leg raise, reduced sensation on the lateral foot");
  await page.getByLabel("Diagnosis 2").fill("Lumbar muscle strain");
  await page.getByRole("button", { name: "Submit note" }).click();

  await expect(page).toHaveURL(/\/results\//);
  await expect(page.locator('[data-testid="summary"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-item="pen-dx-s1-radiculopathy"]')).toContainText("2/2");
  // the second diagnosis lists no supporting findings: half credit for the justification
  await expect(page.locator('[data-item="pen-justification"]')).toContainText("1/2");
  await expect(page.locator('[data-item="pen-justification"]')).toContainText("1 of 2 diagnoses cite findings elicited in the encounter");
  await expect(page.locator('[data-testid="pen-review"] [data-claim="flagged"]')).toHaveCount(0);
  expect(offHost, "no request left the host").toEqual([]);
});
