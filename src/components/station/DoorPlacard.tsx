import type { PublicCase } from "@/domain/schemas";

/** The corridor placard: who, why, vitals, the task and the exams not to perform (1B door instructions). */
export function DoorPlacard({ kase, children }: { kase: PublicCase; children?: React.ReactNode }) {
  const p = kase.patient;
  const v = kase.vitals;
  const d = kase.doorInstructions;
  return (
    <section aria-labelledby="door-placard" className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm" data-testid="door-placard">
      <h2 id="door-placard" className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        Door instructions
      </h2>
      <p className="mt-1 font-semibold">
        {p.name}, {p.age} ({p.pronouns})
      </p>
      <p className="mt-1 text-sm">
        <span className="font-medium">Reason for visit:</span> {d?.reasonForVisit ?? p.chiefComplaint}
      </p>
      <dl className="mt-2 grid grid-cols-3 gap-x-2 gap-y-0.5 text-xs" aria-label="Vital signs">
        <dt className="text-slate-500">BP</dt>
        <dd className="col-span-2">
          {v.bpSystolic}/{v.bpDiastolic} mmHg
        </dd>
        <dt className="text-slate-500">HR</dt>
        <dd className="col-span-2">{v.hr} /min</dd>
        <dt className="text-slate-500">RR</dt>
        <dd className="col-span-2">{v.rr} /min</dd>
        <dt className="text-slate-500">Temp</dt>
        <dd className="col-span-2">{v.tempC.toFixed(1)} °C</dd>
        <dt className="text-slate-500">SpO₂</dt>
        <dd className="col-span-2">
          {v.spo2}% {v.spo2Context}
        </dd>
      </dl>
      <p className="mt-2 text-sm">
        <span className="font-medium">Your task:</span> {d?.task ?? kase.doorSign.task}
      </p>
      {!!d?.prohibitedExams.length && (
        <p className="mt-2 text-sm">
          <span className="font-medium">Do not perform:</span> {d.prohibitedExams.map((x) => x.label).join("; ")}
        </p>
      )}
      {children}
    </section>
  );
}
