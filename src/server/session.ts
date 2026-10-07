import "server-only";
import { MIN_LISTEN_MS } from "@/exam3d/tools/toolLogic";
import { flowLimits, getContent, toPublicCase } from "@/content/load";
import { PenDraft, PenPayload, sessionMode, type Action, type ActionInput, type Case, type PublicCase, type Session, type SessionMode, type TagHit, type Usage } from "@/domain/schemas";
import { DEADLINE_GRACE_MS, allowedInPhase, dueTimerEvents, encounterState, type EncounterPhase, type FlowLimits } from "@/engine/encounter";
import { timeIsUp } from "@/engine/practice";
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
 * Returns the action plus any actions it implied (e.g. an automatic drape `expose`).
 */
export async function appendStudentActions(sessionId: string, raw: unknown, server: ServerFields = {}): Promise<{ action: Action; appended: Action[] }> {
  const before: Action[] = [];
  const after: Action[] = [];
  const action = await appendOne(sessionId, raw, before, after, server);
  const session = await getSessionOr404(sessionId);
  const kase = getCaseOr404(session.caseId);
  const all = [...before, action, ...after].map((a) => redactForStudent(a, kase, session));
  return { action: all[before.length]!, appended: all.filter((a) => visibleToStudent(a, session)) };
}

/**
 * What the student may see while the station is active:
 * - placement distances and tolerances (the hidden anchors) are stripped from tool exams and contacts;
 * - cases with findingsVisibility "end" keep finding text from the student until the station ends.
 */
export function redactForStudent(a: Action, kase: Case, session: Session): Action {
  if (session.status !== "active") return a;
  if (a.type === "tool_contact") return { ...a, payload: { ...a.payload, distanceCm: 0, toleranceCm: 0 } };
  if (a.type !== "examine") return a;
  const { placementError: _e, distanceCm: _d, toleranceCm: _t, ...payload } = a.payload;
  const hide = a.result && kase.findingsVisibility === "end";
  return { ...a, payload, ...(hide && a.result ? { result: { ...a.result, findingText: "", wording: undefined, hidden: true } } : {}) };
}

/** Tool contacts are logged for scoring and coaches only; the student's log never lists them while active. */
export function visibleToStudent(a: Action, session: Session): boolean {
  return session.status !== "active" || a.type !== "tool_contact";
}

const AFTER_TIME_UP = new Set(["submit_ddx", "timer", "hint", "note"]);

/** Fields only the server may set (never accepted from the browser). */
export interface ServerFields {
  /** courtesy tags for a `say` (from src/server/tags.ts) */
  tags?: TagHit[];
}

/** Convenience wrapper when the caller only needs the main action. */
export async function appendStudentAction(sessionId: string, raw: unknown, server: ServerFields = {}): Promise<Action> {
  return (await appendStudentActions(sessionId, raw, server)).action;
}

