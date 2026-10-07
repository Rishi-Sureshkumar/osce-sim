"use client";
import { useEffect, useState } from "react";

/** Scratch paper, as in the real exam: kept in this browser for this session only, never graded. */
export function Notepad({ sessionId }: { sessionId: string }) {
  const key = `osce:notepad:${sessionId}`;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  useEffect(() => {
    try {
      setText(localStorage.getItem(key) ?? "");
    } catch {
      /* storage unavailable: the pad still works for this page */
    }
  }, [key]);
  const change = (v: string) => {
    setText(v);
    try {
      localStorage.setItem(key, v);
    } catch {
      /* ignore */
    }
  };
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/60" aria-label="Notepad">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between px-3 py-1.5 text-sm font-medium text-amber-900">
        Notepad <span className="text-xs font-normal text-amber-800">{open ? "Hide" : "Show"} · not graded</span>
      </button>
      {open && (
        <textarea
          value={text}
          onChange={(e) => change(e.target.value)}
          rows={6}
          aria-label="Notepad text"
          placeholder="Scratch notes (stay in this browser; not graded)"
          className="block w-full resize-y border-t border-amber-200 bg-transparent p-2 font-mono text-xs outline-none"
        />
      )}
    </section>
  );
}
