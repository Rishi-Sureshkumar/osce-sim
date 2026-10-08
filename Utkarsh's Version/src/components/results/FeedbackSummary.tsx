import type { GradingRun } from "@/domain/schemas";

export function FeedbackSummary({ run }: { run: GradingRun }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card" aria-labelledby="summary-h">
      <h2 id="summary-h" className="text-[15px] font-semibold text-slate-900">
        Feedback
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-slate-700" data-testid="summary">
        {run.summary}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
          <h3 className="text-sm font-semibold text-emerald-700">Strengths</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700 marker:text-emerald-500">
            {run.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
          <h3 className="text-sm font-semibold text-amber-700">To improve</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700 marker:text-amber-500">
            {run.improvements.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
