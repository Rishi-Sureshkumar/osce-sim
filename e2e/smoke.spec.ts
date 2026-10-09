import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { consoleAllow, expect, test, waitSettled } from "./qa/fixtures";

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

/** Outside the room: the corridor and door; knock and enter with the accessible button. */
async function knockAndEnter(page: Page) {
  await page.waitForFunction(() => window.__osce3d?.ready, null, { timeout: 60_000 });
  await expect(page.locator('[data-testid="corridor"]')).toBeVisible();
  await page.getByRole("button", { name: "Knock and enter" }).click();
  await expect(page.locator('[data-testid="corridor"]')).toHaveCount(0, { timeout: 10_000 });
  await expect(page.locator('[data-testid="exam3d"]')).toHaveAttribute("data-camera", "overview");
  await waitSettled(page); // camera walks in
}

/** Move the camera to a shot with the keyboard-accessible shot menu, and wait for the tween. */
async function camera(page: Page, shot: string) {
  await page.getByLabel("Camera shot").selectOption(shot);
  await expect(page.locator('[data-testid="exam3d"]')).toHaveAttribute("data-camera", shot);
  await waitSettled(page);
}

/** Click a named object in the 3D scene (door, sanitiser-dispenser, stool, tool:stethoscope…) through the real canvas. */
async function clickObject(page: Page, name: string) {
  await page.locator('[data-testid="exam3d"]').scrollIntoViewIfNeeded();
  const p = await page.evaluate((n) => window.__osce3d!.projectObject(n), name);
  expect(p, name).not.toBeNull();
  await page.mouse.click(p!.x, p!.y);
}

