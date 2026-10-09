import type { Action } from "@/domain/schemas";
import { describeAction, mmss, type Labels } from "@/components/common/format";
import { orderLog } from "@/engine/order";

export function ActionLog({ actions, labels }: { actions: Action[]; labels: Labels }) {
  return (
    <section aria-labelledby="log-h" className="flex min-h-0 flex-col rounded-lg border border-line bg-surface">
      <h2 id="log-h" className="border-b border-line px-3 py-2 text-sm font-semibold">
        Action log
      </h2>
      <ol className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-xs" data-testid="action-log">
        {orderLog(actions).reverse().map((a) => {
          const d = describeAction(a, labels);
          return (
            <li key={a.id} className="py-0.5">
              <span className="text-muted">{mmss(a.t)}</span>{" "}
              <span className={d.who === "patient" ? "text-violet-700" : d.who === "system" ? "text-muted" : "text-ink-2"}>
                {d.who === "patient" ? "Patient: " : ""}
                {d.text}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
