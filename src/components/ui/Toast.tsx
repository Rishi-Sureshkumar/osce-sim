"use client";
import { useEffect, useRef } from "react";

export const TOAST_MS = 6000;

/** A short status message with a ✕; dismisses itself after 6 s. Not a dialog (it never takes focus). */
export function Toast({ message, onDismiss, className, tone = "info" }: { message: string; onDismiss: () => void; className?: string; tone?: "info" | "warn" }) {
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  });
  useEffect(() => {
    const id = setTimeout(() => dismiss.current(), TOAST_MS);
    return () => clearTimeout(id);
  }, [message]);
  const colours = tone === "warn" ? "bg-amber-50 text-amber-900" : "bg-white/95 text-slate-800";
  return (
    <div role="status" data-testid="toast" className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm shadow ${colours} ${className ?? ""}`}>
      <span className="flex-1">{message}</span>
      <button type="button" onClick={() => dismiss.current()} aria-label="Dismiss" className="shrink-0 rounded px-1 leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-800">
        ✕
      </button>
    </div>
  );
}
