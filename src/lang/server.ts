import "server-only";
/**
 * Server side of the deterministic language layer (Phase 4 M1): one MatchBank per case (case
 * history + content/lang banks), phrase vectors from src/lang/generated (npm run lang:embed) or
 * embedded once on first use, and `understand()`: a student turn → clauses, matches and the
 * patient's reply. Browser-computed clause vectors are used only to pick which fixed reply to give,
 * and only when they look like our model's output; grading never reads client data.
 */
import fs from "node:fs";
import path from "node:path";
import { getContent } from "@/content/load";
import type { Action, Case } from "@/domain/schemas";
import { buildBank, type MatchBank } from "./bank";
import { embedTexts } from "./embed/node";
import { EMBED_MODEL, isValidEmbedding, unpack, type PackedVector } from "./embed/vectors";
import type { ClauseMatch } from "./matcher";
import { NORMALIZER_VERSION } from "./normalize";
import type { ReplyResult } from "./patient";
import { splitClauses } from "./split";
import { understandTurn } from "./understand";

export interface GeneratedVectors {
  model: string;
  normalizer: number;
  phrases: Record<string, PackedVector>;
}

const GENERATED = path.join(process.cwd(), "src/lang/generated");

interface Prepared {
  bank: MatchBank;
  vectors: Map<string, Float32Array>;
  ready: Promise<void>;
}
const prepared = new Map<string, Prepared>();

function readGenerated(file: string): Map<string, Float32Array> {
  const out = new Map<string, Float32Array>();
  const f = path.join(GENERATED, file);
  if (!fs.existsSync(f)) return out;
  const g = JSON.parse(fs.readFileSync(f, "utf8")) as GeneratedVectors;
  if (g.model !== EMBED_MODEL || g.normalizer !== NORMALIZER_VERSION) return out;
  for (const [p, v] of Object.entries(g.phrases)) out.set(p, unpack(v));
  return out;
}

/** The case's bank and phrase vectors (missing vectors are embedded once, in the background). */
export function prepare(kase: Case): Prepared {
  const hit = prepared.get(kase.id);
  if (hit) return hit;
  const lang = getContent().lang;
  const bank = buildBank(kase, { synonyms: lang.synonyms, conversation: lang.conversation, history: lang.history });
  const vectors = new Map([...readGenerated("banks.json"), ...readGenerated(`${kase.id}.json`)]);
  const missing = [...new Set(bank.targets.flatMap((t) => t.phrases))].filter((p) => !vectors.has(p));
  const ready = missing.length
    ? embedTexts(missing).then((vs) => {
        vs?.forEach((v, i) => vectors.set(missing[i]!, v));
      })
    : Promise.resolve();
  const p = { bank, vectors, ready };
  prepared.set(kase.id, p);
  return p;
}

export interface ClientClauseVector {
  text: string;
  vector: number[];
}

export interface Understood {
  clauses: ClauseMatch[];
  reply: ReplyResult;
  embedding: "client" | "server" | "none";
}

/** A student turn → what was asked and the patient's (fixed-text) reply. */
export async function understand(kase: Case, log: readonly Action[], raw: string, opts: { clientVectors?: ClientClauseVector[]; clientModel?: string; studentName?: string | null } = {}): Promise<Understood> {
  const p = prepare(kase);
  await p.ready;
  const texts = splitClauses(raw, p.bank.normalize);
  const fromClient = new Map<string, Float32Array>();
  if (opts.clientModel === EMBED_MODEL) for (const c of opts.clientVectors ?? []) if (isValidEmbedding(c.vector)) fromClient.set(c.text, Float32Array.from(c.vector));
  const needServer = texts.filter((t) => !fromClient.has(t));
  const serverVecs = needServer.length && p.vectors.size ? await embedTexts(needServer) : null;
  const clauseVec = (t: string) => fromClient.get(t) ?? (serverVecs ? serverVecs[needServer.indexOf(t)] : undefined) ?? null;
  const embedding: Understood["embedding"] = !p.vectors.size ? "none" : fromClient.size && !needServer.length ? "client" : serverVecs ? "server" : fromClient.size ? "client" : "none";

  const r = understandTurn(kase, p.bank, log, raw, { phrase: (ph) => p.vectors.get(ph), clause: clauseVec }, { studentName: opts.studentName ?? null, embedding });
  return { ...r, embedding };
}

/** For the dev chat tester and tests: the bank of a case. */
export function bankFor(kase: Case): MatchBank {
  return prepare(kase).bank;
}
