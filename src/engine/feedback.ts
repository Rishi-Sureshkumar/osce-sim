/**
 * Narrative feedback from the scores (Phase 4 M1): no model writes it. The summary, strengths and
 * improvements are templates over the graded items, the two 1B domains and the note cross-check,
 * so every sentence traces back to a scored item (and its verbatim evidence where there is some).
 */
import type { ItemScore, MarkSheet } from "@/domain/schemas";
import type { PenCheckResult } from "./penCheck";
import { domainTotals, stationPass, type EffectiveScore } from "./scoring";

export interface Feedback {
  summary: string;
  strengths: string[];
  improvements: string[];
}

const pct = (got: number, max: number) => (max > 0 ? Math.round((100 * got) / max) : 0);

export function deterministicFeedback(args: { sheets: MarkSheet[]; scores: ItemScore[]; pen?: PenCheckResult | null; studentFacing?: boolean }): Feedback {
  const { sheets, scores } = args;
  const item = (s: ItemScore) => sheets.find((x) => x.id === s.markSheetId)?.items.find((i) => i.id === s.itemId);
  const scored = scores.filter((s) => s.status !== "not_assessable" && s.maxPoints > 0);
  const got = scored.reduce((n, s) => n + s.points, 0);
  const max = scored.reduce((n, s) => n + s.maxPoints, 0);
  const domains = domainTotals(scores as EffectiveScore[], sheets);
  const pass = stationPass(domains);
  const review = scores.filter((s) => s.status === "needs_review").length;

  // sections: best and weakest by fraction (at least 2 items)
  const bySection = new Map<string, { got: number; max: number; n: number }>();
  for (const s of scored) {
    const sec = item(s)?.section ?? "Other";
    const x = bySection.get(sec) ?? { got: 0, max: 0, n: 0 };
    bySection.set(sec, { got: x.got + s.points, max: x.max + s.maxPoints, n: x.n + 1 });
  }
  const sections = [...bySection].filter(([, v]) => v.n >= 2 && v.max > 0).map(([k, v]) => ({ k, f: v.got / v.max }));
  sections.sort((a, b) => b.f - a.f);
  const best = sections[0];
  const worst = sections.at(-1);

  const domainLine = domains.length
    ? domains.map((d) => `${d.title}: ${Math.round(d.fraction * 100)}%${d.pass === null ? "" : d.pass ? " (pass)" : " (below the pass mark)"}`).join("; ")
    : "";
  const summary = [
    `You earned ${Math.round(got * 10) / 10} of ${Math.round(max * 10) / 10} points (${pct(got, max)}%).`,
    domainLine ? `${domainLine}.` : "",
    pass === true ? (domains.length > 1 ? "Both domains pass." : "The station passes.") : pass === false ? "At least one domain is below its pass mark." : "",
    best && worst && best.k !== worst.k ? `Strongest area: ${best.k} (${Math.round(best.f * 100)}%). Weakest: ${worst.k} (${Math.round(worst.f * 100)}%).` : "",
    review ? `${review} item${review === 1 ? "" : "s"} will be confirmed by a coach.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  // strengths: full-credit items with the most weight, preferring ones with quoted evidence
  const strengths = scored
    .filter((s) => s.value >= 1)
    .sort((a, b) => b.maxPoints - a.maxPoints || b.evidence.length - a.evidence.length)
    .slice(0, 4)
    .map((s) => {
      const q = s.evidence.find((e) => e.verified)?.quote;
      return `${item(s)?.label ?? s.itemId}${q ? ` — “${q.length > 90 ? `${q.slice(0, 87)}…` : q}”` : "."}`;
    });

  // improvements: missed items with the most weight; unperformed exams claimed in the note first
  const flagged = (args.pen?.claims ?? []).filter((c) => c.status === "flagged").slice(0, 2).map((c) => `Your note says “${c.text}”, but that exam wasn't done in the encounter. Only write what you examined.`);
  const missed = scored
    .filter((s) => s.value < 1 && s.status === "scored")
    .sort((a, b) => b.maxPoints - b.points - (a.maxPoints - a.points))
    .slice(0, Math.max(0, 4 - flagged.length))
    // the item label only: `guidance` is written for graders ("Credit if…"), not for students
    .map((s) => `${s.value > 0 ? "Partly done" : "Missed"}: ${item(s)?.label ?? s.itemId}.`);
  return { summary, strengths, improvements: [...flagged, ...missed] };
}
