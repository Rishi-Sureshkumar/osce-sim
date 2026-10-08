import type { Action } from "@/domain/schemas";
import { describeAction, mmss, type Labels } from "@/components/common/format";
import { orderLog } from "@/engine/order";

export function ActionLog({ actions, labels }: { actions: Action[]; labels: Labels }) {
  return (
    <section aria-labelledby="log-h" className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white shadow-card">
      <h2 id="log-h" className="border-b border-slate-100 px-3.5 py-2.5 text-[13px] font-semibold text-slate-800">
        Action log
      </h2>
      <ol className="min-h-0 flex-1 overflow-y-auto px-3.5 py-2 font-mono text-[11.5px] leading-relaxed" data-testid="action-log">
        {orderLog(actions).reverse().map((a) => {
          const d = describeAction(a, labels);
          return (
            <li key={a.id} className="py-0.5">
              <span className="text-slate-400 tabular-nums">{mmss(a.t)}</span>{" "}
              <span className={d.who === "patient" ? "text-cyan-700" : d.who === "system" ? "text-slate-400" : "text-slate-800"}>
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
