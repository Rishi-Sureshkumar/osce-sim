"use client";
import { useState } from "react";

/** In-app feedback for students and coaches (stored in the database). */
export function FeedbackForm({ sessionId, page, prompt = "Was this feedback fair and useful?" }: { sessionId?: string; page: string; prompt?: string }) {
  const [rating, setRating] = useState<number | null>(null);
  const [fairness, setFairness] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (state === "sent") return <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">Thanks — your feedback was saved.</p>;

  return (
    <form
      className="space-y-2 rounded-lg border border-line bg-surface p-4"
      aria-labelledby="fb-h"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("busy");
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: sessionId ?? null, rating, fairness, text, page }),
        });
        if (res.ok) setState("sent");
        else {
          setError((await res.json().catch(() => ({}))).error ?? "Could not save feedback");
          setState("error");
        }
      }}
    >
      <h2 id="fb-h" className="font-semibold">
        {prompt}
      </h2>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} role="radio" aria-checked={rating === n} onClick={() => setRating(n)} className={`h-8 w-8 rounded-md border ${rating === n ? "border-brand bg-brand text-white" : "border-line-strong"}`}>
              {n}
            </button>
          ))}
        </span>
        <label className="flex items-center gap-2">
          Scoring was
          <select value={fairness ?? ""} onChange={(e) => setFairness(e.target.value || null)} className="rounded-md border border-line-strong px-2 py-1">
            <option value="">—</option>
            <option value="fair">fair</option>
            <option value="too_harsh">too harsh</option>
            <option value="too_lenient">too lenient</option>
            <option value="unsure">not sure</option>
          </select>
        </label>
      </div>
      <label className="block text-sm">
        <span className="sr-only">Comments</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={5000} placeholder="What worked, what didn't, what was wrong?" className="w-full rounded-md border border-line-strong p-2" />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button disabled={state === "busy"} className="rounded-md bg-ink px-4 py-2 text-sm text-white disabled:opacity-50">
        Send feedback
      </button>
    </form>
  );
}
