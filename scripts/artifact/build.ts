/**
 * Builds a single self-contained HTML page of the app for a claude.ai artifact:
 *   npx tsx scripts/artifact/build.ts [out.html]
 * Everything (engine, route handlers, pages, content, 3D models) runs in the browser with AI_MOCK=true.
 * See scripts/artifact/main.tsx for how the server parts are swapped out.
 */
import fs from "node:fs";
import path from "node:path";
import * as esbuild from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const root = process.cwd();
const here = path.join(root, "scripts/artifact");
const out = path.resolve(process.argv[2] ?? path.join(root, ".artifact/osce-sim.html"));

const jsonDir = (dir: string) =>
  fs
    .readdirSync(path.join(root, dir))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(root, dir, f), "utf8")));

// Content: same parse + cross-reference validation as loadFromDisk.ts, from JSON baked into the bundle.
const contentModule = `
import { z } from "zod";
import { Case, ManeuversFile, MarkSheet, RegionsFile } from "@/domain/schemas";
import { validateContentGraph } from "@/content/validate";
const RAW = ${JSON.stringify({
  regions: JSON.parse(fs.readFileSync(path.join(root, "content/catalog/regions.json"), "utf8")),
  maneuvers: jsonDir("content/catalog/maneuvers"),
  cases: jsonDir("content/cases"),
  markSheets: jsonDir("content/marksheets"),
})};
const parse = (schema, raw) => {
  const r = schema.safeParse(raw);
  if (!r.success) throw new Error("Invalid content:\\n" + z.prettifyError(r.error));
  return r.data;
};
export function loadContentFromDisk() {
  const regions = parse(RegionsFile, RAW.regions).regions;
  const maneuvers = RAW.maneuvers.flatMap((f) => parse(ManeuversFile, f).maneuvers);
  const cases = RAW.cases.map((f) => parse(Case, f));
  const markSheets = RAW.markSheets.map((f) => parse(MarkSheet, f));
  const index = {
    regions, regionById: new Map(regions.map((r) => [r.id, r])),
    maneuvers, maneuverById: new Map(maneuvers.map((m) => [m.id, m])),
    cases, caseById: new Map(cases.map((c) => [c.id, c])),
    markSheets, markSheetById: new Map(markSheets.map((m) => [m.id, m])),
  };
  const errors = validateContentGraph(index);
  if (errors.length) throw new Error("Content cross-reference errors:\\n- " + errors.join("\\n- "));
  return index;
}
`;

// Files the app fetches from /public, served by the fetch shim.
const asset = (p: string, type: string) => ({ type, b64: fs.readFileSync(path.join(root, "public", p)).toString("base64") });
const assetsModule = `export const ASSETS = ${JSON.stringify({
  "/models/patient.glb": asset("models/patient.glb", "model/gltf-binary"),
  "/models/patient-female.glb": asset("models/patient-female.glb", "model/gltf-binary"),
  "/audio/manifest.json": asset("audio/manifest.json", "application/json"),
})};`;

const shim = (f: string) => path.join(here, "shims", f);
const ALIASES: Record<string, string> = {
  "server-only": shim("server-only.ts"),
  "next/link": shim("next-link.tsx"),
  "next/navigation": shim("next-navigation.ts"),
  "next/dynamic": shim("next-dynamic.tsx"),
  "next/headers": shim("next-headers.ts"),
};

const plugin: esbuild.Plugin = {
  name: "artifact",
  setup(b) {
    b.onResolve({ filter: /^(server-only|next\/(link|navigation|dynamic|headers))$/ }, (a) => ({ path: ALIASES[a.path]! }));
    b.onResolve({ filter: /^virtual:assets$/ }, () => ({ path: "assets", namespace: "virtual" }));
    b.onLoad({ filter: /^assets$/, namespace: "virtual" }, () => ({ contents: assetsModule, loader: "js" }));
    // Disk-backed modules → browser versions.
    b.onResolve({ filter: /\/loadFromDisk$/ }, () => ({ path: "content", namespace: "virtual" }));
    b.onLoad({ filter: /^content$/, namespace: "virtual" }, () => ({ contents: contentModule, loader: "js", resolveDir: root }));
    b.onResolve({ filter: /^(@\/server\/db|\.\.?\/db)$/ }, () => ({ path: shim("db-index.ts") }));
    // CSS is compiled separately (Tailwind); drop the page-level import.
    b.onResolve({ filter: /\.css$/ }, () => ({ path: "css", namespace: "empty" }));
    b.onLoad({ filter: /.*/, namespace: "empty" }, () => ({ contents: "", loader: "js" }));
  },
};

const result = await esbuild.build({
  entryPoints: [path.join(here, "main.tsx")],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: "es2022",
  minify: true,
  jsx: "automatic",
  legalComments: "none",
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env": JSON.stringify({ AI_MOCK: "true" }),
  },
  plugins: [plugin],
  logLevel: "warning",
});
const js = result.outputFiles[0]!.text.replace(/<\/script/gi, "<\\/script");

const cssIn = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
const css = (await postcss([tailwind({ base: root })]).process(cssIn, { from: path.join(root, "src/app/globals.css") })).css;

// The artifact host wraps the page in its own doctype/head/body skeleton, so emit the content only.
const html = `<title>OSCE Simulator</title>
<style>:root{color-scheme:light}body{min-height:100vh;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}${css}</style>
<div id="root"></div>
<script>${js}</script>
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`wrote ${path.relative(root, out)} (${(html.length / 1e6).toFixed(2)} MB)`);
