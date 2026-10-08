/**
 * npm run lang:vendor — puts the sentence-embedding model and the ONNX wasm runtime where the
 * browser and the server load them from (public/lang/, git-ignored). Phase 4 M1.
 *
 * Model: Xenova/all-MiniLM-L6-v2 (quantized ONNX, 384-d, Apache-2.0), from the npm mirror
 * @ryanstark24/sfgraph-models (huggingface.co is not reachable from every build environment).
 * Only that package's tarball is fetched (`npm pack`, no dependencies); every file is checked
 * against the sha256 pinned below (they also match the package's own CHECKSUM.json).
 *
 *   --soft   warn instead of failing (used by postinstall, so an offline install still works)
 */
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "public/lang");
const CACHE = path.join(ROOT, ".cache/lang");
const PKG = "@ryanstark24/sfgraph-models@1.1.3";
const MODEL = "Xenova/all-MiniLM-L6-v2";

/** pinned sha256 (path under the package's data/ dir) */
export const MODEL_FILES: Record<string, string> = {
  [`${MODEL}/config.json`]: "7135149f7cffa1a573466c6e4d8423ed73b62fd2332c575bf738a0d033f70df7",
  [`${MODEL}/tokenizer.json`]: "da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0",
  [`${MODEL}/tokenizer_config.json`]: "9261e7d79b44c8195c1cada2b453e55b00aeb81e907a6664974b4d7776172ab3",
  [`${MODEL}/special_tokens_map.json`]: "b6d346be366a7d1d48332dbc9fdf3bf8960b5d879522b7799ddba59e76237ee3",
  [`${MODEL}/onnx/model_quantized.onnx`]: "afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1",
};
/** onnxruntime-web runtime files the browser needs (copied from node_modules) */
/** the plain CPU build only (src/lang/embed/browser.ts names these two files explicitly) */
const ORT_FILES = ["ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"];

const sha = (f: string) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

function modelPresent(): boolean {
  return Object.entries(MODEL_FILES).every(([rel, h]) => {
    const f = path.join(OUT, "models", rel);
    return fs.existsSync(f) && sha(f) === h;
  });
}

function fetchModel() {
  fs.mkdirSync(CACHE, { recursive: true });
  const tgz = path.join(CACHE, "ryanstark24-sfgraph-models-1.1.3.tgz");
  if (!fs.existsSync(tgz)) {
    console.log(`lang:vendor: fetching ${PKG} (tarball only)…`);
    execFileSync("npm", ["pack", PKG, "--pack-destination", CACHE, "--silent"], { stdio: ["ignore", "pipe", "inherit"] });
  }
  const tmp = path.join(CACHE, "x");
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  execFileSync("tar", ["xzf", tgz, "-C", tmp]);
  for (const [rel, h] of Object.entries(MODEL_FILES)) {
    const src = path.join(tmp, "package/data", rel);
    if (!fs.existsSync(src)) throw new Error(`lang:vendor: ${rel} is missing from ${PKG}`);
    const got = sha(src);
    if (got !== h) throw new Error(`lang:vendor: checksum mismatch for ${rel} (got ${got}, pinned ${h})`);
    const dst = path.join(OUT, "models", rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

function copyOrt() {
  const dir = path.join(ROOT, "node_modules/onnxruntime-web/dist");
  fs.mkdirSync(path.join(OUT, "ort"), { recursive: true });
  for (const f of fs.readdirSync(path.join(OUT, "ort"))) if (!ORT_FILES.includes(f)) fs.rmSync(path.join(OUT, "ort", f));
  for (const f of ORT_FILES) {
    const src = path.join(dir, f);
    if (!fs.existsSync(src)) throw new Error(`lang:vendor: onnxruntime-web is missing ${f} (npm install)`);
    const dst = path.join(OUT, "ort", f);
    if (!fs.existsSync(dst) || fs.statSync(dst).size !== fs.statSync(src).size) fs.copyFileSync(src, dst);
  }
}

const LICENSE = `# Language model files (public/lang)

Downloaded by \`npm run lang:vendor\`; not committed.

| Files | Source | Licence |
|---|---|---|
| models/${MODEL}/* | sentence-transformers/all-MiniLM-L6-v2, ONNX export by Xenova; vendored via the npm package ${PKG} (MIT wrapper) | Apache-2.0 |
| ort/* | onnxruntime-web (Microsoft) | MIT |

The model only turns text into vectors so a student's words can be compared with a case's
example questions. It never generates text, facts or scores.
`;

function main() {
  const soft = process.argv.includes("--soft");
  try {
    if (!modelPresent()) fetchModel();
    copyOrt();
    fs.writeFileSync(path.join(OUT, "LICENSE.md"), LICENSE);
    console.log("lang:vendor: model and wasm runtime ready in public/lang/");
  } catch (e) {
    const msg = `lang:vendor: ${(e as Error).message}`;
    if (soft) console.warn(`${msg}\n(continuing: run \`npm run lang:vendor\` before building or testing)`);
    else {
      console.error(msg);
      process.exit(1);
    }
  }
}

main();
