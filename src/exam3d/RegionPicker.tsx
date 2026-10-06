"use client";
import type { Region } from "@/domain/schemas";

const GROUPS: { label: string; test: (r: Region) => boolean }[] = [
  { label: "Head & neck", test: (r) => r.view === "head_neck" },
  { label: "Chest & heart", test: (r) => r.view === "precordium" || r.id.startsWith("lung_ant") || r.id.startsWith("lung_lat") },
  { label: "Back", test: (r) => r.view === "posterior" && !r.id.startsWith("calf") },
  { label: "Abdomen", test: (r) => r.id.startsWith("abd_") },
  { label: "Arms & hands", test: (r) => /^(shoulder|arm|elbow|wrist|hand)_/.test(r.id) },
  { label: "Legs & feet", test: (r) => /^(groin|hip|knee|shin|calf|ankle|foot|toe)_/.test(r.id) },
  { label: "Whole patient & neuro", test: (r) => r.view === "whole" || r.view === "neuro" },
];

/** Keyboard/screen-reader route to every region (also used by automated tests). */
export function RegionPicker({ regions, onPick, disabled }: { regions: Region[]; onPick: (r: Region) => void; disabled?: boolean }) {
  const usable = regions.filter((r) => !r.zoomTo);
  return (
    <details className="rounded-md border border-slate-200 bg-white text-sm">
      <summary className="cursor-pointer px-3 py-1.5 text-slate-700">Choose a region from a list</summary>
      <div className="grid max-h-64 gap-2 overflow-y-auto p-2 sm:grid-cols-2">
        {GROUPS.map((g) => {
          const list = usable.filter(g.test);
          if (!list.length) return null;
          return (
            <div key={g.label}>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{g.label}</p>
              <ul>
                {list.map((r) => (
                  <li key={r.id}>
                    <button type="button" disabled={disabled} data-region={r.id} onClick={() => onPick(r)} className="w-full rounded px-1.5 py-0.5 text-left hover:bg-cyan-50 disabled:opacity-50">
                      {r.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </details>
  );
}
