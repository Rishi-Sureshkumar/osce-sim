import type { PublicCase } from "@/domain/schemas";

export function DoorSign({ kase }: { kase: PublicCase }) {
  const p = kase.patient;
  return (
    <section aria-labelledby="door-sign" className="rounded-lg border border-line bg-surface p-3 shadow-1">
      <h2 id="door-sign" className="text-xs font-semibold tracking-wide text-ink-3 uppercase">
        Door sign
      </h2>
      <p className="mt-1 font-semibold">
        {p.name}, {p.age} ({p.pronouns})
      </p>
      <p className="text-sm text-ink-3">{p.setting}</p>
      <p className="mt-2 text-sm">
        <span className="font-medium">Presenting with:</span> {p.chiefComplaint}
      </p>
      <p className="mt-2 text-sm">
        <span className="font-medium">Your task:</span> {kase.doorSign.task}
      </p>
    </section>
  );
}
