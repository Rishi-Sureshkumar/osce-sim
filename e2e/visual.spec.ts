/**
 * npm run test:visual (Phase 4 M0.5): a screenshot tour for human review. Every camera shot in
 * every drawn position for both body models, drape states, every dialog, the note, results and
 * coach pages, and the station at three viewport sizes. PNGs go to qa/screens/ (git-ignored);
 * qa/screens/manifest.json (sha256 + metadata) and qa/REVIEW.md are committed, and
 * `npm run qa:review-check` makes sure every PNG has been reviewed at its current sha.
 * Runs with ?qa=fast,freeze so frames are stable.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { DIALOG_IDS } from "../src/components/ui/dialogIds";
import { POSITION_LABELS } from "@/components/common/format";
import type { Position } from "@/domain/schemas";
import { expect, test, waitSettled } from "./qa/fixtures";
import { OPENERS, enterCode } from "./qa/openers";

const ROOT = path.join(process.cwd(), "qa/screens");
const MANIFEST = path.join(ROOT, "manifest.json");
const VARIANTS = [
  { variant: "male", caseId: "hf-decompensated-01", slug: "hf-male" },
  { variant: "female", caseId: "screening-normal", slug: "screening-female" },
] as const;
const POSITIONS: Position[] = ["supine", "reclined_30", "reclined_45", "seated", "sitting_dangling", "left_lateral_decubitus"];
const PATIENT_SHOTS = ["overview", "seated", "head_neck", "ear_left", "ear_right", "chest_front", "chest_back", "abdomen", "arms", "hands", "legs", "feet"];
/** the close views of single regions (Phase 4 M2), each in the position its exams use */
const REGION_VIEWS: [string, Position][] = [
  ["face", "seated"],
  ["neck_back", "seated"],
  ["head_top", "seated"],
  ["arms_left", "seated"],
  ["elbow_right", "seated"],
  ["elbow_left", "seated"],
  ["chest_right", "seated"],
  ["chest_left", "seated"],
  ["ankle_right", "sitting_dangling"],
  ["ankle_left", "sitting_dangling"],
];

interface ManifestEntry {
  file: string;
  sha256: string;
  viewport: string;
  area: string;
  case?: string;
  shot?: string;
  position?: string;
  drape?: string;
  dialog?: string;
}

function recordShot(entry: ManifestEntry) {
  const list: ManifestEntry[] = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : [];
  const next = [...list.filter((e) => e.file !== entry.file), entry].sort((a, b) => a.file.localeCompare(b.file));
  fs.writeFileSync(MANIFEST, JSON.stringify(next, null, 1));
}

