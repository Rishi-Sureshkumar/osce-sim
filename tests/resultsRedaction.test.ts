/**
 * M1 review: the student's results page must get the same redaction as the station (the matcher's
 * view of each turn never; tool contacts and placement distances not while the station is active).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const store = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "osce-results-")), "store.json");
beforeAll(() => {
  process.env.FILE_STORE_PATH = store;
  delete process.env.DATABASE_URL;
});

describe("results view redaction", async () => {
  const s = await import("@/server/session");
  const { getResultsView } = await import("@/server/results");
  const match = { clauses: [{ text: "how many pillows", target: "fact:orthopnea", kind: "fact" as const, score: 0.9, via: "embedding" as const }], topics: ["hpi.aggravating"], embedding: "server" as const };

  it("students never see patient_say.match or (while active) tool contacts; coaches see everything", async () => {
    const ses = await s.createSession("screening-normal", "T", "practice");
    await s.appendSystemAction(ses.id, { type: "patient_say", source: "system", payload: { text: "Fine, thanks.", match } });
    await s.appendStudentAction(ses.id, { type: "tool_contact", source: "click", payload: { tool: "stethoscope", nearestRegionId: "cardiac_mitral", distanceCm: 4, toleranceCm: 2.5, durationMs: 3200, outcome: "near" } });
    const student = await getResultsView(ses.id, "student");
    expect(JSON.stringify(student.actions)).not.toContain('"clauses"');
    expect(student.actions.some((a) => a.type === "tool_contact")).toBe(false);
    const coach = await getResultsView(ses.id, "coach");
    expect(coach.actions.some((a) => a.type === "patient_say" && a.payload.match)).toBe(true);
    expect(coach.actions.some((a) => a.type === "tool_contact")).toBe(true);
  });
});
