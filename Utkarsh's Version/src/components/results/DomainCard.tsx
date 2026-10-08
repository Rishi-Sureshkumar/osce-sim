import type { Action } from "@/domain/schemas";
import type { Labels } from "@/components/common/format";
import type { DomainTotal } from "@/engine/scoring";
import { domainOf } from "@/engine/sheets";
import type { SheetView } from "@/server/results";
import { SheetCard } from "./SheetCard";
import { ProgressRing } from "@/components/ui/ProgressRing";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Station verdict: pass only when every 1B domain passes. Shows the overall score and each domain against its pass mark. */
export function StationVerdict({ pass, domains }: { pass: boolean | null; domains: DomainTotal[] }) {
  if (!domains.length) return null;
  const pending = domains.reduce((n, d) => n + d.needsReview, 0);
  const points = domains.reduce((n, d) => n + d.points, 0);
  const maxPoints = domains.reduce((n, d) => n + d.maxPoints, 0);
  const overall = maxPoints > 0 ? points / maxPoints : 0;
  const tone = pass === null ? "text-slate-500" : pass ? "text-emerald-600" : "text-amber-500";
  return (
    <section className="@container overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card" data-testid="station-verdict" aria-label="Station result">
      <div className="grid @3xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="flex items-center gap-5 border-b border-slate-100 p-6 @3xl:border-r @3xl:border-b-0">
          <ProgressRing progress={overall * 100} className={tone}>
            <span className="text-[22px] font-semibold tracking-tight text-slate-900 tabular-nums">{pct(overall)}</span>
          </ProgressRing>
          <div className="min-w-0">
            <p className="eyebrow">Station result</p>
            <p className={`mt-1 text-2xl font-semibold tracking-tight ${pass === null ? "text-slate-800" : pass ? "text-emerald-700" : "text-amber-700"}`}>
              {pass === null ? "No pass mark set" : pass ? "Passed" : "Not yet passed"}
            </p>
            <p className="mt-0.5 text-sm text-slate-600 tabular-nums">
              {fmt(points)} of {fmt(maxPoints)} points
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              {pass === null ? "No pass mark set." : pass ? "Station passed: both domains reached their pass mark." : "Station not passed: every domain must reach its pass mark."}
              {pending > 0 && <span className="mt-1 block font-medium text-amber-700">{pending} item(s) still need coach review</span>}
            </p>
          </div>
        </div>
        <ul className="space-y-5 p-6">
          {domains.map((d) => (
            <li key={d.domain}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-slate-900">{d.title}</span>
                <span className="text-sm font-semibold text-slate-900 tabular-nums">
                  {pct(d.fraction)}
                  {d.pass !== null && (
                    <span className={`badge ml-2 align-middle ring-1 ${d.pass ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}`}>{d.pass ? "Pass" : "Not yet"}</span>
                  )}
                </span>
              </div>
              <div className="relative mt-2 h-2 rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${d.pass === false ? "bg-amber-500" : "bg-emerald-600"}`} style={{ width: pct(Math.min(1, d.fraction)) }} />
                {d.threshold !== null && <div className="absolute -top-1 h-4 w-0.5 rounded-full bg-slate-800" style={{ left: pct(d.threshold) }} title={`Pass mark ${pct(d.threshold)}`} />}
              </div>
              <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
                {fmt(d.points)}/{fmt(d.maxPoints)} points{d.threshold !== null && <> · pass mark {pct(d.threshold)}</>}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** One 1B domain: pass/fail against its threshold, then its mark sheets (items grouped by section). */
export function DomainCard({
  domain,
  sheets,
  actionsById,
  labels,
  timelineHref,
  renderExtra,
}: {
  domain: DomainTotal;
  sheets: SheetView[];
  actionsById: Map<string, Action>;
  labels: Labels;
  timelineHref: (actionId: string) => string;
  renderExtra?: (sheetId: string, itemId: string) => React.ReactNode;
}) {
  const mine = sheets.filter((s) => domainOf(s.sheet) === domain.domain);
  return (
    <section className="space-y-3 pt-2" aria-labelledby={`dom-${domain.domain}`} data-domain={domain.domain}>
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-2">
        <h2 id={`dom-${domain.domain}`} className="text-lg font-semibold tracking-tight text-slate-900">
          {domain.title}
        </h2>
        <p className="flex items-center gap-2 text-sm">
          <span className="text-lg font-semibold text-slate-900 tabular-nums">
            {fmt(domain.points)}/{fmt(domain.maxPoints)}
          </span>
          <span className="text-slate-500 tabular-nums">
            {pct(domain.fraction)}
            {domain.threshold !== null && <> · pass mark {pct(domain.threshold)}</>}
          </span>
          {domain.pass !== null && (
            <span className={`badge ${domain.pass ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"}`} data-testid="domain-result">
              {domain.pass ? "PASS" : "NOT YET"}
            </span>
          )}
        </p>
      </header>
      {mine.map((s) => (
        <div key={s.sheet.id}>
          <SheetCard view={s} actionsById={actionsById} labels={labels} timelineHref={timelineHref} renderExtra={renderExtra ? (itemId) => renderExtra(s.sheet.id, itemId) : undefined} />
          {s.sheet.attribution && <p className="mt-1 px-1 text-xs text-slate-500">{s.sheet.attribution}</p>}
        </div>
      ))}
    </section>
  );
}
