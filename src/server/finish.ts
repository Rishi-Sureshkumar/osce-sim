import "server-only";
import type { Action } from "@/domain/schemas";
import { flowLimits } from "@/content/load";
import { getRepo } from "./db";
import { HttpError } from "./errors";
import { appendStudentAction, appendSystemAction, getCaseOr404, getSessionOr404 } from "./session";

/**
 * Ends the station. Encounters require a summary/differential/plan (appended as `submit_ddx`);
 * screening exams may finish without one.
 */
export async function finishSession(sessionId: string, submission: unknown): Promise<Action[]> {
  const session = await getSessionOr404(sessionId);
  if (session.status !== "active") throw new HttpError(409, "This session has already ended.");
  const kase = getCaseOr404(session.caseId);
  if (flowLimits(kase)) throw new HttpError(400, "Leave the room and submit the post-encounter note.");
  const appended: Action[] = [];
  if (submission) {
    appended.push(await appendStudentAction(sessionId, { type: "submit_ddx", source: "text", ...(submission as object) }));
  } else if (kase.mode === "encounter") {
    throw new HttpError(400, "Please submit your summary, differential and plan.");
  }
  appended.push(await appendSystemAction(sessionId, { type: "session_end", source: "system", payload: { reason: "student_finished" } }));
  await (await getRepo()).updateSession(sessionId, { status: "submitted", endedAt: new Date().toISOString() });
  return appended;
}
