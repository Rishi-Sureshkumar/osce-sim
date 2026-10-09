/**
 * npm run test:catalog (Phase 4 M0.3): every maneuver × allowed region × body model, done the way
 * a student would in the 3D room — real mouse events on the canvas through Patient3D's raycast and
 * the tool handlers, the maneuver menu, the Examine… panel — then checked:
 *   (a) probe: the first thing under the pointer is the patient (skin/gown/eye), not hair, an ear,
 *       a drape, the bed or a prop
 *   (b) the click resolves to the expected region (and, for tools, a placement inside tolerance)
 *   (c) an `examine` for that maneuver and region lands in the server log (QA log route)
 *   (d) the server's finding equals the catalog/case resolution, and the newest Findings entry shows it
 * plus, for tools, a placement at 2× the tolerance records nothing.
 * One test per (body model, position); CATALOG_FILTER=<regex on entry id> runs a subset.
 * Known failures: qa/xfail.json. Results: test-results/catalog/*.json → npm run qa:catalog-report.
 */
import fs from "node:fs";
import path from "node:path";
import { request as pwRequest, type APIRequestContext, type Page } from "@playwright/test";
import type { Action, DrapeSection, Tool } from "@/domain/schemas";
import { sectionsForRegion } from "@/engine/patientState";
import { POSITION_LABELS } from "@/components/common/format";
import { classify, type CheckResult } from "../scripts/qa/lib/xfail";
import { poseFor, type Vec3 } from "@/exam3d/regionAnchors";
import { POSITION_ANGLE } from "@/engine/patientState";
import { oracleFor, sampleWorld } from "../qa/anatomy/oracle";
import { skinnedPatient } from "../scripts/qa/lib/patientMesh";
import { buildCatalogPlan, type CatalogEntry } from "./qa/catalogPlan";
import { expect, test, waitSettled } from "./qa/fixtures";

const PLAN = buildCatalogPlan({ filter: process.env.CATALOG_FILTER });
// each (model, position) group starts its own station, so groups can run side by side (CATALOG_WORKERS)
test.describe.configure({ mode: "parallel" });
const GROUPS = new Map<string, CatalogEntry[]>();
for (const e of PLAN) {
  const k = `${e.variant}-${e.position}`;
  GROUPS.set(k, [...(GROUPS.get(k) ?? []), e]);
}
const OUT = path.join(process.cwd(), "test-results/catalog");

/**
 * Which oracle point (qa/anatomy/oracle.ts) a plan entry should also be done at: where a clinician
 * would actually place the instrument. Same-region rules apply directly; these map exams to the
 * anatomical site their anchor stands for. `step`: only that sequence step uses the oracle point.
 */
function oracleRuleFor(e: CatalogEntry, ruleIds: Set<string>): { rule: string; step?: string } | null {
  const side = e.regionId.endsWith("_left") ? "left" : e.regionId.endsWith("_right") ? "right" : null;
  const map: Record<string, string> = {
    rinne_test: `ear_${side}#mastoid`,
    reflex_biceps: `biceps_tendon_${side}`,
    reflex_triceps: `triceps_tendon_${side}`,
    reflex_brachioradialis: `brachioradialis_${side}`,
    reflex_patellar: `patellar_tendon_${side}`,
    reflex_achilles: `achilles_${side}`,
  };
  const mapped = side ? map[e.maneuverId] : undefined;
  if (mapped && ruleIds.has(mapped)) return { rule: mapped, ...(e.maneuverId === "rinne_test" ? { step: "bone" } : {}) };
  if (ruleIds.has(e.regionId)) return { rule: e.regionId };
  return null;
}

