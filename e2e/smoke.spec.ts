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

/** Press and hold a tool on a region (or a named landmark) of the 3D patient via the real canvas. */
async function holdTool(page: Page, region: string, ms: number, landmark?: string) {
  await page.locator('[data-testid="exam3d"]').scrollIntoViewIfNeeded();
  const p = await page.evaluate(([r, l]) => window.__osce3d!.project(r!, l), [region, landmark] as const);
  await page.mouse.move(p!.x, p!.y);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

/** Outside the room: the door sign, then knock and enter. */
async function knockAndEnter(page: Page) {
  await expect(page.locator('[data-testid="room-door"]')).toContainText("Door sign");
  await page.getByRole("button", { name: "Knock and enter" }).click();
  await expect(page.locator('[data-testid="room-door"]')).toHaveCount(0);
}

async function camera(page: Page, preset: string) {
  await page.getByRole("tab", { name: preset }).click();
  await page.waitForTimeout(1500); // tween
}

/** Examine via the keyboard-operable "Examine…" command menu (region → maneuver). */
async function examine(page: Page, region: string, maneuver: string) {
  await page.getByRole("button", { name: /^Examine…/ }).click();
  await page.getByRole("dialog", { name: "Examine" }).locator(`[data-region="${region}"]`).click();
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
  await page.getByLabel(/Practice \(untimed\)/).check();
  await page.locator('[data-case="hf-decompensated-01"]').click();
  await expect(page).toHaveURL(/\/station\//);
  await expect(page.locator('[data-testid="mode-badge"]')).toHaveText("Practice");
  await expect(page.getByText("Educational prototype. Synthetic cases. Not for clinical use.")).toBeVisible();

  // --- room entry: door sign, knock, then sanitise at the dispenser in the 3D scene (press and hold ~3 s)
  await expect(page.locator("#chat-input")).toHaveCount(0); // nothing to do outside the room but read the sign
  await knockAndEnter(page);
  await page.waitForFunction(() => window.__osce3d?.ready, null, { timeout: 60_000 });
  await expect(page.locator('[data-testid="hands-status"]')).toHaveText("Hands: not cleaned");
  await camera(page, "Sink");
  await page.locator('[data-testid="exam3d"]').scrollIntoViewIfNeeded();
  const dispenser = await page.evaluate(() => window.__osce3d!.projectObject("dispenser"));
  await page.mouse.move(dispenser.x, dispenser.y);
  await page.mouse.down();
  await page.waitForTimeout(3_400);
  await page.mouse.up();
  await expect(page.locator('[data-testid="hands-status"]')).toHaveText("Hands: clean");

  // --- history (first question by voice: hold to talk, edit-able draft, then send); courtesy comes from what is said
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

  // --- CV + pulmonary exam, entirely in the 3D view; positioning by asking the patient
  await ask(page, "Could you lie back for me, please?");
  await expect(page.locator('[data-testid="position-label"]')).toHaveText("Reclined to 30°");
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
  await ask(page, "Could you roll onto your left side?");
  await expect(page.locator('[data-testid="position-label"]')).toHaveText("Left lateral decubitus");
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
  // the chest was uncovered automatically for the exam; cover it again (direct manipulation)
  await page.getByRole("button", { name: "Chest: uncovered" }).click();
  await expect(page.getByRole("button", { name: "Chest: covered" })).toHaveAttribute("aria-pressed", "true");
  // crackles at both posterior bases, sitting up (bed raised with the slider), diaphragm
  await page.getByLabel("Bed angle").fill("3");
  await expect(page.locator('[data-testid="position-label"]')).toHaveText("Seated upright");
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
  // the keyboard "Examine…" menu is the non-visual route (no 2D diagram any more)
  await expect(page.getByRole("radio", { name: "2D diagram" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.locator("body").press("e");
  await expect(page.getByRole("dialog", { name: "Examine" })).toBeVisible();
  await page.getByRole("dialog", { name: "Examine" }).getByRole("button", { name: "Close" }).click();

  // --- closing: goodbye, clean hands again (accessible hold button), leave → the presentation opens
  await ask(page, "Thank you for your time, take care.");
  const sanitiser = page.getByRole("button", { name: "Hold to sanitise hands" });
  await sanitiser.hover();
  await page.mouse.down();
  await page.waitForTimeout(3_400);
  await page.mouse.up();
  await expect(page.locator('[data-testid="action-log"]')).toContainText("Cleaned hands");
  await page.getByRole("button", { name: "Leave the room" }).click();
  await expect(page.getByRole("heading", { name: "Present your findings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Keep going" })).toHaveCount(0);
  await page.getByLabel("Summary statement").fill("68-year-old man with known HFrEF with 2 weeks of worsening dyspnoea, orthopnea, raised JVP, S3, crackles and edema.");
  await page.getByLabel("Differential 1").fill("Acute decompensated heart failure");
  await page.getByLabel("Differential 2").fill("Pneumonia");
  await page.getByLabel("Initial plan").fill("Oxygen, IV furosemide, ECG, troponin, BNP and chest x-ray.");
  await page.getByRole("button", { name: "Submit" }).click();

  // --- scored feedback with verified, quoted evidence
  await expect(page).toHaveURL(/\/results\//);
  await expect(page.locator('[data-testid="summary"]')).toBeVisible({ timeout: 30_000 });
  const greet = page.locator('[data-item="greet-by-name"]');
  await expect(greet).toContainText("1/1");
  await expect(greet.locator('span[title="Quote verified in transcript"]')).toContainText("Mr.");
  // courtesy items decided by tags on what was said, and by hygiene / drape / room state
  const intro = page.locator('[data-item="introduce-self-role"]');
  await expect(intro).toContainText("1/1");
  await expect(intro).toContainText("my name is Sam Patel");
  for (const id of ["fcm-01-hand-hygiene", "fcm-03-drape", "courtesy-introduce", "courtesy-consent", "courtesy-exit-hygiene", "courtesy-closing"]) {
    await expect(page.locator(`[data-item="${id}"]`)).toContainText("1/1");
  }
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
  await expect(page.locator('[data-testid="coach-mode"]')).toHaveText("Practice");
  // courtesy tags with the words that earned them, and the encounter events
  await expect(page.locator('[data-testid="courtesy-tag"]').filter({ hasText: "Introduced name" })).toContainText("my name is Sam Patel");
  await expect(page.locator('[data-testid="courtesy-tag"]').filter({ hasText: "Asked consent" })).toContainText("Is it okay if I examine");
  await expect(page.locator('[data-testid="courtesy-tag"]').filter({ hasText: "Asked to change position" }).first()).toContainText("lie back");
  await expect(page.locator('[data-testid="timeline"]')).toContainText("Knocked");
  await expect(page.locator('[data-testid="timeline"]')).toContainText("(asked verbally)");
  await expect(page.locator('[data-testid="timeline"]')).toContainText("Left the room");

  const pulse = page.locator('[data-item="fcm-05-pulse"]');
  await expect(pulse).toContainText("0/1");
  await pulse.getByRole("button", { name: "Override score" }).click();
  await pulse.getByLabel(/Points/).fill("1");
  await pulse.getByLabel("Reason").fill("Pulse counted from the monitor");
  await pulse.getByLabel("Your name").fill("Dr Coach");
  await pulse.getByRole("button", { name: "Save" }).click();
  await expect(pulse).toContainText("1/1");
  await expect(pulse).toContainText("Coach override");
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
  await page.getByLabel(/Practice \(untimed\)/).check();
  await page.locator('[data-case="screening-normal"]').click();
  await knockAndEnter(page);
  await page.waitForFunction(() => window.__osce3d?.ready, null, { timeout: 60_000 });
  // practice help: hint, progress check, technique demo
  await page.getByRole("button", { name: "Hint" }).click();
  await expect(page.locator('[data-testid="practice-help"]')).toContainText("Consider: Cleans hands before first touching the patient");
  await page.getByRole("button", { name: "Check my progress" }).click();
  await expect(page.locator('[data-testid="practice-help"]')).toContainText("Clinical courtesy");
  await page.getByRole("button", { name: /^Examine…/ }).click();
  await page.getByRole("dialog", { name: "Examine" }).locator('[data-region="neck_thyroid"]').click();
  await page.locator('[data-show-me="thyroid_palpation"]').click();
  await expect(page.getByText("Demonstration only. Nothing was examined")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator('[data-testid="voice-status"]')).toContainText("Voice input isn't available in this browser");
  await expect(page.getByRole("button", { name: "Hold to talk" })).toBeDisabled();
  await page.locator('[data-tool="tuning_fork"]').click();
  // Weber at the vertex
  await page.getByRole("button", { name: "Strike fork" }).click();
  await camera(page, "Head & neck");
  await holdTool(page, "scalp", 80, "vertex");
  // touching the patient without hand hygiene is allowed but logged, with a practice nudge
  await expect(page.getByRole("status").filter({ hasText: "You haven't cleaned your hands yet" })).toBeVisible();
  await expect(page.locator('[data-testid="action-log"]')).toContainText("Nudge shown");
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

test("exam mode: countdown, auto-end at zero, forced presentation, exam-only scoring", async ({ page }) => {
  await page.goto("/");
  await enterCode(page, "student-e2e");
  await page.getByLabel("Your name or alias").fill("E2E Exam");
  await page.getByLabel(/Exam \(timed\)/).check();
  await page.locator('[data-case="hf-decompensated-01"]').click();
  await expect(page.locator('[data-testid="mode-badge"]')).toHaveText("Exam");
  await expect(page.getByRole("button", { name: "Hint" })).toHaveCount(0); // no help in exam mode
  await expect(page.getByRole("button", { name: "Pause" })).toHaveCount(0);
  await knockAndEnter(page);
  // keyboard-accessible fallback for the direct-manipulation controls
  await page.getByRole("button", { name: "Actions" }).click();
  await expect(page.getByRole("menuitem").first()).toBeFocused();
  await page.keyboard.press("Enter"); // "Clean hands (no hold)"
  await expect(page.locator('[data-testid="hands-status"]')).toHaveText("Hands: clean");
  await ask(page, "What brings you in today?");
  // the test server shortens the limit to 25 s; at zero the exam locks and the presentation opens
  await expect(page.getByRole("alert").filter({ hasText: "Time is up" })).toBeVisible({ timeout: 40_000 });
  await expect(page.locator("#chat-input")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Hold to sanitise hands" })).toBeDisabled();
  await expect(page.getByRole("heading", { name: /Time is up — Present your findings/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Keep going" })).toHaveCount(0);
  await page.getByLabel("Summary statement").fill("68-year-old man with worsening breathlessness.");
  await page.getByLabel("Differential 1").fill("Heart failure");
  await page.getByLabel("Initial plan").fill("Diuretics.");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.locator('[data-testid="summary"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-testid="mode-badge"]')).toHaveText("Exam");
  await expect(page.locator('[data-item="within-time"]')).toContainText("0/1");
  await expect(page.locator('[data-testid="timeline"]')).toContainText("Time up — station ended");
});

test("initial download stays within the 15 MB budget (JS + models)", () => {
  const sum = (dir: string, ext: RegExp): number =>
    fs.readdirSync(dir).reduce((n, f) => {
      const p = path.join(dir, f);
      return n + (fs.statSync(p).isDirectory() ? sum(p, ext) : ext.test(f) ? fs.statSync(p).size : 0);
    }, 0);
  const js = sum(".next/static", /\.js$/);
  const models = sum("public/models", /\.glb$/);
  expect(js + models).toBeLessThan(15 * 1024 * 1024);
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
