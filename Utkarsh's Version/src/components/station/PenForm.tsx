"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PenDraft } from "@/domain/schemas";

const EMPTY: PenDraft = { history: "", exam: "", diagnoses: [{ diagnosis: "", support: "" }, { diagnosis: "", support: "" }, { diagnosis: "", support: "" }] };
export const AUTOSAVE_MS = 5000;

/**
 * The 1B post-encounter note: history, physical exam (only what was performed) and up to three
 * diagnoses with optional supporting findings. No plan in 1B. Autosaved to the server every 5 s;
 * at time-up (`lockNow`) the note is submitted as it stands and can't be edited.
 */
export function PenForm({ sessionId, initial, lockNow, endReason }: { sessionId: string; initial?: PenDraft | null; lockNow: boolean; endReason: "exit" | "time_up" | null }) {
  const router = useRouter();
  const [pen, setPen] = useState<PenDraft>(() => (initial ? { ...initial, diagnoses: [0, 1, 2].map((i) => initial.diagnoses[i] ?? { diagnosis: "", support: "" }) } : EMPTY));
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = useRef(false);
  const latest = useRef(pen);
  latest.current = pen;
  const done = useRef(false);

  const update = (patch: Partial<PenDraft>) => {
    dirty.current = true;
    setPen((p) => ({ ...p, ...patch }));
  };
  const setDx = (i: number, patch: Partial<PenDraft["diagnoses"][number]>) => update({ diagnoses: pen.diagnoses.map((d, j) => (j === i ? { ...d, ...patch } : d)) });

  // autosave
  useEffect(() => {
    const id = setInterval(async () => {
      if (!dirty.current || done.current) return;
      dirty.current = false;
      const res = await fetch(`/api/sessions/${sessionId}/pen`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(clean(latest.current)) }).catch(() => null);
      if (res?.ok) setSavedAt(((await res.json()) as { savedAt: string }).savedAt);
      else dirty.current = true;
    }, AUTOSAVE_MS);
    return () => clearInterval(id);
  }, [sessionId]);

  const submit = async (locked: boolean) => {
    if (done.current) return;
    done.current = true;
    setBusy(true);
    setError(null);
    const body = { ...clean(latest.current), diagnoses: clean(latest.current).diagnoses.filter((d) => d.diagnosis) };
    const res = await fetch(`/api/sessions/${sessionId}/finish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pen: body }) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    // a 409 at time-up means the server already submitted the autosaved note
    if (res?.ok || (locked && res?.status === 409)) return router.push(json.resultsUrl ?? `/results/${sessionId}`);
    done.current = false;
    setBusy(false);
    setError(json.error ?? "Could not submit the note.");
  };

  useEffect(() => {
    if (lockNow) void submit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- submit reads refs; run once when the lock arrives
  }, [lockNow]);

  const filled = pen.diagnoses.some((d) => d.diagnosis.trim());
  const ro = lockNow || busy;
  return (
    <section className="mx-auto w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-card" aria-labelledby="pen-h" data-testid="pen-form">
      <h2 id="pen-h" className="text-lg font-semibold tracking-tight text-slate-900">
        Post-encounter note
      </h2>
      <p className="mt-0.5 text-sm text-slate-600">
        {endReason === "time_up" ? "Encounter time is up. " : "You have left the room. "}Write your note. It locks when the note time runs out.
      </p>
      <form
        className="mt-5 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(false);
        }}
      >
        <label className="block text-sm">
          <span className="font-semibold text-slate-800">History</span>
          <span className="ml-2 text-xs text-slate-500">pertinent positives and negatives</span>
          <textarea value={pen.history} onChange={(e) => update({ history: e.target.value })} readOnly={ro} rows={6} maxLength={6000} className="input mt-1" />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-slate-800">Physical examination</span>
          <span className="ml-2 text-xs text-slate-500">include only maneuvers you performed</span>
          <textarea value={pen.exam} onChange={(e) => update({ exam: e.target.value })} readOnly={ro} rows={6} maxLength={6000} className="input mt-1" />
        </label>
        <fieldset className="space-y-2 text-sm">
          <legend className="font-semibold text-slate-800">Diagnoses (up to 3, most likely first)</legend>
          {pen.diagnoses.map((d, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.4fr]">
              <input value={d.diagnosis} onChange={(e) => setDx(i, { diagnosis: e.target.value })} readOnly={ro} aria-label={`Diagnosis ${i + 1}`} placeholder={`${i + 1}.`} maxLength={300} className="input" />
              <input value={d.support ?? ""} onChange={(e) => setDx(i, { support: e.target.value })} readOnly={ro} aria-label={`Supporting findings ${i + 1}`} placeholder="Supporting findings (optional)" maxLength={2000} className="input" />
            </div>
          ))}
        </fieldset>
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="text-xs text-slate-500" data-testid="pen-saved">
            {lockNow ? "Time is up — submitting your note…" : savedAt ? `Draft saved ${new Date(savedAt).toLocaleTimeString()}` : "Autosaves every 5 seconds"}
          </span>
          <button type="submit" disabled={ro || !filled} className="btn btn-primary">
            {busy ? "Submitting…" : "Submit note"}
          </button>
        </div>
      </form>
    </section>
  );
}

function clean(p: PenDraft): PenDraft {
  return { history: p.history.trim(), exam: p.exam.trim(), diagnoses: p.diagnoses.map((d) => ({ diagnosis: d.diagnosis.trim(), ...(d.support?.trim() ? { support: d.support.trim() } : {}) })) };
}
