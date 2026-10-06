import "server-only";
import { getContent } from "@/content/load";
import type { Action, Case, GradingRun, MarkSheet } from "@/domain/schemas";
import { scoreAiItems, scoreDeterministicItems } from "@/engine/scoring";
import { gradeAiItems } from "./ai/grader";
import { getRepo } from "./db";
import { HttpError } from "./errors";
import { newId } from "./ids";
import { getCaseOr404, getSessionOr404, recordUsage } from "./session";

/** Mark sheets for a case, restricted to the case's configured sections. */
export function sheetsForCase(kase: Case): MarkSheet[] {
  const content = getContent();
  return kase.markSheetIds.map((id) => {
    const sheet = content.markSheetById.get(id)!;
    const sections = kase.markSheetSections?.[id];
    return sections ? { ...sheet, items: sheet.items.filter((i) => sections.includes(i.section)) } : sheet;
  });
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
  const sheets = sheetsForCase(kase);
  const deterministic = sheets.flatMap((s) => scoreDeterministicItems(s, log));
  const autoScored = deterministic.filter((s) => s.scoring === "auto");
  const got = autoScored.reduce((n, s) => n + s.points, 0);
  const max = autoScored.reduce((n, s) => n + s.maxPoints, 0);
  const content = getContent();
  const missed = autoScored
    .filter((s) => s.value < 1)
    .map((s) => sheets.find((x) => x.id === s.markSheetId)?.items.find((i) => i.id === s.itemId)?.label)
    .filter(Boolean)
    .slice(0, 25);
  const deterministicSummary = `Exam checklist: ${round(got)}/${max} points. Not done or incomplete: ${missed.join("; ") || "none"}.`;

  const ai = await gradeAiItems({ kase, sheets, log, content, deterministicSummary });
  await recordUsage(sessionId, ai.usage);
  const aiScores = sheets.flatMap((s) => scoreAiItems(s, ai.judgements, log));

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

/** Key abnormal findings in the case that the student never elicited (deterministic). */
export function missedKeyFindings(kase: Case, log: Action[]): { maneuverId: string; regionId: string | null }[] {
  const out: { maneuverId: string; regionId: string | null }[] = [];
  for (const [maneuverId, byRegion] of Object.entries(kase.abnormalFindings)) {
    const exams = log.filter((a) => a.type === "examine" && a.payload.maneuverId === maneuverId);
    const regions = Object.keys(byRegion).filter((r) => r !== "default");
    if (!exams.length) out.push({ maneuverId, regionId: regions[0] ?? null });
    else if (regions.length && !exams.some((a) => a.type === "examine" && regions.includes(a.payload.regionId))) {
      out.push({ maneuverId, regionId: regions[0]! });
    }
  }
  return out;
}
