/**
 * Display-only rewording of the patient's (deterministic) reply with the optional WebLLM engine.
 * Falls back to the original silently after REPHRASE_TIMEOUT_MS, on any error, or when the guard
 * rejects the rewording. The log and grading always use the original.
 */
import type { ChatEngine } from "./engine";
import { faithful } from "./guard";

export const REPHRASE_TIMEOUT_MS = 4000;

const SYSTEM = `You voice a standardised patient. Rephrase the PATIENT LINE so it sounds natural when spoken, in the first person.
Keep every fact, number, side and "no"/"not" exactly. Do not add symptoms, history, opinions or questions. One or two short sentences. Output only the line.`;

export interface RephraseResult {
  text: string;
  rephrased: boolean;
  reason?: string;
}

export async function rephrase(engine: ChatEngine | null, original: string, timeoutMs = REPHRASE_TIMEOUT_MS): Promise<RephraseResult> {
  if (!engine || !original.trim()) return { text: original, rephrased: false, reason: "off" };
  const ctrl = new AbortController();
  let handle: ReturnType<typeof setTimeout> | undefined;
  const timer = new Promise<never>((_, reject) => {
    handle = setTimeout(() => {
      ctrl.abort();
      reject(new Error("timeout"));
    }, timeoutMs);
  });
  try {
    const out = await Promise.race([engine.complete(SYSTEM, `PATIENT LINE: ${original}`, { maxTokens: 120, signal: ctrl.signal }), timer]);
    const g = faithful(original, out);
    return g.ok ? { text: out, rephrased: true } : { text: original, rephrased: false, reason: g.reason };
  } catch (e) {
    return { text: original, rephrased: false, reason: (e as Error).message };
  } finally {
    clearTimeout(handle);
  }
}
