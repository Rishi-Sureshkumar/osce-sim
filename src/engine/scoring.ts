import type { Action, Domain, ItemScore, MarkSheet, MarkSheetItem, Override, Rule, SessionMode } from "@/domain/schemas";
import type { PenCheckResult } from "./penCheck";
import { PEN_CONSISTENCY_ITEM, PEN_SHEET } from "./penItems";
import { domainOf } from "./sheets";
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
    .filter((i) => i.scoring === "match" && appliesInMode(i, mode))
    .map((item): ItemScore => {
      const j = byId.get(item.id);
      if (!j) {
        return {
          markSheetId: sheet.id,
          itemId: item.id,
          scoring: "match",
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
        scoring: "match",
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

export const DOMAIN_TITLES: Record<Domain, string> = { patient_encounter: "Patient Encounter Skills", communication: "Communication Skills" };

export interface DomainTotal extends SheetTotals {
  domain: Domain;
  title: string;
  /** 0..1 */
  fraction: number;
  /** fraction needed to pass (highest passThreshold among the domain's sheets), or null if none set */
  threshold: number | null;
  pass: boolean | null;
}

/**
 * Pass/fail per 1B domain from the (overridden) item scores. A station passes only when every
 * domain it scores passes. Items needing review still count at their current points.
 */
export function domainTotals(scores: EffectiveScore[], sheets: readonly Pick<MarkSheet, "id" | "domain" | "kind" | "passThreshold">[]): DomainTotal[] {
  const out: DomainTotal[] = [];
  for (const domain of ["patient_encounter", "communication"] as const) {
    const ds = sheets.filter((s) => domainOf(s) === domain);
    if (!ds.length) continue;
    const ids = new Set(ds.map((s) => s.id));
    const t = totals(scores.filter((s) => ids.has(s.markSheetId)));
    const thresholds = ds.flatMap((s) => (s.passThreshold !== undefined ? [s.passThreshold] : []));
    const threshold = thresholds.length ? Math.max(...thresholds) : null;
    const fraction = t.maxPoints ? t.points / t.maxPoints : 0;
    out.push({ ...t, domain, title: DOMAIN_TITLES[domain], fraction: round(fraction), threshold, pass: threshold === null ? null : fraction >= threshold - 1e-9 });
  }
  return out;
}

export function stationPass(domains: DomainTotal[]): boolean | null {
  if (!domains.length || domains.some((d) => d.pass === null)) return null;
  return domains.every((d) => d.pass);
}

/**
 * The deterministic PEN consistency item: full credit for a note whose exam section reports only
 * performed maneuvers; each flagged claim costs half the item (floor 0).
 */
export function applyPenCheck(scores: ItemScore[], check: PenCheckResult, pen: Extract<Action, { type: "submit_pen" }> | undefined): ItemScore[] {
  return scores.map((s) => {
    if (s.markSheetId !== PEN_SHEET || s.itemId !== PEN_CONSISTENCY_ITEM || s.status === "not_assessable") return s;
    if (!pen) return { ...s, value: 0, points: 0, rationale: "No post-encounter note was submitted." };
    const flagged = check.claims.filter((c) => c.status === "flagged");
    const value = Math.max(0, 1 - 0.5 * flagged.length);
    return {
      ...s,
      value,
      points: round(value * s.maxPoints),
      rationale: flagged.length
        ? `Reported without performing the exam: ${flagged.map((c) => `“${c.text}”`).join("; ")}.`
        : `All ${check.linked} exam claim(s) that name a maneuver are backed by an exam in the log.`,
      evidence: flagged.map((c) => ({ actionId: pen.id, quote: c.text, verified: pen.payload.exam.includes(c.text) })),
    };
  });
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
