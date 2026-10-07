import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/** npm run test:visual — the screenshot tour (e2e/visual.spec.ts) for qa/REVIEW.md. */
export default defineConfig({
  ...base,
  testMatch: /visual\.spec\.ts$/,
  testIgnore: [],
  timeout: 30 * 60_000,
  workers: 1,
  use: { ...base.use, viewport: { width: 1440, height: 900 } },
});
