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
    <section className="mx-auto w-full max-w-3xl rounded-lg border border-line bg-surface p-5 shadow-sm" aria-labelledby="pen-h" data-testid="pen-form">
      <h2 id="pen-h" className="text-lg font-semibold">
        Post-encounter note
      </h2>
      <p className="text-sm text-ink-3">
        {endReason === "time_up" ? "Encounter time is up. " : "You have left the room. "}Write your note. It locks when the note time runs out.
      </p>
      <form
        className="mt-3 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(false);
        }}
      >
        <label className="block text-sm">
          <span className="font-medium">History</span>
          <span className="ml-2 text-xs text-ink-3">pertinent positives and negatives</span>
          <textarea value={pen.history} onChange={(e) => update({ history: e.target.value })} readOnly={ro} rows={6} maxLength={6000} className="mt-1 w-full rounded-md border border-line-strong p-2" />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Physical examination</span>
          <span className="ml-2 text-xs text-ink-3">include only maneuvers you performed</span>
          <textarea value={pen.exam} onChange={(e) => update({ exam: e.target.value })} readOnly={ro} rows={6} maxLength={6000} className="mt-1 w-full rounded-md border border-line-strong p-2" />
        </label>
        <fieldset className="space-y-2 text-sm">
          <legend className="font-medium">Diagnoses (up to 3, most likely first)</legend>
          {pen.diagnoses.map((d, i) => (
            <div key={i} className="grid gap-1 sm:grid-cols-[1fr_1.4fr]">
              <input value={d.diagnosis} onChange={(e) => setDx(i, { diagnosis: e.target.value })} readOnly={ro} aria-label={`Diagnosis ${i + 1}`} placeholder={`${i + 1}.`} maxLength={300} className="rounded-md border border-line-strong px-2 py-1.5" />
              <input value={d.support ?? ""} onChange={(e) => setDx(i, { support: e.target.value })} readOnly={ro} aria-label={`Supporting findings ${i + 1}`} placeholder="Supporting findings (optional)" maxLength={2000} className="rounded-md border border-line-strong px-2 py-1.5" />
            </div>
          ))}
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-3" data-testid="pen-saved">
            {lockNow ? "Time is up — submitting your note…" : savedAt ? `Draft saved ${new Date(savedAt).toLocaleTimeString()}` : "Autosaves every 5 seconds"}
          </span>
          <button type="submit" disabled={ro || !filled} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
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
