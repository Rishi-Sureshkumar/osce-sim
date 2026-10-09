import type { Action } from "@/domain/schemas";
import type { Labels } from "@/components/common/format";
import type { DomainTotal } from "@/engine/scoring";
import { domainOf } from "@/engine/sheets";
import type { SheetView } from "@/server/results";
import { SheetCard } from "./SheetCard";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** A score bar with the pass mark drawn on it. */
function ScoreBar({ fraction, threshold, pass }: { fraction: number; threshold: number | null; pass: boolean | null }) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-line" aria-hidden>
      <div className={`h-full rounded-full ${pass === null ? "bg-brand" : pass ? "bg-ok" : "bg-warn"}`} style={{ width: pct(Math.min(1, fraction)) }} />
      {threshold !== null && <div className="absolute top-0 h-full w-0.5 bg-ink/60" style={{ left: pct(threshold) }} title={`Pass mark ${pct(threshold)}`} />}
    </div>
  );
}

/** Station verdict (Phase 4 M6: the results page leads with it): pass only when every 1B domain passes, with each domain at a glance. */
export function StationVerdict({ pass, domains }: { pass: boolean | null; domains: DomainTotal[] }) {
  if (!domains.length) return null;
  const pending = domains.reduce((n, d) => n + d.needsReview, 0);
  return (
    <section className={`rounded-xl border p-4 shadow-1 ${pass === null ? "border-line bg-surface" : pass ? "border-ok/30 bg-ok-soft" : "border-warn/30 bg-warn-soft"}`} aria-label="Station result">
      <p className={`text-lg font-semibold ${pass === null ? "text-ink" : pass ? "text-ok" : "text-warn"}`} data-testid="station-verdict">
        {pass === null ? "No pass mark set." : pass ? "Station passed: both domains reached their pass mark." : "Station not passed: every domain must reach its pass mark."}
        {pending > 0 && <span className="ml-2 text-sm font-normal text-ink-2">({pending} item{pending === 1 ? "" : "s"} still need coach review)</span>}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {domains.map((d) => (
          <a key={d.domain} href={`#dom-${d.domain}`} className="block rounded-lg border border-line bg-surface p-3 hover:border-line-strong">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-ink">{d.title}</span>
              <span className="font-mono text-sm font-semibold text-ink">
                {fmt(d.points)}/{fmt(d.maxPoints)} <span className="font-sans font-normal text-ink-3">· {pct(d.fraction)}</span>
              </span>
            </div>
            <div className="mt-2">
              <ScoreBar fraction={d.fraction} threshold={d.threshold} pass={d.pass} />
            </div>
            <p className="mt-1.5 text-xs text-ink-3">
              {d.threshold !== null ? `Pass mark ${pct(d.threshold)}` : "No pass mark"}
              {d.pass !== null && <span className={`ml-2 font-semibold ${d.pass ? "text-ok" : "text-warn"}`}>{d.pass ? "Passed" : "Not yet"}</span>}
            </p>
          </a>
        ))}
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
    <section className="scroll-mt-4 space-y-2 rounded-xl border border-line bg-subtle p-3" aria-labelledby={`dom-${domain.domain}`} data-domain={domain.domain}>
      <header className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h2 id={`dom-${domain.domain}`} className="scroll-mt-4 text-lg font-semibold">
          {domain.title}
        </h2>
        <p className="flex items-center gap-2 text-sm">
          <span className="font-mono text-lg font-semibold">
            {fmt(domain.points)}/{fmt(domain.maxPoints)}
          </span>
          <span className="text-ink-3">
            {pct(domain.fraction)}
            {domain.threshold !== null && <> · pass mark {pct(domain.threshold)}</>}
          </span>
          {domain.pass !== null && (
            <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${domain.pass ? "bg-ok text-white" : "bg-warn text-white"}`} data-testid="domain-result">
              {domain.pass ? "PASS" : "NOT YET"}
            </span>
          )}
        </p>
      </header>
      {mine.map((s) => (
        <div key={s.sheet.id}>
          <SheetCard view={s} actionsById={actionsById} labels={labels} timelineHref={timelineHref} renderExtra={renderExtra ? (itemId) => renderExtra(s.sheet.id, itemId) : undefined} />
          {s.sheet.attribution && <p className="mt-1 px-1 text-xs text-ink-3">{s.sheet.attribution}</p>}
        </div>
      ))}
    </section>
  );
}