/** Pick an instrument from the keyboard "Tools…" menu (the non-visual route to the tool table). */
async function pickTool(page: Page, dataTool: string) {
  await page.getByRole("button", { name: "Tools…" }).click();
  await page.locator(`[role=menuitem][data-tool="${dataTool}"]`).click();
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
  // the deliberate wrong access code below
  consoleAllow(page, /^response: 401: POST \/api\/gate$/);
  consoleAllow(page, /^console\.error: Failed to load resource: the server responded with a status of 401/);
  await page.addInitScript(FAKE_STT);
  // --- gate
  await page.goto("/");
  await expect(page).toHaveURL(/\/gate/);
  await enterCode(page, "wrong");
  await expect(page.getByText("That code isn't right.")).toBeVisible();
  await enterCode(page, "student-e2e");
  // the gate page shares the heading: wait until the gate has redirected (cookie set)
  await expect(page).not.toHaveURL(/\/gate/);
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

  // --- corridor: the door placard; practice begins by itself (no proctor), with the notepad to hand
  await expect(page.getByTestId("door-placard")).toContainText("Reason for visit: Shortness of breath");
  await expect(page.getByTestId("door-placard")).toContainText("Do not perform: Breast exam");
  await expect(page.getByTestId("begin")).toHaveCount(0);
  await expect(page.getByTestId("encounter-clock")).toHaveAttribute("data-phase", "encounter");
  await page.getByRole("button", { name: /Notepad/ }).click();
  await page.getByLabel("Notepad text").fill("SOB 2/52, orthopnea");
  // --- click the door in the 3D scene: knock, the door swings open, the camera walks in
  await page.waitForFunction(() => window.__osce3d?.ready, null, { timeout: 60_000 });
  await expect(page.locator('[data-testid="exam3d"]')).toHaveAttribute("data-camera", "corridor");
  await expect(page.locator("#chat-input")).toBeDisabled(); // nothing to do outside the room but read the door
  await page.waitForTimeout(1200);
  await clickObject(page, "door");
  await expect(page.locator('[data-testid="exam3d"]')).toHaveAttribute("data-camera", "overview", { timeout: 10_000 });
  await page.waitForTimeout(1400);
  await expect(page.locator('[data-testid="hands-status"]')).toHaveText("Hands: not cleaned");
  // --- the sanitiser on the left wall: first-person hand rub (~4 s), then hands are clean
  await clickObject(page, "sanitiser-dispenser");
  await expect(page.locator('[data-testid="exam3d"]')).toHaveAttribute("data-camera", "sink");
  await expect(page.locator('[data-testid="washing"]')).toContainText("Cleaning hands");
  await expect(page.locator('[data-testid="hands-status"]')).toHaveText("Hands: clean", { timeout: 8_000 });
  await page.getByRole("button", { name: "Back (Esc)" }).click();
  await expect(page.locator('[data-testid="exam3d"]')).toHaveAttribute("data-camera", "overview");
  await page.waitForTimeout(1400);
  // --- sit down on the stool (removes a barrier; logged)
  await clickObject(page, "stool");
  await expect(page.locator('[data-testid="exam3d"]')).toHaveAttribute("data-camera", "seated");
  await expect(page.locator('[data-testid="action-log"]')).toContainText("Sat down");

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
  // real clicks on the canvas, from the room: the first click on the chest moves the camera close, the second opens the menu
  await camera(page, "overview");
  await page.waitForTimeout(1500);
  let apex = await page.evaluate(() => window.__osce3d!.project("cardiac_mitral"));
  await page.mouse.click(apex!.x, apex!.y);
  await expect(page.locator('[data-testid="exam3d"]')).toHaveAttribute("data-camera", "chest_front");
  await expect(page.locator('[data-testid="breadcrumb"]')).toContainText("Room › Chest (front)");
  await page.waitForTimeout(1500);
  apex = await page.evaluate(() => window.__osce3d!.project("cardiac_mitral"));
  await page.mouse.click(apex!.x, apex!.y);
  await expect(page.getByRole("dialog", { name: "Mitral area / apex (L 5th ICS, MCL)" })).toBeVisible();
  await page.getByRole("dialog", { name: "Mitral area / apex (L 5th ICS, MCL)" }).getByRole("button", { name: "Close" }).click();
  // an exam the door instructions exclude (breast) is refused and logged
  const breast = await page.evaluate(() => window.__osce3d!.project("breast_right"));
  await page.mouse.click(breast!.x, breast!.y);
  await expect(page.getByRole("status").filter({ hasText: "not performed in this encounter" })).toBeVisible();
  await expect(page.locator('[data-testid="action-log"]')).toContainText("Attempted an exam not allowed in this encounter");
  // stethoscope: bell at the apex in left lateral decubitus, held for > 3 s
  await ask(page, "Could you roll onto your left side?");
  await expect(page.locator('[data-testid="position-label"]')).toHaveText("Left lateral decubitus");
  // pick up the stethoscope from the tool table: the camera tilts down, then returns to the patient
  await camera(page, "tool_table");
  await clickObject(page, "tool:stethoscope");
  await expect(page.locator('[data-testid="tool-in-hand"]')).toContainText("Stethoscope");
  await expect(page.locator('[data-testid="exam3d"]')).not.toHaveAttribute("data-camera", "tool_table");
  await page.getByRole("radio", { name: "Bell" }).click();
  await camera(page, "chest_front");
  // practice only: anatomical labels (no target markers) fade in briefly; the hint is logged
  await page.getByTestId("show-landmarks").click();
  await expect(page.getByTestId("landmark-label").first()).toBeVisible();
  await expect(page.locator('[data-testid="action-log"]')).toContainText("Showed landmarks: Chest (front)");
  await expect(page.getByTestId("landmark-label")).toHaveCount(0, { timeout: 5_000 });
  // no giveaway targets: 3.5 cm toward the head from the apex is "near" (2.5–5 cm) — muffled sound, no finding recorded
  const off = await page.evaluate(() => {
    const a = window.__osce3d!.anchor("cardiac_mitral")!;
    return window.__osce3d!.projectPoint([a[0], a[1], a[2] - 0.035]);
  });
  await page.mouse.move(off.x, off.y);
  await page.mouse.down();
  await expect(page.locator('[data-testid="sound-caption"]')).toContainText("Faint, distant sounds", { timeout: 3_000 });
  await page.waitForTimeout(3_300);
  await page.mouse.up();
  await expect(page.locator('[data-testid="findings"]')).not.toContainText("S3 gallop");
  await expect(page.locator('[data-testid="action-log"]')).not.toContainText(/stethoscope \(bell\)/);
  const pt = await page.evaluate(() => window.__osce3d!.project("cardiac_mitral"));
  await page.mouse.move(pt!.x, pt!.y);
  await page.mouse.down();
  await expect(page.locator('[data-testid="sound-caption"]')).toContainText("S3 (loud)", { timeout: 3_000 });
  await page.waitForTimeout(3_300);
  await page.mouse.up();
  await expect(page.locator('[data-testid="findings"]')).toContainText("Loud low-pitched S3 gallop");
  await expect(page.locator('[data-testid="action-log"]')).toContainText(/stethoscope \(bell\)/);
  // the left chest was uncovered automatically for the exam; cover it again (direct manipulation)
  // (only the left side: the apex is under the left chest section)
  await page.getByRole("button", { name: "Chest: left uncovered" }).click();
  await expect(page.getByRole("button", { name: "Chest: covered" })).toHaveAttribute("aria-pressed", "true");
  // crackles at both posterior bases, sitting up (bed raised with the slider), diaphragm
  await page.getByLabel("Bed angle").fill("3");
  await expect(page.locator('[data-testid="position-label"]')).toHaveText("Seated upright");
  await page.getByRole("radio", { name: "Diaphragm" }).click();
  await camera(page, "chest_back");
  await holdTool(page, "lung_post_rl", 3_400);
  await expect(page.locator('[data-testid="findings"]')).toContainText("fine end-inspiratory crackles just above");
  await holdTool(page, "lung_post_ll", 3_400);
  await expect(page.locator('[data-testid="sound-caption"]')).toContainText("fine crackles");
  // put the stethoscope down for the menu-driven exams
  await page.getByRole("button", { name: "Put down" }).click();
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
  // leaving: the door asks for confirmation (no re-entry)
  await camera(page, "overview");
  await page.getByRole("button", { name: "Leave the room" }).click();
  await expect(page.getByRole("dialog", { name: "Leave the room?" })).toContainText("No re-entry");
  await page.getByRole("dialog", { name: "Leave the room?" }).getByRole("button", { name: "Leave" }).click();
  // --- leaving ends the encounter: the post-encounter note (no plan in 1B); the notepad is kept
  await expect(page.getByRole("heading", { name: "Post-encounter note" })).toBeVisible();
  await expect(page.getByTestId("exam3d")).toHaveCount(0); // no re-entry
  await page.getByRole("button", { name: /Notepad/ }).click();
  await expect(page.getByLabel("Notepad text")).toHaveValue("SOB 2/52, orthopnea");
  await expect(page.getByLabel(/Initial plan/)).toHaveCount(0);
  await page.getByLabel("History").fill("68-year-old man with known HFrEF: 2 weeks of worsening dyspnoea, orthopnea (three pillows). No chest pain.");
  // deliberately reports a hepatojugular reflux that was never examined: it must be flagged
  await page.getByLabel("Physical examination").fill("JVP raised at 30 degrees.\nS3 at the apex in left lateral decubitus.\nFine crackles at both bases.\nPitting edema of the shins.\nPositive hepatojugular reflux.");
  await page.getByLabel("Diagnosis 1").fill("Acute decompensated heart failure");
  await page.getByLabel("Supporting findings 1").fill("orthopnea, raised JVP, S3, crackles, edema");
  await page.getByLabel("Diagnosis 2").fill("Pneumonia");
  await expect(page.getByTestId("pen-saved")).toContainText("Draft saved", { timeout: 8_000 });
  await page.getByRole("button", { name: "Submit note" }).click();

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
  // two 1B domains, each with its pass mark; communication credits the checklist's author
  await expect(page.locator('[data-domain="patient_encounter"]')).toContainText("Patient Encounter Skills");
  await expect(page.locator('[data-domain="patient_encounter"]')).toContainText("pass mark 70%");
  await expect(page.locator('[data-domain="communication"]')).toContainText("Communication Skills");
  await expect(page.locator('[data-domain="communication"]')).toContainText("Courtesy of Rebecca Kowalski");
  await expect(page.getByTestId("domain-result")).toHaveCount(2);
  await expect(page.getByTestId("station-verdict")).toBeVisible();
  // the note: every exam claim linked to the log, except the unperformed one
  await expect(page.locator('[data-testid="pen-review"] [data-claim="flagged"]')).toHaveText(/Positive hepatojugular reflux\.\s*Not performed in the encounter/);
  await expect(page.locator('[data-testid="pen-review"] [data-claim="linked"]')).toHaveCount(4);
  const consistency = page.locator('[data-item="pen-no-unperformed"]');
  await expect(consistency).toContainText("1/2");
  await expect(consistency).toContainText("Positive hepatojugular reflux.");
  await expect(page.locator('[data-item="pen-dx-adhf"]')).toContainText("2/2");
  await expect(page.locator('[data-item="remove-barriers"]')).toContainText("1/1"); // sat on the stool
  for (const id of ["fcm-01-hand-hygiene", "fcm-03-drape", "courtesy-consent", "courtesy-exit-hygiene", "courtesy-closing"]) {
    await expect(page.locator(`[data-item="${id}"]`)).toContainText("1/1");
  }
  await expect(page.locator('[data-item="fcm-33-jvp-position"]')).toContainText("1/1");
  await expect(page.locator('[data-item="fcm-38-bell-lld"]')).toContainText("1/1");
  await expect(page.locator('[data-item="fcm-38-bell-technique"]')).toContainText("1/1");
  await expect(page.locator('[data-item="fcm-42-lung-technique"]')).toContainText("1/1");
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
  await expect(page.getByTestId("pen-in-timeline")).toContainText("S3 at the apex in left lateral decubitus");
  // every placement is logged for the coach with its nearest anchor and distance (never shown to the student)
  await expect(page.locator('[data-testid="timeline"]')).toContainText(/stethoscope \(bell\) placed near Mitral area[^·]*· \d\.\d cm \(tolerance 2\.5 cm\)[^·]*·[^·]*· near the target/);
  await expect(page.locator('[data-testid="say-source"]').first()).toHaveText("voice");
  await expect(page.locator('[data-testid="say-source"]').nth(1)).toHaveText("typed");
  // coaches see how each question was understood (never sent to the student)
  await expect(page.locator('[data-testid="utterance-match"]').filter({ hasText: "orthopnea" }).first()).toBeVisible();
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
  // verbal-only exam (masked patient): clicking the mouth in its close view (the face) asks for a description
  await camera(page, "face");
  const mouth = await page.evaluate(() => window.__osce3d!.project("mouth"));
  await page.mouse.click(mouth!.x, mouth!.y);
  await expect(page.getByRole("dialog", { name: /Mouth & throat: verbal exam/ })).toBeVisible();
  await page.getByLabel("Describe the exam").fill("I would use a penlight and tongue depressor to inspect the tongue, tonsils and posterior pharynx for redness, exudate or ulcers.");
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.locator('[data-testid="action-log"]')).toContainText("Described exam of Mouth & throat");
  await pickTool(page, "tuning_fork");
  await expect(page.locator('[data-testid="tool-in-hand"]')).toContainText("Tuning fork 512 Hz");
  // Weber at the vertex
  await page.getByRole("button", { name: "Strike fork" }).click();
  await camera(page, "head_top");
  await holdTool(page, "scalp", 80, "vertex");
  // touching the patient without hand hygiene is allowed but logged, with a practice nudge
  await expect(page.getByRole("status").filter({ hasText: "You haven't cleaned your hands yet" })).toBeVisible();
  await expect(page.locator('[data-testid="action-log"]')).toContainText("Nudge shown");
  await expect(page.locator('[data-testid="sound-caption"]')).toContainText("heard equally in both ears");
  await expect(page.locator('[data-testid="findings"]')).toContainText("no lateralization");
  // Rinne: mastoid → patient signals → beside the ear canal
  await camera(page, "ear_left");
  await page.getByRole("button", { name: "Strike fork" }).click();
  await holdTool(page, "ear_left", 80, "mastoid");
  await expect(page.locator('[data-testid="findings"] li').first()).toContainText("Step done: Base of the fork on the mastoid");
  await page.getByRole("button", { name: /Patient signals/ }).click({ timeout: 10_000 });
  await holdTool(page, "ear_left", 80, "ear_canal");
  await expect(page.locator('[data-testid="sequence"]')).toContainText("Sequence complete");
  await expect(page.locator('[data-testid="sequence"]')).not.toContainText("out of order");
  await expect(page.locator('[data-testid="findings"] li').first()).toContainText("Air conduction greater than bone conduction");
});

