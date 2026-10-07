"use client";
import { useEffect, useState } from "react";

/** Short "performed" visualisation: steps appear one by one while the finding resolves. */
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
    const id = setTimeout(() => setShown((n) => n + 1), 550);
    return () => clearTimeout(id);
  }, [shown, steps.length]);
  const stepsDone = shown >= steps.length;

  return (
    <section aria-live="polite" className="rounded-lg border border-cyan-300 bg-cyan-50 p-3 shadow-md">
      <h3 className="font-semibold text-cyan-900">{title}</h3>
      <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-cyan-950">
        {steps.slice(0, shown).map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {stepsDone && (
        <div className="mt-2 rounded-md bg-white p-2 text-sm" data-testid="perform-finding">
          {finding === null ? <span className="text-slate-500">Examining…</span> : <span className="font-medium">{finding}</span>}
        </div>
      )}
      <div className="mt-2 flex justify-end gap-2">
        {!stepsDone && (
          <button className="text-xs text-cyan-800 underline" onClick={() => setShown(steps.length)}>
            Skip
          </button>
        )}
        {stepsDone && finding !== null && (
          <button
            className="rounded-md bg-cyan-700 px-3 py-1 text-sm text-white"
            onClick={onDone}
          >
            Continue
          </button>
        )}
      </div>
    </section>
  );
}
