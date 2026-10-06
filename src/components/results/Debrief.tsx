import type { ResultsView } from "@/server/results";

export function Debrief({ debrief }: { debrief: NonNullable<ResultsView["debrief"]> }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4" aria-labelledby="debrief-h">
      <h2 id="debrief-h" className="font-semibold">
        Case debrief
      </h2>
      {debrief.missed.length > 0 && (
        <div className="mt-2">
          <h3 className="text-sm font-semibold">Key abnormal findings you did not elicit</h3>
          <ul className="mt-1 list-disc pl-5 text-sm" data-testid="missed-findings">
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
        <div className="mt-3">
          <h3 className="text-sm font-semibold">Expected differential</h3>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
            {debrief.expectedDifferential.map((d) => (
              <li key={d.rank}>
                <span className="font-medium">{d.diagnosis}</span> — <span className="text-slate-600">{d.rationale}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