async function appendOne(sessionId: string, raw: unknown, implied: Action[], after: Action[], server: ServerFields): Promise<Action> {
  const parsed = ActionInputSchema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, "Invalid action");
  const input: ActionInput = parsed.data;
  const session = await getSessionOr404(sessionId);
  if (session.status !== "active") throw new HttpError(409, "This session has ended");
  const kase = getCaseOr404(session.caseId);
  const logSoFar = await enforceFlow(session, kase);
  const flow = flowLimits(kase);
  if (flow) checkFlowInput(input, session, flow, logSoFar);
  else if (timeIsUp(logSoFar) && !AFTER_TIME_UP.has(input.type)) throw new HttpError(409, "Time is up — present your findings.");
  if (input.type === "timer" && (input.payload.event === "pause" || input.payload.event === "resume") && sessionMode(session) === "exam") {
    throw new HttpError(400, "The timer can't be paused in exam mode.");
  }
  if (input.type === "hint" && sessionMode(session) === "exam") throw new HttpError(400, "Hints are not available in exam mode.");
  // t is taken just before appending so log order and timestamps agree (wording can take ~1s).
  const stamp = async () => ({ id: newId("act"), sessionId, t: await nextT(session) });

  let action: Action;
  if (input.type === "examine") {
    const maneuver = getContent().maneuverById.get(input.payload.maneuverId);
    if (!maneuver) throw new HttpError(400, "Unknown maneuver");
    // a tool finding is earned only inside the hidden anchor's tolerance (and, for the stethoscope, after MIN_LISTEN_MS)
    const p = input.payload;
    if (p.tool && p.distanceCm !== undefined && p.toleranceCm !== undefined && p.distanceCm > p.toleranceCm) throw new HttpError(400, "Off target: log a tool_contact instead");
    if (p.tool === "stethoscope" && p.durationMs !== undefined && p.durationMs < MIN_LISTEN_MS) throw new HttpError(400, "Listen for longer to record a finding");
    const repo = await getRepo();
    const state = patientState(await repo.listActions(sessionId));
    // Examining a region that is still draped exposes it first (logged, so coaches see it).
    const zone = DRAPE_ZONE_OF[input.payload.regionId];
    if (zone && state.drape[zone]) {
      const expose: Action = { ...(await stamp()), type: "courtesy", source: input.source, payload: { kind: "expose", regionId: input.payload.regionId } };
      await repo.appendAction(expose);
      implied.push(expose);
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
    // practice mode: nudge (and log) touching the patient without clean hands, once
    if (sessionMode(session) === "practice" && isTouch(maneuver) && !state.handsClean && state.uncleanTouches === 0) {
      after.push({
        id: newId("act"),
        sessionId,
        t: action.t,
        type: "hint",
        source: "system",
        payload: { kind: "nudge", text: "You haven't cleaned your hands yet. Hand hygiene comes before touching the patient." },
      });
    }
  } else if (input.type === "say") {
    action = { ...(await stamp()), ...input, payload: { ...input.payload, ...(server.tags?.length ? { tags: server.tags } : {}) } };
  } else {
    action = { ...(await stamp()), ...input } as Action;
  }
  await (await getRepo()).appendAction(action);
  for (const a of after) await (await getRepo()).appendAction(a);
  return action;
}

/**
 * Sound for a tool placement, so it can play while the stethoscope is held. Returns only the audio
 * (no finding text) and logs nothing; the placement is logged as an `examine` when it ends.
 */
export async function previewAudio(sessionId: string, maneuverId: string, regionId: string) {
  const session = await getSessionOr404(sessionId);
  if (session.status !== "active") throw new HttpError(409, "This session has ended");
  const kase = getCaseOr404(session.caseId);
  const maneuver = getContent().maneuverById.get(maneuverId);
  if (!maneuver) throw new HttpError(400, "Unknown maneuver");
  const state = patientState(await (await getRepo()).listActions(sessionId));
  try {
    return { audio: resolveFinding(kase, maneuver, regionId, { position: state.position }).audio ?? null };
  } catch (e) {
    if (e instanceof InvalidExamError) throw new HttpError(400, e.message);
    throw e;
  }
}

/**
 * Generic normal background for an off-target stethoscope on the chest or back: the catalog's
 * normal heart or breath sounds (never the case's abnormal ones), at the case's rates.
 */
export async function backgroundAudio(sessionId: string, kind: "heart" | "breath") {
  const session = await getSessionOr404(sessionId);
  if (session.status !== "active") throw new HttpError(409, "This session has ended");
  const kase = getCaseOr404(session.caseId);
  const [maneuverId, regionId] = kind === "heart" ? ["auscultate_heart_diaphragm", "cardiac_mitral"] : ["auscultate_lungs", "lung_post_rl"];
  const maneuver = getContent().maneuverById.get(maneuverId);
  if (!maneuver) return { audio: null };
  return { audio: resolveFinding({ ...kase, abnormalFindings: {} }, maneuver, regionId).audio ?? null };
}

// ---------------------------------------------------------------------------
// 1B encounter flow: the server owns the deadlines (src/engine/encounter.ts derives the phase).
// ---------------------------------------------------------------------------

