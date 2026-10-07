/**
 * NegEx-lite (Phase 4 M1): is a term mentioned as absent in a sentence? Used when grading notes
 * ("no chest pain", "denies fever", "JVP not raised") so a pertinent negative is only credited
 * when the note negates it, and a positive finding isn't credited when the note denies it.
 * Works on normalised text (src/lang/normalize.ts).
 */
import { hasPhrase } from "./normalize";

/** cues before the term ("no …", "denies …") within WINDOW words */
const PRE = ["no", "not", "denies", "denied", "deny", "without", "negative for", "absent", "free of", "never", "nor", "none", "rules out", "ruled out", "no evidence of", "no signs of", "no sign of", "neither"];
/** cues after the term ("… absent", "… not raised") within WINDOW words */
const POST = ["absent", "not present", "not raised", "not elevated", "not seen", "not heard", "not palpable", "not felt", "negative", "denied", "normal", "unremarkable", "none"];
/** words that end the scope of a negation */
const TERMINATE = ["but", "however", "although", "except", "apart from", "aside from", "though", "yet"];
const WINDOW = 5;

function indexOfPhrase(words: string[], phrase: string[]): number {
  for (let i = 0; i + phrase.length <= words.length; i++) if (phrase.every((p, k) => words[i + k] === p)) return i;
  return -1;
}

/** Is `term` (normalised) negated in `sentence` (normalised)? false when the term isn't there. */
export function isNegated(sentence: string, term: string): boolean {
  if (!hasPhrase(sentence, term)) return false;
  const w = sentence.split(" ");
  const t = term.split(" ");
  const at = indexOfPhrase(w, t);
  if (at < 0) return false;
  const before = w.slice(Math.max(0, at - WINDOW), at);
  const cut = Math.max(...TERMINATE.map((x) => before.lastIndexOf(x)));
  const scope = (cut >= 0 ? before.slice(cut + 1) : before).join(" ");
  if (PRE.some((cue) => hasPhrase(scope, cue))) return true;
  const after = w.slice(at + t.length, at + t.length + WINDOW);
  const stop = after.findIndex((x) => TERMINATE.includes(x) || x === "and");
  const postScope = (stop >= 0 ? after.slice(0, stop) : after).join(" ");
  return POST.some((cue) => postScope.startsWith(cue) || hasPhrase(postScope, cue));
}

/** "mentioned and affirmed" / "mentioned and negated" / "not mentioned" */
export function polarityOf(sentence: string, term: string): "affirmed" | "negated" | "absent" {
  if (!hasPhrase(sentence, term)) return "absent";
  return isNegated(sentence, term) ? "negated" : "affirmed";
}

/** Does the sentence contain any negation cue at all? (for similarity matches, where there is no term to anchor on) */
export function hasNegationCue(sentence: string): boolean {
  return [...PRE, ...POST.filter((c) => c !== "normal" && c !== "unremarkable")].some((c) => hasPhrase(sentence, c));
}
