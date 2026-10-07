/**
 * Faithfulness guard for optional in-browser rewording (Phase 4 M1, WebLLM). A rewording is shown
 * only if it keeps every number, side, negation and content word of the original and isn't much
 * longer. The log always keeps the original text; this only decides what is displayed.
 */
import { basicNormalize } from "../normalize";

const NEGATIONS = ["no", "not", "never", "none", "nothing", "without", "denies", "deny", "cannot", "neither", "nor"];
const STOP = new Set(["a", "an", "the", "and", "or", "of", "to", "in", "on", "at", "for", "with", "is", "are", "was", "were", "be", "been", "i", "you", "it", "my", "your", "this", "that", "just", "so", "very", "really", "bit", "about", "as", "by", "from", "have", "has", "had", "do", "did", "does", "am", "me", "we", "he", "she", "they", "them", "there", "here", "some", "any", "all", "also", "but", "if", "then", "now", "like", "well", "um", "uh"]);

export interface GuardResult {
  ok: boolean;
  reason?: string;
}

export function faithful(original: string, rewording: string): GuardResult {
  if (!rewording.trim()) return { ok: false, reason: "empty" };
  if (rewording.length > original.length * 1.8 + 40) return { ok: false, reason: "too long" };
  const a = basicNormalize(original);
  const b = basicNormalize(rewording);
  const nums = (s: string) => new Set(s.match(/\d+(?:\.\d+)?/g) ?? []);
  const na = nums(a);
  const nb = nums(b);
  for (const n of nb) if (!na.has(n)) return { ok: false, reason: `new number ${n}` };
  for (const n of na) if (!nb.has(n)) return { ok: false, reason: `dropped number ${n}` };
  const sides = (s: string) => new Set(s.match(/\b(left|right|both|bilateral)\b/g) ?? []);
  const sa = sides(a);
  for (const x of sides(b)) if (!sa.has(x)) return { ok: false, reason: `new side ${x}` };
  for (const x of sa) if (!sides(b).has(x)) return { ok: false, reason: `dropped side ${x}` };
  const negs = (s: string) => s.split(" ").filter((w) => NEGATIONS.includes(w)).length;
  if ((negs(a) > 0) !== (negs(b) > 0)) return { ok: false, reason: "negation changed" };
  // most content words must survive (rewording may change function words and order)
  const content = [...new Set(a.split(" ").filter((w) => w.length > 2 && !STOP.has(w)))];
  const kept = content.filter((w) => b.split(" ").some((x) => x === w || x.startsWith(w.slice(0, 5))));
  if (content.length && kept.length / content.length < 0.6) return { ok: false, reason: "content words dropped" };
  // and it may not add many new content words (no new facts)
  const added = [...new Set(b.split(" ").filter((w) => w.length > 3 && !STOP.has(w) && !a.split(" ").some((x) => x.startsWith(w.slice(0, 5)) || w.startsWith(x.slice(0, 5)))))];
  if (added.length > Math.max(3, content.length * 0.4)) return { ok: false, reason: `new words: ${added.slice(0, 4).join(", ")}` };
  return { ok: true };
}

/** Phase 3's finding guard, kept for findings (numbers and sides only). */
export function passesWordingGuard(raw: string, worded: string): boolean {
  if (!worded || worded.length > raw.length * 3 + 80) return false;
  const nums = (s: string) => new Set(s.match(/\d+(\.\d+)?/g) ?? []);
  const rawNums = nums(raw);
  for (const n of nums(worded)) if (!rawNums.has(n)) return false;
  const sides = (s: string) => new Set((s.toLowerCase().match(/\b(left|right|bilateral(ly)?)\b/g) ?? []).map((x) => x.replace("bilaterally", "bilateral")));
  const rawSides = sides(raw);
  for (const s of sides(worded)) if (!rawSides.has(s)) return false;
  return true;
}
