/**
 * Courtesy tags for a student utterance. A keyword/regex pass runs first; the matched words are
 * stored verbatim as evidence. The similarity fallback (src/lang/tags.ts) is called from chat.ts.
 * Pure — no server-only imports — so it is unit-tested directly.
 */
import type { CourtesyTag, Position, TagHit } from "@/domain/schemas";

/** A request lead-in: "could you (please)", "please", "I'd like you to", or the start of a sentence. */
const LEAD = String.raw`(?:^|[.!?]\s+|\b(?:could|can|would|will) you (?:please |just |now |kindly )?|\bplease,? (?:could you |can you )?|\b(?:i'?d like|i want|i need) you to |\bnow,? |\bfor me,? )`;
function req(verb: RegExp): RegExp {
  // …and not a symptom question that happens to start like one ("can you lie flat at night?")
  return new RegExp(LEAD + verb.source + String.raw`(?![^.?!]*\b(?:at night|without|whenever|how long|ever|breathless|short of breath|pain|hurt)\b)`, "i");
}

interface Pattern {
  tag: CourtesyTag;
  re: RegExp;
  position?: Position;
}

const P: Pattern[] = [
  { tag: "introduced_name", re: /\b(my name is|my name's|i'm called|this is dr\.?)\s+[A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)?/ },
  { tag: "introduced_name", re: /\b(?:hi|hello|good (?:morning|afternoon|evening))[,!.]?\s+(?:[^.?!]*?\b)?i'?m\s+[A-Z][a-z'-]+/i },
  { tag: "stated_role", re: /\b(?:i'?m|i am)\s+(?:a|an|one of the|the)\s+(?:\w+\s){0,2}(?:medical students?|student doctors?|doctor|physician|resident|clinician)\b/i },
  { tag: "stated_role", re: /\b(?:medical students?|student doctors?)\b/i },
  { tag: "confirmed_patient_identity", re: /\b(?:can you|could you|would you) (?:please )?(?:tell|confirm|give) me your (?:full )?name\b|\bdate of birth\b|\bare you (?:mr|mrs|ms|miss|mx)\.?\s+[A-Z][a-z]+/i },
  { tag: "asked_consent_exam", re: /\b(?:is it (?:ok(?:ay)?|alright|all right)|would it be (?:ok(?:ay)?|alright)|do i have your (?:permission|consent)|may i|can i|would you mind if i)\b[^.?!]{0,40}\b(?:examine|exam|examination|listen|take a look|check|feel|press|touch)\b/i },
  { tag: "explained_procedure", re: /\b(?:i'?m going to|i am going to|i'?ll|i will|next i'?ll|now i'?m going to)\s+(?:\w+\s){0,3}(?:listen|examine|feel|press|check|look|shine|tap|place|put)\b[^.?!]*/i },
  { tag: "asked_comfort", re: /\b(?:are you|is that|are you feeling) (?:comfortable|ok(?:ay)?|alright|all right)\b|\blet me know if (?:anything|it) (?:hurts|is uncomfortable)\b|\bany (?:pain|discomfort) when i\b/i },
  { tag: "offered_questions", re: /\b(?:do you have|have you got|any) (?:any )?(?:other )?questions\b|\bis there anything else\b|\banything else (?:you'?d like|you want|i can)\b/i },
  { tag: "closing", re: /\b(?:thank you(?: very much)?(?: for (?:your time|letting me|seeing me))|goodbye|good bye|take care|it was (?:nice|a pleasure) (?:to meet|meeting) you|see you (?:soon|later))\b/i },
  // spoken positioning requests: only as a request ("could you…", "please…", or an imperative
  // sentence), never in a question about symptoms ("do you get breathless when you lie flat?")
  { tag: "requested_position", re: req(/(?:sit (?:up|upright|forward)|sit back up)\b/), position: "seated" },
  { tag: "requested_position", re: req(/lean (?:forward|forwards)\b/), position: "seated_leaning_forward" },
  { tag: "requested_position", re: req(/(?:lie|lay) (?:flat|down|back flat)\b/), position: "supine" },
  { tag: "requested_position", re: req(/(?:lie|lay|recline|sit) back\b[^.?!]{0,30}\b45\b/), position: "reclined_45" },
  { tag: "requested_position", re: req(/(?:lie|lay|recline) back\b(?![^.?!]{0,30}\b45\b)/), position: "reclined_30" },
  { tag: "requested_position", re: req(/(?:roll|turn) (?:over )?(?:onto|on to|to) your left(?: side)?\b/), position: "left_lateral_decubitus" },
  { tag: "requested_position", re: req(/stand up\b/), position: "standing" },
];

/** Regex/keyword pass. One hit per tag (the first match), evidence = the exact matched words. */
export function regexTags(text: string): TagHit[] {
  const out: TagHit[] = [];
  for (const p of P) {
    if (out.some((h) => h.tag === p.tag)) continue;
    const m = text.match(p.re);
    if (m) out.push({ tag: p.tag, evidence: m[0].trim(), via: "regex", ...(p.position ? { position: p.position } : {}) });
  }
  return out;
}

/** Words that suggest courtesy content the regexes may have missed (gate for the similarity fallback). */
const CUES = /\b(name|student|doctor|exam\w*|listen\w*|comfortable|questions|bye|thank|sit|lie|lay|roll|lean|consent|okay if|alright if|permission|mind if)\b/i;

export function needsFallback(text: string, hits: TagHit[]): boolean {
  return hits.length === 0 && text.trim().length >= 20 && CUES.test(text);
}
