import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Content JSON is read from disk at runtime on the server; make sure it ships with the deployment.
  outputFileTracingIncludes: {
    "/**": ["./content/**/*.json"],
  },
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
