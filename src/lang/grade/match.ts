/**
 * Deterministic grading of mark-sheet `match` items (Phase 4 M1). For each item, candidate
 * sentences come verbatim from the student's own words in the log (what they said, the verbal exam
 * descriptions, the post-encounter note). A sentence earns credit by a keyword or pattern hit, or by
 * cosine similarity to the item's exemplars ≥ THRESHOLDS.credit (and closer to them than to any
 * counter-exemplar). [review, credit) → needs_review with the best quote. History-coverage items
 * can also be credited by topic: a question the matcher understood as covering the topic.
 * The quoted sentence is always a verbatim substring, so evidence verification passes.
 */
import type { Action, MarkSheetItem, MatchSource, MatchSpec } from "@/domain/schemas";
import { orderLog } from "@/engine/order";
import type { AiItemJudgement } from "@/engine/scoring";
import { hasPhrase, type Normalizer } from "../normalize";
import { hasNegationCue, isNegated } from "../negation";
import { questionType } from "../question";
import { cosine } from "../embed/vectors";
import { THRESHOLDS } from "../thresholds";
import { splitSentences } from "../sentences";

export interface MatchJudgement extends AiItemJudgement {
  /** similarity in the review band: a coach should look */
  review?: boolean;
}

export interface Candidate {
  actionId: string;
  source: MatchSource;
  /** verbatim sentence from the action's text */
  sentence: string;
  norm: string;
  t: number;
}

export interface GradeContext {
  normalize: Normalizer;
  /** embedding of a text (null if the model isn't available) */
  embed: (text: string) => Float32Array | null;
  patient: { name: string };
  /** history topics each student `say` was understood to cover (from patient_say.match), by say action id, with the (normalised) clauses that asked */
  topicsBySay: Map<string, { topics: string[]; clauses: string[] }>;
  /** first and last physical-contact exam times (ms), for timing windows */
  firstTouchT: number | null;
  lastTouchT: number | null;
  /** the encounter in the room (enter → exit; note-writing time after leaving is outside it) */
  startT: number;
  endT: number;
  /** the student's first few `say` turns (count as "opening" whatever the clock says) */
  earlySayIds?: Set<string>;
}

/** Split text into sentences, keeping the verbatim substrings. */
export const sentences = splitSentences;

/** The student's words in the log, by source, as verbatim sentences. */
export function candidatesFrom(log: readonly Action[], normalize: Normalizer): Candidate[] {
  const out: Candidate[] = [];
  const push = (a: Action, source: MatchSource, text: string) => {
    for (const s of sentences(text)) out.push({ actionId: a.id, source, sentence: s, norm: normalize(s), t: a.t });
  };
  for (const a of orderLog(log)) {
    if (a.type === "say") push(a, "say", a.payload.text);
    else if (a.type === "describe_exam") push(a, "describe_exam", a.payload.text);
    else if (a.type === "interpretation") push(a, "interpretation", a.payload.text);
    else if (a.type === "submit_pen") {
      push(a, "pen_history", a.payload.history);
      push(a, "pen_exam", a.payload.exam);
      // each piece separately, so every quote stays a verbatim substring of the note
      for (const d of a.payload.diagnoses) {
        push(a, "pen_diagnoses", d.diagnosis);
        if (d.support) push(a, "pen_diagnoses", d.support);
      }
    }
  }
  return out;
}

/** The item's effective spec: `match`, else legacy fields (exemplars, mockKeywords, PEN sections → note sources). */
export function specFor(item: MarkSheetItem): MatchSpec {
  const pen = item.section.startsWith("PEN");
  const base: MatchSpec = {
    sources: pen ? ["pen_history", "pen_exam", "pen_diagnoses"] : ["say"],
    keywords: [],
    patterns: [],
    exemplars: [],
    counterExemplars: [],
    topics: [],
    form: "any",
    polarity: "any",
    minMatches: 1,
    window: "any",
    penalties: [],
  };
  const m = item.match;
  return {
    ...base,
    ...(m ?? {}),
    keywords: [...(m?.keywords ?? []), ...(m ? [] : (item.mockKeywords ?? []))],
    exemplars: [...(m?.exemplars ?? []), ...(item.exemplars ?? [])],
  };
}

const fillNames = (s: string, name: string) => {
  const parts = name.split(/\s+/);
  return s.replace(/\{patient\.name\}/g, name).replace(/\{patient\.firstName\}/g, parts[0] ?? name).replace(/\{patient\.lastName\}/g, parts.at(-1) ?? name);
};

function inWindow(c: Candidate, spec: MatchSpec, ctx: GradeContext): boolean {
  switch (spec.window) {
    case "before_first_touch":
      return ctx.firstTouchT === null || c.t <= ctx.firstTouchT;
    case "after_last_touch":
      // no exam at all: closing remarks still count in the last third of the encounter
      return ctx.lastTouchT !== null ? c.t >= ctx.lastTouchT : c.t >= ctx.startT + ((ctx.endT - ctx.startT) * 2) / 3;
    case "first_third":
      return c.t <= ctx.startT + (ctx.endT - ctx.startT) / 3 || (c.source === "say" && !!ctx.earlySayIds?.has(c.actionId));
    case "last_third":
      return c.t >= ctx.startT + ((ctx.endT - ctx.startT) * 2) / 3 && c.t <= ctx.endT;
    default:
      return true;
  }
}

interface Hit {
  c: Candidate;
  score: number;
  via: "keyword" | "pattern" | "exemplar" | "topic";
  detail: string;
}

