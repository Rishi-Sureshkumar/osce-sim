import type { Action } from "@/domain/schemas";
import { describeAction, findingDisplay, mmss, type Labels } from "./format";

/** Interleaved timeline of everything in the log. Each row is an anchor (#a-<actionId>) for evidence links. */
export function Timeline({ actions, labels, highlight }: { actions: Action[]; labels: Labels; highlight?: Set<string> }) {
  return (
    <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white" data-testid="timeline">
      {actions.map((a) => {
        const d = describeAction(a, labels);
        const tone =
          d.who === "patient" ? "text-violet-800" : a.type === "examine" ? "text-emerald-800" : a.type === "courtesy" ? "text-sky-800" : d.who === "system" ? "text-slate-400" : "text-slate-900";
        return (
          <li key={a.id} id={`a-${a.id}`} className={`scroll-mt-24 px-3 py-2 text-sm target:bg-amber-50 ${highlight?.has(a.id) ? "bg-amber-50" : ""}`}>
            <div className="flex gap-3">
              <span className="w-12 shrink-0 font-mono text-xs text-slate-400">{mmss(a.t)}</span>
              <span className="w-20 shrink-0 text-xs font-semibold text-slate-500 uppercase">
                {d.who === "patient" ? "Patient" : a.type === "examine" ? "Exam" : a.type === "courtesy" ? "Action" : d.who === "system" ? "" : "Student"}
              </span>
              <div className={`min-w-0 flex-1 ${tone}`}>
                <p className="break-words whitespace-pre-wrap">{d.text}</p>
                {a.type === "examine" && <p className="mt-0.5 text-slate-600">→ {findingDisplay(a)}</p>}
                {a.type === "submit_ddx" && (
                  <div className="mt-1 space-y-1 text-slate-700">
                    <p>
                      <span className="font-medium">Summary:</span> {a.payload.summary}
                    </p>
                    <p>
                      <span className="font-medium">Plan:</span> {a.payload.plan}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
