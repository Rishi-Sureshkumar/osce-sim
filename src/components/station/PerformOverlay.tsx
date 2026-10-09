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
    <Dialog id="perform" kind="popover" title={title} onClose={onDone} className="rounded-lg border border-cyan-300 bg-brand-soft p-3 text-cyan-950 shadow-md" panelProps={{ "aria-live": "polite" }}>
      <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-cyan-950">
        {steps.slice(0, shown).map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {stepsDone && (
        <div className="mt-2 rounded-md bg-white p-2 text-sm" data-testid="perform-finding">
          {finding === null ? <span className="text-ink-3">Examining…</span> : <span className="font-medium">{finding}</span>}
        </div>
      )}
      <div className="mt-2 flex justify-end gap-2">
        {!stepsDone && (
          <button className="text-xs text-brand-strong underline" onClick={() => setShown(steps.length)}>
            Skip
          </button>
        )}
        {stepsDone && finding !== null && (
          <button
            className="rounded-md bg-brand px-3 py-1 text-sm text-white"
            onClick={onDone}
          >
            Continue
          </button>
        )}
      </div>
    </Dialog>
  );
}
