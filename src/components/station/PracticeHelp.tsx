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
    <div className="relative flex flex-wrap items-start gap-2 text-xs" data-testid="practice-help">
      <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-900">Practice help</span>
      <button type="button" disabled={disabled} onClick={() => call("hint")} className="rounded border border-line-strong bg-white px-2 py-0.5">
        Hint
      </button>
      <button type="button" disabled={disabled} onClick={() => call("progress")} className="rounded border border-line-strong bg-white px-2 py-0.5">
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
          className="absolute top-full right-0 z-30 mt-1 max-h-64 w-[min(28rem,92vw)] overflow-y-auto rounded-md border border-emerald-200 bg-emerald-50 p-2 text-emerald-950 shadow-lg"
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
                  {s.missing.length > 0 && <span className="text-ink-3"> — still to do: {s.missing.slice(0, 3).join("; ")}{s.missing.length > 3 ? "…" : ""}</span>}
                </li>
              ))}
            </ul>
          )}
        </Dialog>
      )}
    </div>
  );
}
