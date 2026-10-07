/**
 * Deterministic grading of every `match` item of a session (Phase 4 M1): replaces the model grader.
 *  - generic items: src/lang/grade/match.ts (keywords / patterns / exemplar similarity / topics)
 *  - note exam items: the quoted claim must not be one the note cross-check flagged as unperformed
 *  - diagnosis justification: every listed diagnosis needs supporting findings drawn from the case's
 *    key (terms of the history and exam points the student documented)
 */
import { orderLog } from "@/engine/order";
import type { Action, Case, MarkSheet } from "@/domain/schemas";
import type { PenCheckResult } from "@/engine/penCheck";
import { PEN_JUSTIFICATION_ITEM } from "@/engine/penItems";
import { hasPhrase, type Normalizer } from "../normalize";
import { candidatesFrom, gradeItem, type GradeContext, type MatchJudgement } from "./match";

export interface GradeArgs {
  kase: Case;
  sheets: MarkSheet[];
  log: Action[];
  check: PenCheckResult | null;
  normalize: Normalizer;
  embed: GradeContext["embed"];
}

function touchTimes(log: readonly Action[]): { first: number | null; last: number | null } {
  const ts = log.filter((a) => a.type === "examine" && a.payload.touch !== false).map((a) => a.t);
  return { first: ts.length ? Math.min(...ts) : null, last: ts.length ? Math.max(...ts) : null };
}

/** history topics each student `say` was understood to cover (the patient_say that answered it), with the clauses that asked */
function topicsBySay(log: readonly Action[]): GradeContext["topicsBySay"] {
  const out: GradeContext["topicsBySay"] = new Map();
  let lastSay: string | null = null;
  for (const a of orderLog(log)) {
    if (a.type === "say") lastSay = a.id;
    else if (a.type === "patient_say" && lastSay && a.payload.match) {
      const prev = out.get(lastSay) ?? { topics: [], clauses: [] };
      const asked = a.payload.match.clauses.filter((c) => c.kind !== "conversation" && c.kind !== "unknown" && c.text !== "(volunteered)").map((c) => c.text);
      out.set(lastSay, { topics: [...prev.topics, ...a.payload.match.topics], clauses: [...prev.clauses, ...asked] });
    }
  }
  return out;
}

function justification(args: GradeArgs): MatchJudgement {
  const pen = args.log.findLast((a): a is Extract<Action, { type: "submit_pen" }> => a.type === "submit_pen");
  if (!pen || !pen.payload.diagnoses.length) return { itemId: PEN_JUSTIFICATION_ITEM, score: 0, rationale: "No diagnoses in the note.", evidence: [] };
  const terms = [...(args.kase.penKey?.history ?? []), ...(args.kase.penKey?.exam ?? [])].flatMap((k) => [...k.terms, ...k.keywords]).map((t) => args.normalize(t)).filter((t) => t.length > 1);
  const listed = pen.payload.diagnoses.filter((d) => d.diagnosis.trim());
  const supported = listed.filter((d) => d.support && terms.some((t) => hasPhrase(args.normalize(d.support!), t)));
  const evidence = supported.map((d) => ({ actionId: pen.id, quote: d.support! }));
  if (supported.length === listed.length) return { itemId: PEN_JUSTIFICATION_ITEM, score: 1, rationale: `Every listed diagnosis cites findings from the case (${supported.length}/${listed.length}).`, evidence };
  if (supported.length > 0) return { itemId: PEN_JUSTIFICATION_ITEM, score: 0.5, rationale: `${supported.length} of ${listed.length} diagnoses cite findings from the case; the others have thin or no support.`, evidence };
  return { itemId: PEN_JUSTIFICATION_ITEM, score: 0, rationale: "No listed diagnosis cites a history or exam finding from the case.", evidence: [] };
}

/** Enter → exit of the room (falls back to the first and last spoken or exam action). */
export function encounterSpan(log: readonly Action[]): { startT: number; endT: number } {
  const ordered = orderLog(log);
  const live = ordered.filter((a) => a.type === "say" || a.type === "patient_say" || a.type === "examine");
  const enter = ordered.find((a) => a.type === "room" && a.payload.event === "enter");
  const exit = ordered.findLast((a) => a.type === "room" && a.payload.event === "exit");
  const startT = enter?.t ?? live[0]?.t ?? 0;
  const endT = exit?.t ?? live.at(-1)?.t ?? startT;
  return { startT, endT: Math.max(endT, startT + 1) };
}

export function gradeMatchItems(args: GradeArgs): MatchJudgement[] {
  const cands = candidatesFrom(args.log, args.normalize);
  const touch = touchTimes(args.log);
  const ctx: GradeContext = {
    normalize: args.normalize,
    embed: args.embed,
    patient: { name: args.kase.patient.name },
    topicsBySay: topicsBySay(args.log),
    firstTouchT: touch.first,
    lastTouchT: touch.last,
    ...encounterSpan(args.log),
    earlySayIds: new Set(orderLog(args.log).filter((a) => a.type === "say").slice(0, 3).map((a) => a.id)),
  };
  const flagged = new Set((args.check?.claims ?? []).filter((c) => c.status === "flagged").map((c) => args.normalize(c.text)));
  const out: MatchJudgement[] = [];
  for (const sheet of args.sheets) {
    for (const item of sheet.items) {
      if (item.scoring !== "match") continue;
      if (item.id === PEN_JUSTIFICATION_ITEM) {
        out.push(justification(args));
        continue;
      }
      const j = gradeItem(item, cands, ctx);
      // a note exam finding counts only if the exam was performed (penCheck linked it)
      if (item.id.startsWith("pen-ex-") && j.score > 0 && j.evidence.some((e) => flagged.has(args.normalize(e.quote)))) {
        out.push({ itemId: item.id, score: 0, rationale: `The note reports this finding, but the exam that elicits it wasn't performed (“${j.evidence[0]!.quote}”).`, evidence: j.evidence });
        continue;
      }
      out.push(j);
    }
  }
  return out;
}
