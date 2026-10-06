"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Action } from "@/domain/schemas";
import { submitFromForm } from "@/input/adapters/text";

/** End of station: encounters submit summary + ranked differential + plan; screening just finishes. */
export function FinishDialog({
  sessionId,
  mode,
  append,
  disabled,
  forceOpen = false,
}: {
  sessionId: string;
  mode: "encounter" | "screening";
  append: (a: Action) => void;
  disabled: boolean;
  /** exam time ran out: the presentation step opens and can't be dismissed */
  forceOpen?: boolean;
}) {
  const router = useRouter();
  const [openState, setOpen] = useState(false);
  const open = openState || forceOpen;
  const [summary, setSummary] = useState("");
  const [ddx, setDdx] = useState(["", "", ""]);
  const [plan, setPlan] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const encounter = mode === "encounter";
  const filled = ddx.filter((d) => d.trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const submission = encounter ? submitFromForm(summary, ddx, plan) : null;
      const res = await fetch(`/api/sessions/${sessionId}/finish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ submission: submission ? { payload: submission.payload } : null }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not submit");
      (body.actions as Action[]).forEach(append);
      router.push(body.resultsUrl);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  if (disabled && !open) {
    return (
      <a href={`/results/${sessionId}`} className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white">
        View results
      </a>
    );
  }

  return (
    <>
      <button onClick={() => setOpen(true)} disabled={disabled} className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50">
        {encounter ? "Finish & present" : "Finish exam"}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal aria-labelledby="finish-h">
          <form onSubmit={submit} className="max-h-[90vh] w-full max-w-xl space-y-3 overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
            <h2 id="finish-h" className="text-lg font-semibold">
              {forceOpen ? "Time is up — " : ""}
              {encounter ? "Present your findings" : "Finish the screening exam?"}
            </h2>
            {encounter ? (
              <>
                <label className="block text-sm">
                  <span className="font-medium">Summary statement</span>
                  <textarea required value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} maxLength={4000} className="mt-1 w-full rounded-md border border-slate-300 p-2" />
                </label>
                <fieldset className="text-sm">
                  <legend className="font-medium">Differential diagnosis (most likely first)</legend>
                  {ddx.map((d, i) => (
                    <label key={i} className="mt-1 flex items-center gap-2">
                      <span className="w-5 text-right text-slate-500">{i + 1}.</span>
                      <input
                        value={d}
                        aria-label={`Differential ${i + 1}`}
                        onChange={(e) => setDdx((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))}
                        maxLength={300}
                        className="flex-1 rounded-md border border-slate-300 px-2 py-1.5"
                      />
                    </label>
                  ))}
                  {ddx.length < 8 && (
                    <button type="button" onClick={() => setDdx((xs) => [...xs, ""])} className="mt-1 ml-7 text-xs text-cyan-700 underline">
                      Add another
                    </button>
                  )}
                </fieldset>
                <label className="block text-sm">
                  <span className="font-medium">Initial plan</span>
                  <textarea required value={plan} onChange={(e) => setPlan(e.target.value)} rows={3} maxLength={4000} className="mt-1 w-full rounded-md border border-slate-300 p-2" />
                </label>
              </>
            ) : (
              <p className="text-sm text-slate-600">You won&apos;t be able to examine further after finishing. Your exam will be scored against the FCM-1 mark sheet.</p>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              {!forceOpen && (
                <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm">
                  Keep going
                </button>
              )}
              <button type="submit" disabled={busy || (encounter && filled.length === 0)} className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {busy ? "Submitting…" : "Submit"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
