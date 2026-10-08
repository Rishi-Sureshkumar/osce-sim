/**
 * Sentence embeddings on the server / in Node scripts and tests (Phase 4 M1): the same MiniLM model
 * the browser uses, run with onnxruntime-node from the vendored files in public/lang/models
 * (npm run lang:vendor). Never fetches anything. Returns null when the model isn't available, so
 * callers fall back to keyword matching.
 */
import path from "node:path";
import fs from "node:fs";
import { EMBED_DIMS, l2normalize } from "./vectors";

type Extractor = (texts: string[], opts: { pooling: "mean"; normalize: boolean }) => Promise<{ data: Float32Array; dims: number[] }>;

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
let loading: Promise<Extractor | null> | null = null;

export function modelDir(): string {
  return path.join(process.cwd(), "public/lang/models");
}

export function modelAvailable(): boolean {
  return fs.existsSync(path.join(modelDir(), MODEL_ID, "onnx/model_quantized.onnx"));
}

async function load(): Promise<Extractor | null> {
  if (!modelAvailable()) {
    console.warn("[lang] embedding model not found in public/lang/models (run npm run lang:vendor); using keywords only");
    return null;
  }
  try {
    const t = await import("@huggingface/transformers");
    t.env.allowRemoteModels = false;
    t.env.allowLocalModels = true;
    t.env.localModelPath = modelDir() + path.sep;
    const extractor = await t.pipeline("feature-extraction", MODEL_ID, { dtype: "q8", device: "cpu" });
    return extractor as unknown as Extractor;
  } catch (e) {
    console.warn("[lang] could not load the embedding model; using keywords only:", (e as Error).message);
    return null;
  }
}

function extractor(): Promise<Extractor | null> {
  loading ??= load();
  return loading;
}

/** Embeds texts (L2-normalised, 384-d). null if the model is unavailable or inference fails (callers use keywords). */
export async function embedTexts(texts: string[], batch = 32): Promise<Float32Array[] | null> {
  const ex = await extractor();
  if (!ex) return null;
  if (!texts.length) return [];
  try {
    const out: Float32Array[] = [];
    for (let i = 0; i < texts.length; i += batch) {
      const chunk = texts.slice(i, i + batch);
      const res = await ex(chunk, { pooling: "mean", normalize: true });
      for (let k = 0; k < chunk.length; k++) out.push(l2normalize(res.data.subarray(k * EMBED_DIMS, (k + 1) * EMBED_DIMS)));
    }
    return out;
  } catch (e) {
    console.warn("[lang] embedding failed; using keywords only for this request:", (e as Error).message);
    return null;
  }
}

export async function embedOne(text: string): Promise<Float32Array | null> {
  return (await embedTexts([text]))?.[0] ?? null;
}
