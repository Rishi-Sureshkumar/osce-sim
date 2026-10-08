/**
 * Optional in-browser language model (Phase 4 M1, off by default): WebLLM, used ONLY to reword
 * text that the deterministic layer has already chosen (the patient's reply, for display) and to
 * give coaches an advisory second opinion on needs-review items. It never picks a fact, finding or
 * score, and the log keeps the original text. Loaded only when "Enhanced patient" is on and the
 * browser has WebGPU; tests use FakeEngine.
 */
export interface ChatEngine {
  /** one completion; resolves to the model's text */
  complete(system: string, user: string, opts?: { maxTokens?: number; signal?: AbortSignal }): Promise<string>;
  readonly modelId: string;
}

/** The model we load (small, instruction-tuned). Size shown to the user before downloading. */
export const WEBLLM_MODEL = { id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", downloadMB: 945, license: "Apache-2.0" } as const;

export function hasWebGPU(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator && !!(navigator as Navigator & { gpu?: unknown }).gpu;
}

/** WebGPU with a usable adapter (call after mount: it is false during server rendering). */
export async function webGPUUsable(): Promise<boolean> {
  if (!hasWebGPU()) return false;
  try {
    const gpu = (navigator as Navigator & { gpu: { requestAdapter(): Promise<unknown> } }).gpu;
    return !!(await gpu.requestAdapter());
  } catch {
    return false;
  }
}

/** Loads WebLLM on demand (a separate chunk; nothing is downloaded until this is called). */
export async function loadWebLLM(onProgress?: (fraction: number, text: string) => void): Promise<ChatEngine> {
  if (!(await webGPUUsable())) throw new Error("This browser has no usable WebGPU, so the in-browser model isn't available.");
  const webllm = await import("@mlc-ai/web-llm");
  const engine = await webllm.CreateMLCEngine(WEBLLM_MODEL.id, { initProgressCallback: (r) => onProgress?.(r.progress, r.text) });
  return {
    modelId: WEBLLM_MODEL.id,
    async complete(system, user, opts) {
      // a timed-out rewording must stop generating, or later requests queue behind it
      opts?.signal?.addEventListener("abort", () => engine.interruptGenerate(), { once: true });
      const res = await engine.chat.completions.create({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: opts?.maxTokens ?? 120,
        temperature: 0.3,
      });
      return res.choices[0]?.message?.content?.trim() ?? "";
    },
  };
}

/** Test double: answers from a function, optionally slowly or by failing. */
export class FakeEngine implements ChatEngine {
  readonly modelId = "fake";
  constructor(
    private reply: (system: string, user: string) => string | Promise<string>,
    private opts: { delayMs?: number; fail?: boolean } = {},
  ) {}
  async complete(system: string, user: string, o?: { signal?: AbortSignal }): Promise<string> {
    if (this.opts.delayMs) {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, this.opts.delayMs);
        o?.signal?.addEventListener("abort", () => {
          clearTimeout(t);
          reject(new Error("aborted"));
        });
      });
    }
    if (this.opts.fail) throw new Error("engine failed");
    return this.reply(system, user);
  }
}
