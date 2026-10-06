/** All model ids live here. Change a model in one place. */
export const MODELS = {
  /** Patient dialogue (streamed, low effort for latency). */
  patient: "claude-sonnet-5-5",
  /** End-of-station grading of `ai` mark-sheet items + narrative feedback. */
  grader: "claude-sonnet-5-5",
  /** Rewording a deterministic finding into a natural sentence. */
  wording: "claude-haiku-4-5-20251001",
  /** Courtesy-tag fallback when the regex pass finds nothing in a long utterance. */
  tagger: "claude-haiku-4-5-20251001",
} as const;

/**
 * Sonnet 5.5 requests opt into server-side refusal fallback: if a safety classifier declines
 * (rare false positives on medical role-play), the API retries on another model in the same call.
 */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01" as const;
