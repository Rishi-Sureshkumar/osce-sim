/**
 * Calibration of deterministic grading against labelled transcripts (Phase 4 M1,
 * tests/fixtures/grading). Each transcript becomes a session log the way the live app would write
 * it: every student turn is understood by the same matcher (so patient_say.match.topics feed the
 * history-coverage items), the fixture's patient lines are kept verbatim, and the note becomes a
 * submit_pen. Then every `match` item is graded and compared with the human label.
 * Pure apart from the `embed` function passed in (tests and scripts/lang/calibrate.ts share it).
 */
import type { Action, Case, MarkSheet } from "@/domain/schemas";
import { buildBank, type BankSources } from "./bank";
import { gradeMatchItems } from "./grade";
import type { MatchJudgement } from "./grade/match";
import { candidatesFrom, specFor } from "./grade/match";
import type { Normalizer } from "./normalize";
import { splitClauses } from "./split";
import { askedTopics, understandTurn, type TurnVectors } from "./understand";

export interface LabelledTranscript {
  id: string;
  turns: ({ say: string } | { patient: string })[];
  pen?: { history?: string; exam?: string; diagnoses?: { diagnosis: string; support?: string }[] };
  expect: Record<string, number>;
  half?: Record<string, boolean>;
  borderline?: string[];
}

export interface ItemOutcome {
  transcript: string;
  itemId: string;
  expected: number;
  predicted: number;
  review: boolean;
  borderline: boolean;
  agree: boolean;
  quote: string | null;
  rationale: string;
}

export interface CalibrationReport {
  items: ItemOutcome[];
  /** agreement over items that weren't sent to review (borderline labels excluded) */
  agreement: number;
  /** share of items sent to needs_review */
  reviewRate: number;
  falseCredit: number;
  missedCredit: number;
}

const TURN_MS = 20_000;
/** 0 / 0.5 / 1 bands, so half credit is compared as half credit */
const band = (x: number) => (x >= 0.75 ? 1 : x >= 0.25 ? 0.5 : 0);

export async function transcriptLog(kase: Case, lang: BankSources, tr: LabelledTranscript, embed: (texts: string[]) => Promise<Float32Array[] | null>): Promise<{ log: Action[]; topics: ReturnType<typeof askedTopics> }> {
  const bank = buildBank(kase, lang);
  const says = tr.turns.flatMap((t) => ("say" in t ? [t.say] : []));
  const phrases = [...new Set(bank.targets.flatMap((t) => t.phrases))];
  const clauses = [...new Set(says.flatMap((s) => splitClauses(s, bank.normalize)))];
  const vecs = await embed([...phrases, ...clauses]);
  const pv = new Map(vecs ? phrases.map((p, i) => [p, vecs[i]!] as const) : []);
  const cv = new Map(vecs ? clauses.map((c, i) => [c, vecs[phrases.length + i]!] as const) : []);
  const vectors: TurnVectors | null = vecs ? { phrase: (p: string) => pv.get(p), clause: (c: string) => cv.get(c) } : null;

  const log: Action[] = [];
  let t = 0;
  let n = 0;
  const push = (a: Omit<Action, "id" | "sessionId" | "t">) => log.push({ ...a, id: `${tr.id}-${++n}`, sessionId: tr.id, t } as Action);
  push({ type: "room", source: "click", payload: { event: "enter" } } as Omit<Action, "id" | "sessionId" | "t">);
  let pendingMatch: ReturnType<typeof understandTurn>["reply"]["match"] | null = null;
  for (const turn of tr.turns) {
    t += TURN_MS;
    if ("say" in turn) {
      pendingMatch = understandTurn(kase, bank, log, turn.say, vectors).reply.match;
      push({ type: "say", source: "text", payload: { text: turn.say } } as Omit<Action, "id" | "sessionId" | "t">);
    } else {
      push({ type: "patient_say", source: "system", payload: { text: turn.patient, ...(pendingMatch ? { match: pendingMatch } : {}) } } as Omit<Action, "id" | "sessionId" | "t">);
      pendingMatch = null;
    }
  }
  t += TURN_MS;
  push({ type: "room", source: "click", payload: { event: "exit" } } as Omit<Action, "id" | "sessionId" | "t">);
  if (tr.pen) {
    t += TURN_MS;
    push({ type: "submit_pen", source: "text", payload: { history: tr.pen.history ?? "", exam: tr.pen.exam ?? "", diagnoses: (tr.pen.diagnoses ?? []).map((d) => ({ diagnosis: d.diagnosis, support: d.support ?? "" })) } } as Omit<Action, "id" | "sessionId" | "t">);
  }
  // graded like the server: topics recomputed from the student's own words
  return { log, topics: askedTopics(bank, log, vectors) };
}

export async function calibrate(args: {
  kase: Case;
  lang: BankSources;
  sheets: MarkSheet[];
  transcripts: LabelledTranscript[];
  normalize: Normalizer;
  embed: (texts: string[]) => Promise<Float32Array[] | null>;
}): Promise<CalibrationReport> {
  const items: ItemOutcome[] = [];
  const matchItems = args.sheets.flatMap((s) => s.items.filter((i) => i.scoring === "match"));
  const exemplarTexts = [...new Set(matchItems.flatMap((it) => { const s = specFor(it); return [...s.exemplars, ...s.counterExemplars, ...s.penalties.flatMap((p) => p.exemplars)]; }))];
  for (const tr of args.transcripts) {
    const { log, topics } = await transcriptLog(args.kase, args.lang, tr, args.embed);
    const texts = [...new Set([...candidatesFrom(log, args.normalize).map((c) => c.sentence), ...exemplarTexts])];
    const vecs = await args.embed(texts);
    const byText = new Map(vecs ? texts.map((x, i) => [x, vecs[i]!] as const) : []);
    const judged = new Map<string, MatchJudgement>(gradeMatchItems({ kase: args.kase, sheets: args.sheets, log, check: null, normalize: args.normalize, embed: (x) => byText.get(x) ?? null, topicsBySay: topics }).map((j) => [j.itemId, j]));
    for (const [itemId, label] of Object.entries(tr.expect)) {
      const j = judged.get(itemId);
      if (!j) continue;
      const expected = tr.half?.[itemId] ? 0.5 : label;
      const predicted = band(j.score);
      const review = !!j.review;
      items.push({ transcript: tr.id, itemId, expected, predicted, review, borderline: !!tr.borderline?.includes(itemId), agree: !review && predicted === expected, quote: j.evidence[0]?.quote ?? null, rationale: j.rationale });
    }
  }
  const decided = items.filter((i) => !i.review && !i.borderline);
  return {
    items,
    agreement: decided.length ? decided.filter((i) => i.agree).length / decided.length : 0,
    reviewRate: items.length ? items.filter((i) => i.review).length / items.length : 0,
    falseCredit: decided.filter((i) => i.predicted > i.expected).length,
    missedCredit: decided.filter((i) => i.predicted < i.expected).length,
  };
}
