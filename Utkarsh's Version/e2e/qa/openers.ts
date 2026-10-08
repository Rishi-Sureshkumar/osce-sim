/**
 * How to open each dialog (shared by e2e/dialogs.spec.ts and the visual tour). Expects a practice
 * session on the screening patient, inside the room. Must cover every DialogId (typecheck).
 */
import type { Page } from "@playwright/test";
import type { DialogId } from "../../src/components/ui/dialogIds";
import { expect, waitSettled } from "./fixtures";

export type Opener = (page: Page) => Promise<void>;

export async function enterCode(page: Page, code: string) {
  await page.getByLabel("Access code").fill(code);
  await page.getByRole("button", { name: "Continue" }).click();
}

async function camera(page: Page, shot: string) {
  await page.getByLabel("Camera shot").selectOption(shot);
  await expect(page.locator('[data-testid="exam3d"]')).toHaveAttribute("data-camera", shot);
  await waitSettled(page);
}

async function clickRegion(page: Page, region: string) {
  await waitSettled(page);
  const p = await page.evaluate((r) => window.__osce3d!.project(r), region);
  expect(p, region).not.toBeNull();
  await page.mouse.click(p!.x, p!.y);
}

async function pickTool(page: Page, dataTool: string) {
  await page.getByRole("button", { name: "Tools…" }).click();
  await page.locator(`[role=menuitem][data-tool="${dataTool}"]`).click();
}

async function openExamine(page: Page) {
  await page.getByRole("button", { name: /^Examine…/ }).click();
}

export const OPENERS = {
  "command-palette": async (page) => {
    await page.getByRole("button", { name: /^Search/ }).click();
  },
  "examine-menu": openExamine,
  "maneuver-menu": async (page) => {
    await openExamine(page);
    await page.locator('[data-dialog="examine-menu"] [data-region="neck_thyroid"]').click();
  },
  perform: async (page) => {
    await openExamine(page);
    await page.locator('[data-dialog="examine-menu"] [data-region="neck_thyroid"]').click();
    await page.locator('[data-dialog="maneuver-menu"] [data-maneuver="thyroid_palpation"]').click();
  },
  "tool-chooser": async (page) => {
    // hands on the right upper quadrant fit light/deep palpation and the liver: the student picks
    await pickTool(page, "hands");
    await camera(page, "abdomen");
    await clickRegion(page, "abd_ruq");
  },
  describe: async (page) => {
    // from its own close view (from head & neck, the first click on the mouth moves the camera to the face)
    await camera(page, "face");
    await clickRegion(page, "mouth");
  },
  "leave-confirm": async (page) => {
    await page.getByRole("button", { name: "Leave the room" }).click();
  },
  "actions-menu": async (page) => {
    await page.getByRole("button", { name: "Actions ▾" }).click();
  },
  "tools-menu": async (page) => {
    await page.getByRole("button", { name: "Tools…" }).click();
  },
  "bed-hud": async (page) => {
    // the lever is on the patient's right: from the room view it lies behind the seated patient's neck
    await camera(page, "seated");
    const p = await page.evaluate(() => window.__osce3d!.projectObject("table-head-control"));
    await page.mouse.click(p!.x, p!.y);
  },
  "practice-help": async (page) => {
    await page.getByRole("button", { name: "Hint" }).click();
  },
  finish: async (page) => {
    await page.getByRole("button", { name: "Finish exam" }).click();
  },
} satisfies Record<DialogId, Opener>;

