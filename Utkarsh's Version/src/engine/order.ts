import type { Action } from "@/domain/schemas";

/**
 * The ONE canonical order of a session log: by `t`, ties broken by `seq` (storage append order),
 * then by original position. Scoring, the timeline, the transcript and the patient prompt all use it,
 * so what a coach sees and what the scorer evaluates can never disagree.
 */
export function orderLog<T extends Pick<Action, "t" | "seq">>(log: readonly T[]): T[] {
  return log
    .map((a, i) => ({ a, i }))
    .sort((x, y) => x.a.t - y.a.t || (x.a.seq ?? x.i) - (y.a.seq ?? y.i) || x.i - y.i)
    .map((x) => x.a);
}
