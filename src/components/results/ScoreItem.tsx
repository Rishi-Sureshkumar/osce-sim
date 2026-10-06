import type { Action, MarkSheetItem } from "@/domain/schemas";
import type { EffectiveScore } from "@/engine/scoring";
import { describeAction, mmss, type Labels } from "@/components/common/format";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ""));

export function StatusBadge({ s }: { s: EffectiveScore }) {
  if (s.override) return <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-800">Coach override</span>;
  if (s.status === "needs_review") return <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">Needs review</span>;
  if (s.status === "not_assessable") return <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">Not assessable</span>;
  return <span className={`rounded px-1.5 py-0.5 text-xs ${s.scoring === "ai" ? "bg-violet-50 text-violet-800" : "bg-emerald-50 text-emerald-800"}`}>{s.scoring === "ai" ? "AI-graded" : "Auto"}</span>;
}

/** One mark-sheet item: score, status, rationale and evidence linking to the timeline. */
export function ScoreItem({
  item,
  score,
  actionsById,
  labels,
  timelineHref,
  children,
}: {
  item: MarkSheetItem;
  score: EffectiveScore;
  actionsById: Map<string, Action>;
  labels: Labels;
  timelineHref: (actionId: string) => string;
  children?: React.ReactNode;
}) {
  const na = score.status === "not_assessable";
  const full = score.maxPoints > 0 && score.points >= score.maxPoints;
  return (
    <li className={`px-3 py-2 ${na ? "opacity-60" : ""}`} data-item={item.id}>
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 w-14 shrink-0 rounded text-center font-mono text-sm ${na ? "bg-slate-100 text-slate-400" : full ? "bg-emerald-100 text-emerald-900" : score.points > 0 ? "bg-amber-100 text-amber-900" : "bg-red-50 text-red-800"}`}
        >
          {na ? "—" : `${fmt(score.points)}/${fmt(score.maxPoints)}`}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {item.fcmId && <span className="mr-1 text-xs text-slate-400">#{item.fcmId}</span>}
            {item.label} <StatusBadge s={score} />
          </p>
          <p className="text-xs text-slate-600">{score.rationale}</p>
          {score.override && (
            <p className="mt-0.5 text-xs text-indigo-800">
              Coach {score.override.coach}: {fmt(score.override.originalPoints)} → {fmt(score.override.newPoints)} — “{score.override.reason}”
            </p>
          )}
          {score.evidence.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {score.evidence.map((e, i) => {
                const a = actionsById.get(e.actionId);
                return (
                  <li key={i} className="text-xs">
                    <a href={timelineHref(e.actionId)} className="text-cyan-700 hover:underline">
                      {a ? mmss(a.t) : "?"}
                    </a>{" "}
                    {e.quote ? (
                      <span className={e.verified ? "text-slate-700" : "text-red-700 line-through"} title={e.verified ? "Quote verified in transcript" : "Quote NOT found verbatim"}>
                        “{e.quote}”
                      </span>
                    ) : (
                      a && <span className="text-slate-600">{describeAction(a, labels).text}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {children}
        </div>
      </div>
    </li>
  );
}
