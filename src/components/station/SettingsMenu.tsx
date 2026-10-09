"use client";
/**
 * Station settings (Phase 4 M6): one popover in the top bar instead of a row of loose controls —
 * exam sound, graphics quality, and the session's fixed choices (findings shown or hidden, mistake
 * alerts), which are set when the case is picked and can't change mid-session.
 */
import { useRef, useState } from "react";
import { Dialog } from "@/components/ui/Overlay";
import { AudioControls } from "./AudioControls";

export function SettingsMenu({
  quality,
  onQuality,
  hideFindings,
  alerts,
}: {
  quality: "high" | "low";
  onQuality: (q: "high" | "low") => void;
  hideFindings: boolean;
  alerts: boolean;
}) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  return (
    <div className="relative">
      <button
        ref={opener}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-sm text-ink-2 hover:bg-subtle"
      >
        <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 fill-current">
          <path d="M11.3 1.5l.4 2.1c.5.2 1 .5 1.4.8l2-.8 1.3 2.3-1.6 1.4c.1.5.1 1.1 0 1.6l1.6 1.4-1.3 2.3-2-.8c-.4.3-.9.6-1.4.8l-.4 2.1H8.7l-.4-2.1c-.5-.2-1-.5-1.4-.8l-2 .8-1.3-2.3 1.6-1.4a4.6 4.6 0 010-1.6L3.6 5.9l1.3-2.3 2 .8c.4-.3.9-.6 1.4-.8l.4-2.1h2.6zM10 7a3 3 0 100 6 3 3 0 000-6z" />
        </svg>
        Settings
      </button>
      {open && (
        <Dialog id="settings" kind="popover" title="Settings" onClose={() => setOpen(false)} ignoreOutside={opener} className="absolute right-0 z-40 mt-1 w-72 space-y-3 rounded-lg border border-line bg-surface p-3 shadow-lg">
          <div className="space-y-1">
            <p className="text-xs font-medium text-ink-3">Exam sound</p>
            <AudioControls />
          </div>
          <label className="flex items-center justify-between gap-2 text-sm text-ink-2">
            Graphics
            <select aria-label="Graphics quality" value={quality} onChange={(e) => onQuality(e.target.value as "high" | "low")} className="rounded-md border border-line bg-surface px-2 py-1 text-sm">
              <option value="high">High</option>
              <option value="low">Low (faster)</option>
            </select>
          </label>
          <dl className="space-y-1 border-t border-line pt-2 text-xs text-ink-3">
            <div className="flex justify-between gap-2">
              <dt>Findings</dt>
              <dd className="text-ink-2">{hideFindings ? "Hidden — interpret what you see and hear" : "Shown"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Mistake alerts</dt>
              <dd className="text-ink-2">{alerts ? "On" : "Off (reviewed in results)"}</dd>
            </div>
            <p className="pt-1 text-[11px]">Findings and alerts are chosen when you start a case.</p>
          </dl>
        </Dialog>
      )}
    </div>
  );
}
