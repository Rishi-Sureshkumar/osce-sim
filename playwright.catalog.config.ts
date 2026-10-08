import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/** npm run test:catalog — the catalog harness (e2e/catalog.spec.ts), one test per body model × position. */
export default defineConfig({
  ...base,
  testMatch: /catalog\.spec\.ts$/,
  testIgnore: [],
  timeout: 60 * 60_000,
  workers: Number(process.env.CATALOG_WORKERS ?? 1),
  // a stuck click fails its entry instead of hanging the whole group until the test timeout
  use: { ...base.use, viewport: { width: 1280, height: 800 }, actionTimeout: 15_000 },
});
