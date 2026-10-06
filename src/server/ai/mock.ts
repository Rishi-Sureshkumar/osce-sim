import type { Action, Case, MarkSheet } from "@/domain/schemas";
import { normalizeForQuote, quotableText } from "@/engine/evidence";
import type { AiItemJudgement } from "@/engine/scoring";
import { orderLog } from "@/engine/order";

const norm = (s: string) => normalizeForQuote(s).toLowerCase();

/**
 * Deterministic stand-in for the patient (AI_MOCK=true). Matches the question against case-fact
 * keywords so builders can test the full flow with realistic answers and zero API spend.
 */
export function mockPatientReply(c: Case, question: string, turnIndex: number): string {
  const q = norm(question);
  if (turnIndex === 0 || /what brings you|how can i help|what can i do for you|why are you here|what's going on|what is going on/.test(q)) {
    if (!/\?/.test(question) && turnIndex === 0 && /^(hi|hello|good (morning|afternoon|evening))/.test(q) && !/brings|help/.test(q)) {
      return `Hello. ${c.history.openingStatement}`;
    }
    return c.history.openingStatement;
  }
  // strongest match wins: total length of matched keywords
  const strength = (keywords?: string[]) => (keywords ?? []).reduce((n, k) => (q.includes(norm(k)) ? n + k.length : n), 0);
  const best = [...c.history.facts.map((f) => ({ answer: f.answer, s: strength(f.keywords) })), ...c.history.pertinentNegatives.map((n) => ({ answer: n.answer, s: strength(n.keywords) }))]
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)[0];
  if (best) return best.answer;
  if (/examine|listen|take a look|feel your|press on|ok if i|okay if i/.test(q)) return "Sure, go ahead.";
  if (/thank/.test(q)) return "Thank you.";
  return c.history.unknownPolicy.unknownReply;
}

/**
 * Deterministic stand-in grader. For each `ai` item, the first student utterance (or submission)
 * containing one of the item's mockKeywords is quoted verbatim as evidence → score 1; else 0.
 */
export function mockJudgements(sheet: MarkSheet, log: Action[]): AiItemJudgement[] {
  const quotable = orderLog(log).filter((a) => a.type === "say" || a.type === "submit_ddx");
  return sheet.items
    .filter((i) => i.scoring === "ai")
    .map((item) => {
      for (const a of quotable) {
        const text = quotableText(a) ?? "";
        const lower = text.toLowerCase().replace(/[‘’]/g, "'");
        for (const kw of item.mockKeywords ?? []) {
          const k = kw.toLowerCase().replace(/[‘’]/g, "'");
          const idx = lower.indexOf(k);
          if (idx >= 0) {
            const quote = sentenceAround(text, idx);
            return { itemId: item.id, score: 1, rationale: `[mock] Found "${kw}" in the student's words.`, evidence: [{ actionId: a.id, quote }] };
          }
        }
      }
      return { itemId: item.id, score: 0, rationale: "[mock] No matching phrase found in the transcript.", evidence: [] };
    });
}

function sentenceAround(text: string, idx: number): string {
  const start = Math.max(0, text.lastIndexOf(".", idx) + 1, text.lastIndexOf("?", idx) + 1, text.lastIndexOf("\n", idx) + 1);
  const ends = [".", "?", "!", "\n"].map((c) => text.indexOf(c, idx)).filter((i) => i >= 0);
  const end = ends.length ? Math.min(...ends) + 1 : text.length;
  return text.slice(start, end).trim();
}
