import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Usage } from "@/domain/schemas";

let client: Anthropic | null = null;

/**
 * AI_MOCK=true → canned responses, no API spend. Also falls back to mock (with a warning)
 * when no API key is configured, so a fresh checkout always runs.
 */
export function isMockMode(): boolean {
  if (process.env.AI_MOCK === "true") return true;
  if (!process.env.ANTHROPIC_API_KEY) {
    if (!warned) console.warn("[ai] ANTHROPIC_API_KEY is not set — using mock responses (set AI_MOCK=true to silence).");
    warned = true;
    return true;
  }
  return false;
}
let warned = false;

/** The only Anthropic client in the app. Server-side only. */
export function getAnthropic(): Anthropic {
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });
  return client;
}

type ApiUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

export function toUsage(u: ApiUsage | null | undefined): Usage {
  return {
    inputTokens: u?.input_tokens ?? 0,
    outputTokens: u?.output_tokens ?? 0,
    cacheReadTokens: u?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u?.cache_creation_input_tokens ?? 0,
  };
}

export const intEnv = (name: string, fallback: number): number => {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