/** oracle world points per body model and position */
const oracleCache = new Map<string, Map<string, Vec3>>();
async function oraclePoints(e: CatalogEntry): Promise<Map<string, Vec3>> {
  const key = `${e.variant}-${e.position}`;
  const hit = oracleCache.get(key);
  if (hit) return hit;
  const pose = poseFor(e.position, POSITION_ANGLE[e.position], e.variant);
  const sp = await skinnedPatient(pose);
  const out = new Map<string, Vec3>();
  for (const o of await oracleFor(e.variant)) out.set(o.id, sampleWorld(o.sample, sp.byName(o.sample.mesh)!.positions));
  oracleCache.set(key, out);
  return out;
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
/** a stethoscope hold: the 3 s listen plus a margin for a slow software-rendered page under load */
const HOLD_MS = 4_000;
/** what the tool HUD says is in hand (ToolTray's TOOL_LABELS; that module is a client component) */
const TOOL_LABELS: Record<Tool, string> = {
  stethoscope: "Stethoscope",
  reflex_hammer: "Reflex hammer",
  penlight: "Penlight",
  tuning_fork: "Tuning fork",
  bp_cuff: "BP cuff",
  hands: "Hands",
  cotton_swab: "Cotton swab",
  pin: "Neurotip (pin)",
};

async function coachApi(baseURL: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL });
  const res = await ctx.post("/api/gate", { data: { code: "coach-e2e" } });
  expect(res.ok(), "coach login for the QA log").toBe(true);
  return ctx;
}

async function qaLog(api: APIRequestContext, sessionId: string): Promise<Action[]> {
  const res = await api.get(`/api/coach/sessions/${sessionId}/log`);
  expect(res.ok(), "QA log route (QA_HOOKS=true)").toBe(true);
  return ((await res.json()) as { actions: Action[] }).actions;
}

async function startStation(page: Page, caseId: string): Promise<string> {
  await page.goto("/");
  await page.getByLabel("Access code").fill("student-e2e");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).not.toHaveURL(/\/gate/);
  await page.getByLabel("Your name or alias").fill("Catalog QA");
  await page.getByLabel(/Practice \(untimed\)/).check();
  await page.locator(`[data-case="${caseId}"]`).click();
  await expect(page).toHaveURL(/\/station\//);
  const sessionId = new URL(page.url()).pathname.split("/").pop()!;
  await page.goto(`${page.url()}?qa=fast`);
  await page.waitForFunction(() => window.__osce3d?.ready, null, { timeout: 60_000 });
  // the harness checks picking, not looks: low graphics renders faster under software WebGL
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Graphics quality").selectOption("low");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Knock and enter" }).click();
  await expect(page.locator('[data-testid="exam3d"]')).toHaveAttribute("data-camera", "overview", { timeout: 10_000 });
  await waitSettled(page);
  return sessionId;
}

async function closeAll(page: Page) {
  for (let k = 0; k < 4 && (await page.locator("[data-dialog]").count()); k++) await page.keyboard.press("Escape");
  // toasts sit over the 3D view (a known UI defect, M6); a student would dismiss one that's in the way
  for (const t of await page.getByTestId("toast").all()) await t.getByRole("button", { name: "Dismiss" }).click().catch(() => undefined);
}

async function setPosition(page: Page, label: string) {
  if ((await page.getByTestId("position-label").textContent())?.trim() === label) return;
  await page.getByRole("button", { name: "Actions ▾" }).click();
  await page.getByRole("menuitem", { name: `Position: ${label}` }).click();
  await expect(page.getByTestId("position-label")).toHaveText(label);
  await waitSettled(page);
}

/**
 * A student uncovers the region before examining it (a covered sheet takes the click): each drape
 * section over the region, with the encounter bar's side buttons (Phase 4 M3 sectioned drapes).
 */
async function expose(page: Page, e: CatalogEntry) {
  for (const sec of sectionsForRegion(e.regionId)) {
    const name = SECTION_BUTTON[sec];
    if (!name) continue;
    const btn = page.getByRole("button", { name: new RegExp(`^${name}: (covered|uncovered)$`) });
    if ((await btn.getAttribute("aria-pressed")) === "true") {
      await btn.click();
      await expect(btn).toHaveAttribute("aria-pressed", "false");
    }
  }
}
const SECTION_BUTTON: Partial<Record<DrapeSection, string>> = {
  chest_left: "Chest left",
  chest_right: "Chest right",
  back: "Back",
  abdomen: "Abdomen",
  leg_left: "Legs left",
  leg_right: "Legs right",
};

