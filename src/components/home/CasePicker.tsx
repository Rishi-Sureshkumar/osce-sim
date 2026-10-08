"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PublicCase } from "@/domain/schemas";

export function CasePicker({ cases }: { cases: PublicCase[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"practice" | "exam">("practice");
  const [findings, setFindings] = useState<"show" | "hide">("show");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (caseId: string) => {
    setBusy(caseId);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, studentLabel: name, mode, findingsDisplay: findings }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not start the session");
      router.push(`/station/${body.sessionId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  return (
    <div className="mt-6 space-y-4">
      <label className="block max-w-sm text-sm">
        <span className="font-medium">Your name or alias</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="e.g. Sam P."
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <fieldset className="text-sm">
        <legend className="font-medium">Mode</legend>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          {(
            [
              ["practice", "Practice (untimed)", "Timer counts up and can pause. Hints, technique demos, nudges and progress checks are available. Scored, labelled practice."],
              ["exam", "Exam (timed)", "Countdown from the station's time limit with a 2-minute warning; ends automatically. No help. Feedback only at the end."],
            ] as const
          ).map(([value, label, help]) => (
            <label key={value} className={`flex cursor-pointer gap-2 rounded-lg border p-3 ${mode === value ? "border-cyan-700 bg-cyan-50" : "border-slate-200 bg-white"}`}>
              <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-1" />
              <span>
                <span className="font-medium">{label}</span>
                <span className="block text-xs text-slate-600">{help}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="text-sm">
        <legend className="font-medium">Findings</legend>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          {(
            [
              ["show", "Show findings", "Each exam tells you what you found."],
              ["hide", "Hide findings (interpret)", "You hear and see what the exam produces (sounds, movements, pupils) and write what you notice. Text-only findings are still shown."],
            ] as const
          ).map(([value, label, help]) => (
            <label key={value} className={`flex cursor-pointer gap-2 rounded-lg border p-3 ${findings === value ? "border-cyan-700 bg-cyan-50" : "border-slate-200 bg-white"}`}>
              <input type="radio" name="findings" value={value} checked={findings === value} onChange={() => setFindings(value)} className="mt-1" />
              <span>
                <span className="font-medium">{label}</span>
                <span className="block text-xs text-slate-600">{help}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {cases.map((c) => (
          <li key={c.id} className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-semibold tracking-wide text-cyan-700 uppercase">{c.mode === "screening" ? "Screening exam" : "Case encounter"}</span>
            <h2 className="mt-1 font-semibold">{c.title}</h2>
            <p className="mt-1 flex-1 text-sm text-slate-600">{c.patient.chiefComplaint}</p>
            <p className="mt-2 text-xs text-slate-500">{c.doorSign.timeLimitMinutes} minutes</p>
            <button
              onClick={() => start(c.id)}
              disabled={!!busy}
              data-case={c.id}
              className="mt-3 rounded-md bg-cyan-700 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-800 disabled:opacity-60"
            >
              {busy === c.id ? "Starting…" : "Start station"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