async function shoot(page: Page, rel: string, meta: Omit<ManifestEntry, "file" | "sha256" | "viewport">) {
  const vp = page.viewportSize()!;
  const viewport = `${vp.width}x${vp.height}`;
  const file = `${viewport}/${rel}.png`;
  const abs = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  // let the last frame land (no animation runs in freeze mode, but the canvas paints asynchronously)
  await page.waitForTimeout(250);
  // clocks, dates and the action log's times differ on every run: masked, so an unchanged screen keeps its sha
  // (and its review) from run to run
  const mask = [page.locator('[aria-label="Time elapsed"], [aria-label="Time remaining"], [data-testid="action-log"], [data-volatile], [data-testid="pen-saved"]')];
  await page.screenshot({ path: abs, animations: "disabled", caret: "hide", mask, maskColor: "#e2e8f0" });
  recordShot({ file, sha256: crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex"), viewport, ...meta });
}

async function startStation(page: Page, caseId: string, opts: { mode?: "practice" | "exam"; qa?: string } = {}) {
  await page.goto("/");
  // a second station in the same test is already past the gate
  if (/\/gate/.test(page.url())) await enterCode(page, "student-e2e");
  await expect(page).not.toHaveURL(/\/gate/);
  await page.getByLabel("Your name or alias").fill("Visual QA");
  if ((opts.mode ?? "practice") === "practice") await page.getByLabel(/Practice \(untimed\)/).check();
  else await page.getByLabel(/Exam \(timed\)/).check();
  await page.locator(`[data-case="${caseId}"]`).click();
  await expect(page).toHaveURL(/\/station\//);
  await page.goto(`${page.url()}?qa=${opts.qa ?? "fast,freeze"}`);
  await page.waitForFunction(() => window.__osce3d?.ready, null, { timeout: 60_000 });
  await waitSettled(page);
}

async function enter(page: Page) {
  await page.getByRole("button", { name: "Knock and enter" }).click();
  await expect(page.locator('[data-testid="exam3d"]')).toHaveAttribute("data-camera", "overview", { timeout: 10_000 });
  await waitSettled(page);
}

async function camera(page: Page, shot: string) {
  if ((await page.locator('[data-testid="exam3d"]').getAttribute("data-camera")) !== shot) {
    await page.getByLabel("Camera shot").selectOption(shot);
    await expect(page.locator('[data-testid="exam3d"]')).toHaveAttribute("data-camera", shot);
  }
  await waitSettled(page);
}

/** Returns false when the room can't show that position yet (no menu entry). */
async function setPosition(page: Page, p: Position): Promise<boolean> {
  const label = POSITION_LABELS[p];
  if ((await page.getByTestId("position-label").textContent())?.trim() === label) return true;
  await page.getByRole("button", { name: "Actions ▾" }).click();
  const item = page.getByRole("menuitem", { name: `Position: ${label}` });
  if (!(await item.count())) {
    await page.keyboard.press("Escape");
    return false;
  }
  await item.click();
  await expect(page.getByTestId("position-label")).toHaveText(label);
  await waitSettled(page);
  return true;
}

async function setDrape(page: Page, zone: "Chest" | "Abdomen" | "Legs", covered: boolean) {
  const btn = page.getByRole("button", { name: new RegExp(`^${zone}: (covered|uncovered)$`) });
  if ((await btn.getAttribute("aria-pressed")) !== String(covered)) await btn.click();
  await expect(btn).toHaveAttribute("aria-pressed", String(covered));
  await waitSettled(page);
}

test.describe.configure({ mode: "serial" });

for (const v of VARIANTS) {
  test(`tour: room, shots × positions, drapes — ${v.slug}`, async ({ page }) => {
    test.setTimeout(30 * 60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await startStation(page, v.caseId);
    await shoot(page, `${v.slug}/room/01-corridor`, { area: "room", case: v.caseId, shot: "corridor" });
    await enter(page);
    let n = 2;
    for (const shot of ["overview", "sink", "tool_table"]) {
      await camera(page, shot);
      await shoot(page, `${v.slug}/room/${String(n++).padStart(2, "0")}-${shot}`, { area: "room", case: v.caseId, shot });
    }
    let k = 1;
    for (const position of POSITIONS) {
      if (!(await setPosition(page, position))) {
        test.info().annotations.push({ type: "skipped-position", description: `${position}: not reachable in the room yet` });
        continue;
      }
      for (const shot of PATIENT_SHOTS) {
        await camera(page, shot);
        await shoot(page, `${v.slug}/shots/${String(k++).padStart(3, "0")}-${shot}__${position}__covered`, { area: "shots", case: v.caseId, shot, position, drape: "covered" });
      }
    }
    let r = 1;
    for (const [shot, position] of REGION_VIEWS) {
      if (!(await setPosition(page, position))) continue;
      await camera(page, shot);
      await shoot(page, `${v.slug}/views/${String(r++).padStart(2, "0")}-${shot}__${position}__covered`, { area: "views", case: v.caseId, shot, position, drape: "covered" });
    }
    // drape states (supine): each zone uncovered on its own, then everything uncovered
    await setPosition(page, "supine");
    let d = 1;
    for (const [zone, shot] of [["Chest", "chest_front"], ["Abdomen", "abdomen"], ["Legs", "legs"]] as const) {
      await setDrape(page, zone, false);
      await camera(page, shot);
      await shoot(page, `${v.slug}/drapes/${String(d++).padStart(2, "0")}-${shot}__supine__${zone.toLowerCase()}-exposed`, { area: "drapes", case: v.caseId, shot, position: "supine", drape: `${zone.toLowerCase()}-exposed` });
      await setDrape(page, zone, true);
    }
    for (const zone of ["Chest", "Abdomen", "Legs"] as const) await setDrape(page, zone, false);
    await camera(page, "overview");
    await shoot(page, `${v.slug}/drapes/${String(d++).padStart(2, "0")}-overview__supine__all-exposed`, { area: "drapes", case: v.caseId, shot: "overview", position: "supine", drape: "all-exposed" });
  });
}

test("tour: every dialog (screening patient)", async ({ page }) => {
  test.setTimeout(10 * 60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await startStation(page, "screening-normal");
  await enter(page);
  let n = 1;
  for (const id of DIALOG_IDS) {
    for (let i = 0; i < 3 && (await page.locator("[data-dialog]").count()); i++) await page.keyboard.press("Escape");
    if (await page.getByRole("button", { name: "Put down" }).isVisible()) await page.getByRole("button", { name: "Put down" }).click();
    await OPENERS[id](page);
    await expect(page.locator(`[data-dialog="${id}"]`)).toBeVisible();
    await shoot(page, `screening-female/dialogs/${String(n++).padStart(2, "0")}-${id}`, { area: "dialogs", case: "screening-normal", dialog: id });
    await page.keyboard.press("Escape");
  }
  // exam mode: the door placard in the corridor
  await startStation(page, "hf-decompensated-01", { mode: "exam" });
  await shoot(page, "hf-male/room/00-exam-corridor-placard", { area: "room", case: "hf-decompensated-01", shot: "corridor" });
});

test("tour: note, results and coach pages, at three sizes (HF case)", async ({ page, browser, baseURL }) => {
  test.setTimeout(10 * 60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await startStation(page, "hf-decompensated-01");
  await enter(page);
  for (const [w, h] of [[1280, 800], [1180, 820], [1440, 900]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await camera(page, "overview");
    await shoot(page, `hf-male/layout/01-station-inside`, { area: "layout", case: "hf-decompensated-01", shot: "overview" });
  }
  await page.locator("#chat-input").fill("Hello Mr. Bennett, I'm Sam, a medical student. What brings you in today?");
  await page.locator("#chat-input").press("Enter");
  await expect(page.locator("[data-streaming]")).toHaveCount(0, { timeout: 15_000 });
  await page.getByRole("button", { name: "Leave the room" }).click();
  await page.locator('[data-dialog="leave-confirm"]').getByRole("button", { name: "Leave" }).click();
  if (await page.getByTestId("leave-nudge").isVisible().catch(() => false)) await page.getByRole("button", { name: "Leave anyway" }).click();
  await expect(page.getByRole("heading", { name: "Post-encounter note" })).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("History").fill("68-year-old man with worsening breathlessness for two weeks.");
  await page.getByLabel("Physical examination").fill("JVP raised.");
  await page.getByLabel("Diagnosis 1").fill("Acute decompensated heart failure");
  await page.getByLabel("Supporting findings 1").fill("orthopnea, raised JVP");
  for (const [w, h] of [[1280, 800], [1180, 820], [1440, 900]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await shoot(page, `hf-male/layout/02-note`, { area: "layout", case: "hf-decompensated-01" });
  }
  await expect(page.getByTestId("pen-saved")).toContainText("Draft saved", { timeout: 8_000 });
  await page.getByRole("button", { name: "Submit note" }).click();
  await expect(page).toHaveURL(/\/results\//);
  await expect(page.locator('[data-testid="summary"]')).toBeVisible({ timeout: 30_000 });
  const sessionId = page.url().split("/results/")[1]!.split("#")[0]!;
  for (const [w, h] of [[1280, 800], [1180, 820], [1440, 900]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await shoot(page, `hf-male/layout/03-results`, { area: "layout", case: "hf-decompensated-01" });
  }
  const coachCtx = await browser.newContext({ baseURL });
  const coach = await coachCtx.newPage();
  await coach.goto("/coach");
  await enterCode(coach, "coach-e2e");
  await expect(coach.getByRole("heading", { name: /Coach view/ })).toBeVisible();
  for (const [w, h] of [[1280, 800], [1180, 820], [1440, 900]] as const) {
    await coach.setViewportSize({ width: w, height: h });
    await shoot(coach, `hf-male/layout/04-coach-list`, { area: "layout" });
  }
  await coach.goto(`/coach/${sessionId}`);
  await expect(coach.locator('[data-testid="timeline"]')).toBeVisible();
  for (const [w, h] of [[1280, 800], [1180, 820], [1440, 900]] as const) {
    await coach.setViewportSize({ width: w, height: h });
    await shoot(coach, `hf-male/layout/05-coach-detail`, { area: "layout", case: "hf-decompensated-01" });
  }
  await coachCtx.close();
});
