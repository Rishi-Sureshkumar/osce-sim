import type { Action, DrapeSection, Position, Rule, StateCondition } from "@/domain/schemas";
import { orderLog } from "./order";
import { patientState, sectionsForRegion } from "./patientState";

/**
 * The ONE interpreter for `auto` mark-sheet rules. Rules are declarative predicates over the
 * append-only action log. Returns a value in [0, 1] (1 = fully achieved) plus the ids of the
 * actions that satisfied it (used as evidence links in the results page).
 */
export interface RuleResult {
  value: number;
  actionIds: string[];
}

/** Phase 4: extra context some rules need (all optional; mark sheets work without it). */
export interface RuleContext {
  /** regions.json drapeSections */
  regionSections?: Readonly<Record<string, readonly DrapeSection[]>>;
  /** the action being checked (mistake triggers): `state` rules look at the state just before it */
  eventActionId?: string;
  /** penCheck result for the submitted note */
  penFlagged?: number;
  /** "now" in ms since start (for idle-exposure rules); default = last action's t */
  nowT?: number;
}

const list = <T>(x: T | T[]): T[] => (Array.isArray(x) ? x : [x]);

function examines(log: Action[]) {
  return log.filter((a): a is Extract<Action, { type: "examine" }> => a.type === "examine");
}

/** Position the patient is in when log[actionIndex] happens (last `position` courtesy before it). `log` must be ordered. */
export function positionAt(log: Action[], actionIndex: number): Position | undefined {
  let pos: Position | undefined;
  for (let i = 0; i < actionIndex && i < log.length; i++) {
    const a = log[i]!;
    if (a.type === "courtesy" && a.payload.kind === "position" && a.payload.position) pos = a.payload.position;
    if (a.type === "state_change" && a.payload.position) pos = a.payload.position;
  }
  return pos;
}

/** Finds the action an event ref points at (see EventRef docs in schemas.ts). `log` must be ordered. */
export function findEvent(log: Action[], ref: string): Action | undefined {
  let mode: "first" | "last" = "first";
  let body = ref;
  if (ref.startsWith("last:")) {
    mode = "last";
    body = ref.slice(5);
  } else if (ref.startsWith("first:")) {
    body = ref.slice(6);
  }
  const match = (a: Action): boolean => {
    if (body.startsWith("maneuver:")) return a.type === "examine" && a.payload.maneuverId === body.slice(9);
    if (body.startsWith("position:")) {
      const p = body.slice(9);
      return (a.type === "courtesy" && a.payload.kind === "position" && a.payload.position === p) || (a.type === "state_change" && a.payload.position === p);
    }
    if (body === "touch") return a.type === "examine" && a.payload.touch !== false;
    if (body === "drape_change") {
      return (a.type === "courtesy" && ["drape", "expose", "cover"].includes(a.payload.kind)) || (a.type === "state_change" && !!a.payload.drape);
    }
    if (body === "drape:cover" || body === "drape:expose") {
      const cover = body === "drape:cover";
      return (
        (a.type === "courtesy" && (a.payload.kind === (cover ? "cover" : "expose") || (cover && a.payload.kind === "drape"))) ||
        (a.type === "state_change" && !!a.payload.drape && a.payload.drape.covered === cover)
      );
    }
    if (body === "sit_down") return a.type === "sit_down";
    if (body.startsWith("describe:")) return a.type === "describe_exam" && a.payload.regionId === body.slice(9);
    if (body === "prohibited_attempt") return a.type === "prohibited_attempt";
    if (body.startsWith("prohibited:")) return a.type === "prohibited_attempt" && a.payload.regionId === body.slice(11);
    if (body.startsWith("drape:expose:") || body.startsWith("drape:cover:")) {
      const cover = body.startsWith("drape:cover:");
      const sec = body.slice(cover ? 12 : 13);
      return a.type === "state_change" && !!a.payload.drape && a.payload.drape.covered === cover && (a.payload.drape.section === sec || (!!a.payload.drape.zone && ZONE_SECTION_LIST[a.payload.drape.zone]!.includes(sec)));
    }
    if (body.startsWith("mistake:")) return a.type === "mistake" && a.payload.ruleId === body.slice(8);
    if (body.startsWith("region:")) return a.type === "examine" && a.payload.regionId === body.slice(7);
    if (body.startsWith("tag:")) return a.type === "say" && !!a.payload.tags?.some((t) => t.tag === body.slice(4));
    if (body.startsWith("room:")) return a.type === "room" && a.payload.event === body.slice(5);
    if (body.startsWith("timer:")) return a.type === "timer" && a.payload.event === body.slice(6);
    if (ACTION_TYPES.includes(body)) return a.type === body;
    return a.type === "courtesy" && a.payload.kind === body;
  };
  return mode === "first" ? log.find(match) : [...log].reverse().find(match);
}

