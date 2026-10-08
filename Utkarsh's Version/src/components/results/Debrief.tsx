import type { ResultsView } from "@/server/results";

export function Debrief({ debrief }: { debrief: NonNullable<ResultsView["debrief"]> }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card" aria-labelledby="debrief-h">
      <h2 id="debrief-h" className="text-[15px] font-semibold text-slate-900">
        Case debrief
      </h2>
      {debrief.missed.length > 0 && (
        <div className="mt-3">
          <h3 className="eyebrow">Key abnormal findings you did not elicit</h3>
          <ul className="mt-2 grid list-disc gap-x-6 gap-y-1 pl-5 text-sm text-slate-700 marker:text-slate-400 sm:grid-cols-2" data-testid="missed-findings">
            {debrief.missed.map((m) => (
              <li key={m.label + m.region}>
                {m.label}
                {m.region ? ` (${m.region})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
      {debrief.expectedDifferential.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h3 className="eyebrow">Expected differential</h3>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700 marker:font-semibold marker:text-slate-400">
            {debrief.expectedDifferential.map((d) => (
              <li key={d.rank}>
                <span className="font-semibold text-slate-900">{d.diagnosis}</span> — <span className="text-slate-600">{d.rationale}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
