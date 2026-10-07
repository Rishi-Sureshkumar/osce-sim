/**
 * The match bank for one case (Phase 4 M1): every thing a student might ask or say that has a
 * fixed reply — the case's history facts, follow-ups and pertinent negatives, conversational turns
 * (case overrides first, then content/lang/conversation.json) and generic history questions
 * (content/lang/history-bank.json, answered with the case's own unknownPolicy text). Pure; the
 * server builds it from content and keeps it for the case.
 */
import type { Case, ConversationKind, ConversationReply, Emotion, Intent } from "@/domain/schemas";
import { makeNormalizer, type Normalizer, type SynonymEntry } from "./normalize";

export type TargetKind = "fact" | "negative" | "follow_up" | "conversation" | "bank";

export type Reply =
  | { type: "text"; text: string }
  | { type: "conversation"; kind: ConversationKind; replies: string[] }
  | { type: "policy"; which: "negative" | "unknown" };

export interface Target {
  /** fact:<id> · neg:<id> · followup:<factId>/<id> · conv:<kind> · bank:<id> */
  id: string;
  kind: TargetKind;
  intent: Intent;
  /** normalised canonical + paraphrases (what embeddings and exact matching use) */
  phrases: string[];
  /** normalised keywords */
  keywords: string[];
  patterns: RegExp[];
  topics: string[];
  /** follow-ups: their fact's target id */
  parent?: string;
  emotion?: Emotion;
  /** fact may be volunteered on "anything else?" */
  volunteer?: boolean;
  reply: Reply;
  /** 3 case history · 2 conversation · 1 generic bank */
  priority: number;
}

export interface HistoryBankEntry {
  id: string;
  topic: string;
  intents: Intent;
  reply: "negative" | "unknown";
}

export interface MatchBank {
  caseId: string;
  targets: Target[];
  byId: Map<string, Target>;
  /** normalised phrase → targets that list it (exact matching) */
  exact: Map<string, Target[]>;
  normalize: Normalizer;
}

export interface BankSources {
  synonyms: SynonymEntry[];
  conversation: ConversationReply[];
  history: HistoryBankEntry[];
}

const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
export const negativeId = (n: { id?: string; topic: string }) => n.id ?? `neg-${slugify(n.topic)}`;

function compilePatterns(src: string[]): RegExp[] {
  const out: RegExp[] = [];
  for (const s of src) {
    try {
      out.push(new RegExp(s, "i"));
    } catch {
      /* invalid patterns are reported by npm run validate */
    }
  }
  return out;
}

export function buildBank(kase: Pick<Case, "id" | "history">, src: BankSources): MatchBank {
  const normalize = makeNormalizer(src.synonyms);
  const targets: Target[] = [];
  const add = (t: Omit<Target, "phrases" | "keywords" | "patterns" | "topics"> & { legacyKeywords?: string[] }) => {
    const phrases = [...new Set([t.intent.canonical, ...t.intent.paraphrases].map(normalize).filter(Boolean))];
    const keywords = [...new Set([...t.intent.keywords, ...(t.legacyKeywords ?? [])].map(normalize).filter(Boolean))];
    const { legacyKeywords: _l, ...rest } = t;
    targets.push({ ...rest, phrases, keywords, patterns: compilePatterns(t.intent.patterns), topics: t.intent.topics });
  };
  const intentOr = (i: Intent | undefined, fallback: string): Intent => i ?? { canonical: fallback, paraphrases: [], keywords: [], patterns: [], topics: [] };

  for (const f of kase.history.facts) {
    // legacy keywords only stand in when no intents were authored (they misroute: see docs/CASE_AUTHORING.md)
    add({ id: `fact:${f.id}`, kind: "fact", intent: intentOr(f.intents, f.topic), legacyKeywords: f.intents ? [] : f.keywords, reply: { type: "text", text: f.answer }, priority: 3, ...(f.emotion ? { emotion: f.emotion } : {}), volunteer: !f.revealOnlyIfAsked });
    for (const u of f.followUps ?? []) {
      add({ id: `followup:${f.id}/${u.id}`, kind: "follow_up", intent: u.intents, parent: `fact:${f.id}`, reply: { type: "text", text: u.answer }, priority: 3, ...(u.emotion ? { emotion: u.emotion } : {}) });
    }
  }
  for (const n of kase.history.pertinentNegatives) {
    add({ id: `neg:${negativeId(n)}`, kind: "negative", intent: intentOr(n.intents, n.topic), legacyKeywords: n.intents ? [] : n.keywords, reply: { type: "text", text: n.answer }, priority: 3, ...(n.emotion ? { emotion: n.emotion } : {}) });
  }
  // conversation: the case's own entries replace the bank's for the same kind (replies), and add intents
  const caseConv = new Map(kase.history.conversation.map((c) => [c.kind, c]));
  const kinds = new Set([...src.conversation.map((c) => c.kind), ...caseConv.keys()]);
  for (const kind of kinds) {
    const base = src.conversation.find((c) => c.kind === kind);
    const own = caseConv.get(kind);
    const intent: Intent | undefined = own?.intents && base?.intents ? { ...base.intents, paraphrases: [...base.intents.paraphrases, ...own.intents.paraphrases].slice(0, 30), keywords: [...base.intents.keywords, ...own.intents.keywords] } : (own?.intents ?? base?.intents);
    if (!intent) continue;
    add({ id: `conv:${kind}`, kind: "conversation", intent, reply: { type: "conversation", kind, replies: own?.replies ?? base?.replies ?? [] }, priority: 2, ...(own?.emotion ? { emotion: own.emotion } : {}) });
  }
  for (const h of src.history) {
    add({ id: `bank:${h.id}`, kind: "bank", intent: h.intents, reply: { type: "policy", which: h.reply }, priority: 1 });
  }

  const exact = new Map<string, Target[]>();
  for (const t of targets) for (const p of t.phrases) exact.set(p, [...(exact.get(p) ?? []), t]);
  return { caseId: kase.id, targets, byId: new Map(targets.map((t) => [t.id, t])), exact, normalize };
}
