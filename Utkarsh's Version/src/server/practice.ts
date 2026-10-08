import "server-only";
import { sessionMode, type Action } from "@/domain/schemas";
import { nextHint, sectionProgress, type SectionStatus } from "@/engine/practice";
import { getRepo } from "./db";
import { HttpError } from "./errors";
import { sheetsForCase } from "./grading";
import { appendSystemAction, getCaseOr404, getSessionOr404 } from "./session";

async function practiceContext(sessionId: string) {
  const session = await getSessionOr404(sessionId);
  if (sessionMode(session) !== "practice") throw new HttpError(403, "Hints and progress checks are only available in practice mode.");
  if (session.status !== "active") throw new HttpError(409, "This session has ended.");
  const kase = getCaseOr404(session.caseId);
  const log = await (await getRepo()).listActions(sessionId);
  return { kase, log, sheets: sheetsForCase(kase) };
}

/** Next suggested step (first unmet checklist item). Logged so coaches see hints used. */
export async function giveHint(sessionId: string): Promise<Action> {
  const { log, sheets } = await practiceContext(sessionId);
  const hint = nextHint(sheets, log, "practice");
  return appendSystemAction(sessionId, {
    type: "hint",
    source: "system",
    payload: hint ? { kind: "hint", text: hint.text, itemId: hint.itemId } : { kind: "hint", text: "You've covered every checklist item that can be checked automatically." },
  });
}

/** Per-section checklist progress (deterministic items only). Logged as a section check. */
export async function checkProgress(sessionId: string): Promise<{ sections: SectionStatus[]; action: Action }> {
  const { log, sheets } = await practiceContext(sessionId);
  const sections = sectionProgress(sheets, log, "practice");
  const done = sections.reduce((n, s) => n + s.done, 0);
  const total = sections.reduce((n, s) => n + s.total, 0);
  const action = await appendSystemAction(sessionId, {
    type: "hint",
    source: "system",
    payload: { kind: "section_check", text: `Checked progress: ${done}/${total} checklist items` },
  });
  return { sections, action };
}
