import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { Action, GradingRun, Session } from "@/domain/schemas";
import { FileRepo } from "@/server/db/fileRepo";
import type { Repo } from "@/server/db/repo";

const session = (id: string): Session => ({
  id,
  caseId: "hf-decompensated-01",
  studentLabel: "T",
  status: "active",
  startedAt: new Date().toISOString(),
  endedAt: null,
  patientTurns: 0,
  gradingRuns: 0,
  usage: { inputTokens: 1, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 4 },
});

function contract(name: string, make: () => Promise<Repo>) {
  describe(`${name} repo contract`, () => {
    it("stores sessions, append-only actions in order, runs, overrides and feedback", async () => {
      const repo = await make();
      const id = `ses_${name}_${Date.now()}`;
      await repo.createSession(session(id));
      const actions: Action[] = [0, 1, 2].map((i) => ({ id: `${id}_a${i}`, sessionId: id, t: i * 10, type: "say", source: "text", payload: { text: `m${i}` } }));
      for (const a of actions) await repo.appendAction(a);
      expect((await repo.listActions(id)).map((a) => a.id)).toEqual(actions.map((a) => a.id));

      const updated = await repo.updateSession(id, { status: "graded", patientTurns: 3 });
      expect(updated.status).toBe("graded");
      expect((await repo.getSession(id))?.usage?.cacheWriteTokens).toBe(4);

      const run: GradingRun = { id: `${id}_g`, sessionId: id, createdAt: new Date().toISOString(), trigger: "student_submit", summary: "s", strengths: [], improvements: [], scores: [], usage: session(id).usage, mocked: true };
      await repo.saveGradingRun(run);
      expect((await repo.listGradingRuns(id))[0]?.id).toBe(run.id);

      await repo.addOverride({ id: `${id}_o`, sessionId: id, gradingRunId: run.id, markSheetId: "m", itemId: "i", coach: "C", originalPoints: 0, newPoints: 0.5, reason: "r", createdAt: new Date().toISOString() });
      expect((await repo.listOverrides(id))[0]?.newPoints).toBe(0.5);

      await repo.addFeedback({ id: `${id}_f`, sessionId: id, role: "student", rating: 4, fairness: "fair", text: "ok", page: "results", createdAt: new Date().toISOString() });
      expect((await repo.listFeedback()).some((f) => f.id === `${id}_f`)).toBe(true);
      expect((await repo.listSessions()).some((s) => s.id === id)).toBe(true);
    });
  });
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "osce-repo-"));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
contract("file", async () => new FileRepo(path.join(tmp, "store.json")));

// Runs only when a disposable Postgres is provided: TEST_DATABASE_URL=postgres://... (migrations are applied first).
const pgUrl = process.env.TEST_DATABASE_URL;
if (pgUrl) {
  contract("postgres", async () => {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const postgres = (await import("postgres")).default;
    const client = postgres(pgUrl, { max: 1 });
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    await client.end();
    const { PgRepo } = await import("@/server/db/pgRepo");
    return new PgRepo(pgUrl);
  });
}
