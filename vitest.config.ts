import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // lets tests import server modules; Next enforces the real guard in app code
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  // tsconfig keeps JSX for Next ("preserve"); tests that render a component need the React 17+ runtime
  esbuild: { jsx: "automatic" },
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/setup/no-network.ts"],
  },
});
