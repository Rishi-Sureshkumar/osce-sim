/**
 * Found by the M3/M6 catalog runs: picking up a tool changed the bars around the 3D view (the tool
 * HUD wrapped onto a second line when its help text appeared; the encounter bar wrapped at 1280), so
 * the canvas resized mid-exam and the patient moved under the pointer. A one-row HUD then ran under
 * the right panel and hid "Put down". At every supported width, with any tool in hand, the 3D view
 * keeps its size and every HUD control is the topmost element under its own centre.
 */
import { expect, reloadInQaMode, test } from "../qa/fixtures";
import { enterCode } from "../qa/openers";

const TOOLS = ["stethoscope", "tuning_fork", "penlight", "cotton_swab", "pointer"] as const;

for (const [width, height] of [
  [1440, 900],
  [1280, 800],
  [1180, 820],
] as const) {
  test(`the 3D view keeps its size with any tool in hand at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await enterCode(page, "student-e2e");
    await page.getByLabel("Your name or alias").fill("Layout");
    await page.getByLabel(/Practice \(untimed\)/).check();
    await page.locator('[data-case="hf-decompensated-01"]').click();
    await expect(page).toHaveURL(/\/station\//);
    await reloadInQaMode(page);
    await page.getByRole("button", { name: "Knock and enter" }).click();
    await expect(page.locator('[data-testid="exam3d"]')).toHaveAttribute("data-camera", "overview", { timeout: 10_000 });

    const view = page.getByTestId("exam3d");
    const size = async () => {
      const b = await view.boundingBox();
      return b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
    };
    const start = await size();
    const coveredControls = () =>
      page.getByTestId("tool-hud").evaluate((hud) => [
        ...[...hud.querySelectorAll("button")]
          .map((b) => {
            const r = b.getBoundingClientRect();
            const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return top && (top === b || b.contains(top)) ? null : `${b.textContent?.trim()} (under ${top?.tagName.toLowerCase()})`;
          })
          .filter(Boolean),
        ...(hud.scrollWidth > hud.clientWidth + 1 ? [`the row overflows (${hud.scrollWidth} > ${hud.clientWidth} px)`] : []),
      ]);
    for (const tool of TOOLS) {
      await page.getByRole("button", { name: "Tools…" }).click();
      await page.locator(`[role=menuitem][data-tool="${tool}"]`).click();
      expect(await size(), `3D view with ${tool} in hand`).toEqual(start);
      expect(await coveredControls(), `HUD controls covered with ${tool} in hand`).toEqual([]);
    }

    // the widest HUD: a stethoscope that remembers which exam a hold records ("Listening for: …")
    await page.getByRole("button", { name: /^Abdomen: covered$/ }).click();
    await page.getByLabel("Camera shot").selectOption("abdomen");
    await page.waitForFunction(() => window.__osce3d?.settled(), null, { timeout: 15_000 });
    await page.getByRole("button", { name: "Tools…" }).click();
    await page.locator('[role=menuitem][data-tool="stethoscope"]').click();
    const at = await page.evaluate(() => window.__osce3d!.projectPoint(window.__osce3d!.anchor("abd_ruq")!));
    await page.mouse.move(at!.x, at!.y);
    await page.mouse.down();
    await page.waitForTimeout(3_300);
    await page.mouse.up();
    await page.locator('[data-dialog="tool-chooser"] [data-maneuver="bowel_sounds"]').click();
    await expect(page.getByTestId("listening-for")).toBeVisible();
    expect(await size(), "3D view while listening for an exam").toEqual(start);
    expect(await coveredControls(), "HUD controls covered while listening for an exam").toEqual([]);
  });
}
