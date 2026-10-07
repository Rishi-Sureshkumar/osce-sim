import "server-only";
/**
 * Courtesy-tag fallback (Phase 4 M1; replaces the model tagger). When the regex pass
 * (src/server/tags.ts) finds nothing but the words suggest courtesy, each sentence is compared with
 * example phrasings; a close match tags it, and the evidence is that sentence verbatim. Positioning
 * requests are left to the regexes (they need the exact position).
 */
import type { CourtesyTag, TagHit } from "@/domain/schemas";
import { needsFallback } from "@/server/tags";
import { sentences } from "./grade/match";
import { embedTexts } from "./embed/node";
import { cosine } from "./embed/vectors";

const MIN_SIMILARITY = 0.72;

const EXAMPLES: Partial<Record<CourtesyTag, string[]>> = {
  introduced_name: ["My name is Alex.", "I'm Alex, nice to meet you.", "Hi there, Alex here."],
  stated_role: ["I'm a first-year medical student.", "I'm one of the medical students working with the team today.", "I'm a student doctor."],
  confirmed_patient_identity: ["Can you tell me your full name please?", "Could you confirm your name and date of birth?", "Just to check, what's your name?"],
  asked_consent_exam: ["Would it be okay if I examined you now?", "Do I have your permission to have a look at your chest?", "Is it alright if I listen to your heart?", "Are you happy for me to examine you?"],
  explained_procedure: ["I'm going to listen to your heart now.", "Next I'll press gently on your tummy.", "Now I'm going to check the pulses in your feet."],
  asked_comfort: ["Are you comfortable like that?", "Let me know if anything hurts.", "Is that okay for you, not too sore?", "Tell me if you need a break."],
  offered_questions: ["Do you have any questions for me?", "Is there anything you'd like to ask?", "Anything I can explain for you?"],
  closing: ["Thank you so much for your time today.", "It was nice meeting you, take care.", "Thanks for letting me examine you, goodbye."],
  shared_impression: ["From what you've told me and what I found, I think your heart isn't pumping as well as it should.", "My impression is that this could be your heart failure getting worse.", "I think the swelling and breathlessness are probably from fluid building up."],
};

let exampleVecs: Promise<{ tag: CourtesyTag; v: Float32Array }[] | null> | null = null;
function examples() {
  exampleVecs ??= (async () => {
    const list = Object.entries(EXAMPLES).flatMap(([tag, xs]) => xs!.map((x) => ({ tag: tag as CourtesyTag, x })));
    const vs = await embedTexts(list.map((l) => l.x));
    return vs ? list.map((l, i) => ({ tag: l.tag, v: vs[i]! })) : null;
  })();
  return exampleVecs;
}

export async function courtesyFallbackTags(text: string): Promise<TagHit[]> {
  if (!needsFallback(text, [])) return [];
  const ex = await examples();
  if (!ex) return [];
  const sents = sentences(text);
  const vs = await embedTexts(sents);
  if (!vs) return [];
  const out: TagHit[] = [];
  sents.forEach((s, i) => {
    const best = new Map<CourtesyTag, number>();
    for (const e of ex) best.set(e.tag, Math.max(best.get(e.tag) ?? 0, cosine(vs[i]!, e.v)));
    for (const [tag, sim] of best) if (sim >= MIN_SIMILARITY && !out.some((h) => h.tag === tag)) out.push({ tag, evidence: s, via: "similarity" });
  });
  return out;
}
