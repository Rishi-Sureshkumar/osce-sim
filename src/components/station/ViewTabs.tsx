"use client";
import type { View } from "@/domain/schemas";

export const VIEW_TABS: { view: View; label: string }[] = [
  { view: "anterior", label: "Front" },
  { view: "posterior", label: "Back" },
  { view: "head_neck", label: "Head & neck" },
  { view: "precordium", label: "Precordium" },
  { view: "neuro", label: "Neuro" },
];

export function ViewTabs({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div role="tablist" aria-label="Diagram view" className="flex flex-wrap gap-1">
      {VIEW_TABS.map((t) => (
        <button
          key={t.view}
          role="tab"
          aria-selected={view === t.view}
          onClick={() => onChange(t.view)}
          className={`rounded-md px-3 py-1.5 text-sm ${view === t.view ? "bg-cyan-700 text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
