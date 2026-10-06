import { asc, desc, eq } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Action, Feedback, GradingRun, Override, Session } from "@/domain/schemas";
import type { Repo } from "./repo";
import * as t from "./schema";

const iso = (s: string | null) => (s ? new Date(s).toISOString() : null);

export class PgRepo implements Repo {
  private db: PostgresJsDatabase<typeof t>;

  constructor(url: string) {
    this.db = drizzle(postgres(url, { max: 5, prepare: false }), { schema: t });
  }

  private toSession(r: typeof t.sessions.$inferSelect): Session {
    return { ...r, status: r.status as Session["status"], startedAt: iso(r.startedAt)!, endedAt: iso(r.endedAt) };
  }

  async createSession(s: Session) {
    await this.db.insert(t.sessions).values(s);
  }
  async getSession(id: string) {
    const [r] = await this.db.select().from(t.sessions).where(eq(t.sessions.id, id));
    return r ? this.toSession(r) : null;
  }
  async listSessions(limit = 200) {
    const rows = await this.db.select().from(t.sessions).orderBy(desc(t.sessions.startedAt)).limit(limit);
    return rows.map((r) => this.toSession(r));
  }
  async updateSession(id: string, patch: Partial<Omit<Session, "id">>) {
    const [r] = await this.db.update(t.sessions).set(patch).where(eq(t.sessions.id, id)).returning();
    if (!r) throw new Error(`session ${id} not found`);
    return this.toSession(r);
  }
  async appendAction(a: Action) {
    await this.db.insert(t.actions).values({ id: a.id, sessionId: a.sessionId, t: a.t, type: a.type, data: a });
  }
  async listActions(sessionId: string) {
    const rows = await this.db.select().from(t.actions).where(eq(t.actions.sessionId, sessionId)).orderBy(asc(t.actions.seq));
    return rows.map((r) => r.data);
  }
  async saveGradingRun(run: GradingRun) {
    await this.db.insert(t.gradingRuns).values({ id: run.id, sessionId: run.sessionId, createdAt: run.createdAt, data: run });
  }
  async listGradingRuns(sessionId: string) {
    const rows = await this.db
      .select()
      .from(t.gradingRuns)
      .where(eq(t.gradingRuns.sessionId, sessionId))
      .orderBy(asc(t.gradingRuns.createdAt));
    return rows.map((r) => r.data);
  }
  async addOverride(o: Override) {
    await this.db.insert(t.overrides).values(o);
  }
  async listOverrides(sessionId: string) {
    const rows = await this.db
      .select()
      .from(t.overrides)
      .where(eq(t.overrides.sessionId, sessionId))
      .orderBy(asc(t.overrides.createdAt));
    return rows.map((r) => ({ ...r, createdAt: iso(r.createdAt)! }));
  }
  async addFeedback(f: Feedback) {
    await this.db.insert(t.feedback).values(f);
  }
  async listFeedback(limit = 200) {
    const rows = await this.db.select().from(t.feedback).orderBy(desc(t.feedback.createdAt)).limit(limit);
    return rows.map((r) => ({
      ...r,
      role: r.role as Feedback["role"],
      fairness: r.fairness as Feedback["fairness"],
      createdAt: iso(r.createdAt)!,
    }));
  }
}
