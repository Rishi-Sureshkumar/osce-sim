/** Pure helpers for practice/exam mode: active time, hints, section checks. */
import type { Action, MarkSheet, SessionMode } from "@/domain/schemas";
import { orderLog } from "./order";
import { evaluateRule } from "./rules";
import { appliesInMode } from "./scoring";

/** Milliseconds of active (unpaused) time at `nowT` (ms since session start). */
export function activeElapsed(log: readonly Action[], nowT: number): number {
  let paused = 0;
  let pausedAt: number | null = null;
  for (const a of orderLog(log)) {
    if (a.type !== "timer") continue;
    if (a.payload.event === "pause" && pausedAt === null) pausedAt = a.t;
    if (a.payload.event === "resume" && pausedAt !== null) {
      paused += a.t - pausedAt;
      pausedAt = null;
    }
  }
  if (pausedAt !== null) paused += Math.max(0, nowT - pausedAt);
  return Math.max(0, nowT - paused);
}

export function isPaused(log: readonly Action[]): boolean {
  let p = false;
  for (const a of orderLog(log)) if (a.type === "timer" && (a.payload.event === "pause" || a.payload.event === "resume")) p = a.payload.event === "pause";
  return p;
}

export const timeIsUp = (log: readonly Action[]) => log.some((a) => a.type === "timer" && a.payload.event === "auto_end");

export interface SectionStatus {
  markSheetId: string;
  section: string;
  done: number;
  total: number;
  /** labels of auto items not yet (fully) achieved */
  missing: string[];
}

/** Deterministic progress per section (auto items only — no AI), for practice-mode feedback. */
export function sectionProgress(sheets: readonly MarkSheet[], log: Action[], mode: SessionMode): SectionStatus[] {
  const out: SectionStatus[] = [];
  for (const sheet of sheets) {
    for (const section of [...new Set(sheet.items.map((i) => i.section))]) {
      const items = sheet.items.filter((i) => i.section === section && i.scoring === "auto" && appliesInMode(i, mode));
      if (!items.length) continue;
      const results = items.map((i) => ({ i, v: evaluateRule(i.rule!, log).value }));
      out.push({
        markSheetId: sheet.id,
        section,
        done: results.filter((r) => r.v >= 1).length,
        total: items.length,
        missing: results.filter((r) => r.v < 1).map((r) => r.i.label),
      });
    }
  }
  return out;
}

/** The next thing to try: the first unmet auto item, in mark-sheet order. */
export function nextHint(sheets: readonly MarkSheet[], log: Action[], mode: SessionMode): { itemId: string; text: string } | null {
  for (const sheet of sheets) {
    for (const item of sheet.items) {
      if (item.scoring !== "auto" || !appliesInMode(item, mode)) continue;
      if (evaluateRule(item.rule!, log).value < 1) return { itemId: item.id, text: `Consider: ${item.label}` };
    }
  }
  return null;
}
