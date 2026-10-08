import { Check } from "lucide-react";
import type { Action } from "@/domain/schemas";

const STEPS = ["Door", "History", "Exam", "Note", "Results"] as const;

/** Where the student is in the station, read only from the log: door → history → exam → note → results. */
export function StationStepper({ actions, ended }: { actions: Action[]; ended: boolean }) {
  const done = [
    actions.some((a) => a.type === "room" && a.payload.event === "enter"),
    actions.some((a) => a.type === "say"),
    actions.some((a) => a.type === "examine"),
    ended,
    ended,
  ];
  const current = done.indexOf(false);
  return (
    <ol className="hidden items-center gap-1.5 xl:flex" aria-label="Station progress">
      {STEPS.map((label, i) => {
        const isDone = done[i];
        const isCurrent = i === current;
        return (
          <li key={label} className="flex items-center gap-1.5" aria-current={isCurrent ? "step" : undefined}>
            {i > 0 && <span aria-hidden className={`h-px w-5 ${done[i - 1] ? "bg-cyan-600" : "bg-slate-200"}`} />}
            <span
              className={`flex size-5 items-center justify-center rounded-full text-[10px] font-semibold transition-colors ${
                isDone ? "bg-cyan-700 text-white" : isCurrent ? "bg-white text-cyan-700 ring-2 ring-cyan-600" : "bg-slate-100 text-slate-400"
              }`}
            >
              {isDone ? <Check aria-hidden className="size-3" strokeWidth={3} /> : i + 1}
            </span>
            <span className={`text-xs font-medium ${isDone || isCurrent ? "text-slate-800" : "text-slate-400"}`}>
              {label}
              <span className="sr-only">{isDone ? " (done)" : isCurrent ? " (current)" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
