import type { Action } from "@/domain/schemas";
import { mmss, type Labels } from "@/components/common/format";
import { recognitionRows, type RecognitionVerdict } from "@/engine/recognition";

const VERDICT: Record<RecognitionVerdict, { label: string; tone: string }> = {
  recognized: { label: "Recognized", tone: "bg-emerald-100 text-emerald-900" },
  partial: { label: "Partly", tone: "bg-amber-100 text-amber-900" },
  missed: { label: "Missed", tone: "bg-red-100 text-red-900" },
  not_attempted: { label: "Not written", tone: "bg-slate-100 text-slate-600" },
};

/** Recognition (hide-findings mode): what each exam produced vs what the student wrote. Informational, not scored. */
export function RecognitionSection({ actions, labels, timelineHref }: { actions: Action[]; labels: Labels; timelineHref: (id: string) => string }) {
  const rows = recognitionRows(actions);
  if (!rows.length) return null;
  const counts = rows.reduce<Record<RecognitionVerdict, number>>((c, r) => ({ ...c, [r.verdict]: c[r.verdict] + 1 }), { recognized: 0, partial: 0, missed: 0, not_attempted: 0 });
  return (
    <section aria-labelledby="recognition-h" className="space-y-2 rounded-xl border border-slate-200 bg-white shadow-card p-5" data-testid="recognition">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="recognition-h" className="text-[15px] font-semibold text-slate-900">
          Recognition
        </h2>
        <p className="text-xs text-slate-500">
          {counts.recognized} recognized · {counts.partial} partly · {counts.missed} missed · {counts.not_attempted} not written · informational, not scored
        </p>
      </div>
      <p className="text-sm text-slate-600">Findings were hidden: here is what each exam produced, next to what you wrote.</p>
      <ul className="divide-y divide-slate-100">
        {rows.map((r) => (
          <li key={r.examActionId} className="grid gap-1 py-2 text-sm" data-verdict={r.verdict}>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${VERDICT[r.verdict].tone}`}>{VERDICT[r.verdict].label}</span>
              <a href={timelineHref(r.examActionId)} className="text-xs text-slate-500 hover:underline">
                {labels.maneuver(r.maneuverId)} — {labels.region(r.regionId)}
              </a>
            </div>
            <p>
              <span className="text-slate-500">Finding: </span>
              {r.findingText}
            </p>
            {r.interpretation && (
              <p>
                <span className="text-slate-500">You wrote: </span>“{r.interpretation}”
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Every mistake the rules caught (alerted at the time or not), in order. */
export function MistakesSection({ actions, timelineHref }: { actions: Action[]; timelineHref: (id: string) => string }) {
  const mistakes = actions.filter((a): a is Extract<Action, { type: "mistake" }> => a.type === "mistake");
  if (!mistakes.length) return null;
  return (
    <section aria-labelledby="mistakes-h" className="space-y-2 rounded-xl border border-slate-200 bg-white shadow-card p-5" data-testid="mistakes">
      <h2 id="mistakes-h" className="text-[15px] font-semibold text-slate-900">
        Mistakes <span className="font-normal text-slate-500">({mistakes.length})</span>
      </h2>
      <ul className="divide-y divide-slate-100">
        {mistakes.map((m) => (
          <li key={m.id} className="flex items-start gap-2 py-2 text-sm">
            <span aria-hidden="true" className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-red-600 text-xs font-bold text-white">
              !
            </span>
            <span className="min-w-0 flex-1">
              {m.payload.message}{" "}
              <a href={timelineHref(m.payload.causeActionId ?? m.id)} className="font-mono text-xs text-slate-500 hover:underline">
                {mmss(m.t)}
              </a>
              {!m.payload.alerted && <span className="ml-2 text-xs text-slate-500">(not shown during the exam)</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
