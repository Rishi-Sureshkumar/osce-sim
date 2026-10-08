/**
 * The deterministic standardised patient (Phase 4 M1): a student turn → the patient's reply, built
 * only from case text and the fixed conversation bank. Each bundled question gets its own answer
 * (deduplicated); "anything else?" volunteers one unasked fact at a time; empathy is acknowledged
 * with the case's cue for the patient's current emotion. Pure: the server passes the bank, the
 * prior log, and how each clause matched.
 */
import type { Action, Case, Emotion, UtteranceMatch } from "@/domain/schemas";
import type { MatchBank, Target } from "./bank";
import type { ClauseMatch } from "./matcher";
import { questionType } from "./question";

/** a clause that asks (a question or a request to tell), not an explanation or a statement */
const REQUEST = /\b(?:tell me|let me know|i(?: would|d) like to (?:know|ask|hear)|i want to (?:know|ask)|let us talk about|lets talk about|describe|walk me through|talk me through)\b/;
export const asks = (clause: string) => questionType(clause) !== "statement" || REQUEST.test(clause);

export interface DialogueState {
  /** targets the patient has already answered (fact:… etc.), oldest first */
  answered: string[];
  /** times each conversational kind was used (to rotate its replies) */
  convCount: Record<string, number>;
  emotion: Emotion | null;
  lastFactId: string | null;
  /** what the patient said last (for "sorry, could you say that again?") */
  lastPatientText: string | null;
}

/** Rebuild the dialogue state from the log (patient_say.match). */
export function dialogueState(log: readonly Action[], bank: MatchBank): DialogueState {
  const s: DialogueState = { answered: [], convCount: {}, emotion: null, lastFactId: null, lastPatientText: null };
  for (const a of log) {
    if (a.type === "patient_say") s.lastPatientText = a.payload.text;
    if (a.type !== "patient_say" || !a.payload.match) continue;
    for (const c of a.payload.match.clauses) {
      if (c.target === "unknown") continue;
      s.answered.push(c.target);
      const t = bank.byId.get(c.target);
      if (!t) continue;
      if (t.kind === "conversation") s.convCount[t.id] = (s.convCount[t.id] ?? 0) + 1;
      if (t.kind === "fact" || t.kind === "follow_up") s.lastFactId = t.kind === "fact" ? t.id : (t.parent ?? null);
      if (t.emotion) s.emotion = t.emotion;
    }
  }
  return s;
}

export interface PatientCase {
  patient: Pick<Case["patient"], "name">;
  history: Pick<Case["history"], "openingStatement" | "unknownPolicy" | "emotionCues">;
}

function fill(text: string, kase: PatientCase, studentName: string | null): string {
  const parts = kase.patient.name.split(/\s+/);
  const last = parts.at(-1) ?? kase.patient.name;
  return text
    .replace(/\{patient\.name\}/g, kase.patient.name)
    .replace(/\{patient\.firstName\}/g, parts[0] ?? kase.patient.name)
    .replace(/\{patient\.lastName\}/g, last)
    .replace(/\s*\{student\.name\}/g, studentName ? ` ${studentName}` : "")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}

export interface ReplyResult {
  text: string;
  match: UtteranceMatch;
  /** targets answered by this reply (including a fact volunteered on "anything else?") */
  answered: string[];
}

const KIND: Record<Target["kind"], UtteranceMatch["clauses"][number]["kind"]> = { fact: "fact", negative: "negative", follow_up: "follow_up", conversation: "conversation", bank: "bank" };

export function patientReply(kase: PatientCase, bank: MatchBank, state: DialogueState, clauses: ClauseMatch[], opts: { studentName?: string | null; embedding?: UtteranceMatch["embedding"]; questionClauses?: ReadonlySet<string> } = {}): ReplyResult {
  const parts: string[] = [];
  const answered: string[] = [];
  /** targets the student actually asked about (history coverage counts these, not volunteered facts) */
  const asked: string[] = [];
  const say = (t: string) => {
    const x = fill(t, kase, opts.studentName ?? null);
    if (x && !parts.includes(x)) parts.push(x);
  };
  const conv = { ...state.convCount };
  const seen = new Set(state.answered);
  let unknown = false;
  const recorded: UtteranceMatch["clauses"] = [];
  for (const c of clauses) {
    const t = c.target;
    recorded.push({ text: c.text, target: t?.id ?? "unknown", kind: t ? KIND[t.kind] : "unknown", score: +c.score.toFixed(3), via: c.via });
    if (!t) {
      unknown = true;
      continue;
    }
    answered.push(t.id);
    if (asks(c.text) || opts.questionClauses?.has(c.text)) asked.push(t.id);
    seen.add(t.id);
    const r = t.reply;
    if (r.type === "text") say(r.text);
    else if (r.type === "policy") say(r.which === "negative" ? kase.history.unknownPolicy.negativeReply : kase.history.unknownPolicy.unknownReply);
    else if (r.kind === "opening") say(kase.history.openingStatement);
    else if (r.kind === "anything_else") {
      const next = bank.targets.find((x) => x.kind === "fact" && x.volunteer && !seen.has(x.id) && x.reply.type === "text");
      if (next && next.reply.type === "text") {
        say(next.reply.text);
        answered.push(next.id);
        seen.add(next.id);
        recorded.push({ text: "(volunteered)", target: next.id, kind: "fact", score: 1, via: "none" });
      } else say(r.replies[(conv[t.id] ?? 0) % Math.max(1, r.replies.length)] ?? "");
    } else if (r.kind === "repeat") {
      say(r.replies[(conv[t.id] ?? 0) % Math.max(1, r.replies.length)] ?? "");
      if (state.lastPatientText) say(state.lastPatientText);
    } else if (r.kind === "empathy") {
      const cue = state.emotion ? kase.history.emotionCues.find((e) => e.emotion === state.emotion) : undefined;
      say(cue?.acknowledgement ?? r.replies[(conv[t.id] ?? 0) % Math.max(1, r.replies.length)] ?? "");
    } else {
      say(r.replies[(conv[t.id] ?? 0) % Math.max(1, r.replies.length)] ?? "");
    }
    if (t.kind === "conversation") conv[t.id] = (conv[t.id] ?? 0) + 1;
  }
  if (!parts.length || (unknown && parts.length === 0)) say(kase.history.unknownPolicy.unknownReply);
  const topics = [...new Set(asked.flatMap((id) => bank.byId.get(id)?.topics ?? []))];
  return { text: parts.join(" "), match: { clauses: recorded.slice(0, 6), topics, embedding: opts.embedding ?? "none" }, answered };
}
