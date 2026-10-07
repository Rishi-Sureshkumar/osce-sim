import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// patch-package edits files under node_modules, which webpack's persistent cache assumes never
// change; make every patch a build dependency so a new or changed patch invalidates the cache.
const PATCHES = fs.existsSync(path.join(process.cwd(), "patches"))
  ? fs.readdirSync(path.join(process.cwd(), "patches")).map((f) => path.join(process.cwd(), "patches", f))
  : [];

const nextConfig: NextConfig = {
  // Content JSON is read from disk at runtime on the server; make sure it ships with the deployment.
  outputFileTracingIncludes: {
    "/**": ["./content/**/*.json"],
  },
  serverExternalPackages: ["postgres"],
  webpack(config) {
    if (config.cache && typeof config.cache === "object" && PATCHES.length) {
      config.cache.buildDependencies = { ...(config.cache.buildDependencies ?? {}), patches: PATCHES };
    }
    return config;
  },
};

export default nextConfig;
