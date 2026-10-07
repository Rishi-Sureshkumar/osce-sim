import type { Action, Feedback, GradingRun, Override, Session } from "@/domain/schemas";
import type { Repo } from "@/server/db/repo";
import { orderLog } from "@/engine/order";

interface Store {
  sessions: Session[];
  actions: Action[];
  gradingRuns: GradingRun[];
  overrides: Override[];
  feedback: Feedback[];
}

const KEY = "osce-sim-artifact-store-v1";
const empty = (): Store => ({ sessions: [], actions: [], gradingRuns: [], overrides: [], feedback: [] });

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    return empty();
  }
}

/** Artifact build: in-memory store, mirrored to this viewer's localStorage when available. */
class MemoryRepo implements Repo {
  private st = load();
  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.st));
    } catch {
      /* storage unavailable: keep in memory only */
    }
  }
  async createSession(s: Session) {
    this.st.sessions.push(structuredClone(s));
    this.save();
  }
  async getSession(id: string) {
    const s = this.st.sessions.find((x) => x.id === id);
    return s ? structuredClone(s) : null;
  }
  async listSessions(limit = 200) {
    return structuredClone([...this.st.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, limit));
  }
  async updateSession(id: string, patch: Partial<Omit<Session, "id">>) {
    const s = this.st.sessions.find((x) => x.id === id);
    if (!s) throw new Error(`session ${id} not found`);
    Object.assign(s, structuredClone(patch));
    this.save();
    return structuredClone(s);
  }
  async appendAction(a: Action) {
    const seq = this.st.actions.reduce((m, x, i) => Math.max(m, x.seq ?? i + 1), 0) + 1;
    this.st.actions.push(structuredClone({ ...a, seq }));
    this.save();
  }
  async listActions(sessionId: string) {
    return structuredClone(orderLog(this.st.actions.filter((a) => a.sessionId === sessionId)));
  }
  async saveGradingRun(run: GradingRun) {
    this.st.gradingRuns.push(structuredClone(run));
    this.save();
  }
  async listGradingRuns(sessionId: string) {
    return structuredClone(this.st.gradingRuns.filter((r) => r.sessionId === sessionId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  }
  async addOverride(o: Override) {
    this.st.overrides.push(structuredClone(o));
    this.save();
  }
  async listOverrides(sessionId: string) {
    return structuredClone(this.st.overrides.filter((o) => o.sessionId === sessionId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  }
  async addFeedback(f: Feedback) {
    this.st.feedback.push(structuredClone(f));
    this.save();
  }
  async listFeedback(limit = 200) {
    return structuredClone([...this.st.feedback].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit));
  }
}

let repo: Repo | null = null;
export async function getRepo(): Promise<Repo> {
  return (repo ??= new MemoryRepo());
}