const ZONE_SECTION_LIST: Record<string, string[]> = { chest: ["chest_left", "chest_right", "back"], abdomen: ["abdomen"], legs: ["leg_left", "leg_right"] };
export const ACTION_TYPES = [
  "examine",
  "say",
  "courtesy",
  "submit_ddx",
  "submit_pen",
  "note",
  "state_change",
  "hint",
  "room",
  "describe_exam",
  "tool_contact",
  "interpretation",
  "settings",
  "mistake",
  "patient_say",
  "timer",
  "sit_down",
  "prohibited_attempt",
];

export function evaluateRule(rule: Rule, log: Action[], ctx: RuleContext = {}): RuleResult {
  return evaluate(rule, orderLog(log), ctx);
}

/** Phase 4: does the state condition hold just before ctx.eventActionId (or at the end of the log)? */
export function stateHolds(cond: StateCondition, log: Action[], ctx: RuleContext): boolean {
  const st = patientState(log, Infinity, { regionSections: ctx.regionSections, beforeActionId: ctx.eventActionId });
  if (cond.handsClean !== undefined && st.handsClean !== cond.handsClean) return false;
  if (cond.position !== undefined && !list(cond.position).includes(st.position)) return false;
  if (cond.inRoom !== undefined && st.inRoom !== cond.inRoom) return false;
  const exposed = (sec: DrapeSection) => !st.sections[sec];
  if (cond.exposedAll && !cond.exposedAll.every(exposed)) return false;
  if (cond.exposedAny && !cond.exposedAny.some(exposed)) return false;
  if (cond.exposedCountAtLeast !== undefined && Object.values(st.sections).filter((c) => !c).length < cond.exposedCountAtLeast) return false;
  if (cond.eventRegionCovered !== undefined) {
    const ev = ctx.eventActionId ? log.find((a) => a.id === ctx.eventActionId) : undefined;
    const region = ev?.type === "examine" ? ev.payload.regionId : ev?.type === "tool_contact" ? ev.payload.nearestRegionId : null;
    const covered = !!region && sectionsForRegion(region, ctx.regionSections).some((sec) => st.sections[sec]);
    if (covered !== cond.eventRegionCovered) return false;
  }
  if (cond.exposedIdleMsAtLeast !== undefined) {
    const ev = ctx.eventActionId ? log.find((a) => a.id === ctx.eventActionId) : undefined;
    const now = ctx.nowT ?? ev?.t ?? log.at(-1)?.t ?? 0;
    const idle = (Object.entries(st.exposedSince) as [DrapeSection, number][]).some(([sec, since]) => {
      const lastExam = log.filter((a) => a.type === "examine" && a.t >= since && a.t <= now && sectionsForRegion(a.payload.regionId, ctx.regionSections).includes(sec)).at(-1)?.t ?? since;
      return now - lastExam >= cond.exposedIdleMsAtLeast!;
    });
    if (!idle) return false;
  }
  return true;
}

