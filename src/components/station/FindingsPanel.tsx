import type { Action } from "@/domain/schemas";
import { findingDisplay, mmss, type Labels } from "@/components/common/format";

type Exam = Extract<Action, { type: "examine" }>;

/** All findings elicited so far, newest first. Reads only from the action log. */
export function FindingsPanel({ actions, labels }: { actions: Action[]; labels: Labels }) {
  const exams = actions.filter((a): a is Exam => a.type === "examine").reverse();
  return (
    <section aria-labelledby="findings-h" className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white">
      <h2 id="findings-h" className="border-b border-slate-200 px-3 py-2 text-sm font-semibold">
        Findings <span className="font-normal text-slate-500">({exams.length})</span>
      </h2>
      <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto" data-testid="findings">
        {exams.length === 0 && <li className="p-3 text-sm text-slate-500">Click a body region to examine.</li>}
        {exams.map((a) => (
          <li key={a.id} className="px-3 py-2 text-sm">
            <p className="text-xs text-slate-500">
              {mmss(a.t)} · {labels.maneuver(a.payload.maneuverId)} — {labels.region(a.payload.regionId)}
            </p>
            <p>{findingDisplay(a)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
