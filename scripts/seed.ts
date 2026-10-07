/**
 * `npm run seed` — writes one graded demo session for the HF case into the configured store
 * (Postgres if DATABASE_URL is set, else .data/store.json). Uses the real engine and the mock
 * grader, so it costs nothing and needs no API key. Handy for demoing the coach view.
 */
import { loadContentFromDisk } from "../src/content/loadFromDisk";
import type { Action, ActionInput, GradingRun, Session } from "../src/domain/schemas";

type SystemInput = Omit<Extract<Action, { source: "system" }>, "id" | "sessionId" | "t">;
import { isTouch, resolveFinding } from "../src/engine/resolveFinding";
import { applyPenCheck, scoreAiItems, scoreDeterministicItems } from "../src/engine/scoring";
import { penCheck } from "../src/engine/penCheck";
import { sheetsForCase } from "../src/engine/sheets";
import { mockJudgements, mockPatientReply } from "../src/server/ai/mock";
import { regexTags } from "../src/server/tags";
import { FileRepo } from "../src/server/db/fileRepo";
import type { Repo } from "../src/server/db/repo";

const content = loadContentFromDisk();
const kase = content.caseById.get("hf-decompensated-01")!;
const repo: Repo = process.env.DATABASE_URL ? new (await import("../src/server/db/pgRepo")).PgRepo(process.env.DATABASE_URL) : new FileRepo();

const sessionId = `ses_seed_${Date.now().toString(36)}`;
const start = Date.now() - 14 * 60_000;
let t = 0;
const log: Action[] = [];
const push = (a: ActionInput | SystemInput, dt = 15_000) => {
  t += dt;
  const action = { ...a, id: `act_${sessionId}_${log.length}`, sessionId, t } as Action;
  if (action.type === "examine") {
    const m = content.maneuverById.get(action.payload.maneuverId)!;
    action.result = resolveFinding(kase, m, action.payload.regionId);
  }
  log.push(action);
};
const say = (text: string) => {
  const tags = regexTags(text);
  push({ type: "say", source: "text", payload: { text, ...(tags.length ? { tags } : {}) } } as ActionInput);
  const turn = log.filter((a) => a.type === "patient_say").length;
  push({ type: "patient_say", source: "system", payload: { text: mockPatientReply(kase, text, turn), mocked: true } }, 4_000);
};
const ex = (maneuverId: string, regionId: string) => {
  const touch = isTouch(content.maneuverById.get(maneuverId)!);
  push({ type: "examine", source: "click", payload: { maneuverId, regionId, touch } } as ActionInput, 20_000);
};
const pos = (position: string) => push({ type: "state_change", source: "click", payload: { position, via: "direct" } } as ActionInput, 5_000);

