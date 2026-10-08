/**
 * Bug 9 regression (Phase 4 M2): the BP cuff recorded nothing. Now a blood pressure is taken as a
 * sequence on the upper arm — wrap the cuff (a cuff on the forearm is logged and does not wrap),
 * support the arm, feel the brachial pulse, listen over it, inflate on the aneroid gauge, release
 * slowly and record the reading — and the case's blood pressure appears in Findings.
 */
import { request as pwRequest, type APIRequestContext, type Page } from "@playwright/test";
import type { Action } from "@/domain/schemas";
import { expect, test, waitSettled } from "../qa/fixtures";
import { enterCode } from "../qa/openers";

async function coachApi(baseURL: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL });
  expect((await ctx.post("/api/gate", { data: { code: "coach-e2e" } })).ok()).toBe(true);
  return ctx;
}
async function qaLog(api: APIRequestContext, sessionId: string): Promise<Action[]> {
  const res = await api.get(`/api/coach/sessions/${sessionId}/log`);
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { actions: Action[] }).actions;
}
async function pick(page: Page, tool: string) {
  await page.getByRole("button", { name: "Tools…" }).click();
  await page.locator(`[role=menuitem][data-tool="${tool}"]`).click();
  await waitSettled(page);
}
/** page point of a region's anchor (3 mm under the skin) or of a sequence landmark on it */
async function target(page: Page, regionId: string, landmark?: string) {
  const p = await page.evaluate(
    ([r, l]) => {
      const h = window.__osce3d!;
      if (l) return h.project(r!, l);
      const w = h.anchor(r!);
      const n = h.anchorNormal(r!) ?? [0, 0, 0];
      return w ? h.projectPoint([w[0] - n[0] * 0.003, w[1] - n[1] * 0.003, w[2] - n[2] * 0.003]) : null;
    },
    [regionId, landmark ?? null] as const,
  );
  expect(p, `${regionId}${landmark ? ` ${landmark}` : ""} on screen`).not.toBeNull();
  return p!;
}
async function click(page: Page, p: { x: number; y: number }) {
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(250);
}

test("bug 9: a blood pressure is taken on the upper arm and the case's BP is recorded", async ({ page, baseURL }) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await enterCode(page, "student-e2e");
  await page.getByLabel("Your name or alias").fill("Bug 9");
  await page.getByLabel(/Practice \(untimed\)/).check();
  await page.locator('[data-case="hf-decompensated-01"]').click();
  await expect(page).toHaveURL(/\/station\//);
  const sessionId = new URL(page.url()).pathname.split("/").pop()!;
  await page.goto(`${page.url()}?qa=fast`);
  await page.waitForFunction(() => window.__osce3d?.ready, null, { timeout: 60_000 });
  await page.getByRole("button", { name: "Knock and enter" }).click();
  await waitSettled(page);
  await page.getByRole("button", { name: "Actions ▾" }).click();
  await page.getByRole("menuitem", { name: "Position: Seated upright" }).click();
  await waitSettled(page);
  await page.getByLabel("Camera shot").selectOption("arms");
  await waitSettled(page);
  const api = await coachApi(baseURL!);

  // a cuff on the forearm is logged and does not wrap
  await pick(page, "bp_cuff");
  await click(page, await target(page, "wrist_right"));
  await expect(page.getByTestId("bp-panel")).toHaveCount(0);
  let log = await qaLog(api, sessionId);
  expect(log.some((a) => a.type === "tool_contact" && a.payload.tool === "bp_cuff" && a.payload.outcome !== "finding")).toBe(true);

  // on the upper arm it wraps (and logs the cuff placement)
  await click(page, await target(page, "upper_arm_right"));
  await expect(page.getByTestId("bp-panel")).toBeVisible();
  await page.getByTestId("bp-support").click();
  await waitSettled(page);

  // feel the brachial pulse, then listen over it
  await pick(page, "hands");
  await click(page, await target(page, "upper_arm_right", "brachial"));
  await expect(page.getByTestId("bp-pulse")).toHaveText(/felt/);
  await pick(page, "stethoscope");
  await click(page, await target(page, "upper_arm_right", "brachial"));

  // inflate ~30 mmHg above systolic (the pulse disappears), then release slowly to below diastolic
  const pressure = async () => Number(((await page.getByTestId("bp-pressure").textContent()) ?? "0").replace(/[^0-9]/g, ""));
  await page.getByTestId("bp-valve-closed").click();
  for (let i = 0; i < 30 && (await pressure()) < 180; i++) await page.getByTestId("bp-squeeze").click();
  expect(await pressure()).toBeGreaterThanOrEqual(176);
  await expect(page.getByTestId("bp-pulse")).toHaveText(/gone/);
  await page.getByTestId("bp-valve-slow").click();
  await expect.poll(pressure, { timeout: 60_000 }).toBeLessThan(80);
  await page.getByTestId("bp-valve-open").click();

  await page.getByLabel("Systolic (mmHg)").fill("148");
  await page.getByLabel("Diastolic (mmHg)").fill("92");
  await page.getByTestId("bp-record").click();
  await waitSettled(page);

  // the reading is posted after the click: wait for it in the log
  await expect.poll(async () => (log = await qaLog(api, sessionId)).some((a) => a.type === "examine" && a.payload.maneuverId === "blood_pressure"), { timeout: 10_000 }).toBe(true);
  const examined = (id: string) => log.filter((a) => a.type === "examine" && a.payload.maneuverId === id && a.payload.regionId === "upper_arm_right");
  expect(examined("bp_cuff_placement")).toHaveLength(1);
  expect(examined("bp_arm_support")).toHaveLength(1);
  const bp = examined("blood_pressure").at(-1);
  expect(bp, "the blood pressure is recorded").toBeDefined();
  expect(bp!.type === "examine" && bp!.result?.findingText).toBe("Blood pressure 148/92 mmHg.");
  const reading = bp!.type === "examine" ? bp!.payload.bpReading : undefined;
  expect(reading).toMatchObject({ systolic: 148, diastolic: 92, inflatedEnough: true, tooFast: false });
  await expect(page.locator('[data-testid="findings"] > li').first()).toContainText("148/92");
});