test("exam mode: door placard, You may begin, 15-minute encounter ends itself, the note locks at time-up", async ({ page }) => {
  await page.goto("/");
  await enterCode(page, "student-e2e");
  await page.getByLabel("Your name or alias").fill("E2E Exam");
  await page.getByLabel(/Exam \(timed\)/).check();
  await page.locator('[data-case="hf-decompensated-01"]').click();
  await expect(page.locator('[data-testid="mode-badge"]')).toHaveText("Exam");
  await expect(page.getByRole("button", { name: "Hint" })).toHaveCount(0); // no help in exam mode
  await expect(page.getByRole("button", { name: "Pause" })).toHaveCount(0);
  // corridor: the door stays shut until "You may begin"
  await page.waitForFunction(() => window.__osce3d?.ready, null, { timeout: 60_000 });
  await expect(page.getByTestId("encounter-clock")).toHaveAttribute("data-phase", "corridor");
  await expect(page.getByRole("button", { name: "Knock and enter" })).toBeDisabled();
  await page.getByTestId("begin").click();
  await expect(page.getByTestId("begin-banner")).toHaveText("You may begin.");
  await expect(page.getByTestId("encounter-clock")).toHaveAttribute("data-phase", "encounter");
  await knockAndEnter(page);
  // keyboard-accessible fallback for the direct-manipulation controls
  await page.getByRole("button", { name: "Actions" }).click();
  await expect(page.getByRole("menuitem").first()).toBeFocused();
  await page.keyboard.press("Enter"); // "Clean hands (no hold)"
  await expect(page.locator('[data-testid="hands-status"]')).toHaveText("Hands: clean");
  await ask(page, "What brings you in today?");
  // the test server shortens the encounter to 25 s (warning when 5 minutes remain); at zero the note opens
  await expect(page.getByRole("heading", { name: "Post-encounter note" })).toBeVisible({ timeout: 40_000 });
  await expect(page.getByTestId("pen-form")).toContainText("Encounter time is up");
  await expect(page.getByTestId("exam3d")).toHaveCount(0);
  await page.getByLabel("History").fill("68-year-old man with worsening breathlessness.");
  await page.getByLabel("Diagnosis 1").fill("Heart failure");
  await expect(page.getByTestId("pen-saved")).toContainText("Draft saved", { timeout: 8_000 });
  // the note (20 s here) locks at time-up and is submitted as it stands
  await expect(page.locator('[data-testid="summary"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-testid="mode-badge"]')).toHaveText("Exam");
  await expect(page.locator('[data-item="within-time"]')).toContainText("0/1");
  for (const t of ["“You may begin”", "5 minutes remaining in the encounter", "Encounter time is up", "Note time is up — note locked", "(locked at time-up): Heart failure"]) {
    await expect(page.locator('[data-testid="timeline"]')).toContainText(t);
  }
});