push({ type: "session_start", source: "system", payload: { caseId: kase.id } }, 0);
push({ type: "timer", source: "click", payload: { event: "begin" } } as ActionInput, 20_000);
push({ type: "room", source: "click", payload: { event: "knock" } }, 10_000);
push({ type: "room", source: "click", payload: { event: "enter" } }, 3_000);
push({ type: "sit_down", source: "click", payload: {} } as ActionInput, 4_000);
say("Hello Mr. Bennett, my name is Alex Kim and I'm a first-year medical student. What brings you in today?");
say("Tell me more about that. When did it start?");
say("How far can you walk before you get breathless?");
say("Do you get short of breath when you lie flat?");
say("Any swelling in your legs or ankles?");
say("Any chest pain?");
say("Have you been taking your water pill?");
say("What medications do you take, and what doses?");
say("Any allergies?");
say("Do you smoke or drink alcohol?");
say("Is it okay if I examine you now?");
push({ type: "courtesy", source: "toolbar", payload: { kind: "hand_hygiene" } });
push({ type: "courtesy", source: "toolbar", payload: { kind: "drape" } }, 5_000);
ex("general_appearance", "general");
ex("pulse_radial", "wrist_right");
ex("respiratory_rate", "general");
pos("reclined_30");
ex("jvp_inspection", "neck_jvp_right");
ex("hepatojugular_reflux", "abd_ruq");
pos("supine");
ex("pmi_palpation", "cardiac_mitral");
for (const r of ["cardiac_aortic", "cardiac_pulmonic", "cardiac_erbs", "cardiac_tricuspid", "cardiac_mitral"]) ex("auscultate_heart_diaphragm", r);
pos("left_lateral_decubitus");
ex("auscultate_heart_bell", "cardiac_mitral");
pos("seated");
for (const r of ["lung_post_ru", "lung_post_lu", "lung_post_rl", "lung_post_ll"]) ex("auscultate_lungs", r);
ex("chest_percussion", "lung_post_rl");
ex("edema_assessment", "shin_right");
ex("edema_assessment", "shin_left");
push({ type: "state_change", source: "click", payload: { drape: { zone: "chest", covered: true }, via: "direct" } } as ActionInput, 5_000);
say("I think your heart is struggling to pump and fluid has built up. We will give you medicine to remove the fluid. Do you have any questions?");
say("Thank you for your time, Mr. Bennett. Take care.");
push({ type: "courtesy", source: "click", payload: { kind: "hand_hygiene" } }, 5_000);
push({ type: "room", source: "click", payload: { event: "exit" } }, 3_000);
push({
  type: "submit_pen",
  source: "text",
  payload: {
    history: "68-year-old man with prior MI (stent 2019) and EF ~30%. 2 weeks of progressive dyspnoea, now on minimal exertion; orthopnea (three pillows), PND, ankle swelling and ~4 kg weight gain. Ran out of furosemide 10 days ago; salty food at a family party. No chest pain, no fever.",
    exam: "JVP raised at 30 degrees.\nPositive hepatojugular reflux.\nDisplaced PMI.\nS3 at the apex in left lateral decubitus.\nFine crackles at both posterior bases, dull right base.\nBilateral pitting edema to the shins.",
    diagnoses: [
      { diagnosis: "Acute decompensated heart failure", support: "orthopnea, PND, raised JVP, S3, crackles, edema; stopped furosemide" },
      { diagnosis: "Acute coronary syndrome", support: "prior MI; must exclude as precipitant" },
      { diagnosis: "Pneumonia", support: "crackles, cough; but afebrile" },
    ],
  },
} as ActionInput);
push({ type: "session_end", source: "system", payload: { reason: "student_finished" } }, 1_000);

const sheets = sheetsForCase(kase, content.markSheetById);
const pen = log.findLast((a): a is Extract<Action, { type: "submit_pen" }> => a.type === "submit_pen");
const check = penCheck(pen?.payload.exam ?? "", content.maneuvers, kase.penKey?.exam ?? [], log);
const scores = sheets.flatMap((s) => [...applyPenCheck(scoreDeterministicItems(s, log), check, pen), ...scoreAiItems(s, mockJudgements(s, log), log)]);
const session: Session = {
  id: sessionId,
  caseId: kase.id,
  studentLabel: "Demo student (seed)",
  status: "graded",
  startedAt: new Date(start).toISOString(),
  endedAt: new Date(start + t).toISOString(),
  patientTurns: log.filter((a) => a.type === "patient_say").length,
  gradingRuns: 1,
  usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
};
const run: GradingRun = {
  id: `grd_${sessionId}`,
  sessionId,
  createdAt: new Date(start + t + 5_000).toISOString(),
  trigger: "student_submit",
  summary: "[Seeded mock feedback] Focused, well-ordered cardiorespiratory history and exam. See the item-level scores below.",
  strengths: ["Elicited orthopnea and medication non-adherence early.", "Assessed JVP at 30° and listened with the bell in left lateral decubitus."],
  improvements: ["Share your impression in plain words before leaving.", "Percuss both bases and compare sides."],
  scores,
  usage: session.usage,
  mocked: true,
};
await repo.createSession(session);
for (const a of log) await repo.appendAction(a);
await repo.saveGradingRun(run);
console.log(`seeded ${sessionId}: ${log.length} actions, ${scores.length} item scores → /coach/${sessionId}`);
process.exit(0);
