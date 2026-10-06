import type { Action, ItemScore, MarkSheet, MarkSheetItem, Override, Rule, SessionMode } from "@/domain/schemas";
import { verifyEvidence } from "./evidence";
import { evaluateRule } from "./rules";

const round = (n: number) => Math.round(n * 100) / 100;

/** Is this item scored in this session mode? (e.g. time-dependent items are exam-only) */
export function appliesInMode(item: Pick<MarkSheetItem, "modes">, mode: SessionMode): boolean {
  return !item.modes || item.modes.includes(mode);
}

/**
 * Deterministic scoring of every `auto` item, plus placeholder rows for `not_assessable` items
 * and for items that don't apply in this session mode.
 */
export function scoreDeterministicItems(sheet: MarkSheet, log: Action[], mode: SessionMode = "exam"): ItemScore[] {
  const out: ItemScore[] = [];
  for (const item of sheet.items) {
    if (!appliesInMode(item, mode)) {
      out.push({
        markSheetId: sheet.id,
        itemId: item.id,
        scoring: "not_assessable",
        status: "not_assessable",
        value: 0,
        points: 0,
        maxPoints: 0,
        rationale: `Only scored in ${item.modes!.join("/")} mode.`,
        evidence: [],
      });
    } else if (item.scoring === "not_assessable") {
      out.push({
        markSheetId: sheet.id,
        itemId: item.id,
        scoring: "not_assessable",
        status: "not_assessable",
        value: 0,
        points: 0,
        maxPoints: 0,
        rationale: item.notAssessableReason ?? "Cannot be assessed from this interface.",
        evidence: [],
      });
    } else if (item.scoring === "auto") {
      const r = evaluateRule(item.rule!, log);
      out.push({
        markSheetId: sheet.id,
        itemId: item.id,
        scoring: "auto",
        status: "scored",
        value: round(r.value),
        points: round(r.value * item.weight),
        maxPoints: item.weight,
        rationale: describeAuto(item.rule!, r.value),
        evidence: r.actionIds.map((actionId) => ({ actionId, quote: "", verified: true })),
      });
    }
  }
  return out;
}

export interface AiItemJudgement {
  itemId: string;
  score: number; // 0..1
  rationale: string;
  evidence: { actionId: string; quote: string }[];
}

/**
 * Turns raw grader output into ItemScores, verifying every quote against the log.
 * An item is `needs_review` if: the grader skipped it, any quote fails verification,
 * or it awarded credit without evidence.
 */
export function scoreAiItems(sheet: MarkSheet, judgements: AiItemJudgement[], log: Action[], mode: SessionMode = "exam"): ItemScore[] {
  const byId = new Map(judgements.map((j) => [j.itemId, j]));
  return sheet.items
    .filter((i) => i.scoring === "ai" && appliesInMode(i, mode))
    .map((item): ItemScore => {
      const j = byId.get(item.id);
      if (!j) {
        return {
          markSheetId: sheet.id,
          itemId: item.id,
          scoring: "ai",
          status: "needs_review",
          value: 0,
          points: 0,
          maxPoints: item.weight,
          rationale: "The grader returned no judgement for this item.",
          evidence: [],
        };
      }
      const value = Math.max(0, Math.min(1, j.score));
      const evidence = verifyEvidence(j.evidence, log);
      const unverified = evidence.some((e) => !e.verified);
      const creditWithoutEvidence = value > 0 && evidence.length === 0;
      const reasons = [
        unverified ? "a quoted line could not be found verbatim in the transcript" : "",
        creditWithoutEvidence ? "credit was given without quoted evidence" : "",
      ].filter(Boolean);
      return {
        markSheetId: sheet.id,
        itemId: item.id,
        scoring: "ai",
        status: reasons.length ? "needs_review" : "scored",
        value: round(value),
        points: round(value * item.weight),
        maxPoints: item.weight,
        rationale: reasons.length ? `${j.rationale} [Needs review: ${reasons.join("; ")}.]` : j.rationale,
        evidence,
      };
    });
}

export interface EffectiveScore extends ItemScore {
  override?: Override;
}

/** Latest override wins; the original score is always kept on the row. */
export function applyOverrides(scores: ItemScore[], overrides: Override[]): EffectiveScore[] {
  return scores.map((s) => {
    const latest = overrides
      .filter((o) => o.markSheetId === s.markSheetId && o.itemId === s.itemId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .at(-1);
    return latest ? { ...s, override: latest, points: latest.newPoints } : s;
  });
}

export interface SheetTotals {
  points: number;
  maxPoints: number;
  needsReview: number;
  notAssessable: number;
}

export function totals(scores: EffectiveScore[]): SheetTotals {
  let points = 0;
  let maxPoints = 0;
  let needsReview = 0;
  let notAssessable = 0;
  for (const s of scores) {
    if (s.status === "not_assessable") {
      notAssessable++;
      continue;
    }
    if (s.status === "needs_review" && !s.override) needsReview++;
    points += s.points;
    maxPoints += s.maxPoints;
  }
  return { points: round(points), maxPoints: round(maxPoints), needsReview, notAssessable };
}

export function itemFor(sheet: MarkSheet, itemId: string): MarkSheetItem | undefined {
  return sheet.items.find((i) => i.id === itemId);
}

function describeAuto(rule: Rule, value: number): string {
  const done = value === 1;
  if ("performed" in rule) {
    if (rule.regions?.length) {
      return done
        ? `Performed at all ${rule.regions.length} required locations.`
        : value > 0
          ? `Performed at ${Math.round(value * rule.regions.length)} of ${rule.regions.length} required locations.`
          : "Not performed at the required locations.";
    }
    return done ? "Performed." : "Not performed.";
  }
  if ("courtesy" in rule) return done ? "Done." : "Not done.";
  if ("before" in rule) return done ? "Done in the expected order." : "Not done, or not in the expected order.";
  if ("performedIn" in rule) return done ? "Performed with the patient correctly positioned." : "Not performed in the correct position.";
  if ("submitted" in rule) return done ? "Submitted." : "Not submitted.";
  return done ? "All criteria met." : value > 0 ? "Partly met." : "Not met.";
}
