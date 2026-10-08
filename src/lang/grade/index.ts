/**
 * Deterministic grading of every `match` item of a session (Phase 4 M1): replaces the model grader.
 *  - generic items: src/lang/grade/match.ts (keywords / patterns / exemplar similarity / topics)
 *  - note exam items: credit only if the key point's maneuvers were performed (and the quote doesn't overlap a flagged claim)
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
  /**
   * History topics each student `say` asked about, recomputed on the server from the say's text
   * (src/lang/understand.ts askedTopics). Never read from what was stored at chat time.
   */
  topicsBySay?: GradeContext["topicsBySay"];
}

function touchTimes(log: readonly Action[]): { first: number | null; last: number | null } {
  const ts = log.filter((a) => a.type === "examine" && a.payload.touch !== false).map((a) => a.t);
  return { first: ts.length ? Math.min(...ts) : null, last: ts.length ? Math.max(...ts) : null };
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
    topicsBySay: args.topicsBySay ?? new Map(),
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
      // a note exam finding counts only if the exam that elicits it was performed: the key point's
      // maneuvers must be in the log
      const key = item.id.startsWith("pen-ex-") ? args.kase.penKey?.exam.find((e) => `pen-ex-${e.id}` === item.id) : undefined;
      const unperformed = key?.maneuverIds.length ? !args.log.some((a) => a.type === "examine" && key.maneuverIds.includes(a.payload.maneuverId)) : false;
      const overlapsFlagged = j.evidence.some((e) => {
        const q = args.normalize(e.quote);
        return [...flagged].some((f) => f && q && (f.includes(q) || q.includes(f)));
      });
      // (the flagged-claim overlap is only a fallback for key points without maneuvers)
      if (item.id.startsWith("pen-ex-") && j.score > 0 && (key?.maneuverIds.length ? unperformed : overlapsFlagged)) {
        out.push({ itemId: item.id, score: 0, rationale: `The note reports this finding, but the exam that elicits it wasn't performed (“${j.evidence[0]!.quote}”).`, evidence: j.evidence });
        continue;
      }
      out.push(j);
    }
  }
  return out;
}