async function camera(page: Page, shot: string) {
  const cur = await page.locator('[data-testid="exam3d"]').getAttribute("data-camera");
  if (cur !== shot) {
    await page.getByLabel("Camera shot").selectOption(shot);
    await expect(page.locator('[data-testid="exam3d"]')).toHaveAttribute("data-camera", shot);
  }
  await waitSettled(page);
}

async function holdTool(page: Page, tool: string, mode?: string) {
  const inHand = (await page.getByTestId("tool-in-hand").textContent()) ?? "";
  const want = TOOL_LABELS[tool as Tool] ?? tool;
  const forkOk = tool !== "tuning_fork" || inHand.includes(`${mode ?? "512"} Hz`);
  if (!inHand.includes(want) || !forkOk) {
    await page.getByRole("button", { name: "Tools…" }).click();
    await page.locator(`[role=menuitem][data-tool="${tool === "tuning_fork" && mode === "128" ? "tuning_fork_128" : tool}"]`).click();
  }
  if (tool === "stethoscope" && mode) await page.getByRole("radio", { name: mode === "bell" ? "Bell" : "Diaphragm" }).click();
  if (tool === "tuning_fork") await page.getByRole("button", { name: "Strike fork" }).click();
}

async function putDown(page: Page) {
  if (await page.getByRole("button", { name: "Put down" }).isVisible()) await page.getByRole("button", { name: "Put down" }).click();
}

interface Probe {
  first: { kind: string; part: string | null; name: string } | null;
  /** what the browser would deliver the click to, when it isn't the 3D canvas */
  covering: string | null;
}
async function probeAt(page: Page, x: number, y: number): Promise<Probe> {
  return page.evaluate(([px, py]) => {
    // clicks pass through hair to the scalp beneath (src/exam3d/hit.ts), so hair never blocks
    const hits = window.__osce3d!.probe(px!, py!).map((h) => ({ kind: h.kind, part: h.part, name: h.name })).filter((h) => h.kind !== "hair");
    const el = document.elementFromPoint(px!, py!);
    const covering = !el || el.tagName === "CANVAS" ? null : `${el.tagName.toLowerCase()}${el.getAttribute("data-testid") ? `[data-testid=${el.getAttribute("data-testid")}]` : ""}${el.getAttribute("data-dialog") ? `[data-dialog=${el.getAttribute("data-dialog")}]` : ""}${el.className && typeof el.className === "string" ? `.${el.className.split(" ").slice(0, 2).join(".")}` : ""}`;
    return { first: hits[0] ?? null, covering };
  }, [x, y]);
}

function probeOk(e: CatalogEntry, p: Probe): string | null {
  if (p.covering) return `the page covers the canvas here (${p.covering})`;
  const f = p.first;
  if (!f) return "nothing under the pointer";
  const isEar = /^ear_/.test(e.regionId);
  if (f.kind === "eye") return /^eye_/.test(e.regionId) ? null : "an eye is in front";
  if (f.kind === "body" || f.kind.startsWith("gown")) {
    if (f.part === "hair") return "hair is in front";
    if (!isEar && f.part?.startsWith("ear_")) return `the ear (${f.part}) is in front`;
    return null;
  }
  return `first hit is ${f.kind}${f.name ? ` (${f.name})` : ""}, not the patient`;
}

async function newestExamine(api: APIRequestContext, sessionId: string, since: number) {
  const log = await qaLog(api, sessionId);
  const ex = log.filter((a): a is Extract<Action, { type: "examine" }> => a.type === "examine");
  return { log, fresh: ex.slice(since), count: ex.length };
}

/**
 * Runs one plan entry; returns the failed assertions (empty = pass). With `at`, the click (or the
 * given sequence step) goes to that world point instead of the stored anchor (oracle placement).
 */
