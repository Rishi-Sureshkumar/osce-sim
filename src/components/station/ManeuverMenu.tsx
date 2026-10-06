"use client";
import type { Region } from "@/domain/schemas";
import type { PublicCatalog } from "@/content/types";

type M = PublicCatalog["maneuvers"][number];
const TECHNIQUE_ORDER = ["inspect", "palpate", "percuss", "auscultate", "special"] as const;
const TECHNIQUE_LABEL: Record<string, string> = {
  inspect: "Inspect",
  palpate: "Palpate",
  percuss: "Percuss",
  auscultate: "Auscultate",
  special: "Special tests",
};

export function ManeuverMenu({
  region,
  maneuvers,
  busy,
  onChoose,
  onClose,
}: {
  region: Region;
  maneuvers: M[];
  busy: boolean;
  onChoose: (m: M) => void;
  onClose: () => void;
}) {
  const available = maneuvers.filter((m) => m.allowedRegions.includes(region.id));
  return (
    <section aria-label={`Examinations for ${region.label}`} className="rounded-lg border border-cyan-200 bg-white p-3 shadow-md">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="font-semibold">{region.label}</h3>
        <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800" aria-label="Close menu">
          ✕
        </button>
      </div>
      {available.length === 0 && <p className="text-sm text-slate-500">No examinations are defined for this region yet.</p>}
      {TECHNIQUE_ORDER.map((t) => {
        const list = available.filter((m) => m.technique === t);
        if (!list.length) return null;
        return (
          <div key={t} className="mb-2">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{TECHNIQUE_LABEL[t]}</p>
            <ul className="mt-1 space-y-1">
              {list.map((m) => (
                <li key={m.id}>
                  <button
                    disabled={busy}
                    onClick={() => onChoose(m)}
                    data-maneuver={m.id}
                    className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-cyan-50 disabled:opacity-50"
                  >
                    {m.label}
                    {m.fcmId && <span className="ml-2 rounded bg-slate-100 px-1.5 text-xs text-slate-500">#{m.fcmId}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
