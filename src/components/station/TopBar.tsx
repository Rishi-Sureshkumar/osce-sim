"use client";
/**
 * The station's top bar (Phase 4 M6): case and mode on the left, the clock in the middle, settings,
 * leaving the room and finishing on the right — one row at every supported width (V-WRAP).
 */
import type { ReactNode } from "react";

export function TopBar({
  title,
  subtitle,
  mode,
  hideFindings,
  clock,
  settings,
  onLeave,
  leaveDisabled,
  end,
}: {
  title: string;
  subtitle: string;
  mode: "practice" | "exam";
  hideFindings: boolean;
  clock: ReactNode;
  settings: ReactNode;
  /** present while the student is in the room */
  onLeave?: () => void;
  leaveDisabled?: boolean;
  /** finish / view results */
  end?: ReactNode;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 shadow-1">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base leading-tight font-semibold text-ink" title={title}>
          {title}
        </h1>
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-ink-3">
          <span className="truncate">{subtitle}</span>
          <span className={`shrink-0 rounded-md px-1.5 py-px font-semibold ${mode === "practice" ? "bg-ok-soft text-ok" : "bg-ink text-white"}`} data-testid="mode-badge">
            {mode === "practice" ? "Practice" : "Exam"}
          </span>
          {hideFindings && (
            <span className="shrink-0 rounded-md bg-warn-soft px-1.5 py-px font-medium text-warn" title="Findings are hidden: interpret what you see and hear">
              Findings hidden
            </span>
          )}
        </p>
      </div>
      <div className="shrink-0">{clock}</div>
      <div className="flex flex-1 items-center justify-end gap-2">
        {settings}
        {onLeave && (
          <button type="button" disabled={leaveDisabled} onClick={onLeave} className="h-8 rounded-md border border-line-strong bg-surface px-3 text-sm text-ink-2 hover:bg-subtle disabled:opacity-50">
            Leave the room
          </button>
        )}
        {end}
      </div>
    </header>
  );
}
