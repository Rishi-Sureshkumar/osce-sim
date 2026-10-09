import type { Action } from "@/domain/schemas";
import { TAG_LABELS, describeAction, findingDisplay, mmss, type Labels } from "./format";
import { orderLog } from "@/engine/order";

/** Interleaved timeline of everything in the log. Each row is an anchor (#a-<actionId>) for evidence links. */
export function Timeline({ actions, labels, highlight }: { actions: Action[]; labels: Labels; highlight?: Set<string> }) {
  return (
    <ol className="divide-y divide-slate-100 rounded-lg border border-line bg-surface" data-testid="timeline">
      {orderLog(actions).map((a) => {
        const d = describeAction(a, labels);
        const tone =
          d.who === "patient" ? "text-violet-800" : a.type === "examine" ? "text-emerald-800" : a.type === "courtesy" ? "text-sky-800" : d.who === "system" ? "text-muted" : "text-ink";
        return (
          <li key={a.id} id={`a-${a.id}`} className={`scroll-mt-24 px-3 py-2 text-sm target:bg-amber-50 ${highlight?.has(a.id) ? "bg-amber-50" : ""}`}>
            <div className="flex gap-3">
              <span className="w-12 shrink-0 font-mono text-xs text-muted" data-volatile>{mmss(a.t)}</span>
              <span className="flex w-20 shrink-0 flex-col items-start gap-0.5 text-xs font-semibold text-ink-3 uppercase">
                {d.who === "patient" ? "Patient" : a.type === "examine" ? "Exam" : a.type === "courtesy" ? "Action" : d.who === "system" ? "" : "Student"}
                {a.type === "say" && (
                  <span className={`rounded px-1 text-[10px] font-normal normal-case ${a.source === "voice" ? "bg-cyan-100 text-brand-strong" : "bg-subtle text-ink-3"}`} data-testid="say-source">
                    {a.source === "voice" ? "voice" : "typed"}
                  </span>
                )}
              </span>
              <div className={`min-w-0 flex-1 ${tone}`}>
                <p className="break-words whitespace-pre-wrap">{d.text}</p>
                {a.type === "say" && !!a.payload.tags?.length && (
                  <ul className="mt-1 flex flex-wrap gap-1" aria-label="Courtesy tags">
                    {a.payload.tags.map((t) => (
                      <li key={t.tag} className="rounded bg-sky-50 px-1.5 py-0.5 text-[11px] text-sky-900" data-testid="courtesy-tag" title={t.via === "regex" ? "Tagged by keyword match" : t.via === "similarity" ? "Tagged by similarity to example phrasings (quote is the student's own sentence)" : "Tagged by the model (legacy session; quote verified)"}>
                        {TAG_LABELS[t.tag]}
                        {t.position ? ` (${t.position.replace(/_/g, " ")})` : ""}: <q className="italic">{t.evidence}</q>
                        {t.via !== "regex" && <span className="ml-1 text-sky-600">· {t.via === "similarity" ? "similar" : "model"}</span>}
                      </li>
                    ))}
                  </ul>
                )}
                {a.type === "patient_say" && a.payload.match && (
                  <p className="mt-0.5 text-[11px] text-ink-3" data-testid="utterance-match" title="How the deterministic matcher understood the student's question (coach view only)">
                    understood as{" "}
                    {a.payload.match.clauses
                      .map((c) => (c.kind === "unknown" ? `“${c.text}” → not recognised` : `${c.target.replace(/^[a-z_]+:/, "")} (${c.kind.replace("_", "-")}, ${c.via}${c.via === "none" ? "" : ` ${c.score.toFixed(2)}`})`))
                      .join(" · ")}
                    {a.payload.match.embedding !== "none" && <span> · embedded on the {a.payload.match.embedding}</span>}
                  </p>
                )}
                {a.type === "examine" && <p className="mt-0.5 text-ink-3">→ {findingDisplay(a, labels)}</p>}
                {a.type === "submit_pen" && (
                  <div className="mt-1 space-y-1 text-ink-2" data-testid="pen-in-timeline">
                    <p className="whitespace-pre-wrap">
                      <span className="font-medium">History:</span> {a.payload.history || "—"}
                    </p>
                    <p className="whitespace-pre-wrap">
                      <span className="font-medium">Physical exam:</span> {a.payload.exam || "—"}
                    </p>
                    <ol className="list-decimal pl-5">
                      {a.payload.diagnoses.map((d, i) => (
                        <li key={i}>
                          {d.diagnosis}
                          {d.support ? <span className="text-ink-3"> — {d.support}</span> : null}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {a.type === "submit_ddx" && (
                  <div className="mt-1 space-y-1 text-ink-2">
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
