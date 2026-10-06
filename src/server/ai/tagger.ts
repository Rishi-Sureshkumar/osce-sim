import "server-only";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { CourtesyTag, Position, type TagHit, type Usage } from "@/domain/schemas";
import { normalizeForQuote } from "@/engine/evidence";
import { getAnthropic, isMockMode, toUsage } from "./client";
import { MODELS } from "./models";

const TaggerOutput = z.object({
  tags: z.array(z.object({ tag: CourtesyTag, evidence: z.string(), position: Position.nullable() })),
});

const SYSTEM = `You label one thing a medical student said to a standardised patient during a physical exam.
Possible tags:
- introduced_name: the student says their own name
- stated_role: the student says they are a medical student / doctor
- confirmed_patient_identity: asks the patient's name or date of birth
- asked_consent_exam: asks permission to examine
- explained_procedure: tells the patient what they are about to do
- asked_comfort: checks the patient is comfortable or in pain
- offered_questions: invites the patient's questions
- closing: says goodbye or thanks the patient at the end
- requested_position: asks the patient to change position (give position: seated, seated_leaning_forward, supine, reclined_30, reclined_45, left_lateral_decubitus or standing; otherwise null)
Only tag what is clearly said. For each tag give evidence: a short span copied character-for-character from the utterance. Return an empty list if nothing applies.`;

/**
 * Model fallback for courtesy tags. Quotes are checked against the utterance; a tag whose evidence
 * isn't verbatim is dropped. Mock mode, errors and timeouts return no tags (the regex pass stands).
 */
export async function modelTags(text: string): Promise<{ tags: TagHit[]; usage: Usage | null }> {
  if (isMockMode()) return { tags: [], usage: null };
  try {
    const msg = await getAnthropic().beta.messages.parse(
      {
        model: MODELS.tagger,
        max_tokens: 400,
        output_config: { format: betaZodOutputFormat(TaggerOutput) },
        system: SYSTEM,
        messages: [{ role: "user", content: `UTTERANCE: ${text}` }],
      },
      { timeout: 5000, maxRetries: 0 },
    );
    const out = msg.parsed_output;
    if (!out) return { tags: [], usage: toUsage(msg.usage) };
    return { tags: verifiedTags(text, out.tags), usage: toUsage(msg.usage) };
  } catch (e) {
    console.warn("[ai] tagger failed, keeping regex tags:", (e as Error).message);
    return { tags: [], usage: null };
  }
}

export function verifiedTags(text: string, raw: { tag: CourtesyTag; evidence: string; position: Position | null }[]): TagHit[] {
  const hay = normalizeForQuote(text).toLowerCase();
  const out: TagHit[] = [];
  for (const r of raw) {
    const q = normalizeForQuote(r.evidence).toLowerCase();
    if (!q || !hay.includes(q) || out.some((h) => h.tag === r.tag)) continue;
    if (r.tag === "requested_position" && !r.position) continue;
    out.push({ tag: r.tag, evidence: r.evidence, via: "model", ...(r.tag === "requested_position" && r.position ? { position: r.position } : {}) });
  }
  return out;
}