async function runEntry(page: Page, api: APIRequestContext, sessionId: string, e: CatalogEntry, at?: { world: Vec3; step?: string }): Promise<string[]> {
  const fails: string[] = [];
  await closeAll(page);
  const before = (await newestExamine(api, sessionId, 0)).count;

  if (e.route === "panel" || e.route === "panel-tool") {
    await putDown(page);
    await page.getByRole("button", { name: /^Examine…/ }).click();
    await page.locator(`[data-dialog="examine-menu"] [data-region="${e.regionId}"]`).click();
  } else {
    await expose(page, e);
    if (e.shot) await camera(page, e.shot);
    if (e.route === "tool") await holdTool(page, e.tool!, e.toolMode);
    else await putDown(page);
    await waitSettled(page);
  }

  // where the student clicks: the anchor (or each sequence landmark)
  const targets: { x: number; y: number }[] = [];
  // re-aims each target from its world point (the camera can move between clicks)
  const aims: (() => Promise<{ x: number; y: number } | null>)[] = [];
  if (e.route !== "panel" && e.route !== "panel-tool") {
    const steps = e.sweep ? e.sweep.map((r) => ({ id: "", landmark: undefined as string | undefined, regionId: r })) : e.steps?.length ? e.steps.map((st) => ({ ...st, regionId: e.regionId })) : [{ id: "", landmark: undefined as string | undefined, regionId: e.regionId }];
    for (const st of steps) {
      const lm = st.landmark;
      const useOracle = at && (!at.step || at.step === st.id);
      // an anchor is aimed 3 mm under the skin (as the Node occlusion check does): one on the body's
      // outline from its shot is still clicked on the body, not on the edge
      const aim = () =>
        useOracle
          ? page.evaluate((w) => window.__osce3d!.projectPoint(w), at!.world)
          : lm
            ? page.evaluate(([r, l]) => window.__osce3d!.project(r!, l!), [st.regionId, lm] as const)
            : page.evaluate((r) => {
                const h = window.__osce3d!;
                const w = h.anchor(r);
                const n = h.anchorNormal(r) ?? [0, 0, 0];
                return w ? h.projectPoint([w[0] - n[0] * 0.003, w[1] - n[1] * 0.003, w[2] - n[2] * 0.003]) : null;
              }, st.regionId);
      aims.push(aim);
      const p = await aim();
      if (!p) {
        fails.push(`no anchor${lm ? ` for landmark ${lm}` : ""} to click`);
        return fails;
      }
      targets.push(p);
    }
    for (const t of await page.getByTestId("toast").all()) await t.getByRole("button", { name: "Dismiss" }).click().catch(() => undefined);
    const pr = await probeAt(page, targets[0]!.x, targets[0]!.y);
    const bad = probeOk(e, pr);
    if (bad) fails.push(`(a) ${bad}`);
  }

  if (e.route === "menu" || e.route === "verbal" || e.route === "prohibited") {
    const before = await page.evaluate(() => window.__osce3d!.lastPointer()?.at ?? 0);
    await page.mouse.click(targets[0]!.x, targets[0]!.y);
    const lp = await page.evaluate(() => window.__osce3d!.lastPointer());
    if (!lp || lp.at === before) fails.push("(b) the click never reached the patient");
    else if (lp.bodyHit?.regionId !== e.regionId) fails.push(`(b) the click resolved to ${lp.bodyHit?.regionId ?? "no region"}`);
  }
  if (e.route === "verbal") {
    const dlg = page.locator('[data-dialog="describe"]');
    if (!(await dlg.isVisible({ timeout: 2_000 }).catch(() => false))) return [...fails, "(c) the verbal exam dialog did not open"];
    await dlg.getByLabel("Describe the exam").fill("I would inspect this area with a light and describe what I see.");
    await dlg.getByRole("button", { name: "Done" }).click();
    // Done posts the description; the log may be read before that request has landed
    const logged = async () => (await qaLog(api, sessionId)).some((a) => a.type === "describe_exam" && a.payload.regionId === e.regionId);
    if (!(await expect.poll(logged, { timeout: 5_000 }).toBe(true).then(() => true, () => false))) fails.push("(c) no describe_exam logged");
    return fails;
  }
  if (e.route === "prohibited") {
    const logged = async () => (await qaLog(api, sessionId)).some((a) => a.type === "prohibited_attempt" && a.payload.regionId === e.regionId);
    if (!(await expect.poll(logged, { timeout: 5_000 }).toBe(true).then(() => true, () => false))) fails.push("(c) no prohibited_attempt logged");
    return fails;
  }

  if (e.route === "panel-tool") {
    const menu = page.locator('[data-dialog="maneuver-menu"]');
    if (!(await menu.isVisible({ timeout: 2_000 }).catch(() => false))) return [...fails, "(b) the maneuver menu did not open"];
    await menu.locator(`[data-maneuver="${e.maneuverId}"]`).click();
    if (!((await page.getByTestId("tool-in-hand").textContent()) ?? "").includes(TOOL_LABELS[e.tool!])) fails.push(`(b) choosing it did not put the ${e.tool} in hand`);
    await putDown(page);
    return fails;
  }
  if (e.route === "menu" || e.route === "panel") {
    const menu = page.locator('[data-dialog="maneuver-menu"]');
    if (!(await menu.isVisible({ timeout: 2_000 }).catch(() => false))) return [...fails, "(b) the maneuver menu did not open"];
    const btn = menu.locator(`[data-maneuver="${e.maneuverId}"]`);
    if (!(await btn.count())) return [...fails, `(b) ${e.maneuverId} is not in the menu for this region`];
    await btn.click();
    await expect(page.locator('[data-testid="perform-finding"] .font-medium')).toBeVisible({ timeout: 8_000 }).catch(() => fails.push("(d) no finding in the perform card"));
  } else {
    // tool: click (or hold ≥ 3 s with the stethoscope) on each target; a remembered stethoscope pick
    // from an earlier entry is cleared first so the "which exam?" question appears
    if (e.hold && (await page.getByTestId("listening-for").isVisible())) await page.getByTestId("listening-for").getByRole("button", { name: "Change exam" }).click();
    const pointerBefore = await page.evaluate(() => window.__osce3d!.lastPointer()?.at ?? 0);
    if (e.sweep) {
      // one press dragged through the targets (the camera holds still while the beam is dragged)
      await page.mouse.move(targets[0]!.x, targets[0]!.y);
      await page.mouse.down();
      for (const t of targets.slice(1)) await page.mouse.move(t.x, t.y, { steps: 16 });
      await page.mouse.up();
      await page.waitForTimeout(300);
    }
    for (const [i, t0] of (e.sweep ? [] : targets).entries()) {
      // aimed again just before pressing: the view may still have been easing when the targets were taken
      await waitSettled(page);
      const t = (await aims[i]?.()) ?? t0;
      await page.mouse.move(t.x, t.y);
      await page.mouse.down();
      if (e.hold) await page.waitForTimeout(HOLD_MS);
      await page.mouse.up();
      const chooser = page.locator('[data-dialog="tool-chooser"]');
      if (await chooser.isVisible({ timeout: 600 }).catch(() => false)) {
        await chooser.locator(`[data-maneuver="${e.maneuverId}"]`).click();
        // a stethoscope hold asks first (several exams fit); then hold again to listen — aimed afresh,
        // since the view may have moved closer meanwhile
        if (e.hold) {
          await waitSettled(page);
          const t2 = (await aims[i]?.()) ?? t;
          await page.mouse.move(t2.x, t2.y);
          await page.mouse.down();
          await page.waitForTimeout(HOLD_MS);
          await page.mouse.up();
        }
      }
      await page.waitForTimeout(150);
    }
    const lp = await page.evaluate(() => window.__osce3d!.lastPointer());
    const d = lp?.decision as { regionId?: string; outcome?: string; distanceCm?: number; none?: boolean } | undefined;
    if (lp && lp.at === pointerBefore) fails.push("(b) the placement never reached the patient");
    else if (!e.hold && !e.sweep) {
      if (!d || d.none) fails.push("(b) the placement resolved to no region");
      else if (d.regionId !== e.regionId || d.outcome !== "finding") fails.push(`(b) placement → ${d.regionId} ${d.outcome} (${d.distanceCm?.toFixed(1)} cm)`);
    }
  }

  // (c) + (d) — a held tool records when its listening time is up, and the post can land after the
  // release under load: give the log a few seconds before calling the exam missing
  const wanted = (list: Extract<Action, { type: "examine" }>[]) => list.filter((a) => a.payload.maneuverId === e.maneuverId && a.payload.regionId === e.regionId).at(-1);
  let { fresh } = await newestExamine(api, sessionId, before);
  for (let k = 0; k < 15 && !wanted(fresh); k++) {
    await page.waitForTimeout(200);
    ({ fresh } = await newestExamine(api, sessionId, before));
  }
  const ex = wanted(fresh);
  if (!ex) {
    fails.push(`(c) no examine for ${e.maneuverId}@${e.regionId} (got ${fresh.map((a) => `${a.payload.maneuverId}@${a.payload.regionId}`).join(", ") || "none"})`);
  } else {
    if (e.expectedFinding !== null && norm(ex.result?.findingText ?? "") !== norm(e.expectedFinding)) fails.push(`(d) server finding "${ex.result?.findingText}" ≠ expected "${e.expectedFinding}"`);
    // the Findings panel lists the newest first
    const shown = norm((await page.locator('[data-testid="findings"] > li').first().locator("p").last().textContent()) ?? "");
    const want = norm(ex.result?.wording || ex.result?.findingText || "");
    if (!e.steps?.length && want && shown !== want) fails.push(`(d) Findings shows "${shown}" ≠ "${want}"`);
  }
  await closeAll(page);
  return fails;
}

