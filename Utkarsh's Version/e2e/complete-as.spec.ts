import type { Page } from "@playwright/test";
import { expect, test, waitSettled } from "./qa/fixtures";
import { enterCode } from "./qa/openers";

/**
 * Phase 4 M5: the aortic stenosis case end to end, with every off-host request blocked — the
 * ejection murmur at the right upper sternal border, the same murmur over the carotid, the slow
 * carotid upstroke, then a note that names aortic stenosis and is credited for it.
 */

async function ask(page: Page, text: string) {
  const before = await page.locator('[data-testid="chat-log"] > div').count();
  await page.locator("#chat-input").fill(text);
  await page.locator("#chat-input").press("Enter");
  await expect(page.locator('[data-testid="chat-log"] > div')).toHaveCount(before + 2);
  await expect(page.locator("[data-streaming]")).toHaveCount(0);
}

async function camera(page: Page, shot: string) {
  await page.getByLabel("Camera shot").selectOption(shot);
  await expect(page.locator('[data-testid="exam3d"]')).toHaveAttribute("data-camera", shot);
  await waitSettled(page);
}

/** press and hold the stethoscope on a region's hidden target (3 mm under the skin) */
async function listen(page: Page, regionId: string) {
  const p = await page.evaluate((r) => {
    const h = window.__osce3d!;
    const w = h.anchor(r);
    const n = h.anchorNormal(r) ?? [0, 0, 0];
    return w ? h.projectPoint([w[0] - n[0] * 0.003, w[1] - n[1] * 0.003, w[2] - n[2] * 0.003]) : null;
  }, regionId);
  expect(p, `${regionId} on screen`).not.toBeNull();
  await page.mouse.move(p!.x, p!.y);
  await page.mouse.down();
  await page.waitForTimeout(3_600);
  await page.mouse.up();
}

async function examine(page: Page, region: string, maneuver: string) {
  await page.getByRole("button", { name: /^Examine…/ }).click();
  await page.getByRole("dialog", { name: "Examine" }).locator(`[data-region="${region}"]`).click();
  await page.locator(`[data-maneuver="${maneuver}"]`).click();
  await expect(page.locator('[data-testid="perform-finding"] .font-medium')).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
}

test("aortic stenosis: ejection murmur at the RUSB and the carotid, slow upstroke, credited note (offline)", async ({ page }) => {
  test.setTimeout(240_000);
  const offHost: string[] = [];
  await page.route(/^https?:\/\/(?!localhost[:/]|127\.0\.0\.1[:/])/, (route) => {
    offHost.push(route.request().url());
    return route.abort();
  });

  await page.goto("/");
  await enterCode(page, "student-e2e");
  await page.getByLabel(/Practice \(untimed\)/).check();
  await page.locator('[data-case="aortic-stenosis-01"]').click();
  await expect(page).toHaveURL(/\/station\//);
  await expect(page.getByTestId("door-placard")).toContainText("Breathlessness on exertion and a near-faint");
  await page.goto(`${page.url()}?qa=fast`);
  await page.waitForFunction(() => window.__osce3d?.ready, null, { timeout: 60_000 });
  await page.getByRole("button", { name: "Knock and enter" }).click();
  await waitSettled(page);

  await ask(page, "Hello Mr Ashby, my name is Sam Patel and I'm a medical student. What brings you in today?");
  await expect(page.locator('[data-testid="chat-log"]')).toContainText("funny turn");
  await ask(page, "Did you actually lose consciousness?");
  await ask(page, "Is it okay if I examine your heart now?");

  // the murmur: diaphragm at the right upper sternal border, then over the right carotid
  await page.getByRole("button", { name: "Tools…" }).click();
  await page.locator('[role=menuitem][data-tool="stethoscope"]').click();
  await page.getByRole("radio", { name: "Diaphragm" }).click();
  await camera(page, "chest_front");
  await listen(page, "cardiac_aortic");
  await expect(page.locator('[data-testid="findings"] li').first()).toContainText("grade 3/6 crescendo–decrescendo");
  await camera(page, "head_neck");
  await listen(page, "carotid_right");
  await expect(page.locator('[data-testid="findings"] li').first()).toContainText("transmitted up the neck");
  await page.getByRole("button", { name: "Put down" }).click();
  // the carotid upstroke, from the keyboard Examine… menu (a reported finding: no sound)
  await examine(page, "carotid_right", "carotid_palpation");
  await expect(page.locator('[data-testid="findings"] li').first()).toContainText("slow to rise");
  await expect(page.getByTestId("mistake-alert")).toHaveCount(0);

  await camera(page, "overview");
  await page.getByRole("button", { name: "Leave the room" }).click();
  await page.getByRole("dialog", { name: "Leave the room?" }).getByRole("button", { name: "Leave" }).click();
  await page.getByRole("status").filter({ hasText: "Before you leave" }).getByRole("button", { name: "Leave anyway" }).click();
  await expect(page.getByRole("heading", { name: "Post-encounter note" })).toBeVisible();
  await page.getByLabel("History").fill("74-year-old man with 6 months of exertional breathlessness and a near-faint on the stairs last week, no loss of consciousness.");
  await page.getByLabel("Physical examination").fill("Grade 3/6 ejection systolic murmur at the right upper sternal border radiating to the carotids, soft S2.\nSlow-rising, low-volume carotid upstroke.");
  await page.getByLabel("Diagnosis 1").fill("Severe aortic stenosis");
  await page.getByLabel("Supporting findings 1").fill("ejection systolic murmur radiating to the carotids, slow-rising carotid pulse, exertional presyncope");
  await page.getByRole("button", { name: "Submit note" }).click();

  await expect(page).toHaveURL(/\/results\//);
  await expect(page.locator('[data-testid="summary"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-item="pen-dx-aortic-stenosis"]')).toContainText("2/2");
  await expect(page.locator('[data-item="pen-justification"]')).toContainText("2/2");
  await expect(page.locator('[data-testid="pen-review"] [data-claim="flagged"]')).toHaveCount(0);
  expect(offHost, "no request left the host").toEqual([]);
});
