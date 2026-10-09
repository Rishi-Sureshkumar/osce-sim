"use client";
import { useEffect, useState } from "react";
import type { PublicCase } from "@/domain/schemas";

/**
 * The corridor placard: who, why, vitals, the task and the exams not to perform (1B door instructions).
 * Inside the room it folds to one line (V-OVERFLOW: it pushed the conversation below the fold); the
 * student can open it again at any time.
 */
export function DoorPlacard({ kase, collapsible = false, children }: { kase: PublicCase; collapsible?: boolean; children?: React.ReactNode }) {
  const p = kase.patient;
  const v = kase.vitals;
  const d = kase.doorInstructions;
  const [open, setOpen] = useState(!collapsible);
  useEffect(() => {
    setOpen(!collapsible);
  }, [collapsible]);
  return (
    <section aria-labelledby="door-placard" className="rounded-lg border border-line bg-surface shadow-1" data-testid="door-placard">
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
        <h2 id="door-placard" className="text-xs font-semibold tracking-wide text-ink-3 uppercase">
          Door instructions
        </h2>
        {collapsible && (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="text-xs text-brand hover:underline">
            {open ? "Hide" : "Show"}
          </button>
        )}
      </div>
      <div className="px-3 pb-3">
        <p className="mt-1 font-semibold text-ink">
          {p.name}, {p.age} ({p.pronouns})
        </p>
        {open ? (
          <>
            <p className="mt-1 text-sm text-ink-2">
              <span className="font-medium text-ink">Reason for visit:</span> {d?.reasonForVisit ?? p.chiefComplaint}
            </p>
            <dl className="mt-2 grid grid-cols-3 gap-x-2 gap-y-0.5 text-xs" aria-label="Vital signs">
              <dt className="text-ink-3">BP</dt>
              <dd className="col-span-2">
                {v.bpSystolic}/{v.bpDiastolic} mmHg
              </dd>
              <dt className="text-ink-3">HR</dt>
              <dd className="col-span-2">{v.hr} /min</dd>
              <dt className="text-ink-3">RR</dt>
              <dd className="col-span-2">{v.rr} /min</dd>
              <dt className="text-ink-3">Temp</dt>
              <dd className="col-span-2">{v.tempC.toFixed(1)} °C</dd>
              <dt className="text-ink-3">SpO₂</dt>
              <dd className="col-span-2">
                {v.spo2}% {v.spo2Context}
              </dd>
            </dl>
            <p className="mt-2 text-sm text-ink-2">
              <span className="font-medium text-ink">Your task:</span> {d?.task ?? kase.doorSign.task}
            </p>
            {!!d?.prohibitedExams.length && (
              <p className="mt-2 text-sm text-ink-2">
                <span className="font-medium text-ink">Do not perform:</span> {d.prohibitedExams.map((x) => x.label).join("; ")}
              </p>
            )}
          </>
        ) : (
          <p className="truncate text-xs text-ink-3" title={d?.reasonForVisit ?? p.chiefComplaint}>
            {d?.reasonForVisit ?? p.chiefComplaint} · BP {v.bpSystolic}/{v.bpDiastolic}, HR {v.hr}, RR {v.rr}, SpO₂ {v.spo2}%
          </p>
        )}
        {children}
      </div>
    </section>
  );
}