export function gradeItem(item: MarkSheetItem, all: readonly Candidate[], ctx: GradeContext): MatchJudgement {
  const spec = specFor(item);
  const credit = spec.thresholds?.credit ?? THRESHOLDS.credit;
  const review = spec.thresholds?.review ?? THRESHOLDS.review;
  const keywords = spec.keywords.map((k) => ctx.normalize(fillNames(k, ctx.patient.name))).filter(Boolean);
  const patterns = spec.patterns.flatMap((p) => {
    try {
      return [new RegExp(fillNames(p, ctx.patient.name), "i")];
    } catch {
      return [];
    }
  });
  const exVecs = spec.exemplars.map((e) => ctx.embed(e)).filter((v): v is Float32Array => !!v);
  const counterVecs = spec.counterExemplars.map((e) => ctx.embed(e)).filter((v): v is Float32Array => !!v);

  const cands = all.filter((c) => spec.sources.includes(c.source) && inWindow(c, spec, ctx) && (spec.form === "any" || c.source !== "say" || questionType(c.norm, c.sentence) === spec.form));
  const hits: Hit[] = [];
  let bestReview: Hit | null = null;
  for (const c of cands) {
    const kw = keywords.find((k) => hasPhrase(c.norm, k));
    const pt = patterns.find((p) => p.test(c.sentence) || p.test(c.norm));
    // a negated item: the term must be negated in the sentence, unless the keyword carries its own cue ("denies chest pain")
    if (spec.polarity === "negated" && kw && !hasNegationCue(kw) && !isNegated(c.norm, kw)) continue;
    if (spec.polarity === "affirmed" && kw && isNegated(c.norm, kw)) continue;
    if (kw || pt) {
      hits.push({ c, score: 1, via: kw ? "keyword" : "pattern", detail: kw ? `“${kw}”` : `/${pt!.source}/` });
      continue;
    }
    if (!exVecs.length) continue;
    // similarity has no term to anchor negation on: a negated item needs a negation cue in the sentence, an affirmed one none
    if (spec.polarity === "negated" && !hasNegationCue(c.norm)) continue;
    if (spec.polarity === "affirmed" && hasNegationCue(c.norm)) continue;
    const v = ctx.embed(c.sentence);
    if (!v) continue;
    const sim = Math.max(...exVecs.map((e) => cosine(v, e)));
    const counter = counterVecs.length ? Math.max(...counterVecs.map((e) => cosine(v, e))) : -1;
    if (counter >= sim) continue;
    if (sim >= credit) hits.push({ c, score: sim, via: "exemplar", detail: `similarity ${sim.toFixed(2)}` });
    else if (sim >= review && (!bestReview || sim > bestReview.score)) bestReview = { c, score: sim, via: "exemplar", detail: `similarity ${sim.toFixed(2)}` };
  }
  // history coverage by topic: the student asked a question the matcher filed under the topic
  if (spec.topics.length) {
    for (const [sayId, covered] of ctx.topicsBySay) {
      const topic = spec.topics.find((tp) => covered.topics.includes(tp));
      if (!topic || hits.some((h) => h.c.actionId === sayId)) continue;
      // quote the sentence of that turn that asked (most words shared with the matched clauses)
      const sents = cands.filter((c) => c.source === "say" && c.actionId === sayId);
      const words = new Set(covered.clauses.join(" ").split(" ").filter((w) => w.length > 2));
      const overlap = (c: Candidate) => c.norm.split(" ").filter((w) => words.has(w)).length;
      const best = [...sents].sort((a, b) => overlap(b) - overlap(a))[0];
      if (best && inWindow(best, spec, ctx)) hits.push({ c: best, score: 1, via: "topic", detail: `asked about ${topic}` });
    }
  }
  const distinct = [...new Map(hits.map((h) => [h.c.actionId + h.c.sentence, h])).values()].sort((a, b) => a.c.t - b.c.t);
  if (distinct.length >= spec.minMatches) {
    const used = distinct.slice(0, Math.max(1, spec.minMatches));
    let value = 1;
    const notes: string[] = [];
    for (const p of spec.penalties) {
      const pkw = p.keywords.map((k) => ctx.normalize(k)).filter(Boolean);
      const ppt = p.patterns.flatMap((s) => {
        try {
          return [new RegExp(s, "i")];
        } catch {
          return [];
        }
      });
      const pex = p.exemplars.map((e) => ctx.embed(e)).filter((x): x is Float32Array => !!x);
      const offending = cands.find((c) => pkw.some((k) => hasPhrase(c.norm, k)) || ppt.some((r) => r.test(c.sentence)) || (pex.length && Math.max(...pex.map((e) => cosine(ctx.embed(c.sentence) ?? new Float32Array(1), e))) >= credit));
      if (offending) {
        value = Math.max(0, value - p.value);
        notes.push(`${p.reason} (“${offending.sentence}”)`);
      }
    }
    return {
      itemId: item.id,
      score: value,
      rationale: `Matched ${used.map((h) => h.detail).join(", ")}.${notes.length ? ` Deducted: ${notes.join("; ")}.` : ""}`,
      evidence: used.map((h) => ({ actionId: h.c.actionId, quote: h.c.sentence })),
    };
  }
  if (bestReview) {
    return {
      itemId: item.id,
      score: 0,
      review: true,
      rationale: `Possible match (${bestReview.detail}), below the credit threshold ${credit}: a coach should decide.`,
      evidence: [{ actionId: bestReview.c.actionId, quote: bestReview.c.sentence }],
    };
  }
  return { itemId: item.id, score: 0, rationale: "No matching words in the student's own words.", evidence: [] };
}
