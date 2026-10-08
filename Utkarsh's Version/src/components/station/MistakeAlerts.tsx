"use client";
import { useEffect, useRef, useState } from "react";
import type { Action } from "@/domain/schemas";
import { audioEngine } from "@/audio/engine";

type Mistake = Extract<Action, { type: "mistake" }>;

const TONE: Record<string, string> = {
  critical: "border-red-300 bg-red-50 text-red-950",
  major: "border-red-300 bg-red-50 text-red-950",
  minor: "border-amber-300 bg-amber-50 text-amber-950",
  info: "border-sky-300 bg-sky-50 text-sky-950",
};

/**
 * Mistake alerts (Phase 4 M4): each alerted `mistake` in the log shows as a red "!" with its message
 * and a ✕, with a soft chime when it first appears. Exam mode logs mistakes silently (they are not
 * sent to the student until the end). Reads only from the action log.
 */
export function MistakeAlerts({ actions }: { actions: Action[] }) {
  const mistakes = actions.filter((a): a is Mistake => a.type === "mistake" && a.payload.alerted);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    // chime for mistakes that arrive while the page is open (not for ones already in the log on load)
    if (!seen.current) {
      seen.current = new Set(mistakes.map((m) => m.id));
      return;
    }
    const fresh = mistakes.filter((m) => !seen.current!.has(m.id));
    for (const m of fresh) seen.current.add(m.id);
    if (fresh.length) audioEngine.ding();
  }, [mistakes]);
  const open = mistakes.filter((m) => !dismissed.has(m.id)).slice(-3).reverse();
  if (!open.length) return null;
  return (
    <ul className="grid gap-1.5" aria-live="polite" data-testid="mistake-alerts">
      {open.map((m) => (
        <li key={m.id} role="alert" className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-sm shadow-card ${TONE[m.payload.severity] ?? TONE.minor}`} data-testid="mistake-alert" data-rule={m.payload.ruleId}>
          <span aria-hidden="true" className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-red-600 text-xs font-bold text-white">
            !
          </span>
          <span className="min-w-0 flex-1">{m.payload.message}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setDismissed((d) => new Set(d).add(m.id))} className="shrink-0 rounded px-1 text-slate-500 hover:text-slate-900">
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}