/** A tool placement at 2× the tolerance must not record that exam. */
async function runNegative(page: Page, api: APIRequestContext, sessionId: string, e: CatalogEntry): Promise<string[]> {
  if (e.route !== "tool" || e.steps?.length || e.sweep || !e.toleranceCm) return [];
  await closeAll(page);
  // the camera may still be easing after the positive placement: project and probe a still scene
  await waitSettled(page);
  // a skin point the click actually reaches well outside the tolerance (≥ 1.5×): what the ray meets
  // first there is the patient's skin, not a nearer limb, the sheet or a prop
  const p = await page.evaluate(([r, cm]) => {
    const h = window.__osce3d!;
    const a = h.anchor(r!);
    if (!a) return null;
    return (
      h.skinPointNear(r!, cm!, 8).find((q) => {
        if (q.page.x <= 0 || q.page.y <= 0) return false;
        const first = h.probe(q.page.x, q.page.y).find((x) => x.kind !== "hair");
        return !!first && first.kind === "body" && Math.hypot(first.point[0] - a[0], first.point[1] - a[1], first.point[2] - a[2]) >= (cm! / 100) * 0.75;
      }) ?? null
    );
  }, [e.regionId, e.toleranceCm * 2] as const);
  if (!p) return ["(neg) no visible skin 2× the tolerance away to test"];
  const before = (await newestExamine(api, sessionId, 0)).count;
  await page.mouse.move(p.page.x, p.page.y);
  await page.mouse.down();
  if (e.hold) await page.waitForTimeout(HOLD_MS);
  await page.mouse.up();
  const chooser = page.locator('[data-dialog="tool-chooser"]');
  if (await chooser.isVisible({ timeout: 500 }).catch(() => false)) {
    // the placement landed on another region's exams (e.g. bowel sounds / bruits): not this exam
    const opt = chooser.locator(`[data-maneuver="${e.maneuverId}"]`);
    if (!(await opt.count())) {
      await page.keyboard.press("Escape");
      await closeAll(page);
      return [];
    }
    await opt.click();
    if (e.hold) {
      await page.mouse.move(p.page.x, p.page.y);
      await page.mouse.down();
      await page.waitForTimeout(HOLD_MS);
      await page.mouse.up();
    }
  }
  await page.waitForTimeout(200);
  const { fresh } = await newestExamine(api, sessionId, before);
  await closeAll(page);
  return fresh.some((a) => a.payload.maneuverId === e.maneuverId && a.payload.regionId === e.regionId) ? ["(neg) 2× the tolerance away still recorded the exam"] : [];
}

