import "server-only";
import { z } from "zod";
import { getContent } from "@/content/load";
import type { Override, Session } from "@/domain/schemas";
import { applyOverrides, totals } from "@/engine/scoring";
import { getRepo } from "./db";
import { HttpError } from "./errors";
import { newId } from "./ids";
import { getSessionOr404 } from "./session";

export interface SessionRow {
  session: Session;
  caseTitle: string;
  points: number | null;
  maxPoints: number | null;
  needsReview: number;
  overrides: number;
  hints: number;
}

export async function listSessionRows(): Promise<SessionRow[]> {
  const repo = await getRepo();
  const content = getContent();
  const sessions = await repo.listSessions(200);
  return Promise.all(
    sessions.map(async (session) => {
      const [runs, overrides, actions] = await Promise.all([repo.listGradingRuns(session.id), repo.listOverrides(session.id), repo.listActions(session.id)]);
      const run = runs.at(-1);
      const t = run ? totals(applyOverrides(run.scores, overrides.filter((o) => o.gradingRunId === run.id))) : null;
      return {
        session,
        caseTitle: content.caseById.get(session.caseId)?.title ?? session.caseId,
        points: t?.points ?? null,
        maxPoints: t?.maxPoints ?? null,
        needsReview: t?.needsReview ?? 0,
        overrides: overrides.length,
        hints: actions.filter((a) => a.type === "hint").length,
      };
    }),
  );
}

export const OverrideInput = z.object({
  markSheetId: z.string().min(1),
  itemId: z.string().min(1),
  newPoints: z.number().min(0),
  reason: z.string().trim().min(3, "Please give a reason").max(1000),
  coach: z.string().trim().min(1, "Please enter your name").max(80),
});

/** Records a coach override against the latest grading run. The original score is never modified. */
export async function addOverride(sessionId: string, raw: unknown): Promise<Override> {
  const parsed = OverrideInput.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid override");
  const input = parsed.data;
  await getSessionOr404(sessionId);
  const repo = await getRepo();
  const run = (await repo.listGradingRuns(sessionId)).at(-1);
  if (!run) throw new HttpError(409, "This session has not been graded yet.");
  const score = run.scores.find((s) => s.markSheetId === input.markSheetId && s.itemId === input.itemId);
  if (!score) throw new HttpError(404, "Unknown mark-sheet item for this session.");
  if (score.status === "not_assessable") throw new HttpError(400, "Not-assessable items are not scored.");
  if (input.newPoints > score.maxPoints) throw new HttpError(400, `Maximum for this item is ${score.maxPoints}.`);
  const override: Override = {
    id: newId("ovr"),
    sessionId,
    gradingRunId: run.id,
    markSheetId: input.markSheetId,
    itemId: input.itemId,
    coach: input.coach,
    // always the grader's score for this run; earlier overrides stay in the history
    originalPoints: score.points,
    newPoints: input.newPoints,
    reason: input.reason,
    createdAt: new Date().toISOString(),
  };
  await repo.addOverride(override);
  return override;
}
