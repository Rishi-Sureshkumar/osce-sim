"use client";
import { useEffect, useRef, useState } from "react";
import type { Region, RegionGroup } from "@/domain/schemas";
import { Dialog } from "@/components/ui/Overlay";
import { useScrollCue } from "@/components/ui/useScrollCue";

export const GROUP_LABELS: Record<RegionGroup, string> = {
  head_neck: "Head & neck",
  chest_front: "Chest & heart (front)",
  chest_back: "Back",
  abdomen: "Abdomen",
  arms: "Arms",
  hands: "Hands & wrists",
  legs: "Legs",
  feet: "Feet",
  whole: "Whole patient",
  neuro: "Neurological",
};
const ORDER = Object.keys(GROUP_LABELS) as RegionGroup[];

/**
 * Non-visual route to every exam: a keyboard-operable command menu (region → maneuver).
 * Picking a region opens the same maneuver menu a click on the body does, so it emits the same
 * Actions. It draws no diagram. Open with the button or the "E" key.
 */
export function ExamineMenu({ regions, onPick, disabled }: { regions: Region[]; onPick: (r: Region) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  useScrollCue(list, [open, filter]);
  const usable = regions.filter((r) => !r.hidden);
  const q = filter.trim().toLowerCase();
  const shown = q ? usable.filter((r) => r.label.toLowerCase().includes(q)) : usable;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if ((e.key === "e" || e.key === "E") && !e.metaKey && !e.ctrlKey && !e.altKey && !disabled) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled]);
  const close = () => {
    setOpen(false);
    setFilter("");
  };

  return (
    <>
      <button type="button" disabled={disabled} onClick={() => setOpen(true)} className="rounded-md border border-line-strong bg-white px-2.5 py-1 text-sm hover:bg-subtle disabled:opacity-50" aria-haspopup="dialog">
        Examine… <kbd className="ml-1 rounded border border-line-strong px-1 text-[10px] text-ink-3">E</kbd>
      </button>
      {open && (
        <Dialog id="examine-menu" kind="modal" title="Examine" onClose={close} initialFocus={input} backdropClassName="items-start justify-center pt-[10vh]" className="flex max-h-[75vh] w-full max-w-2xl flex-col rounded-lg bg-white p-3 shadow-xl">
            <div className="border-b border-line pb-2">
              <label className="block">
                <span className="sr-only">Find a region</span>
                <input ref={input} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a region (e.g. apex, knee)…" className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm" />
              </label>
            </div>
            <div ref={list} className="scroll-cue grid gap-3 overflow-y-auto p-3 sm:grid-cols-2" data-testid="examine-menu">
              {ORDER.map((g) => {
                const list = shown.filter((r) => r.group === g);
                if (!list.length) return null;
                return (
                  <div key={g}>
                    <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">{GROUP_LABELS[g]}</p>
                    <ul>
                      {list.map((r) => (
                        <li key={r.id}>
                          <button
                            type="button"
                            data-region={r.id}
                            onClick={() => {
                              close();
                              onPick(r);
                            }}
                            className="w-full rounded px-1.5 py-0.5 text-left text-sm hover:bg-brand-soft focus:bg-brand-soft focus:outline-none"
                          >
                            {r.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
        </Dialog>
      )}
    </>
  );
}
