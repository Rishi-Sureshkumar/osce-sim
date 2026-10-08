/**
 * Scoring the chat fixtures (tests/fixtures/chat/<caseId>.json) against the matcher (Phase 4 M1).
 * An item is right when every expected target was answered and no other history target was:
 *   - a follow-up counts as its fact (`followup:orthopnea/…` satisfies `fact:orthopnea`)
 *   - `bank:*` is any generic history-bank entry; `unknown` means nothing matched
 *   - extra conversational matches are fine ("Hi, any chest pain?" may also greet)
 */
import type { MatchBank } from "./bank";
import type { ClauseMatch } from "./matcher";

export interface FixtureItem {
  q: string;
  expect: string[];
  note?: string;
}

export interface ItemResult {
  q: string;
  expect: string[];
  got: string[];
  ok: boolean;
}

function canonical(id: string, bank: MatchBank): string {
  const t = bank.byId.get(id);
  if (t?.kind === "follow_up" && t.parent) return t.parent;
  if (t?.kind === "bank") return "bank:*";
  return id;
}

export function scoreItem(item: FixtureItem, clauses: ClauseMatch[], bank: MatchBank): ItemResult {
  const got = clauses.map((c) => (c.target ? c.target.id : "unknown"));
  const norm = new Set(got.map((g) => (g === "unknown" ? g : canonical(g, bank))));
  const expected = new Set(item.expect.map((e) => (e.startsWith("bank:") ? "bank:*" : e)));
  const allFound = [...expected].every((e) => (e === "unknown" ? [...norm].every((g) => g === "unknown" || g.startsWith("conv:")) : norm.has(e)));
  const extra = [...norm].filter((g) => !expected.has(g) && g !== "unknown" && !g.startsWith("conv:"));
  return { q: item.q, expect: item.expect, got, ok: allFound && extra.length === 0 };
}

export function confusion(results: ItemResult[]): string {
  const bad = results.filter((r) => !r.ok);
  return bad.map((r) => `  ✗ "${r.q}"\n      expected ${r.expect.join(" + ")}\n      got      ${r.got.join(" + ")}`).join("\n");
}
