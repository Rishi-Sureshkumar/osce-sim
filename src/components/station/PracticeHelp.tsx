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
    // in the top bar (Phase 4 M6): beside the encounter bar it made that bar wrap to a second row
    <div className="relative flex items-center gap-1.5 text-sm" data-testid="practice-help" role="group" aria-label="Practice help">
      <button type="button" disabled={disabled} onClick={() => call("hint")} className="h-8 rounded-md border border-ok/40 bg-ok-soft px-2.5 text-ok hover:bg-ok-soft/70 disabled:opacity-50">
        Hint
      </button>
      <button type="button" disabled={disabled} onClick={() => call("progress")} className="h-8 rounded-md border border-ok/40 bg-ok-soft px-2.5 text-ok hover:bg-ok-soft/70 disabled:opacity-50">
        Check my progress
      </button>
      {error && <span className="text-xs text-bad">{error}</span>}
      {(hint || sections) && (
        <Dialog
          id="practice-help"
          kind="popover"
          title={hint ? "Hint" : "Checklist progress (automatic items)"}
          onClose={() => {
            setHint(null);
            setSections(null);
          }}
          // below the encounter bar, over the top of the side panel (V-HINTOVER: hanging from the top bar it
          // covered the drape chips and the Actions menu)
          className="fixed top-[9.25rem] right-4 z-40 max-h-[min(24rem,60vh)] w-[min(24rem,92vw)] overflow-y-auto rounded-lg border border-ok/30 bg-surface p-3 text-sm text-ink shadow-2"
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
