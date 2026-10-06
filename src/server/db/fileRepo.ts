import fs from "node:fs";
import path from "node:path";
import type { Action, Feedback, GradingRun, Override, Session } from "@/domain/schemas";
import type { Repo } from "./repo";

interface Store {
  sessions: Session[];
  actions: Action[];
  gradingRuns: GradingRun[];
  overrides: Override[];
  feedback: Feedback[];
}

const empty = (): Store => ({ sessions: [], actions: [], gradingRuns: [], overrides: [], feedback: [] });

/** Local-dev store: one JSON file, writes serialised through a promise chain. */
export class FileRepo implements Repo {
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private file = process.env.FILE_STORE_PATH || path.join(process.cwd(), ".data", "store.json")) {}

  private read(): Store {
    if (!fs.existsSync(this.file)) return empty();
    return { ...empty(), ...JSON.parse(fs.readFileSync(this.file, "utf8")) };
  }

  private write(s: Store) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(s));
    fs.renameSync(tmp, this.file);
  }

  private mutate<T>(fn: (s: Store) => T): Promise<T> {
    const next = this.chain.then(() => {
      const s = this.read();
      const out = fn(s);
      this.write(s);
      return out;
    });
    this.chain = next.catch(() => undefined);
    return next;
  }

  async createSession(s: Session) {
    await this.mutate((st) => void st.sessions.push(s));
  }
  async getSession(id: string) {
    return this.read().sessions.find((s) => s.id === id) ?? null;
  }
  async listSessions(limit = 200) {
    return this.read()
      .sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit);
  }
  async updateSession(id: string, patch: Partial<Omit<Session, "id">>) {
    return this.mutate((st) => {
      const s = st.sessions.find((x) => x.id === id);
      if (!s) throw new Error(`session ${id} not found`);
      Object.assign(s, patch);
      return s;
    });
  }
  async appendAction(a: Action) {
    await this.mutate((st) => void st.actions.push(a));
  }
  async listActions(sessionId: string) {
    return this.read().actions.filter((a) => a.sessionId === sessionId);
  }
  async saveGradingRun(run: GradingRun) {
    await this.mutate((st) => void st.gradingRuns.push(run));
  }
  async listGradingRuns(sessionId: string) {
    return this.read()
      .gradingRuns.filter((r) => r.sessionId === sessionId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async addOverride(o: Override) {
    await this.mutate((st) => void st.overrides.push(o));
  }
  async listOverrides(sessionId: string) {
    return this.read()
      .overrides.filter((o) => o.sessionId === sessionId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async addFeedback(f: Feedback) {
    await this.mutate((st) => void st.feedback.push(f));
  }
  async listFeedback(limit = 200) {
    return this.read()
      .feedback.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
}
