import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

test.beforeAll(() => fs.rmSync("test-results/e2e-store.json", { force: true }));

async function enterCode(page: Page, code: string) {
  await page.getByLabel("Access code").fill(code);
  await page.getByRole("button", { name: "Continue" }).click();
}

async function ask(page: Page, text: string) {
  const before = await page.locator('[data-testid="chat-log"] > div').count();
  await page.locator("#chat-input").fill(text);
  await page.locator("#chat-input").press("Enter");
  // wait for the student bubble + the completed (no longer streaming) patient reply
  await expect(page.locator('[data-testid="chat-log"] > div')).toHaveCount(before + 2);
  await expect(page.locator("[data-streaming]")).toHaveCount(0);
  await expect(page.locator("#chat-input")).toBeEnabled();
  await expect(page.getByRole("button", { name: "Send" })).toBeDisabled(); // empty input, not streaming
}

async function examine(page: Page, view: string, region: string, maneuver: string) {
  await page.getByRole("tab", { name: view }).click();
  await page.locator(`[data-region="${region}"]`).click();
  await page.locator(`[data-maneuver="${maneuver}"]`).click();
  await expect(page.locator('[data-testid="perform-finding"] .font-medium')).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
}

test("student completes the HF case end to end; coach reviews and overrides", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    // expected 401s from the deliberate wrong-code / forbidden checks are network noise, not app errors
    if (m.type() === "error" && !/status of 40[13]/.test(m.text())) consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  // --- gate
  await page.goto("/");
  await expect(page).toHaveURL(/\/gate/);
  await enterCode(page, "wrong");
  await expect(page.getByText("That code isn't right.")).toBeVisible();
  await enterCode(page, "student-e2e");
  await expect(page.getByRole("heading", { name: "OSCE Simulator" })).toBeVisible();

  // students can't reach coach pages
  const coachApi = await page.request.post("/api/coach/sessions/x/regrade");
  expect(coachApi.status()).toBe(403);

  // --- start the HF encounter
  await page.getByLabel("Your name or alias").fill("E2E Student");
  await page.locator('[data-case="hf-decompensated-01"]').click();
  await expect(page).toHaveURL(/\/station\//);
  await expect(page.getByText("Educational prototype. Synthetic cases. Not for clinical use.")).toBeVisible();

  // --- courtesy + history
  await page.getByRole("button", { name: "Wash hands" }).click();
  await ask(page, "Hello Mr. Bennett, my name is Sam Patel and I'm a medical student. What brings you in today?");
  await expect(page.locator('[data-testid="chat-log"]')).toContainText("catch my breath");
  await ask(page, "Do you get short of breath when you lie flat at night?");
  await expect(page.locator('[data-testid="chat-log"]')).toContainText("three pillows");
  await ask(page, "Any chest pain?");
  await ask(page, "Is it okay if I examine you now?");

  // --- CV + pulmonary exam
  await page.getByLabel("Patient position").selectOption("reclined_30");
  await examine(page, "Head & neck", "neck_jvp_right", "jvp_inspection");
  await expect(page.locator('[data-testid="findings"]')).toContainText("JVP clearly elevated");
  await page.getByLabel("Patient position").selectOption("left_lateral_decubitus");
  await examine(page, "Precordium", "cardiac_mitral", "auscultate_heart_bell");
  await expect(page.locator('[data-testid="findings"]')).toContainText("S3 gallop");
  await page.getByLabel("Patient position").selectOption("seated");
  await examine(page, "Back", "lung_post_rl", "auscultate_lungs");
  await examine(page, "Back", "lung_post_ll", "auscultate_lungs");
  await examine(page, "Front", "shin_right", "edema_assessment");
  await expect(page.locator('[data-testid="findings"]')).toContainText("pitting edema");

  // --- present
  await page.getByRole("button", { name: "Finish & present" }).click();
  await page.getByLabel("Summary statement").fill("68-year-old man with known HFrEF with 2 weeks of worsening dyspnoea, orthopnea, raised JVP, S3, crackles and edema.");
  await page.getByLabel("Differential 1").fill("Acute decompensated heart failure");
  await page.getByLabel("Differential 2").fill("Pneumonia");
  await page.getByLabel("Initial plan").fill("Oxygen, IV furosemide, ECG, troponin, BNP and chest x-ray.");
  await page.getByRole("button", { name: "Submit" }).click();

  // --- scored feedback with verified, quoted evidence
  await expect(page).toHaveURL(/\/results\//);
  await expect(page.locator('[data-testid="summary"]')).toBeVisible({ timeout: 30_000 });
  const intro = page.locator('[data-item="introduce-self-role"]');
  await expect(intro).toContainText("1/1");
  await expect(intro.locator('span[title="Quote verified in transcript"]')).toContainText("my name is");
  await expect(page.locator('[data-item="fcm-01-hand-hygiene"]')).toContainText("1/1");
  await expect(page.locator('[data-item="fcm-33-jvp-position"]')).toContainText("1/1");
  await expect(page.locator('[data-item="fcm-38-bell-lld"]')).toContainText("1/1");
  await expect(page.locator('[data-item="remove-barriers"]')).toContainText("Not assessable");
  await expect(page.locator('[data-testid="missed-findings"]')).toContainText("Hepatojugular");
  // evidence link jumps to the timeline
  await intro.locator("a").first().click();
  await expect(page).toHaveURL(/#a-act_/);
  // student feedback form
  await page.getByPlaceholder("What worked, what didn't, what was wrong?").fill("E2E feedback");
  await page.getByRole("button", { name: "Send feedback" }).click();
  await expect(page.getByText("your feedback was saved")).toBeVisible();
  const sessionUrl = page.url();
  const sessionId = sessionUrl.split("/results/")[1]!.split("#")[0]!;

  // --- coach: gate, timeline, override
  await page.goto("/coach");
  await expect(page).toHaveURL(/\/gate\?next=%2Fcoach&coach=1/);
  await enterCode(page, "coach-e2e");
  await expect(page.getByRole("heading", { name: /Coach view/ })).toBeVisible();
  await page.getByRole("link", { name: "E2E Student" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/coach/${sessionId}`));
  await expect(page.locator('[data-testid="timeline"]')).toContainText("Jugular venous pressure");
  await expect(page.locator('[data-testid="timeline"]')).toContainText("three pillows");
  await expect(page.locator('[data-testid="tokens"]')).toBeVisible();

  const drape = page.locator('[data-item="fcm-03-drape"]');
  await expect(drape).toContainText("0/1");
  await drape.getByRole("button", { name: "Override score" }).click();
  await drape.getByLabel(/Points/).fill("1");
  await drape.getByLabel("Reason").fill("Draped verbally; toolbar missed it");
  await drape.getByLabel("Your name").fill("Dr Coach");
  await drape.getByRole("button", { name: "Save" }).click();
  await expect(drape).toContainText("1/1");
  await expect(drape).toContainText("Coach override");
  await expect(page.locator('[data-testid="override-history"]')).toContainText("from 0 to 1");

  // timeline is strictly ordered by t
  const times = await page.locator('[data-testid="timeline"] li span.font-mono').allInnerTexts();
  expect([...times].sort()).toEqual(times);

  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});

test("no API key or framework text in client bundles", () => {
  const dir = ".next/static";
  const files: string[] = [];
  const walk = (d: string) => {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".js")) files.push(p);
    }
  };
  walk(dir);
  expect(files.length).toBeGreaterThan(0);
  const bundle = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");
  expect(bundle).not.toContain("ANTHROPIC_API_KEY");
  expect(bundle).not.toMatch(/sk-ant-[a-zA-Z0-9]/);
  expect(bundle).not.toContain("@anthropic-ai/sdk");
  // a distinctive framework sentence (copyright) must not ship
  expect(bundle).not.toContain("Wash your hands in view of the Pt");
});
