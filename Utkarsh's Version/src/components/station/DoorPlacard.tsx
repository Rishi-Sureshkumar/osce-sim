import { useEffect, useState } from "react";
import type { PublicCase } from "@/domain/schemas";

/** The corridor placard: who, why, vitals, the task and the exams not to perform (1B door instructions). */
export function DoorPlacard({ kase, children, collapsible = false }: { kase: PublicCase; children?: React.ReactNode; collapsible?: boolean }) {
  // once inside the room the task text folds away so the conversation gets the space (it stays in the DOM)
  const [open, setOpen] = useState(!collapsible);
  useEffect(() => {
    if (collapsible) setOpen(false);
  }, [collapsible]);
  const p = kase.patient;
  const v = kase.vitals;
  const d = kase.doorInstructions;
  return (
    <section aria-labelledby="door-placard" className="rounded-xl border border-slate-200 bg-white p-4 shadow-card" data-testid="door-placard">
      <div className="flex items-center justify-between gap-2">
        <h2 id="door-placard" className="eyebrow">
          Door instructions
        </h2>
        {collapsible && (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="rounded px-1 text-[11px] font-medium text-cyan-700 hover:bg-cyan-50">
            {open ? "Hide task" : "Show task"}
          </button>
        )}
      </div>
      <p className="mt-1.5 text-[15px] font-semibold text-slate-900">
        {p.name}, {p.age} ({p.pronouns})
      </p>
      <p className="mt-1 text-sm leading-relaxed text-slate-700">
        <span className="font-semibold text-slate-900">Reason for visit:</span> {d?.reasonForVisit ?? p.chiefComplaint}
      </p>
      <dl className="mt-3 grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 text-xs tabular-nums" aria-label="Vital signs">
        {(
          [
            ["BP", `${v.bpSystolic}/${v.bpDiastolic}`, "mmHg"],
            ["HR", String(v.hr), "/min"],
            ["RR", String(v.rr), "/min"],
            ["Temp", v.tempC.toFixed(1), "°C"],
            ["SpO₂", `${v.spo2}%`, v.spo2Context],
          ] as const
        ).map(([k, val, unit], i) => (
          <div key={k} className={`bg-white px-2 py-1.5 ${i === 0 ? "col-span-2" : i === 4 ? "col-span-3" : ""}`}>
            <dt className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{k}</dt>
            <dd className="mt-px truncate font-semibold text-slate-900">
              {val} <span className="font-normal text-slate-500">{unit}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm leading-relaxed text-slate-700" hidden={!open}>
        <span className="font-semibold text-slate-900">Your task:</span> {d?.task ?? kase.doorSign.task}
      </p>
      {!!d?.prohibitedExams.length && (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          <span className="font-semibold">Do not perform:</span> {d.prohibitedExams.map((x) => x.label).join("; ")}
        </p>
      )}
      {children}
    </section>
  );
}