const PHASE_REFUSAL: Record<EncounterPhase, string> = {
  corridor: "Wait for “You may begin”.",
  encounter: "Leave the room to start the post-encounter note.",
  pen: "The encounter has ended. Only the post-encounter note can be completed now.",
  submitted: "This session has ended",
};

function checkFlowInput(input: ActionInput, session: Session, flow: FlowLimits, log: Action[]) {
  const mode = sessionMode(session);
  const st = encounterState(log, mode, flow, elapsedMs(session));
  if (input.type === "submit_pen") throw new HttpError(400, "Submit the note with Finish.");
  if (!allowedInPhase(st.phase, input.type)) throw new HttpError(409, PHASE_REFUSAL[st.phase]);
  if (input.type === "timer") {
    const e = input.payload.event;
    const ok = e === "begin" ? st.phase === "corridor" : e === "encounter_warning" || e === "pen_warning" ? dueTimerEvents(st, elapsedMs(session)).includes(e) : false;
    if (!ok) throw new HttpError(409, "That timer event is not due.");
  }
}

/**
 * Applies deadlines that have passed (exam mode): logs `encounter_end` once the encounter time is
 * up, and after the PEN deadline (plus grace) locks the note and submits the last autosaved draft.
 * Returns the (possibly extended) log. Safe to call on every request.
 */
export async function enforceFlow(session: Session, kase: Case): Promise<Action[]> {
  const repo = await getRepo();
  let log = await repo.listActions(session.id);
  const flow = flowLimits(kase);
  if (!flow || session.status !== "active") return log;
  const now = elapsedMs(session);
  const st = encounterState(log, sessionMode(session), flow, now);
  const has = (e: string) => log.some((a) => a.type === "timer" && a.payload.event === e);
  if (st.phase === "pen" && st.endReason === "time_up" && !has("encounter_end")) {
    await appendSystemAction(session.id, { type: "timer", source: "system", payload: { event: "encounter_end" } });
    log = await repo.listActions(session.id);
  }
  if (st.phase === "pen" && st.penDeadline !== null && now > st.penDeadline + DEADLINE_GRACE_MS) {
    await submitPen(session, log, draftToPen(session.penDraft), "time_up");
    log = await repo.listActions(session.id);
  }
  return log;
}

function draftToPen(d: PenDraft | null | undefined): PenPayload {
  return {
    history: d?.history ?? "",
    exam: d?.exam ?? "",
    diagnoses: (d?.diagnoses ?? []).filter((x) => x.diagnosis.trim()).map((x) => ({ diagnosis: x.diagnosis.trim(), ...(x.support?.trim() ? { support: x.support.trim() } : {}) })),
    locked: true,
  };
}

/** Appends the note, the lock (if time ran out) and the session end; marks the session submitted. */
async function submitPen(session: Session, log: Action[], pen: PenPayload, how: "student" | "time_up"): Promise<Action[]> {
  const repo = await getRepo();
  const out: Action[] = [];
  const stamp = async () => ({ id: newId("act"), sessionId: session.id, t: await nextT(session) });
  if (pen.locked && !log.some((a) => a.type === "timer" && a.payload.event === "pen_lock")) {
    out.push({ ...(await stamp()), type: "timer", source: "system", payload: { event: "pen_lock" } });
    await repo.appendAction(out.at(-1)!);
  }
  out.push({ ...(await stamp()), type: "submit_pen", source: how === "student" ? "text" : "system", payload: pen } as Action);
  await repo.appendAction(out.at(-1)!);
  out.push({ ...(await stamp()), type: "session_end", source: "system", payload: { reason: how === "student" ? "student_finished" : "pen_time_up" } });
  await repo.appendAction(out.at(-1)!);
  await repo.updateSession(session.id, { status: "submitted", endedAt: new Date().toISOString() });
  return out;
}

