import type { PublicCase } from "@/domain/schemas";

export function DoorSign({ kase }: { kase: PublicCase }) {
  const p = kase.patient;
  return (
    <section aria-labelledby="door-sign" className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <h2 id="door-sign" className="eyebrow">
        Door sign
      </h2>
      <p className="mt-1.5 text-[15px] font-semibold text-slate-900">
        {p.name}, {p.age} ({p.pronouns})
      </p>
      <p className="text-sm text-slate-600">{p.setting}</p>
      <p className="mt-3 text-sm leading-relaxed text-slate-700">
        <span className="font-semibold text-slate-900">Presenting with:</span> {p.chiefComplaint}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">
        <span className="font-semibold text-slate-900">Your task:</span> {kase.doorSign.task}
      </p>
    </section>
  );
}
