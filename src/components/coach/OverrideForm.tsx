"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loadCoachName, saveCoachName } from "./CoachName";

export function OverrideForm({ sessionId, markSheetId, itemId, maxPoints, currentPoints }: { sessionId: string; markSheetId: string; itemId: string; maxPoints: number; currentPoints: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState(String(currentPoints));
  const [reason, setReason] = useState("");
  const [coach, setCoach] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setCoach(loadCoachName()), []);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-1 text-xs text-indigo-700 underline" data-override={itemId}>
        Override score
      </button>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      saveCoachName(coach);
      const res = await fetch(`/api/coach/sessions/${sessionId}/overrides`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ markSheetId, itemId, newPoints: Number(points), reason, coach }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Override failed");
      setOpen(false);
      setReason("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-2 flex flex-wrap items-end gap-2 rounded-md bg-indigo-50 p-2 text-xs">
      <label className="flex flex-col">
        <span>Points (max {maxPoints})</span>
        <input type="number" step="0.25" min={0} max={maxPoints} value={points} onChange={(e) => setPoints(e.target.value)} className="w-20 rounded border border-slate-300 px-1 py-1" required />
      </label>
      <label className="flex min-w-48 flex-1 flex-col">
        <span>Reason</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} className="rounded border border-slate-300 px-1 py-1" required minLength={3} maxLength={1000} />
      </label>
      <label className="flex flex-col">
        <span>Your name</span>
        <input value={coach} onChange={(e) => setCoach(e.target.value)} className="w-32 rounded border border-slate-300 px-1 py-1" required maxLength={80} />
      </label>
      <button disabled={busy} className="rounded bg-indigo-700 px-3 py-1.5 text-white disabled:opacity-50">
        Save
      </button>
      <button type="button" onClick={() => setOpen(false)} className="px-2 py-1.5">
        Cancel
      </button>
      {error && (
        <p role="alert" className="w-full text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
