import { defineConfig } from "@playwright/test";

const PORT = 3200;

/** Smoke test runs a production build with the model mocked and access codes set. */
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // software WebGL so the 3D view renders in headless CI
    launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/gate`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      AI_MOCK: "true",
      ANTHROPIC_API_KEY: "",
      DATABASE_URL: "",
      FILE_STORE_PATH: "test-results/e2e-store.json",
      ACCESS_CODE: "student-e2e",
      COACH_ACCESS_CODE: "coach-e2e",
      AUTH_SECRET: "e2e-secret-not-for-production",
      RATE_LIMIT_PER_MINUTE: "1000",
      // exam-mode countdown for e2e (practice mode counts up and is unaffected)
      TIME_LIMIT_SECONDS_OVERRIDE: "25",
      // 1B flow (encounter cases): a 25 s encounter and a 20 s note
      ENCOUNTER_SECONDS_OVERRIDE: "25",
      PEN_SECONDS_OVERRIDE: "20",
    },
  },
});
