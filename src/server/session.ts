import "server-only";
import { getContent, toPublicCase } from "@/content/load";
import type { Action, ActionInput, Case, PublicCase, Session, SessionMode, Usage } from "@/domain/schemas";
import { ActionInput as ActionInputSchema } from "@/domain/schemas";
import { InvalidExamError, isTouch, resolveFinding } from "@/engine/resolveFinding";
import { DRAPE_ZONE_OF, patientState } from "@/engine/patientState";
import { getRepo } from "./db";
import { HttpError } from "./errors";
import { newId } from "./ids";
import { wordFinding } from "./ai/wording";

export const emptyUsage = (): Usage => ({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });

export function getCaseOr404(caseId: string): Case {
  const c = getContent().caseById.get(caseId);
  if (!c) throw new HttpError(404, `Unknown case "${caseId}"`);
  return c;
}

export async function createSession(caseId: string, studentLabel: string, mode: SessionMode = "exam"): Promise<Session> {
  getCaseOr404(caseId);
  const repo = await getRepo();
  const session: Session = {
    id: newId("ses"),
    caseId,
    studentLabel: studentLabel.trim().slice(0, 80) || "Anonymous",
    status: "active",
    mode,
    startedAt: new Date().toISOString(),
    endedAt: null,
    patientTurns: 0,
    gradingRuns: 0,
    usage: emptyUsage(),
  };
  await repo.createSession(session);
  await repo.appendAction({ id: newId("act"), sessionId: session.id, t: 0, type: "session_start", source: "system", payload: { caseId } });
  return session;
}

export async function getSessionOr404(id: string): Promise<Session> {
  const s = await (await getRepo()).getSession(id);
  if (!s) throw new HttpError(404, "Session not found");
  return s;
}

export function elapsedMs(session: Session): number {
  return Math.max(0, Date.now() - Date.parse(session.startedAt));
}

/** Monotonic per-session timestamp: never earlier than the last logged action. */
async function nextT(session: Session): Promise<number> {
  const log = await (await getRepo()).listActions(session.id);
  return Math.max(elapsedMs(session), log.at(-1)?.t ?? 0);
}

/**
 * The single write path for student actions. Validates the input, resolves exam findings
 * deterministically, optionally adds AI wording, and appends to the log.
 */
export async function appendStudentAction(sessionId: string, raw: unknown): Promise<Action> {
  const parsed = ActionInputSchema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, "Invalid action");
  const input: ActionInput = parsed.data;
  const session = await getSessionOr404(sessionId);
  if (session.status !== "active") throw new HttpError(409, "This session has ended");
  const kase = getCaseOr404(session.caseId);
  // t is taken just before appending so log order and timestamps agree (wording can take ~1s).
  const stamp = async () => ({ id: newId("act"), sessionId, t: await nextT(session) });

  let action: Action;
  if (input.type === "examine") {
    const maneuver = getContent().maneuverById.get(input.payload.maneuverId);
    if (!maneuver) throw new HttpError(400, "Unknown maneuver");
    const repo = await getRepo();
    const state = patientState(await repo.listActions(sessionId));
    // Examining a region that is still draped exposes it first (logged, so coaches see it).
    const zone = DRAPE_ZONE_OF[input.payload.regionId];
    if (zone && state.drape[zone]) {
      await repo.appendAction({ ...(await stamp()), type: "courtesy", source: input.source, payload: { kind: "expose", regionId: input.payload.regionId } });
    }
    let resolved;
    try {
      resolved = resolveFinding(kase, maneuver, input.payload.regionId, { position: state.position });
    } catch (e) {
      if (e instanceof InvalidExamError) throw new HttpError(400, e.message);
      throw e;
    }
    const region = getContent().regionById.get(input.payload.regionId)!;
    const wording = await wordFinding(sessionId, { maneuverLabel: maneuver.label, regionLabel: region.label, findingText: resolved.findingText });
    action = {
      ...(await stamp()),
      type: "examine",
      source: input.source,
      payload: { ...input.payload, touch: isTouch(maneuver) },
      result: { ...resolved, ...(wording ? { wording } : {}) },
    };
  } else {
    action = { ...(await stamp()), ...input } as Action;
  }
  await (await getRepo()).appendAction(action);
  return action;
}

export async function appendSystemAction(sessionId: string, a: Omit<Extract<Action, { source: "system" }>, "id" | "sessionId" | "t">): Promise<Action> {
  const session = await getSessionOr404(sessionId);
  const action = { ...a, id: newId("act"), sessionId, t: await nextT(session) } as Action;
  await (await getRepo()).appendAction(action);
  return action;
}

export async function recordUsage(sessionId: string, u: Partial<Usage>): Promise<void> {
  const repo = await getRepo();
  const s = await repo.getSession(sessionId);
  if (!s) return;
  await repo.updateSession(sessionId, {
    usage: {
      inputTokens: s.usage.inputTokens + (u.inputTokens ?? 0),
      outputTokens: s.usage.outputTokens + (u.outputTokens ?? 0),
      cacheReadTokens: s.usage.cacheReadTokens + (u.cacheReadTokens ?? 0),
      cacheWriteTokens: s.usage.cacheWriteTokens + (u.cacheWriteTokens ?? 0),
    },
  });
}

export function totalTokens(u: Usage): number {
  return u.inputTokens + u.outputTokens + u.cacheReadTokens + u.cacheWriteTokens;
}

export interface StudentSessionView {
  session: Session;
  kase: PublicCase;
  actions: Action[];
}

export async function getStudentView(sessionId: string): Promise<StudentSessionView> {
  const session = await getSessionOr404(sessionId);
  const kase = toPublicCase(getCaseOr404(session.caseId));
  const actions = await (await getRepo()).listActions(sessionId);
  return { session, kase, actions };
}
