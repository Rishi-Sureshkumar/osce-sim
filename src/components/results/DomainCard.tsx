import type { Action } from "@/domain/schemas";
import type { Labels } from "@/components/common/format";
import type { DomainTotal } from "@/engine/scoring";
import { domainOf } from "@/engine/sheets";
import type { SheetView } from "@/server/results";
import { SheetCard } from "./SheetCard";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Station verdict: pass only when every 1B domain passes. */
export function StationVerdict({ pass, domains }: { pass: boolean | null; domains: DomainTotal[] }) {
  if (!domains.length) return null;
  const pending = domains.reduce((n, d) => n + d.needsReview, 0);
  return (
    <p
      className={`rounded-md px-3 py-2 text-sm font-medium ${pass === null ? "bg-slate-100 text-slate-700" : pass ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}
      data-testid="station-verdict"
    >
      {pass === null ? "No pass mark set." : pass ? "Station passed: both domains reached their pass mark." : "Station not passed: every domain must reach its pass mark."}
      {pending > 0 && <span className="ml-2 font-normal">({pending} item(s) still need coach review)</span>}
    </p>
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
    <section className="space-y-2 rounded-xl border border-slate-300 bg-slate-50 p-3" aria-labelledby={`dom-${domain.domain}`} data-domain={domain.domain}>
      <header className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h2 id={`dom-${domain.domain}`} className="text-lg font-semibold">
          {domain.title}
        </h2>
        <p className="flex items-center gap-2 text-sm">
          <span className="font-mono text-lg font-semibold">
            {fmt(domain.points)}/{fmt(domain.maxPoints)}
          </span>
          <span className="text-slate-600">
            {pct(domain.fraction)}
            {domain.threshold !== null && <> · pass mark {pct(domain.threshold)}</>}
          </span>
          {domain.pass !== null && (
            <span className={`rounded px-2 py-0.5 text-xs font-bold ${domain.pass ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`} data-testid="domain-result">
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
