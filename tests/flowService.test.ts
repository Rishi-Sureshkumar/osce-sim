import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const store = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "osce-flow-")), "store.json");
beforeAll(() => {
  process.env.FILE_STORE_PATH = store;
  delete process.env.DATABASE_URL;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-01-01T09:00:00Z"));
});
afterAll(() => vi.useRealTimers());

const at = (ms: number) => vi.setSystemTime(new Date(Date.parse("2026-01-01T09:00:00Z") + ms));
const MIN = 60_000;

describe("1B flow on the server (exam mode)", async () => {
  const s = await import("@/server/session");
  const types = async (id: string) => (await (await import("@/server/db")).getRepo()).listActions(id).then((l) => l.map((a) => (a.type === "timer" ? `timer:${a.payload.event}` : a.type)));

  it("door locked until begin; time-up ends the encounter; the note locks and submits the autosaved draft", async () => {
    at(0);
    const ses = await s.createSession("hf-decompensated-01", "T", "exam");
    await expect(s.appendStudentAction(ses.id, { type: "room", source: "click", payload: { event: "knock" } })).rejects.toThrow(/You may begin/);
    await s.appendStudentAction(ses.id, { type: "timer", source: "click", payload: { event: "begin" } });
    await expect(s.appendStudentAction(ses.id, { type: "timer", source: "click", payload: { event: "begin" } })).rejects.toThrow();
    await s.appendStudentAction(ses.id, { type: "room", source: "click", payload: { event: "knock" } });
    await s.appendStudentAction(ses.id, { type: "room", source: "click", payload: { event: "enter" } });
    // the 5-minute warning can't be logged early
    await expect(s.appendStudentAction(ses.id, { type: "timer", source: "system", payload: { event: "encounter_warning" } })).rejects.toThrow(/not due/);
    at(10 * MIN + 1000);
    await s.appendStudentAction(ses.id, { type: "timer", source: "system", payload: { event: "encounter_warning" } });
    // 15 minutes after begin: refused, and the server logs the end itself
    at(15 * MIN + 2000);
    await expect(s.appendStudentAction(ses.id, { type: "say", source: "text", payload: { text: "One more question" } })).rejects.toThrow(/post-encounter note/);
    expect(await types(ses.id)).toContain("timer:encounter_end");
    // no re-entry
    await expect(s.appendStudentAction(ses.id, { type: "room", source: "click", payload: { event: "enter" } })).rejects.toThrow();
    await s.savePenDraft(ses.id, { history: "SOB, orthopnea", exam: "JVP raised", diagnoses: [{ diagnosis: "Heart failure" }, { diagnosis: "" }] });
    // 10 minutes later (+ grace): locked and submitted from the draft
    at(15 * MIN + 1000 + 10 * MIN + 6000);
    const view = await s.getStudentView(ses.id);
    expect(view.session.status).toBe("submitted");
    const pen = view.actions.find((a) => a.type === "submit_pen");
    expect(pen?.type === "submit_pen" && pen.payload).toMatchObject({ locked: true, exam: "JVP raised", diagnoses: [{ diagnosis: "Heart failure" }] });
    expect(await types(ses.id)).toEqual(expect.arrayContaining(["timer:pen_lock", "submit_pen", "session_end"]));
  });

  it("leaving ends the encounter; the student submits the note in time", async () => {
    at(0);
    const ses = await s.createSession("hf-decompensated-01", "T", "exam");
    await s.appendStudentAction(ses.id, { type: "timer", source: "click", payload: { event: "begin" } });
    await s.appendStudentAction(ses.id, { type: "room", source: "click", payload: { event: "enter" } });
    at(5 * MIN);
    await s.appendStudentAction(ses.id, { type: "room", source: "click", payload: { event: "exit" } });
    await expect(s.appendStudentAction(ses.id, { type: "say", source: "text", payload: { text: "hello?" } })).rejects.toThrow();
    await expect(s.appendStudentAction(ses.id, { type: "submit_pen", source: "text", payload: { history: "h", exam: "e", diagnoses: [{ diagnosis: "HF" }] } })).rejects.toThrow(/Finish/);
    await expect(s.finishWithPen(ses.id, { history: "h", exam: "e", diagnoses: [] })).rejects.toThrow(/at least one/);
    at(9 * MIN);
    const out = await s.finishWithPen(ses.id, { history: "h", exam: "e", diagnoses: [{ diagnosis: "HF", support: "S3, crackles" }] });
    expect(out.map((a) => a.type)).toEqual(["submit_pen", "session_end"]);
    expect(out[0]?.type === "submit_pen" && out[0].payload.locked).toBeUndefined();
  });

  it("practice: begin, no deadlines", async () => {
    at(0);
    const ses = await s.createSession("hf-decompensated-01", "T", "practice");
    await s.appendStudentAction(ses.id, { type: "timer", source: "click", payload: { event: "begin" } });
    at(90 * MIN);
    await s.appendStudentAction(ses.id, { type: "room", source: "click", payload: { event: "enter" } });
    expect(await types(ses.id)).not.toContain("timer:encounter_end");
  });
});
