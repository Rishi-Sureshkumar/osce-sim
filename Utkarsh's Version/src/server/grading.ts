import "server-only";
import { getContent } from "@/content/load";
import { sessionMode, type Action, type Case, type GradingRun, type MarkSheet } from "@/domain/schemas";
import { appliesInMode, applyPenCheck, scoreAiItems, scoreDeterministicItems } from "@/engine/scoring";
import { penCheck } from "@/engine/penCheck";
import { sheetsForCase as filterSheets } from "@/engine/sheets";
import { deterministicFeedback } from "@/engine/feedback";
import { embedTexts } from "@/lang/embed/node";
import { gradeMatchItems } from "@/lang/grade";
import { candidatesFrom, specFor } from "@/lang/grade/match";
import { makeNormalizer } from "@/lang/normalize";
import { gradingTopics } from "@/lang/server";
import { getRepo } from "./db";
import { HttpError } from "./errors";
import { newId } from "./ids";
import { getCaseOr404, getSessionOr404 } from "./session";

export function sheetsForCase(kase: Case): MarkSheet[] {
  return filterSheets(kase, getContent().markSheetById);
}

const inFlight = new Map<string, Promise<GradingRun>>();

/**
 * Grades a session: `auto` items from the log by the rule interpreter, `match` items by the
 * deterministic language matcher (src/lang/grade; quotes are the student's own sentences and are
 * verified). No model is involved. Students get one grading run per session; coaches may re-run.
 */
export function runGrading(sessionId: string, trigger: GradingRun["trigger"]): Promise<GradingRun> {
  const existing = inFlight.get(sessionId);
  if (existing) return existing;
  const p = doGrade(sessionId, trigger).finally(() => inFlight.delete(sessionId));
  inFlight.set(sessionId, p);
  return p;
}

async function doGrade(sessionId: string, trigger: GradingRun["trigger"]): Promise<GradingRun> {
  const repo = await getRepo();
  const session = await getSessionOr404(sessionId);
  if (session.status === "active") throw new HttpError(409, "Finish the station before grading.");
  const previous = await repo.listGradingRuns(sessionId);
  if (trigger === "student_submit" && previous.length) return previous.at(-1)!;

  const kase = getCaseOr404(session.caseId);
  const log: Action[] = await repo.listActions(sessionId);
  const mode = sessionMode(session);
  const sheets = sheetsForCase(kase);
  const content = getContent();
  const pen = penFor(log);
  const check = penCheck(pen?.payload.exam ?? "", content.maneuvers, kase.penKey?.exam ?? [], log);
  const deterministic = applyPenCheck(sheets.flatMap((s) => scoreDeterministicItems(s, log, mode)), check, pen);
  const gradedSheets = sheets.map((s) => ({ ...s, items: s.items.filter((i) => appliesInMode(i, mode)) }));
  // embed every sentence and example the matcher may compare (once), then grade synchronously
  const normalize = makeNormalizer(content.lang.synonyms);
  const texts = new Set<string>(candidatesFrom(log, normalize).map((c) => c.sentence));
  for (const sh of gradedSheets)
    for (const it of sh.items) {
      if (it.scoring !== "match") continue;
      const spec = specFor(it);
      for (const t of [...spec.exemplars, ...spec.counterExemplars, ...spec.penalties.flatMap((p) => p.exemplars)]) texts.add(t);
    }
  const list = [...texts];
  const vecs = await embedTexts(list);
  const byText = new Map(vecs ? list.map((t, i) => [t, vecs[i]!] as const) : []);
  const asked = await gradingTopics(kase, log);
  const judgements = gradeMatchItems({ kase, sheets: gradedSheets, log, check: pen ? check : null, normalize, embed: (t) => byText.get(t) ?? null, topicsBySay: asked.topics });
  const aiScores = sheets.flatMap((s) => scoreAiItems(s, judgements, log, mode));

  // keep mark-sheet item order
  const order = new Map(sheets.flatMap((s) => s.items.map((i, idx) => [`${s.id}/${i.id}`, idx] as const)));
  const scores = [...deterministic, ...aiScores].sort(
    (a, b) => sheets.findIndex((s) => s.id === a.markSheetId) - sheets.findIndex((s) => s.id === b.markSheetId) || order.get(`${a.markSheetId}/${a.itemId}`)! - order.get(`${b.markSheetId}/${b.itemId}`)!,
  );

  const run: GradingRun = {
    id: newId("grd"),
    sessionId,
    createdAt: new Date().toISOString(),
    trigger,
    mode,
    ...deterministicFeedback({ sheets, scores, pen: pen ? check : null }),
    scores,
    grader: "deterministic",
    embeddings: !!vecs && asked.embeddings,
  };
  await repo.saveGradingRun(run);
  const fresh = await getSessionOr404(sessionId);
  await repo.updateSession(sessionId, { status: "graded", gradingRuns: fresh.gradingRuns + 1 });
  return run;
}

export const penFor = (log: Action[]) => log.findLast((a): a is Extract<Action, { type: "submit_pen" }> => a.type === "submit_pen");
