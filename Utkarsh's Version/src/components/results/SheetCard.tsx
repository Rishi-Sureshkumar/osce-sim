import type { Action } from "@/domain/schemas";
import type { Labels } from "@/components/common/format";
import type { SheetView } from "@/server/results";
import { ScoreItem } from "./ScoreItem";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function SheetCard({
  view,
  actionsById,
  labels,
  timelineHref,
  renderExtra,
}: {
  view: SheetView;
  actionsById: Map<string, Action>;
  labels: Labels;
  timelineHref: (actionId: string) => string;
  renderExtra?: (itemId: string) => React.ReactNode;
}) {
  const { sheet, scores, totals } = view;
  const byItem = new Map(scores.map((s) => [s.itemId, s]));
  const sections = [...new Set(sheet.items.map((i) => i.section))];
  const pct = totals.maxPoints ? Math.round((totals.points / totals.maxPoints) * 100) : 0;
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card" aria-labelledby={`sheet-${sheet.id}`} data-sheet={sheet.id}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <h2 id={`sheet-${sheet.id}`} className="text-[15px] font-semibold text-slate-900">
          {sheet.title}
        </h2>
        <p className="text-sm">
          <span className="text-base font-semibold text-slate-900 tabular-nums">
            {fmt(totals.points)}/{fmt(totals.maxPoints)}
          </span>{" "}
          <span className="text-slate-500 tabular-nums">({pct}%)</span>
          {totals.needsReview > 0 && <span className="badge ml-2 bg-amber-50 text-amber-800 ring-1 ring-amber-200">{totals.needsReview} need review</span>}
          {totals.notAssessable > 0 && <span className="ml-2 text-xs text-slate-500">{totals.notAssessable} not assessable</span>}
        </p>
      </header>
      {sections.map((sec) => {
        const items = sheet.items.filter((i) => i.section === sec && byItem.has(i.id));
        if (!items.length) return null;
        return (
          <details key={sec} open className="border-b border-slate-100 last:border-0">
            <summary className="cursor-pointer border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase hover:text-slate-800">{sec}</summary>
            <ul className="divide-y divide-slate-100">
              {items.map((item) => (
                <ScoreItem key={item.id} item={item} score={byItem.get(item.id)!} actionsById={actionsById} labels={labels} timelineHref={timelineHref}>
                  {renderExtra?.(item.id)}
                </ScoreItem>
              ))}
            </ul>
          </details>
        );
      })}
    </section>
  );
}
