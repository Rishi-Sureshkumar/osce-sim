import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

test.beforeAll(() => fs.rmSync("test-results/e2e-store.json", { force: true }));

async function enterCode(page: Page, code: string) {
  await page.getByLabel("Access code").fill(code);
  await page.getByRole("button", { name: "Continue" }).click();
}

/**
 * Stand-in for the browser's speech recognizer (a real microphone can't be used headlessly).
 * It emits each scripted utterance as interim words, then a final result when stopped.
 */
const FAKE_STT = `
  window.__sttScript = [];
  class FakeRecognition {
    constructor() { this.onresult = null; this.onend = null; this.onerror = null; }
    start() {
      this.text = window.__sttScript.shift() || "";
      const words = this.text.split(" ");
      setTimeout(() => this.onresult && this.onresult({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: words.slice(0, 3).join(" ") } }] }), 50);
    }
    stop() {
      setTimeout(() => {
        this.onresult && this.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: this.text } }] });
        this.onend && this.onend();
      }, 30);
    }
  }
  window.SpeechRecognition = FakeRecognition;
  window.webkitSpeechRecognition = FakeRecognition;
`;

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

/** Examine via the 3D view's accessible region list (part of the 3D view). */
/** Press and hold a tool on a region (or a named landmark) of the 3D patient via the real canvas. */
async function holdTool(page: Page, region: string, ms: number, landmark?: string) {
  const p = await page.evaluate(([r, l]) => window.__osce3d!.project(r!, l), [region, landmark] as const);
  await page.mouse.move(p!.x, p!.y);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

async function camera(page: Page, preset: string) {
  await page.getByRole("tab", { name: preset }).click();
  await page.waitForTimeout(1500); // tween
}

async function examine(page: Page, region: string, maneuver: string) {
  const picker = page.locator("details", { hasText: "Choose a region from a list" });
  if (!(await picker.evaluate((d) => (d as HTMLDetailsElement).open))) await picker.locator("summary").click();
  await picker.locator(`[data-region="${region}"]`).click();
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
  await page.addInitScript(FAKE_STT);
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

  // --- courtesy + history (first question by voice: hold to talk, edit-able draft, then send)
  await page.getByRole("button", { name: "Wash hands" }).click();
  await page.evaluate(() => (window as unknown as { __sttScript: string[] }).__sttScript.push("Hello Mr. Bennett, my name is Sam Patel and I'm a medical student. What brings you in today?"));
  const mic = page.getByRole("button", { name: "Hold to talk" });
  await mic.hover();
  await page.mouse.down();
  await expect(page.locator('[data-testid="voice-status"]')).toContainText("Listening… Hello Mr. Bennett,");
  await page.mouse.up();
  await expect(page.locator("#chat-input")).toHaveValue(/What brings you in today\?$/);
  await page.locator("#chat-input").press("Enter");
  await expect(page.locator('[data-testid="chat-log"]')).toContainText("You (voice)");
  await expect(page.locator("[data-streaming]")).toHaveCount(0);
  await expect(page.locator('[data-testid="chat-log"]')).toContainText("catch my breath");
  await ask(page, "Do you get short of breath when you lie flat at night?");
  await expect(page.locator('[data-testid="chat-log"]')).toContainText("three pillows");
  await ask(page, "Any chest pain?");
  await ask(page, "Is it okay if I examine you now?");

  // --- CV + pulmonary exam, entirely in the 3D view
  await page.waitForFunction(() => window.__osce3d?.ready, null, { timeout: 60_000 });
  await page.getByLabel("Patient position").selectOption("reclined_30");
  await examine(page, "neck_jvp_right", "jvp_inspection");
  await expect(page.locator('[data-testid="findings"]')).toContainText("JVP clearly elevated");
  // one real click on the canvas: project the apex anchor to the screen and click it (goes through raycasting)
  await page.getByRole("tab", { name: "Chest (front)" }).click();
  await page.waitForTimeout(1500); // camera tween
  const apex = await page.evaluate(() => window.__osce3d!.project("cardiac_mitral"));
  await page.mouse.click(apex!.x, apex!.y);
  await expect(page.locator('section[aria-label="Examinations for Mitral area / apex (L 5th ICS, MCL)"]')).toBeVisible();
  await page.getByRole("button", { name: "Close menu" }).click();
  // stethoscope: bell at the apex in left lateral decubitus, held for > 3 s
  await page.getByLabel("Patient position").selectOption("left_lateral_decubitus");
  await page.locator('[data-tool="stethoscope"]').click();
  await page.getByRole("radio", { name: "Bell" }).click();
  await camera(page, "Chest (front)");
  const apexHold = page.evaluate(() => window.__osce3d!.project("cardiac_mitral"));
  const pt = await apexHold;
  await page.mouse.move(pt!.x, pt!.y);
  await page.mouse.down();
  await expect(page.locator('[data-testid="sound-caption"]')).toContainText("S3 (loud)", { timeout: 3_000 });
  await page.waitForTimeout(3_300);
  await page.mouse.up();
  await expect(page.locator('[data-testid="findings"]')).toContainText("Loud low-pitched S3 gallop");
  await expect(page.locator('[data-testid="action-log"]')).toContainText(/stethoscope \(bell\) · (on|edge of) target/);
  // crackles at both posterior bases, sitting up, diaphragm
  await page.getByLabel("Patient position").selectOption("seated");
  await page.getByRole("radio", { name: "Diaphragm" }).click();
  await camera(page, "Chest (back)");
  await holdTool(page, "lung_post_rl", 3_400);
  await expect(page.locator('[data-testid="findings"]')).toContainText("fine end-inspiratory crackles just above");
  await holdTool(page, "lung_post_ll", 3_400);
  await expect(page.locator('[data-testid="sound-caption"]')).toContainText("fine crackles");
  // back to the pointer for the menu-driven exams
  await page.getByRole("button", { name: "Pointer (menu)" }).click();
  await examine(page, "shin_right", "edema_assessment");
  await expect(page.locator('[data-testid="findings"]')).toContainText("pitting edema");
  // the drape was exposed automatically and logged
  await expect(page.locator('[data-testid="action-log"]')).toContainText("Exposed a region");
  // 2D fallback is still available
  await page.getByRole("radio", { name: "2D diagram" }).click();
  await expect(page.locator('[data-region="lung_ant_ru"]').first()).toBeVisible();
  await page.getByRole("radio", { name: "3D patient" }).click();

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
  await expect(page.locator('[data-item="fcm-38-bell-technique"]')).toContainText("1/1");
  await expect(page.locator('[data-item="fcm-42-lung-technique"]')).toContainText("1/1");
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
  await expect(page.locator('[data-testid="say-source"]').first()).toHaveText("voice");
  await expect(page.locator('[data-testid="say-source"]').nth(1)).toHaveText("typed");
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

test("tuning forks: Weber and the Rinne sequence on the screening patient", async ({ page }) => {
  // also: a browser without speech recognition (e.g. Firefox) falls back to typing with a notice
  await page.addInitScript("window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined;");
  await page.goto("/");
  await enterCode(page, "student-e2e");
  await page.locator('[data-case="screening-normal"]').click();
  await page.waitForFunction(() => window.__osce3d?.ready, null, { timeout: 60_000 });
  await expect(page.locator('[data-testid="voice-status"]')).toContainText("Voice input isn't available in this browser");
  await expect(page.getByRole("button", { name: "Hold to talk" })).toBeDisabled();
  await page.locator('[data-tool="tuning_fork"]').click();
  // Weber at the vertex
  await page.getByRole("button", { name: "Strike fork" }).click();
  await camera(page, "Head & neck");
  await holdTool(page, "scalp", 80, "vertex");
  await expect(page.locator('[data-testid="sound-caption"]')).toContainText("heard equally in both ears");
  await expect(page.locator('[data-testid="findings"]')).toContainText("no lateralization");
  // Rinne: mastoid → patient signals → beside the ear canal
  await camera(page, "Left side");
  await page.getByRole("button", { name: "Strike fork" }).click();
  await holdTool(page, "ear_left", 80, "mastoid");
  await expect(page.locator('[data-testid="findings"] li').first()).toContainText("Step done: Base of the fork on the mastoid");
  await page.getByRole("button", { name: /Patient signals/ }).click({ timeout: 10_000 });
  await holdTool(page, "ear_left", 80, "ear_canal");
  await expect(page.locator('[data-testid="sequence"]')).toContainText("Sequence complete");
  await expect(page.locator('[data-testid="sequence"]')).not.toContainText("out of order");
  await expect(page.locator('[data-testid="findings"] li').first()).toContainText("Air conduction greater than bone conduction");
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
