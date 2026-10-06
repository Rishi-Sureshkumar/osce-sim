import type { Action, Position, Rule } from "@/domain/schemas";
import { orderLog } from "./order";

/**
 * The ONE interpreter for `auto` mark-sheet rules. Rules are declarative predicates over the
 * append-only action log. Returns a value in [0, 1] (1 = fully achieved) plus the ids of the
 * actions that satisfied it (used as evidence links in the results page).
 */
export interface RuleResult {
  value: number;
  actionIds: string[];
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
      return a.type === "courtesy" && a.payload.kind === "position" && a.payload.position === body.slice(9);
    }
    if (body === "touch") return a.type === "examine" && a.payload.touch !== false;
    if (body.startsWith("tag:")) return a.type === "say" && !!a.payload.tags?.some((t) => t.tag === body.slice(4));
    if (body.startsWith("room:")) return a.type === "room" && a.payload.event === body.slice(5);
    if (["examine", "say", "courtesy", "submit_ddx", "note", "state_change", "hint", "room"].includes(body)) return a.type === body;
    return a.type === "courtesy" && a.payload.kind === body;
  };
  return mode === "first" ? log.find(match) : [...log].reverse().find(match);
}

export function evaluateRule(rule: Rule, log: Action[]): RuleResult {
  return evaluate(rule, orderLog(log));
}

/** `log` is already in canonical order here. */
function evaluate(rule: Rule, log: Action[]): RuleResult {
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

  if ("submitted" in rule) {
    const hit = log.find((a) => a.type === "submit_ddx");
    return { value: hit ? 1 : 0, actionIds: hit ? [hit.id] : [] };
  }

  if ("all" in rule) {
    const rs = rule.all.map((r) => evaluate(r, log));
    return { value: Math.min(...rs.map((r) => r.value)), actionIds: unique(rs.flatMap((r) => r.actionIds)) };
  }
  if ("any" in rule) {
    const rs = rule.any.map((r) => evaluate(r, log));
    const best = rs.reduce((a, b) => (b.value > a.value ? b : a));
    return best;
  }
  if ("not" in rule) {
    const r = evaluate(rule.not, log);
    return { value: 1 - r.value, actionIds: [] };
  }
  const never: never = rule;
  throw new Error(`Unknown rule ${JSON.stringify(never)}`);
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}
