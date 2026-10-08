/**
 * One student turn → clauses, matches and the patient's reply (pure core of the deterministic
 * patient, Phase 4 M1). The server (src/lang/server.ts), the seed script and the tests share it;
 * vectors are passed in, so nothing here loads a model.
 */
import type { Action } from "@/domain/schemas";
import { orderLog } from "@/engine/order";
import type { MatchBank } from "./bank";
import { matchClause, type ClauseMatch } from "./matcher";
import { asks, dialogueState, patientReply, type PatientCase, type ReplyResult } from "./patient";
import { questionClauses, splitClauses } from "./split";

export interface TurnVectors {
  /** bank phrase → vector */
  phrase: (p: string) => Float32Array | null | undefined;
  /** clause text → vector */
  clause: (c: string) => Float32Array | null | undefined;
}

export interface TurnResult {
  clauses: ClauseMatch[];
  reply: ReplyResult;
}

export function understandTurn(kase: PatientCase, bank: MatchBank, log: readonly Action[], raw: string, vectors: TurnVectors | null, opts: { studentName?: string | null; embedding?: "client" | "server" | "none" } = {}): TurnResult {
  const state = dialogueState(log, bank);
  const clauses: ClauseMatch[] = [];
  let lastFactId = state.lastFactId;
  for (const t of splitClauses(raw, bank.normalize)) {
    const m = matchClause(t, bank, vectors ? { clauseVector: vectors.clause(t), phraseVector: vectors.phrase, lastFactId } : { lastFactId });
    clauses.push(m);
    if (m.target?.kind === "fact") lastFactId = m.target.id;
    if (m.target?.kind === "follow_up") lastFactId = m.target.parent ?? lastFactId;
  }
  return { clauses, reply: patientReply(kase, bank, state, clauses, { studentName: opts.studentName ?? null, embedding: opts.embedding ?? (vectors ? "server" : "none"), questionClauses: questionClauses(raw, bank.normalize) }) };
}

export interface AskedTopics {
  topics: string[];
  /** the (normalised) clauses that asked, for quoting the right sentence */
  clauses: string[];
}

/**
 * For grading: the history topics each student `say` asked about, recomputed from the say's own text
 * with the vectors the caller trusts (the server's). What was stored on patient_say at chat time
 * (possibly picked with browser-supplied vectors) is never used for scores. Facts the patient
 * volunteered and the student's statements or explanations earn nothing.
 */
export function askedTopics(bank: MatchBank, log: readonly Action[], vectors: TurnVectors | null): Map<string, AskedTopics> {
  const out = new Map<string, AskedTopics>();
  let lastFactId: string | null = null;
  for (const a of orderLog(log)) {
    if (a.type !== "say") continue;
    const qs = questionClauses(a.payload.text, bank.normalize);
    const topics: string[] = [];
    const asked: string[] = [];
    for (const t of splitClauses(a.payload.text, bank.normalize)) {
      const m = matchClause(t, bank, vectors ? { clauseVector: vectors.clause(t), phraseVector: vectors.phrase, lastFactId } : { lastFactId });
      const target = m.target;
      if (!target) continue;
      if (target.kind === "fact") lastFactId = target.id;
      if (target.kind === "follow_up") lastFactId = target.parent ?? lastFactId;
      if (target.kind === "conversation" || !(asks(t) || qs.has(t))) continue;
      topics.push(...target.topics);
      asked.push(t);
    }
    if (topics.length) out.set(a.id, { topics: [...new Set(topics)], clauses: asked });
  }
  return out;
}
