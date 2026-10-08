/**
 * Mistake alerts (Phase 4 M4), pure. Rules are data (content/mistakes.json plus a case's own
 * `mistakes`), written in the same rule language as the mark sheets. After every appended student
 * action the server asks which rules that action fires; each fired rule becomes a system `mistake`
 * action in the log (alerted to the student only in practice, or when alerts are switched on).
 */
import type { Action, MistakeRule, SessionSettings } from "@/domain/schemas";
import { evaluateRule, findEvent, type RuleContext } from "./rules";
import { patientState } from "./patientState";

export interface MistakeContext {
  mode: "practice" | "exam";
  /** the case patient's sex (rules can apply to one) */
  sex?: "female" | "male" | "intersex";
  caseMode?: "encounter" | "screening";
  rules?: RuleContext;
}

export interface MistakeHit {
  rule: MistakeRule;
  causeActionId: string;
}

const list = <T>(x: T | T[] | undefined): T[] => (x === undefined ? [] : Array.isArray(x) ? x : [x]);

/** Does `a` match the rule's trigger.on? */
export function triggerMatches(rule: MistakeRule, a: Action, log: Action[]): boolean {
  const on = rule.trigger.on;
  if (on.type) {
    if (on.type === "touch") {
      if (!(a.type === "examine" && a.payload.touch !== false)) return false;
    } else if (a.type !== on.type) return false;
  }
  if (on.ref && findEvent([a], on.ref) !== a) return false;
  const maneuverId = a.type === "examine" ? a.payload.maneuverId : a.type === "tool_contact" ? a.payload.maneuverId : undefined;
  const regionId = a.type === "examine" || a.type === "prohibited_attempt" || a.type === "describe_exam" ? a.payload.regionId : a.type === "tool_contact" ? a.payload.nearestRegionId : undefined;
  if (on.maneuver && !(maneuverId && list(on.maneuver).includes(maneuverId))) return false;
  if (on.region && !(regionId && list(on.region).includes(regionId))) return false;
  if (on.tool && !((a.type === "examine" || a.type === "tool_contact") && a.payload.tool === on.tool)) return false;
  if (on.toolMode && !((a.type === "examine" || a.type === "tool_contact") && a.payload.toolMode === on.toolMode)) return false;
  if (on.position) {
    const st = patientState(log, Infinity, { beforeActionId: a.id });
    if (!list(on.position).includes(st.position)) return false;
  }
  return true;
}

/**
 * The rules the action `a` (already in `log`) fires. A rule fires when its trigger matches, its
 * `when` holds and its `unless` does not (both judged on the log up to and including `a`), it
 * applies to this session's mode, patient and case, and (for `once` rules) it has not fired before.
 */
export function detectMistakes(rules: readonly MistakeRule[], log: readonly Action[], a: Action, ctx: MistakeContext): MistakeHit[] {
  const upTo = log.slice(0, log.findIndex((x) => x.id === a.id) + 1 || log.length);
  const fired = new Set(log.filter((x): x is Extract<Action, { type: "mistake" }> => x.type === "mistake").map((x) => x.payload.ruleId));
  const rctx: RuleContext = { ...ctx.rules, eventActionId: a.id };
  const out: MistakeHit[] = [];
  for (const rule of rules) {
    if (!rule.modes.includes(ctx.mode)) continue;
    if (rule.appliesTo?.sex && (!ctx.sex || !rule.appliesTo.sex.includes(ctx.sex))) continue;
    if (rule.appliesTo?.caseModes && (!ctx.caseMode || !rule.appliesTo.caseModes.includes(ctx.caseMode))) continue;
    if (rule.once && fired.has(rule.id)) continue;
    if (!triggerMatches(rule, a, upTo as Action[])) continue;
    if (rule.trigger.when && evaluateRule(rule.trigger.when, upTo as Action[], rctx).value < 1) continue;
    if (rule.trigger.unless && evaluateRule(rule.trigger.unless, upTo as Action[], rctx).value >= 1) continue;
    out.push({ rule, causeActionId: a.id });
    fired.add(rule.id);
  }
  return out;
}

/** Whether a fired mistake is shown to the student at the time (it is always logged). */
export function alertsOn(settings: Pick<SessionSettings, "alerts"> | null | undefined, mode: "practice" | "exam"): boolean {
  const alerts = settings?.alerts ?? "default";
  return alerts === "on" || (alerts === "default" && mode === "practice");
}