test("download budget: station first load ≤ 15 MB, all JS ≤ 15 MB, language libraries lazy", () => {
  const MB = 1024 * 1024;
  const sum = (dir: string, ext: RegExp): number =>
    fs.readdirSync(dir).reduce((n, f) => {
      const p = path.join(dir, f);
      return n + (fs.statSync(p).isDirectory() ? sum(p, ext) : ext.test(f) ? fs.statSync(p).size : 0);
    }, 0);
  const models = sum("public/models", /\.glb$/);
  // (a) what the station page loads up front: its JS chunks plus the patient models
  const manifest = JSON.parse(fs.readFileSync(".next/app-build-manifest.json", "utf8")) as { pages: Record<string, string[]> };
  const stationFiles = manifest.pages["/station/[id]/page"]!.filter((f) => f.endsWith(".js"));
  const stationJs = stationFiles.reduce((n, f) => n + fs.statSync(path.join(".next", f)).size, 0);
  expect(stationJs + models).toBeLessThan(15 * MB);
  // (b) every JS chunk, lazy ones included
  expect(sum(".next/static", /\.js$/)).toBeLessThan(15 * MB);
  // (c) the embedding runtime and WebLLM are separate chunks, fetched only when used (the model files
  //     under /lang/ are covered by e2e/lang-browser.spec.ts)
  const firstLoad = stationFiles.map((f) => fs.readFileSync(path.join(".next", f), "utf8")).join("\n");
  expect(firstLoad).not.toContain("prebuiltAppConfig"); // inside @mlc-ai/web-llm
  expect(firstLoad).not.toContain("InferenceSession"); // inside onnxruntime-web
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
  // the matcher's data stays on the server: case facts, paraphrase banks and phrase vectors
  expect(bundle).not.toContain("I’ve been sleeping on three pillows");
  expect(bundle).not.toMatch(/"model":"Xenova\/all-MiniLM-L6-v2:q8","normalizer"/);
  // a distinctive framework sentence (copyright) must not ship
  expect(bundle).not.toContain("Wash your hands in view of the Pt");
});
