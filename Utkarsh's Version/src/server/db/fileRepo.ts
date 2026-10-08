import fs from "node:fs";
import path from "node:path";
import type { Action, Feedback, GradingRun, Override, Session } from "@/domain/schemas";
import type { Repo } from "./repo";
import { orderLog } from "@/engine/order";

interface Store {
  sessions: Session[];
  actions: Action[];
  gradingRuns: GradingRun[];
  overrides: Override[];
  feedback: Feedback[];
}

const empty = (): Store => ({ sessions: [], actions: [], gradingRuns: [], overrides: [], feedback: [] });

/**
 * Local-dev store: one JSON file, writes serialised through a promise chain. The parsed file is
 * cached by (mtime, size) so reads don't re-parse it; getters hand out copies, never cache objects.
 */
export class FileRepo implements Repo {
  private chain: Promise<unknown> = Promise.resolve();
  private cache: { mtimeMs: number; size: number; store: Store } | null = null;

  constructor(private file = process.env.FILE_STORE_PATH || path.join(process.cwd(), ".data", "store.json")) {}

  private read(): Store {
    let st: fs.Stats;
    try {
      st = fs.statSync(this.file);
    } catch {
      this.cache = null;
      return empty();
    }
    if (this.cache && this.cache.mtimeMs === st.mtimeMs && this.cache.size === st.size) return this.cache.store;
    const store: Store = { ...empty(), ...JSON.parse(fs.readFileSync(this.file, "utf8")) };
    this.cache = { mtimeMs: st.mtimeMs, size: st.size, store };
    return store;
  }

  private write(s: Store) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(s));
    fs.renameSync(tmp, this.file);
    const st = fs.statSync(this.file);
    this.cache = { mtimeMs: st.mtimeMs, size: st.size, store: s };
  }

  private mutate<T>(fn: (s: Store) => T): Promise<T> {
    const next = this.chain.then(() => {
      // mutate a copy: a throw inside fn must not leave the cache half-changed
      const s = structuredClone(this.read());
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
    const s = this.read().sessions.find((x) => x.id === id);
    return s ? structuredClone(s) : null;
  }
  async listSessions(limit = 200) {
    return structuredClone(
      [...this.read().sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, limit),
    );
  }
  async updateSession(id: string, patch: Partial<Omit<Session, "id">>) {
    return this.mutate((st) => {
      const s = st.sessions.find((x) => x.id === id);
      if (!s) throw new Error(`session ${id} not found`);
      Object.assign(s, patch);
      return structuredClone(s);
    });
  }
  async appendAction(a: Action) {
    await this.mutate((st) => {
      const seq = st.actions.reduce((m, x, i) => Math.max(m, x.seq ?? i + 1), 0) + 1;
      st.actions.push({ ...a, seq });
    });
  }
  async listActions(sessionId: string) {
    const all = this.read().actions;
    return orderLog(structuredClone(all.map((a, i) => ({ ...a, seq: a.seq ?? i + 1 })).filter((a) => a.sessionId === sessionId)));
  }
  async saveGradingRun(run: GradingRun) {
    await this.mutate((st) => void st.gradingRuns.push(run));
  }
  async listGradingRuns(sessionId: string) {
    return structuredClone(this.read().gradingRuns.filter((r) => r.sessionId === sessionId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async addOverride(o: Override) {
    await this.mutate((st) => void st.overrides.push(o));
  }
  async listOverrides(sessionId: string) {
    return structuredClone(this.read().overrides.filter((o) => o.sessionId === sessionId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async addFeedback(f: Feedback) {
    await this.mutate((st) => void st.feedback.push(f));
  }
  async listFeedback(limit = 200) {
    return structuredClone([...this.read().feedback].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit));
  }
}