/** `log` is already in canonical order here. */
function evaluate(rule: Rule, log: Action[], ctx: RuleContext = {}): RuleResult {
  if ("performed" in rule) {
    const ids = new Set(list(rule.performed));
    const hits = examines(log).filter((a) => ids.has(a.payload.maneuverId));
    if (rule.regions?.length) {
      const covered = rule.regions.filter((r) => hits.some((h) => h.payload.regionId === r));
      const frac = covered.length / rule.regions.length;
      const value = rule.partial ? frac : frac === 1 ? 1 : 0;
      return { value, actionIds: hits.filter((h) => covered.includes(h.payload.regionId)).map((h) => h.id) };
    }
    if (rule.minRegions) {
      const distinct = new Set(hits.map((h) => h.payload.regionId));
      const frac = Math.min(1, distinct.size / rule.minRegions);
      return { value: rule.partial ? frac : frac === 1 ? 1 : 0, actionIds: hits.map((h) => h.id) };
    }
    return { value: hits.length ? 1 : 0, actionIds: hits.slice(0, 1).map((h) => h.id) };
  }

  if ("courtesy" in rule) {
    const hit = log.find(
      (a) =>
        a.type === "courtesy" &&
        a.payload.kind === rule.courtesy &&
        (rule.position === undefined || a.payload.position === rule.position),
    );
    return { value: hit ? 1 : 0, actionIds: hit ? [hit.id] : [] };
  }

  if ("before" in rule) {
    const a = findEvent(log, rule.before[0]);
    const b = findEvent(log, rule.before[1]);
    if (!a || !b) return { value: 0, actionIds: [] };
    const ok = log.indexOf(a) < log.indexOf(b);
    return { value: ok ? 1 : 0, actionIds: ok ? [a.id, b.id] : [] };
  }

  if ("performedIn" in rule) {
    const ids = new Set(list(rule.performedIn.maneuver));
    const positions = new Set(list(rule.performedIn.position));
    const hit = log.find((a, i) => a.type === "examine" && ids.has(a.payload.maneuverId) && positions.has(positionAt(log, i)!));
    return { value: hit ? 1 : 0, actionIds: hit ? [hit.id] : [] };
  }

  if ("said" in rule) {
    const tags = new Set<string>(list(rule.said));
    const hit = log.find((a) => a.type === "say" && a.payload.tags?.some((t) => tags.has(t.tag)));
    return { value: hit ? 1 : 0, actionIds: hit ? [hit.id] : [] };
  }

  if ("happened" in rule) {
    const hit = findEvent(log, rule.happened);
    return { value: hit ? 1 : 0, actionIds: hit ? [hit.id] : [] };
  }

  if ("hygieneBeforeTouch" in rule) {
    // the last hand hygiene before the first examine that involves touch
    const firstTouch = log.findIndex((a) => a.type === "examine" && a.payload.touch !== false);
    if (firstTouch < 0) return { value: 0, actionIds: [] };
    let hygiene: Action | undefined;
    for (let i = 0; i < firstTouch; i++) {
      const a = log[i]!;
      if (a.type === "courtesy" && a.payload.kind === "hand_hygiene") hygiene = a;
    }
    return hygiene ? { value: 1, actionIds: [hygiene.id, log[firstTouch]!.id] } : { value: 0, actionIds: [log[firstTouch]!.id] };
  }

  if ("technique" in rule) {
    const r = rule.technique;
    const ids = new Set(list(r.maneuver));
    const positions = r.position ? new Set(list(r.position)) : null;
    const good = log.filter((a, i) => {
      if (a.type !== "examine" || !ids.has(a.payload.maneuverId)) return false;
      const p = a.payload;
      if (r.tool && p.tool !== r.tool) return false;
      if (r.toolMode && p.toolMode !== r.toolMode) return false;
      if (r.maxPlacementError !== undefined && (p.placementError === undefined || p.placementError > r.maxPlacementError)) return false;
      if (r.minDurationMs !== undefined && (p.durationMs === undefined || p.durationMs < r.minDurationMs)) return false;
      if (positions && !positions.has(positionAt(log, i)!)) return false;
      return true;
    }) as Extract<Action, { type: "examine" }>[];
    if (r.regions?.length) {
      const covered = r.regions.filter((reg) => good.some((g) => g.payload.regionId === reg));
      const frac = covered.length / r.regions.length;
      return { value: r.partial ? frac : frac === 1 ? 1 : 0, actionIds: good.filter((g) => covered.includes(g.payload.regionId)).map((g) => g.id) };
    }
    return { value: good.length ? 1 : 0, actionIds: good.slice(0, 1).map((g) => g.id) };
  }

  if ("placedWithin" in rule) {
    const r = rule.placedWithin;
    const ids = new Set(list(r.maneuver));
    const positions = r.position ? new Set(list(r.position)) : null;
    // A recorded finding: tool placements only produce an examine inside the anchor tolerance,
    // so an examine of the maneuver (tool or click) is the evidence; its tool_contact gives the distance.
    const good = log.filter((a, i) => {
      if (a.type !== "examine" || !ids.has(a.payload.maneuverId)) return false;
      if (a.payload.distanceCm !== undefined && a.payload.toleranceCm !== undefined && a.payload.distanceCm > a.payload.toleranceCm) return false;
      if (positions && !positions.has(positionAt(log, i)!)) return false;
      return true;
    }) as Extract<Action, { type: "examine" }>[];
    if (r.regions?.length) {
      const covered = r.regions.filter((reg) => good.some((g) => g.payload.regionId === reg));
      const frac = covered.length / r.regions.length;
      return { value: r.partial ? frac : frac === 1 ? 1 : 0, actionIds: good.filter((g) => covered.includes(g.payload.regionId)).map((g) => g.id) };
    }
    return { value: good.length ? 1 : 0, actionIds: good.slice(0, 1).map((g) => g.id) };
  }

  if ("submitted" in rule) {
    const hit = log.find((a) => a.type === rule.submitted);
    return { value: hit ? 1 : 0, actionIds: hit ? [hit.id] : [] };
  }

  if ("state" in rule) {
    return { value: stateHolds(rule.state, log, ctx) ? 1 : 0, actionIds: ctx.eventActionId ? [ctx.eventActionId] : [] };
  }

  if ("drapeDiscipline" in rule) {
    // every section that was uncovered is covered again afterwards (within recoverWithinMs of the last exam it was needed for)
    const exposures = log.filter((a) => a.type === "state_change" && !!a.payload.drape && !a.payload.drape.covered) as Extract<Action, { type: "state_change" }>[];
    if (!exposures.length) return { value: 0, actionIds: [] };
    const sectionsOf = (a: Extract<Action, { type: "state_change" }>) =>
      a.payload.drape!.section ? [a.payload.drape!.section] : (ZONE_SECTION_LIST[a.payload.drape!.zone!] ?? []);
    let ok = 0;
    const ids: string[] = [];
    for (const e of exposures) {
      const secs = sectionsOf(e);
      const recover = log.find(
        (a) => a.t >= e.t && a !== e && a.type === "state_change" && !!a.payload.drape && a.payload.drape.covered && sectionsOf(a).some((x) => secs.includes(x)),
      );
      if (!recover) continue;
      if (rule.drapeDiscipline.recoverWithinMs !== undefined) {
        const lastExam = log.filter((a) => a.type === "examine" && a.t >= e.t && a.t <= recover.t).at(-1)?.t ?? e.t;
        if (recover.t - lastExam > rule.drapeDiscipline.recoverWithinMs) continue;
      }
      ok++;
      ids.push(e.id, recover.id);
    }
    const frac = ok / exposures.length;
    return { value: rule.drapeDiscipline.partial ? frac : frac === 1 ? 1 : 0, actionIds: unique(ids) };
  }

  if ("penUnperformed" in rule) {
    const n = ctx.penFlagged ?? 0;
    return { value: n >= (rule.penUnperformed.atLeast ?? 1) ? 1 : 0, actionIds: [] };
  }

  if ("all" in rule) {
    const rs = rule.all.map((r) => evaluate(r, log, ctx));
    return { value: Math.min(...rs.map((r) => r.value)), actionIds: unique(rs.flatMap((r) => r.actionIds)) };
  }
  if ("any" in rule) {
    const rs = rule.any.map((r) => evaluate(r, log, ctx));
    const best = rs.reduce((a, b) => (b.value > a.value ? b : a));
    return best;
  }
  if ("not" in rule) {
    const r = evaluate(rule.not, log, ctx);
    return { value: 1 - r.value, actionIds: [] };
  }
  const never: never = rule;
  throw new Error(`Unknown rule ${JSON.stringify(never)}`);
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}
