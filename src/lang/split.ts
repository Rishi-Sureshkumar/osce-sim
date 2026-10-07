/**
 * Splits a student's turn into the questions it bundles (Phase 4 M1), so each can be answered:
 * "Any chest pain or fever? And do you smoke?" → ["any chest pain", "any fever", "do you smoke"].
 * Works on normalised text plus the raw text's sentence punctuation. At most MAX_CLAUSES.
 */
import { basicNormalize } from "./normalize";
import { splitSentences } from "./sentences";

export const MAX_CLAUSES = 5;

/** Lead-ins that a list of short noun phrases can share ("any X, Y or Z" → "any X", "any Y", "any Z"). */
const SHARED_LEAD = /^(?:(?:and|also|ok|okay|so|right|alright|now)\s+)*((?:have you (?:had|got|noticed|been having|experienced)|do you (?:have|get|ever get|ever have|suffer from)|did you (?:have|get|notice)|are you (?:having|getting)|any(?:thing like)?|no)\s+(?:any\s+)?)(.+)$/;
const LIST_SEP = /\s*(?:,\s*(?:or|and)?|\bor\b|\band\b|\/)\s*/;
/** words that start a new question inside one sentence ("…, and do you smoke") */
const NEW_QUESTION = /\s+(?:and|also|or)\s+(?=(?:do|does|did|are|is|have|has|can|could|would|will|what|when|where|why|how|who|any)\b)/;
/** "do you drink alcohol or take any drugs": a second verb phrase after a question → its own clause */
const SECOND_VERB = /^((?:do|did|have|are)\s+you\s+.+?)\s+(?:or|and)\s+((?:take|use|smoke|drink|vape|get|feel|notice|have|eat|do)\s+.+)$/;

const MAX_PHRASE_WORDS = 4;

function distribute(clause: string): string[] {
  const m = clause.match(SHARED_LEAD);
  if (!m) return [clause];
  const lead = m[1]!;
  const items = m[2]!.split(LIST_SEP).map((s) => s.trim()).filter(Boolean);
  if (items.length < 2 || items.some((s) => s.split(" ").length > MAX_PHRASE_WORDS)) return [clause];
  return items.map((s) => `${lead}${s}`.trim());
}

/** Raw student text → normalised clauses (each one question or statement). */
export function splitClauses(raw: string, normalize: (t: string) => string = basicNormalize): string[] {
  const sentences = splitSentences(raw);
  const out: string[] = [];
  for (const s of sentences) {
    // keep commas (normalisation drops punctuation): they separate list items
    const n = s
      .split(",")
      .map((x) => normalize(x))
      .filter(Boolean)
      .join(" , ");
    if (!n) continue;
    const parts = n.split(NEW_QUESTION).flatMap((p) => {
      const m = p.trim().match(SECOND_VERB);
      return m ? [m[1]!, m[2]!] : [p];
    });
    for (const part of parts) {
      for (const c of distribute(part.trim())) {
        const clean = c.replace(/\s*,\s*/g, " ").replace(/\s+/g, " ").trim();
        if (clean) out.push(clean);
      }
    }
  }
  // greetings and introductions glued to a question stay separate clauses already; cap the count
  return out.slice(0, MAX_CLAUSES);
}
