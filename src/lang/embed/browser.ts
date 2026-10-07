"use client";
/**
 * Sentence embeddings in the student's browser (Phase 4 M1): the same MiniLM model as the server,
 * from /lang/models with the onnxruntime-web wasm in /lang/ort (npm run lang:vendor). Nothing is
 * downloaded until `warmUp()` (first focus of the chat box, or idle time). Chat never waits for it:
 * until the model is ready the server embeds instead. The vectors only help pick which fixed reply
 * the patient gives; grading always re-embeds on the server.
 */
import { EMBED_DIMS, EMBED_MODEL, l2normalize } from "./vectors";

type Extractor = (texts: string[], opts: { pooling: "mean"; normalize: boolean }) => Promise<{ data: Float32Array }>;

let state: "idle" | "loading" | "ready" | "failed" = "idle";
let extractor: Extractor | null = null;
let loading: Promise<void> | null = null;

export function embedderState() {
  return state;
}

/** Start loading the model (idempotent). */
export function warmUp(): Promise<void> {
  if (loading) return loading;
  state = "loading";
  loading = (async () => {
    try {
      const t = await import("@huggingface/transformers");
      t.env.allowRemoteModels = false;
      t.env.allowLocalModels = true;
      t.env.localModelPath = "/lang/models/";
      const wasm = t.env.backends.onnx.wasm;
      if (wasm) {
        // the plain CPU build (14 MB); without this ORT asks for the 27 MB asyncify (WebGPU-capable) build
        wasm.wasmPaths = { mjs: "/lang/ort/ort-wasm-simd-threaded.mjs", wasm: "/lang/ort/ort-wasm-simd-threaded.wasm" };
        wasm.numThreads = 1; // no cross-origin isolation needed
        wasm.proxy = false;
      }
      extractor = (await t.pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8", device: "wasm" })) as unknown as Extractor;
      state = "ready";
    } catch (e) {
      console.info("[lang] in-browser embeddings unavailable; the server will embed instead:", (e as Error).message);
      state = "failed";
    }
  })();
  return loading;
}

/** Clause vectors if the model is ready now; null otherwise (never waits for a download). */
export async function embedClausesNow(clauses: string[]): Promise<{ model: string; clauses: { text: string; vector: number[] }[] } | null> {
  if (state !== "ready" || !extractor || !clauses.length) return null;
  try {
    const res = await extractor(clauses, { pooling: "mean", normalize: true });
    return {
      model: EMBED_MODEL,
      clauses: clauses.map((text, k) => ({ text, vector: Array.from(l2normalize(res.data.subarray(k * EMBED_DIMS, (k + 1) * EMBED_DIMS)), (x) => Math.round(x * 1e5) / 1e5) })),
    };
  } catch {
    return null;
  }
}
