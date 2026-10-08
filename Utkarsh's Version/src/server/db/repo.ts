import type { Action, Feedback, GradingRun, Override, Session } from "@/domain/schemas";

/**
 * Storage interface. Postgres (Drizzle) in production, a JSON file in local dev when
 * DATABASE_URL is unset. Actions are append-only: there is deliberately no update/delete.
 */
export interface Repo {
  createSession(s: Session): Promise<void>;
  getSession(id: string): Promise<Session | null>;
  listSessions(limit?: number): Promise<Session[]>;
  updateSession(id: string, patch: Partial<Omit<Session, "id">>): Promise<Session>;

  /** Appends and assigns `seq` (append order). */
  appendAction(a: Action): Promise<void>;
  /** Returns the log in canonical order (t, then seq) with `seq` populated. */
  listActions(sessionId: string): Promise<Action[]>;

  saveGradingRun(run: GradingRun): Promise<void>;
  listGradingRuns(sessionId: string): Promise<GradingRun[]>;

  addOverride(o: Override): Promise<void>;
  listOverrides(sessionId: string): Promise<Override[]>;

  addFeedback(f: Feedback): Promise<void>;
  listFeedback(limit?: number): Promise<Feedback[]>;
}
