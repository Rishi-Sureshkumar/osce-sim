/**
 * Open vs closed questions (Phase 4 M1), for communication feedback ("started with an open
 * question") and the matcher (an open "tell me about…" may volunteer more). Normalised text in.
 */
const OPEN = /^(?:(?:so|ok|okay|and|now|right|alright)\s+)*(?:what|how|tell me|could you tell me|can you tell me|would you tell me|describe|could you describe|can you describe|talk me through|walk me through|explain|in your own words|why|what about)\b/;
const CLOSED = /^(?:(?:so|ok|okay|and|now|right|alright)\s+)*(?:do|does|did|are|is|was|were|have|has|had|can|could|will|would|any|is there|are there)\b/;

export type QuestionType = "open" | "closed" | "statement";

export function questionType(normalized: string, raw = ""): QuestionType {
  if (OPEN.test(normalized)) return "open";
  if (CLOSED.test(normalized) || /\?\s*$/.test(raw)) return "closed";
  return "statement";
}
