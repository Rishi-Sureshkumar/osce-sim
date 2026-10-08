"use client";
import { useState } from "react";
import type { Action } from "@/domain/schemas";
import type { SectionStatus } from "@/engine/practice";
import { Dialog } from "@/components/ui/Overlay";

/** Practice-mode help: a hint and a checklist progress check (both logged for coaches). */
export function PracticeHelp({ sessionId, append, disabled }: { sessionId: string; append: (a: Action) => void; disabled: boolean }) {
  const [hint, setHint] = useState<string | null>(null);
  const [sections, setSections] = useState<SectionStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const call = async (path: "hint" | "progress") => {
    setError(null);
    const res = await fetch(`/api/sessions/${sessionId}/${path}`, { method: "POST" });
    const body = await res.json();
    if (!res.ok) return setError(body.error ?? "Couldn't load help");
    append(body.action as Action);
    if (path === "hint") {
      setSections(null);
      setHint((body.action as Extract<Action, { type: "hint" }>).payload.text);
    } else {
      setHint(null);
      setSections(body.sections as SectionStatus[]);
    }
  };
  return (
    <div className="relative flex flex-wrap items-center gap-1.5 text-xs" data-testid="practice-help">
      <span className="badge bg-emerald-50 py-1 text-emerald-700 ring-1 ring-emerald-200">Practice help</span>
      <button type="button" disabled={disabled} onClick={() => call("hint")} className="btn btn-secondary btn-sm">
        Hint
      </button>
      <button type="button" disabled={disabled} onClick={() => call("progress")} className="btn btn-secondary btn-sm">
        Check my progress
      </button>
      {error && <span className="text-red-700">{error}</span>}
      {(hint || sections) && (
        <Dialog
          id="practice-help"
          kind="popover"
          title={hint ? "Hint" : "Checklist progress (automatic items)"}
          onClose={() => {
            setHint(null);
            setSections(null);
          }}
          className="absolute top-full right-0 z-30 mt-1.5 max-h-72 w-[min(28rem,92vw)] overflow-y-auto rounded-xl border border-emerald-200 bg-white p-3 text-sm text-slate-800 shadow-pop"
          panelProps={{ "aria-live": "polite" }}
        >
          {hint && <p data-testid="practice-hint">{hint}</p>}
          {sections && (
            <ul className="space-y-0.5" data-testid="practice-progress">
              {sections.map((s) => (
                <li key={s.markSheetId + s.section}>
                  <span className="font-mono">
                    {s.done}/{s.total}
                  </span>{" "}
                  {s.section}
                  {s.missing.length > 0 && <span className="text-slate-600"> — still to do: {s.missing.slice(0, 3).join("; ")}{s.missing.length > 3 ? "…" : ""}</span>}
                </li>
              ))}
            </ul>
          )}
        </Dialog>
      )}
    </div>
  );
}
