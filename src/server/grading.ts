import "server-only";
import { getContent } from "@/content/load";
import { sessionMode, type Action, type Case, type GradingRun, type MarkSheet } from "@/domain/schemas";
import { appliesInMode, applyPenCheck, scoreAiItems, scoreDeterministicItems } from "@/engine/scoring";
import { penCheck } from "@/engine/penCheck";
import { sheetsForCase as filterSheets } from "@/engine/sheets";
import { gradeAiItems } from "./ai/grader";
import { getRepo } from "./db";
import { HttpError } from "./errors";
import { newId } from "./ids";
import { getCaseOr404, getSessionOr404, recordUsage } from "./session";

export function sheetsForCase(kase: Case): MarkSheet[] {
  return filterSheets(kase, getContent().markSheetById);
}

const inFlight = new Map<string, Promise<GradingRun>>();

/**
 * Grades a session: deterministic `auto` items from the log, then one AI call for `ai` items
 * (quotes verified). Students get one grading run per session; coaches may re-run.
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
  const autoScored = deterministic.filter((s) => s.scoring === "auto");
  const got = autoScored.reduce((n, s) => n + s.points, 0);
  const max = autoScored.reduce((n, s) => n + s.maxPoints, 0);
  const missed = autoScored
    .filter((s) => s.value < 1)
    .map((s) => sheets.find((x) => x.id === s.markSheetId)?.items.find((i) => i.id === s.itemId)?.label)
    .filter(Boolean)
    .slice(0, 25);
  const flagged = check.claims.filter((c) => c.status === "flagged").map((c) => `“${c.text}”`);
  const deterministicSummary =
    `Exam checklist: ${round(got)}/${max} points. Not done or incomplete: ${missed.join("; ") || "none"}.` +
    (pen ? ` Post-encounter note exam claims with no matching exam in the log: ${flagged.join("; ") || "none"}.` : "");

  const gradedSheets = sheets.map((s) => ({ ...s, items: s.items.filter((i) => appliesInMode(i, mode)) }));
  const ai = await gradeAiItems({ kase, sheets: gradedSheets, log, content, deterministicSummary });
  await recordUsage(sessionId, ai.usage);
  const aiScores = sheets.flatMap((s) => scoreAiItems(s, ai.judgements, log, mode));

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
    summary: ai.summary,
    strengths: ai.strengths,
    improvements: ai.improvements,
    scores,
    usage: ai.usage,
    mocked: ai.mocked,
  };
  await repo.saveGradingRun(run);
  const fresh = await getSessionOr404(sessionId);
  await repo.updateSession(sessionId, { status: "graded", gradingRuns: fresh.gradingRuns + 1 });
  return run;
}

const round = (n: number) => Math.round(n * 100) / 100;

export const penFor = (log: Action[]) => log.findLast((a): a is Extract<Action, { type: "submit_pen" }> => a.type === "submit_pen");
