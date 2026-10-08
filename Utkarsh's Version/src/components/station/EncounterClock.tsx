"use client";
import { useEffect, useRef, useState } from "react";
import type { Action, SessionMode } from "@/domain/schemas";
import { mmss } from "@/components/common/format";
import { dueTimerEvents, encounterState, remainingMs, type FlowLimits } from "@/engine/encounter";

type Due = "encounter_warning" | "pen_warning";

/**
 * 1B clocks. Exam: 15:00 countdown from "You may begin" (warning at 5 minutes left), then the
 * 10:00 note countdown (warning at 2). At each deadline `onDeadline` asks the server to apply it.
 * Practice: counts up, no deadlines.
 */
export function EncounterClock({
  mode,
  startedAt,
  limits,
  actions,
  onWarning,
  onDeadline,
}: {
  mode: SessionMode;
  startedAt: string;
  limits: FlowLimits;
  actions: Action[];
  onWarning: (e: Due) => void;
  onDeadline: (phase: "encounter" | "pen") => void;
}) {
  const [now, setNow] = useState<number | null>(null);
  const fired = useRef(new Set<string>());
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const t = now === null ? 0 : now - Date.parse(startedAt);
  const st = encounterState(actions, mode, limits, t);
  const left = remainingMs(st, t);

  useEffect(() => {
    if (now === null) return;
    for (const e of dueTimerEvents(st, t)) {
      if (fired.current.has(e)) continue;
      fired.current.add(e);
      onWarning(e as Due);
    }
    if (st.phase === "encounter" && left === 0 && !fired.current.has("encounter_end")) {
      fired.current.add("encounter_end");
      onDeadline("encounter");
    }
    if (st.phase === "pen" && st.penDeadline !== null && t >= st.penDeadline && !fired.current.has("pen_lock")) {
      fired.current.add("pen_lock");
      onDeadline("pen");
    }
  });

  if (now === null) return <div className="rounded-lg px-3 py-1 font-mono text-lg font-medium tabular-nums bg-slate-900 text-white">--:--</div>;
  const label = st.phase === "corridor" ? "Waiting to begin" : st.phase === "encounter" ? "Encounter" : st.phase === "pen" ? "Post-encounter note" : "Finished";
  const shown = left ?? (st.phase === "pen" && st.endedAt !== null ? t - st.endedAt : st.beganAt !== null && st.phase === "encounter" ? t - st.beganAt : null);
  const warn = left !== null && ((st.phase === "encounter" && left <= 5 * 60_000) || (st.phase === "pen" && left <= 2 * 60_000));
  return (
    <div className="flex items-center gap-2" data-testid="encounter-clock" data-phase={st.phase}>
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span
        className={`rounded-lg px-3 py-1 font-mono text-lg font-medium tabular-nums ${left === 0 ? "bg-red-600 text-white" : warn ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300" : "bg-slate-900 text-white"}`}
        aria-label={left !== null ? "Time remaining" : "Time elapsed"}
        data-testid="exam-timer"
      >
        {shown === null ? (st.phase === "corridor" ? mmss(limits.encounterSeconds * 1000) : "--:--") : mmss(shown)}
      </span>
    </div>
  );
}
