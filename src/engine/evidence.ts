import type { Action, Evidence, PenPayload } from "@/domain/schemas";

/** The PEN as one quotable text (section headings are fixed, so quotes can't straddle sections usefully). */
export function penText(p: PenPayload): string {
  return [`HISTORY:\n${p.history}`, `PHYSICAL EXAMINATION:\n${p.exam}`, `DIAGNOSES:\n${p.diagnoses.map((d, i) => `${i + 1}. ${d.diagnosis}${d.support ? `\n   Supporting: ${d.support}` : ""}`).join("\n")}`].join("\n\n");
}

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
    case "describe_exam":
      return a.payload.text;
    case "submit_pen":
      return penText(a.payload);
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
