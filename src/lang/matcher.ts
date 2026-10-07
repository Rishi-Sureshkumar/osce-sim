/**
 * The deterministic matcher (Phase 4 M1): one normalised clause → the bank target it asks for.
 *   1. exact: the clause is one of a target's normalised phrases
 *   2. similarity: cosine to the target's phrase vectors (MiniLM), plus small bonuses for keyword
 *      and pattern hits, case-over-bank priority and recency (follow-ups of the fact just answered)
 *   3. accept the best at ≥ THRESHOLDS.accept with a margin over the runner-up; otherwise nothing
 * Without vectors (model not loaded) it falls back to keywords/patterns alone.
 * Pure: vectors come in through `ctx`, so tests and the dev chat tester can drive it directly.
 */
import { hasPhrase } from "./normalize";
import { cosine } from "./embed/vectors";
import type { MatchBank, Target } from "./bank";
import { THRESHOLDS } from "./thresholds";

export type Via = "exact" | "keyword" | "pattern" | "embedding" | "none";

export interface Scored {
  target: Target;
  /** final score used for the decision */
  score: number;
  cosine: number | null;
  keywordWords: number;
  pattern: boolean;
}

export interface ClauseMatch {
  text: string;
  target: Target | null;
  score: number;
  via: Via;
  /** top candidates (for the coach view and the dev chat tester) */
  top: { id: string; score: number; cosine: number | null }[];
}

export interface MatchContext {
  /** the clause's embedding, if available */
  clauseVector?: Float32Array | null;
  /** embedding of a bank phrase, if available */
  phraseVector?: (phrase: string) => Float32Array | null | undefined;
  /** the fact (target id) the patient answered last */
  lastFactId?: string | null;
}

function keywordWords(clause: string, t: Target): number {
  let n = 0;
  for (const k of t.keywords) if (hasPhrase(clause, k)) n += k.split(" ").length;
  return n;
}

/**
 * Two targets that shouldn't compete for the margin: a fact and its own follow-up, or a case target
 * and a generic history-bank entry on the same topic (the bank only answers what the case doesn't).
 */
const shadows = (caseT: Target, bankT: Target) => bankT.kind === "bank" && caseT.kind !== "bank" && caseT.kind !== "conversation" && bankT.topics.some((x) => caseT.topics.includes(x));
const related = (a: Target, b: Target) => a.parent === b.id || b.parent === a.id || shadows(a, b) || shadows(b, a);

/** "and / also / so / okay…" at the start of a clause carries no meaning for an exact match */
const LEAD = /^(?:(?:and|also|so|ok|okay|alright|right|then|now|um|uh|well|great|thanks|thank you)\s+)+/;

export function scoreTargets(clause: string, bank: MatchBank, ctx: MatchContext = {}): Scored[] {
  const useVectors = !!ctx.clauseVector && !!ctx.phraseVector;
  const out: Scored[] = [];
  for (const t of bank.targets) {
    const kw = keywordWords(clause, t);
    const pattern = t.patterns.some((p) => p.test(clause));
    let cos: number | null = null;
    if (useVectors) {
      for (const p of t.phrases) {
        const v = ctx.phraseVector!(p);
        if (v) cos = Math.max(cos ?? -1, cosine(ctx.clauseVector!, v));
      }
    }
    const recency = ctx.lastFactId && t.parent === ctx.lastFactId ? THRESHOLDS.recencyFollowUp : ctx.lastFactId && t.id === ctx.lastFactId ? THRESHOLDS.recencyFact : 0;
    const bonus = Math.min(THRESHOLDS.keywordMax, kw * THRESHOLDS.keywordPerWord) + (pattern ? THRESHOLDS.pattern : 0) + (t.priority - 1) * THRESHOLDS.priorityStep + recency;
    const score = useVectors ? (cos ?? 0) + bonus : kw + (pattern ? 2 : 0) > 0 ? kw + (pattern ? 2 : 0) + bonus : 0;
    out.push({ target: t, score, cosine: cos, keywordWords: kw, pattern });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** the best-scoring target of a tier, if it clears the thresholds against its own tier's runner-up */
function decide(scored: Scored[]): { best: Scored; via: Via } | null {
  const best = scored[0];
  if (!best || best.score <= 0) return null;
  // two bank entries with the same reply ("No, nothing like that.") don't block each other
  const same = (a: Target, b: Target) => a.kind === "bank" && b.kind === "bank" && JSON.stringify(a.reply) === JSON.stringify(b.reply);
  const rival = scored.find((x) => x.target.id !== best.target.id && !related(x.target, best.target) && !same(x.target, best.target));
  if (best.cosine !== null) {
    if (best.score >= THRESHOLDS.accept && best.score - (rival?.score ?? 0) >= THRESHOLDS.margin) return { best, via: (best.cosine ?? 0) >= THRESHOLDS.accept ? "embedding" : best.pattern ? "pattern" : "keyword" };
    return null;
  }
  // keyword-only fallback: a clear winner with at least one keyword or pattern
  if ((best.keywordWords > 0 || best.pattern) && (!rival || best.score - rival.score >= 0.5)) return { best, via: best.pattern ? "pattern" : "keyword" };
  return null;
}

/**
 * Two tiers: the case (facts, negatives, follow-ups) and the conversation bank first; the generic
 * history bank only when nothing in the first tier is accepted — a bank "No" must never contradict
 * or pre-empt something the case actually says.
 */
export function matchClause(clause: string, bank: MatchBank, ctx: MatchContext = {}): ClauseMatch {
  const top = (list: Scored[]) => list.slice(0, 5).map((s) => ({ id: s.target.id, score: +s.score.toFixed(3), cosine: s.cosine === null ? null : +s.cosine.toFixed(3) }));
  const isBank = (t: Target) => t.kind === "bank";
  const exactAll = bank.exact.get(clause) ?? bank.exact.get(clause.replace(LEAD, "")) ?? [];
  const exactCase = exactAll.filter((t) => !isBank(t));
  const pick = (ts: Target[]) => [...ts].sort((a, b) => b.priority - a.priority)[0]!;
  if (exactCase.length) {
    const t = pick(exactCase);
    return { text: clause, target: t, score: 1, via: "exact", top: [{ id: t.id, score: 1, cosine: null }] };
  }
  const scored = scoreTargets(clause, bank, ctx);
  const first = decide(scored.filter((x) => !isBank(x.target)));
  if (first) return { text: clause, target: first.best.target, score: first.best.score, via: first.via, top: top(scored) };
  if (exactAll.length) {
    const t = pick(exactAll);
    return { text: clause, target: t, score: 1, via: "exact", top: [{ id: t.id, score: 1, cosine: null }] };
  }
  const second = decide(scored.filter((x) => isBank(x.target)));
  if (second) return { text: clause, target: second.best.target, score: second.best.score, via: second.via, top: top(scored) };
  return { text: clause, target: null, score: scored[0]?.score ?? 0, via: "none", top: top(scored) };
}
