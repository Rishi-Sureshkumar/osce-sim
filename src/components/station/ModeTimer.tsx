"use client";
import { useEffect, useRef, useState } from "react";
import type { Action, SessionMode } from "@/domain/schemas";
import { mmss } from "@/components/common/format";
import { activeElapsed, isPaused, timeIsUp } from "@/engine/practice";

/**
 * Practice: counts up and can be paused (pause/resume are logged).
 * Exam: counts down from the case limit, warns at 2 minutes and auto-ends at zero (both logged).
 */
export function ModeTimer({
  mode,
  startedAt,
  limitSeconds,
  actions,
  stopped,
  onTimerEvent,
}: {
  mode: SessionMode;
  startedAt: string;
  limitSeconds: number;
  actions: Action[];
  stopped: boolean;
  onTimerEvent: (e: "pause" | "resume" | "warning" | "auto_end") => void;
}) {
  const [now, setNow] = useState<number | null>(null);
  const sent = useRef(new Set<string>(actions.flatMap((a) => (a.type === "timer" ? [a.payload.event] : []))));
  useEffect(() => {
    setNow(Date.now());
    if (stopped) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [stopped]);

  const elapsed = now === null ? 0 : activeElapsed(actions, now - Date.parse(startedAt));
  const remaining = limitSeconds * 1000 - elapsed;
  const up = timeIsUp(actions);

  useEffect(() => {
    if (mode !== "exam" || now === null || stopped || up) return;
    if (remaining <= 120_000 && remaining > 0 && !sent.current.has("warning")) {
      sent.current.add("warning");
      onTimerEvent("warning");
    }
    if (remaining <= 0 && !sent.current.has("auto_end")) {
      sent.current.add("auto_end");
      onTimerEvent("auto_end");
    }
  }, [mode, now, remaining, stopped, up, onTimerEvent]);

  if (now === null) return <div className="rounded-md bg-subtle px-3 py-1 font-mono text-lg">--:--</div>;

  if (mode === "practice") {
    const paused = isPaused(actions);
    return (
      <div className="flex items-center gap-1">
        <div className={`rounded-md px-3 py-1 font-mono text-lg tabular-nums ${paused ? "bg-amber-100 text-amber-900" : "bg-subtle"}`} aria-label="Time elapsed">
          {mmss(elapsed)}
        </div>
        {!stopped && (
          <button type="button" onClick={() => onTimerEvent(paused ? "resume" : "pause")} className="rounded border border-line-strong bg-white px-2 py-1 text-xs">
            {paused ? "Resume" : "Pause"}
          </button>
        )}
      </div>
    );
  }
  const warn = remaining <= 120_000;
  return (
    <div
      className={`rounded-md px-3 py-1 font-mono text-lg tabular-nums ${remaining <= 0 ? "bg-red-600 text-white" : warn ? "bg-amber-100 text-amber-900" : "bg-subtle"}`}
      aria-label="Time remaining"
      data-testid="exam-timer"
    >
      {mmss(Math.max(0, remaining))}
    </div>
  );
}
