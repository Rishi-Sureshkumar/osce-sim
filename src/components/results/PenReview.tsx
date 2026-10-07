import type { Action } from "@/domain/schemas";
import { mmss } from "@/components/common/format";
import type { PenCheckResult } from "@/engine/penCheck";

/** The post-encounter note, with each physical-exam claim linked to the exam that supports it or flagged. */
export function PenReview({ pen, check, actionsById, timelineHref }: { pen: Extract<Action, { type: "submit_pen" }>; check: PenCheckResult; actionsById: Map<string, Action>; timelineHref: (id: string) => string }) {
  const p = pen.payload;
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm" aria-labelledby="pen-review-h" data-testid="pen-review">
      <h2 id="pen-review-h" className="font-semibold">
        Post-encounter note{p.locked && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-900">locked at time-up</span>}
      </h2>
      <h3 className="mt-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">History</h3>
      <p className="whitespace-pre-wrap">{p.history || "—"}</p>
      <h3 className="mt-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        Physical exam <span className="font-normal normal-case">· each claim checked against the exam log</span>
      </h3>
      {check.claims.length === 0 ? (
        <p>—</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {check.claims.map((c, i) => (
            <li key={i} className={`rounded px-2 py-1 ${c.status === "flagged" ? "bg-red-50" : c.status === "linked" ? "bg-emerald-50" : "bg-slate-50"}`} data-claim={c.status}>
              <span>{c.text}</span>{" "}
              {c.status === "flagged" && <span className="text-xs font-semibold text-red-800">Not performed in the encounter</span>}
              {c.status === "linked" && (
                <span className="text-xs text-emerald-900">
                  performed at{" "}
                  {c.actionIds.slice(0, 4).map((id, j) => (
                    <a key={id} href={timelineHref(id)} className="text-cyan-700 underline">
                      {j ? ", " : ""}
                      {mmss(actionsById.get(id)?.t ?? 0)}
                    </a>
                  ))}
                </span>
              )}
              {c.status === "unmatched" && <span className="text-xs text-slate-500">no specific maneuver named</span>}
            </li>
          ))}
        </ul>
      )}
      <h3 className="mt-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Diagnoses</h3>
      <ol className="list-decimal pl-5">
        {p.diagnoses.map((d, i) => (
          <li key={i}>
            {d.diagnosis}
            {d.support && <span className="text-slate-500"> — {d.support}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
