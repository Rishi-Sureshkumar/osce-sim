/**
 * One student turn → clauses, matches and the patient's reply (pure core of the deterministic
 * patient, Phase 4 M1). The server (src/lang/server.ts), the seed script and the tests share it;
 * vectors are passed in, so nothing here loads a model.
 */
import type { Action } from "@/domain/schemas";
import type { MatchBank } from "./bank";
import { matchClause, type ClauseMatch } from "./matcher";
import { dialogueState, patientReply, type PatientCase, type ReplyResult } from "./patient";
import { splitClauses } from "./split";

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
  return { clauses, reply: patientReply(kase, bank, state, clauses, { studentName: opts.studentName ?? null, embedding: opts.embedding ?? (vectors ? "server" : "none") }) };
}