/** Student submits the PEN (from the finish route). At or just after the deadline it is marked locked. */
export async function finishWithPen(sessionId: string, raw: unknown): Promise<Action[]> {
  const session = await getSessionOr404(sessionId);
  if (session.status !== "active") throw new HttpError(409, "This session has already ended.");
  const kase = getCaseOr404(session.caseId);
  const flow = flowLimits(kase);
  if (!flow) throw new HttpError(400, "This case has no post-encounter note.");
  const log = await enforceFlow(session, kase);
  const fresh = await getSessionOr404(sessionId);
  if (fresh.status !== "active") throw new HttpError(409, "Note time is up — your autosaved note was submitted.");
  const st = encounterState(log, sessionMode(session), flow, elapsedMs(session));
  if (st.phase !== "pen") throw new HttpError(409, PHASE_REFUSAL[st.phase]);
  const parsed = PenPayload.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, "Invalid note");
  const locked = st.penDeadline !== null && elapsedMs(session) >= st.penDeadline;
  if (!locked && parsed.data.diagnoses.length === 0) throw new HttpError(400, "List at least one diagnosis.");
  return submitPen(session, log, { ...parsed.data, ...(locked ? { locked: true } : { locked: undefined }) }, "student");
}

/** Autosave of the PEN draft (only while the note is open). */
export async function savePenDraft(sessionId: string, raw: unknown): Promise<{ savedAt: string }> {
  const session = await getSessionOr404(sessionId);
  if (session.status !== "active") throw new HttpError(409, "This session has ended");
  const kase = getCaseOr404(session.caseId);
  const flow = flowLimits(kase);
  if (!flow) throw new HttpError(400, "This case has no post-encounter note.");
  const parsed = PenDraft.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, "Invalid draft");
  const log = await enforceFlow(session, kase);
  const st = encounterState(log, sessionMode(session), flow, elapsedMs(session));
  if (st.phase !== "pen" || (st.penDeadline !== null && elapsedMs(session) > st.penDeadline + DEADLINE_GRACE_MS)) throw new HttpError(409, "The note is not open.");
  await (await getRepo()).updateSession(sessionId, { penDraft: parsed.data });
  return { savedAt: new Date().toISOString() };
}

/** Client heartbeat at a deadline: applies it and returns the student's view of the log. */
export async function tickFlow(sessionId: string): Promise<StudentSessionView> {
  return getStudentView(sessionId);
}

type SystemAppend =
  | Omit<Extract<Action, { source: "system" }>, "id" | "sessionId" | "t">
  | { type: "hint"; source: "system"; payload: Extract<Action, { type: "hint" }>["payload"] }
  | { type: "timer"; source: "system"; payload: Extract<Action, { type: "timer" }>["payload"] };

export async function appendSystemAction(sessionId: string, a: SystemAppend): Promise<Action> {
  const session = await getSessionOr404(sessionId);
  const action = { ...a, id: newId("act"), sessionId, t: await nextT(session) } as Action;
  await (await getRepo()).appendAction(action);
  return action;
}

export async function recordUsage(sessionId: string, u: Partial<Usage>): Promise<void> {
  const repo = await getRepo();
  const s = await repo.getSession(sessionId);
  if (!s) return;
  const cur = s.usage ?? emptyUsage();
  await repo.updateSession(sessionId, {
    usage: {
      inputTokens: cur.inputTokens + (u.inputTokens ?? 0),
      outputTokens: cur.outputTokens + (u.outputTokens ?? 0),
      cacheReadTokens: cur.cacheReadTokens + (u.cacheReadTokens ?? 0),
      cacheWriteTokens: cur.cacheWriteTokens + (u.cacheWriteTokens ?? 0),
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
  const before = await getSessionOr404(sessionId);
  const full = getCaseOr404(before.caseId);
  await enforceFlow(before, full);
  const session = await getSessionOr404(sessionId);
  const actions = (await (await getRepo()).listActions(sessionId)).filter((a) => visibleToStudent(a, session)).map((a) => redactForStudent(a, full, session));
  return { session, kase: toPublicCase(full), actions };
}
