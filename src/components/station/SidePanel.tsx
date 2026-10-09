"use client";
import { useEffect, useState, type ReactNode } from "react";

/** Remembered per browser (a convenience only): whether each side panel of the station is open. */
export function usePanelOpen(key: "left" | "right"): [boolean, (open: boolean) => void] {
  const storageKey = `osce.panel.${key}`;
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) === "closed") setOpen(false);
    } catch {
      /* storage unavailable: stays open */
    }
  }, [storageKey]);
  const set = (o: boolean) => {
    setOpen(o);
    try {
      localStorage.setItem(storageKey, o ? "open" : "closed");
    } catch {
      /* ignore */
    }
  };
  return [open, set];
}

/**
 * A station side column that folds to a thin rail so the 3D view gets the room (Phase 4 M6). The
 * children stay mounted when folded (the conversation keeps streaming), just hidden.
 */
export function SidePanel({ side, label, open, onToggle, children }: { side: "left" | "right"; label: string; open: boolean; onToggle: (open: boolean) => void; children: ReactNode }) {
  return (
    <div className="relative flex min-h-0 flex-col" data-panel={side}>
      <button
        type="button"
        onClick={() => onToggle(!open)}
        aria-expanded={open}
        aria-label={open ? `Hide ${label}` : `Show ${label}`}
        title={open ? `Hide ${label}` : `Show ${label}`}
        className={
          open
            ? // a small handle on the column's inner edge, in the gap beside the 3D view (clear of the panels' own headers)
              `absolute top-1/2 z-20 hidden h-8 w-4 -translate-y-1/2 items-center justify-center rounded-md border border-line bg-surface text-ink-3 shadow-1 hover:bg-subtle lg:flex ${side === "left" ? "-right-[0.875rem]" : "-left-[0.875rem]"}`
            : "hidden h-full w-full flex-col items-center gap-2 rounded-lg border border-line bg-surface py-3 text-xs text-ink-3 shadow-1 hover:bg-subtle lg:flex"
        }
      >
        <span aria-hidden>{(side === "left") === open ? "‹" : "›"}</span>
        {!open && <span className="[writing-mode:vertical-rl]">{label}</span>}
      </button>
      <div className={`flex min-h-0 flex-1 flex-col gap-2 ${open ? "" : "lg:hidden"}`}>{children}</div>
    </div>
  );
}