for (const [group, entries] of GROUPS) {
  test(`catalog ${group} (${entries.length})`, async ({ page, baseURL }) => {
    // a stethoscope hold may need a pick and a second hold (bug 10): budget more for those
    test.setTimeout(Math.max(120_000, entries.reduce((ms, e) => ms + (e.hold ? 40_000 : 20_000), 0)));
    const api = await coachApi(baseURL!);
    const sessionId = await startStation(page, entries[0]!.caseId);
    await setPosition(page, POSITION_LABELS[entries[0]!.position]);
    // fewer camera moves: by shot, then region
    const ordered = [...entries].sort((a, b) => `${a.shot}${a.regionId}`.localeCompare(`${b.shot}${b.regionId}`));
    const results: CheckResult[] = [];
    const oracle = await oracleFor(entries[0]!.variant);
    const ruleIds = new Set(oracle.map((o) => o.id));
    // rules measured along a limb axis (the cuff's height: anywhere around the arm is fine) are about
    // placing a tool; a plain click there may fairly pick the chest beside the arm (the BP cuff
    // itself is checked by e2e/regressions/bug9-bp.spec.ts)
    const axisRules = new Set(oracle.filter((o) => o.axis).map((o) => o.id));
    for (const [i, e] of ordered.entries()) {
      let fails: string[];
      const t0 = Date.now();
      try {
        fails = await runEntry(page, api, sessionId, e);
      } catch (err) {
        fails = [`error: ${(err as Error).message.split("\n")[0]}`];
        await closeAll(page).catch(() => undefined);
      }
      results.push({ id: e.id, pass: fails.length === 0, detail: fails.join("; ") });
      // a sweep's anatomical points are each eye's own entry
      const rule = (e.route === "tool" || e.route === "menu") && !e.sweep ? oracleRuleFor(e, ruleIds) : null;
      const o = rule && !(e.route === "menu" && axisRules.has(rule.rule)) ? rule : null;
      if (o) {
        let ofails: string[];
        try {
          const world = (await oraclePoints(e)).get(o.rule)!;
          ofails = await runEntry(page, api, sessionId, e, { world, ...(o.step ? { step: o.step } : {}) });
        } catch (err) {
          ofails = [`error: ${(err as Error).message.split("\n")[0]}`];
          await closeAll(page).catch(() => undefined);
        }
        results.push({ id: e.id.replace(/^catalog:/, "catalog-oracle:"), pass: ofails.length === 0, detail: `at the anatomical point (${o.rule}${o.step ? `, ${o.step} step` : ""}): ${ofails.join("; ")}` });
      }
      if (process.env.CATALOG_VERBOSE) console.log(`[${i + 1}/${ordered.length}] ${fails.length ? "✗" : "✓"} ${e.id} ${Date.now() - t0} ms${fails.length ? ` — ${fails.join("; ")}` : ""}`);
      if (e.route === "tool" && !e.sweep) {
        let neg: string[];
        try {
          neg = await runNegative(page, api, sessionId, e);
        } catch (err) {
          neg = [`error: ${(err as Error).message.split("\n")[0]}`];
        }
        results.push({ id: e.id.replace(/^catalog:/, "catalog-neg:"), pass: neg.length === 0, detail: neg.join("; ") });
      }
    }
    const classified = classify(results);
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, `${group}.json`), JSON.stringify(classified.results.map(({ id, status, detail }) => ({ id, status, detail })), null, 1));
    const bad = classified.results.filter((r) => r.status === "FAIL" || r.status === "XPASS");
    expect(bad.map((r) => `${r.status} ${r.id}: ${r.detail || "now passes — remove from qa/xfail.json"}`), `catalog ${group}`).toEqual([]);
  });
}
