import type { GradingRun } from "@/domain/schemas";

export function FeedbackSummary({ run }: { run: GradingRun }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4" aria-labelledby="summary-h">
      <h2 id="summary-h" className="font-semibold">
        Feedback
      </h2>
      <p className="mt-1 text-sm whitespace-pre-wrap" data-testid="summary">
        {run.summary}
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-emerald-800">Strengths</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {run.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-amber-800">To improve</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {run.improvements.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
