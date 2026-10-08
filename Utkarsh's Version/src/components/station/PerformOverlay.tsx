"use client";
import { useEffect, useState } from "react";
import { qaDelay } from "@/exam3d/qa";
import { Dialog } from "@/components/ui/Overlay";

/**
 * Short "performed" visualisation: steps appear one by one while the finding resolves. Closing it
 * (✕, Esc, a click elsewhere, Continue) never loses anything: the exam is already in the log.
 */
export function PerformOverlay({
  title,
  steps,
  finding,
  onDone,
}: {
  title: string;
  steps: string[];
  finding: string | null;
  onDone: () => void;
}) {
  const [shown, setShown] = useState(1);
  useEffect(() => {
    if (shown >= steps.length) return;
    const id = setTimeout(() => setShown((n) => n + 1), qaDelay(550));
    return () => clearTimeout(id);
  }, [shown, steps.length]);
  const stepsDone = shown >= steps.length;

  return (
    <Dialog id="perform" kind="popover" title={title} onClose={onDone} className="rounded-xl border border-slate-200 bg-white p-3.5 text-slate-800 shadow-pop" panelProps={{ "aria-live": "polite" }}>
      <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-slate-700 marker:text-slate-400">
        {steps.slice(0, shown).map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {stepsDone && (
        <div className="mt-2.5 rounded-lg border border-cyan-200 bg-cyan-50 p-2.5 text-sm text-cyan-950" data-testid="perform-finding">
          {finding === null ? <span className="text-slate-500">Examining…</span> : <span className="font-medium">{finding}</span>}
        </div>
      )}
      <div className="mt-2 flex justify-end gap-2">
        {!stepsDone && (
          <button className="btn btn-ghost btn-sm" onClick={() => setShown(steps.length)}>
            Skip
          </button>
        )}
        {stepsDone && finding !== null && (
          <button
            className="btn btn-primary btn-sm"
            onClick={onDone}
          >
            Continue
          </button>
        )}
      </div>
    </Dialog>
  );
}
