/**
 * Builds the whole app as one self-contained HTML page (for a claude.ai artifact or any static host):
 * the client UI plus the real API route handlers running in the page, with AI_MOCK=true and a
 * browser-local store. Usage: npm run build:artifact -- [out.html]
 *
 * Note: this puts full cases in the browser bundle (invariant 9 does not hold here). Use it for
 * demos of synthetic content only, never as a student-facing deployment.
 */
import fs from "node:fs";
import path from "node:path";
import { build, type Plugin } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const ROOT = path.resolve(import.meta.dirname, "../..");
const HERE = import.meta.dirname;
const out = path.resolve(process.argv[2] ?? path.join(ROOT, ".cache/artifact/osce-sim.html"));

const shim = (f: string) => path.join(HERE, "shims", f);
const files = (dir: string, ext: string): string[] =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { recursive: true, encoding: "utf8" })
        .filter((f) => f.endsWith(ext))
        .sort()
        .map((f) => path.join(dir, f))
    : [];

function routesModule(): string {
  const apiDir = path.join(ROOT, "src/app/api");
  const routeFiles = files(apiDir, "route.ts");
  // Static segments before dynamic ones so /api/sessions beats /api/sessions/[id].
  const entries = routeFiles.map((f) => ({ f, pattern: "/api/" + path.relative(apiDir, path.dirname(f)).split(path.sep).join("/") }));
  return [
    ...entries.map((e, i) => `import * as r${i} from ${JSON.stringify(e.f)};`),
    `export const routes = [${entries.map((e, i) => `{ pattern: ${JSON.stringify(e.pattern)}, mod: r${i} }`).join(",")}];`,
  ].join("\n");
}

function contentModule(): string {
  const c = path.join(ROOT, "content");
  const ref = (f: string) => `{ file: ${JSON.stringify(path.relative(ROOT, f))}, data: ${fs.readFileSync(f, "utf8")} }`;
  const list = (dir: string) => `[${files(path.join(c, dir), ".json").map(ref).join(",")}]`;
  return `import { buildIndex } from ${JSON.stringify(shim("content.ts"))};
const raw = { regions: ${ref(path.join(c, "catalog/regions.json"))}, maneuvers: ${list("catalog/maneuvers")}, cases: ${list("cases")}, markSheets: ${list("marksheets")} };
export function loadContentFromDisk() { return buildIndex(raw); }`;
}

function assetsModule(): string {
  const pub = path.join(ROOT, "public");
  const types: Record<string, string> = { ".glb": "model/gltf-binary", ".json": "application/json", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav" };
  const entries = [...files(path.join(pub, "models"), ".glb"), ...files(path.join(pub, "audio"), "")]
    .filter((f) => types[path.extname(f)])
    .map((f) => `${JSON.stringify("/" + path.relative(pub, f).split(path.sep).join("/"))}: { type: ${JSON.stringify(types[path.extname(f)])}, base64: ${JSON.stringify(fs.readFileSync(f).toString("base64"))} }`);
  return `export const assets = {${entries.join(",")}};`;
}

const aliases: Record<string, string> = {
  "server-only": shim("empty.ts"),
  "next/link": shim("next-link.tsx"),
  "next/navigation": shim("next-navigation.ts"),
  "next/dynamic": shim("next-dynamic.tsx"),
  "next/headers": shim("next-headers.ts"),
  "@anthropic-ai/sdk": shim("anthropic.ts"),
  "@anthropic-ai/sdk/helpers/beta/zod": shim("anthropic.ts"),
  "node:fs": shim("fs.ts"),
  "node:path": shim("path.ts"),
};

const browserApp: Plugin = {
  name: "osce-artifact",
  setup(b) {
    b.onResolve({ filter: /^(server-only|next\/(link|navigation|dynamic|headers)|@anthropic-ai\/sdk(\/helpers\/beta\/zod)?|node:(fs|path))$/ }, (a) => ({ path: aliases[a.path]! }));
    b.onResolve({ filter: /^\.\/pgRepo$/ }, () => ({ path: shim("pgRepo.ts") }));
    b.onResolve({ filter: /^\.\/loadFromDisk$/ }, () => ({ path: "content", namespace: "artifact" }));
    b.onResolve({ filter: /^artifact:(routes|assets)$/ }, (a) => ({ path: a.path.slice("artifact:".length), namespace: "artifact" }));
    b.onLoad({ filter: /.*/, namespace: "artifact" }, (a) => ({
      contents: a.path === "routes" ? routesModule() : a.path === "assets" ? assetsModule() : contentModule(),
      loader: "ts",
      resolveDir: ROOT,
    }));
  },
};

const js = await build({
  entryPoints: [path.join(HERE, "main.tsx")],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: "es2022",
  minify: true,
  jsx: "automatic",
  legalComments: "none",
  tsconfig: path.join(ROOT, "tsconfig.json"),
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [browserApp],
  logLevel: "warning",
});

const cssIn = path.join(ROOT, "src/app/globals.css");
const css = await postcss([tailwind({ base: ROOT })]).process(fs.readFileSync(cssIn, "utf8"), { from: cssIn });

const script = js.outputFiles[0]!.text.replace(/<\/script/gi, "<\\/script");
const html = `<title>OSCE Simulator</title>
<style>${css.css}</style>
<div id="root"></div>
<script>${script}</script>
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`Wrote ${path.relative(process.cwd(), out)} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
