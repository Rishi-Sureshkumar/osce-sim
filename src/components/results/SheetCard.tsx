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
    <section className="rounded-lg border border-slate-200 bg-white" aria-labelledby={`sheet-${sheet.id}`} data-sheet={sheet.id}>
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <h2 id={`sheet-${sheet.id}`} className="font-semibold">
          {sheet.title}
        </h2>
        <p className="text-sm">
          <span className="font-mono text-lg font-semibold">
            {fmt(totals.points)}/{fmt(totals.maxPoints)}
          </span>{" "}
          <span className="text-slate-500">({pct}%)</span>
          {totals.needsReview > 0 && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">{totals.needsReview} need review</span>}
          {totals.notAssessable > 0 && <span className="ml-2 text-xs text-slate-500">{totals.notAssessable} not assessable</span>}
        </p>
      </header>
      {sections.map((sec) => {
        const items = sheet.items.filter((i) => i.section === sec && byItem.has(i.id));
        if (!items.length) return null;
        return (
          <details key={sec} open className="border-b border-slate-100 last:border-0">
            <summary className="cursor-pointer bg-slate-50 px-4 py-1.5 text-xs font-semibold tracking-wide text-slate-600 uppercase">{sec}</summary>
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
