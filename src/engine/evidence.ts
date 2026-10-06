import type { Action, Evidence } from "@/domain/schemas";

/** Normalise only typography and whitespace — wording must still match exactly. */
export function normalizeForQuote(s: string): string {
  return s
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** Text of an action that a grader is allowed to quote from. */
export function quotableText(a: Action): string | null {
  switch (a.type) {
    case "say":
    case "patient_say":
    case "note":
      return a.payload.text;
    case "submit_ddx":
      return [a.payload.summary, ...a.payload.differential, a.payload.plan].join("\n");
    default:
      return null;
  }
}

/**
 * INVARIANT: an AI-scored item only counts if every quote appears verbatim in the action it cites.
 * Returns the evidence with `verified` set.
 */
export function verifyEvidence(evidence: { actionId: string; quote: string }[], log: Action[]): Evidence[] {
  const byId = new Map(log.map((a) => [a.id, a]));
  return evidence.map((e) => {
    const action = byId.get(e.actionId);
    const text = action ? quotableText(action) : null;
    const quote = normalizeForQuote(e.quote);
    const verified = !!text && quote.length > 0 && normalizeForQuote(text).includes(quote);
    return { actionId: e.actionId, quote: e.quote, verified };
  });
}
