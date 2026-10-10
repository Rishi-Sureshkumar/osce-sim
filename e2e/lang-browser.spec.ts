/**
 * Phase 4 M1: in-browser embeddings. Nothing under /lang/ is fetched while the student hasn't touched
 * the chat (only after the idle delay), the vendored model loads from our own origin, chat turns then
 * carry the browser's clause vectors, and no request ever leaves the app's host.
 */
import { request as pwRequest, type Page } from "@playwright/test";
import type { Action } from "../src/domain/schemas";
import { expect, reloadInQaMode, test, waitSettled } from "./qa/fixtures";
import { enterCode } from "./qa/openers";

test("embeddings load lazily in the browser and are used for chat; no off-host requests", async ({ page, baseURL }) => {
  test.setTimeout(240_000);
  const host = new URL(baseURL!).host;
  const offHost: string[] = [];
  const lang: { url: string; t: number }[] = [];
  let stationLoadedAt = 0;
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.protocol.startsWith("http") && u.host !== host) offHost.push(r.url());
    if (u.pathname.startsWith("/lang/")) lang.push({ url: u.pathname, t: Date.now() });
  });
  page.on("domcontentloaded", () => {
    if (/\/station\//.test(page.url())) stationLoadedAt = Date.now();
  });

  await page.goto("/");
  await enterCode(page, "student-e2e");
  await page.getByLabel("Your name or alias").fill("Lang QA");
  await page.getByLabel(/Practice \(untimed\)/).check();
  await page.locator('[data-case="screening-normal"]').click();
  await expect(page).toHaveURL(/\/station\//);
  const sessionId = page.url().match(/\/station\/([^/?#]+)/)![1]!;
  await reloadInQaMode(page);
  await page.getByRole("button", { name: "Knock and enter" }).click();
  await waitSettled(page);

  // the model is fetched only on chat focus or after the idle delay (8 s after the station mounted)
  await chatBox(page).focus();
  await expect(page.locator("[data-embedder]")).toHaveAttribute("data-embedder", "ready", { timeout: 150_000 });
  expect(lang.length, "the model files came from /lang/").toBeGreaterThan(0);
  const first = Math.min(...lang.map((l) => l.t));
  expect(first - stationLoadedAt, "no /lang/ request before focus or idle").toBeGreaterThan(0);
  expect(lang.map((l) => l.url).filter((u) => u.includes("asyncify") || u.includes("jsep")), "only the plain CPU wasm").toEqual([]);

  await chatBox(page).fill("How are you feeling today?");
  await chatBox(page).press("Enter");
  await expect(page.locator("[data-streaming]")).toHaveCount(0, { timeout: 30_000 });

  const api = await pwRequest.newContext({ baseURL });
  expect((await api.post("/api/gate", { data: { code: "coach-e2e" } })).ok()).toBe(true);
  const { actions } = (await (await api.get(`/api/coach/sessions/${sessionId}/log`)).json()) as { actions: Action[] };
  const reply = actions.findLast((a) => a.type === "patient_say");
  expect(reply?.type === "patient_say" && reply.payload.match?.embedding, "the turn used the browser's vectors").toBe("client");
  // the student never sees how the matcher understood them
  const html = await (await page.request.get(`/station/${sessionId}`)).text();
  expect(html).toContain("How are you feeling today?");
  expect(html).not.toMatch(/\\?"clauses\\?":\s*\[/);

  expect(offHost, "requests to other hosts").toEqual([]);
});

const chatBox = (page: Page) => page.locator("#chat-input");
