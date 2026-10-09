"use client";
import { useState } from "react";
import type { Action } from "@/domain/schemas";
import { findingDisplay, mmss, type Labels } from "@/components/common/format";
import { orderLog } from "@/engine/order";

type Exam = Extract<Action, { type: "examine" }>;

/**
 * All findings elicited so far, newest first. Reads only from the action log. In hide-findings mode
 * an exam with a sound or visual shows what was done, and the student writes what they noticed
 * (logged as an `interpretation`); text-only ("reported") findings are shown as usual.
 */
export function FindingsPanel({ actions, labels, hide = false, onInterpret }: { actions: Action[]; labels: Labels; hide?: boolean; onInterpret?: (exam: Exam, text: string) => Promise<void> }) {
  const ordered = orderLog(actions);
  const exams = ordered.filter((a): a is Exam => a.type === "examine").reverse();
  const interpretation = new Map<string, string>();
  for (const a of ordered) if (a.type === "interpretation") interpretation.set(a.payload.examActionId, a.payload.text);
  return (
    <section aria-labelledby="findings-h" className="flex min-h-0 flex-col rounded-lg border border-line bg-surface">
      <h2 id="findings-h" className="flex items-center justify-between border-b border-line px-3 py-2 text-sm font-semibold">
        <span>
          Findings <span className="font-normal text-ink-3">({exams.length})</span>
        </span>
        {hide && (
          <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-semibold text-violet-900" data-testid="findings-hidden-chip" title="Exams with a sound or visual show only what you did; write what you notice.">
            Findings hidden
          </span>
        )}
      </h2>
      <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto" data-testid="findings">
        {exams.length === 0 && <li className="p-3 text-sm text-ink-3">{hide ? "Click a body region to examine. Listen and watch, then write what you notice." : "Click a body region to examine."}</li>}
        {exams.map((a) => (
          <li key={a.id} className="px-3 py-2 text-sm">
            <p className="text-xs text-ink-3">
              {mmss(a.t)} · {labels.maneuver(a.payload.maneuverId)} — {labels.region(a.payload.regionId)}
            </p>
            {hide && a.result && !a.result.reported ? (
              <Interpret exam={a} saved={interpretation.get(a.id)} onInterpret={onInterpret} />
            ) : (
              <p>{findingDisplay(a, labels)}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Interpret({ exam, saved, onInterpret }: { exam: Exam; saved?: string; onInterpret?: (exam: Exam, text: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const id = `interp-${exam.id}`;
  return (
    <div className="mt-1 grid gap-1" data-testid="interpret">
      <p className="text-ink-3 italic">{exam.result?.doneText ?? "Examined."}</p>
      {saved && (
        <p className="rounded bg-violet-50 px-2 py-1 text-violet-950" data-testid="interpretation">
          You noted: {saved}
        </p>
      )}
      {onInterpret && (
        <form
          className="flex gap-1"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!text.trim()) return;
            setBusy(true);
            try {
              await onInterpret(exam, text.trim());
              setText("");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label htmlFor={id} className="sr-only">
            What did you notice?
          </label>
          <input id={id} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder={saved ? "Revise what you noticed" : "What did you hear or see?"} className="min-w-0 flex-1 rounded border border-line-strong px-2 py-1 text-sm" />
          <button type="submit" disabled={busy || !text.trim()} className="rounded bg-violet-700 px-2 py-1 text-xs font-medium text-white disabled:opacity-50">
            Save
          </button>
        </form>
      )}
    </div>
  );
}
