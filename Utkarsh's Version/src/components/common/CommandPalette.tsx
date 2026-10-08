"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ClipboardList, Home, Moon, Search, Stethoscope, Users } from "lucide-react";
import { Dialog } from "@/components/ui/Overlay";

export const OPEN_PALETTE = "osce:palette";
export const TOGGLE_THEME = "osce:toggle-theme";

type Item = { id: string; group: string; label: string; hint?: string; icon: React.ComponentType<{ className?: string }>; run: () => void | Promise<void> };

/** ⌘K / Ctrl K: jump anywhere or start a practice station from the keyboard. */
export function CommandPalette({ stations }: { stations: { id: string; title: string; mode: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setError(null);
    }
  }, [open]);

  const start = async (caseId: string) => {
    setBusy(caseId);
    setError(null);
    try {
      const res = await fetch("/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caseId, studentLabel: "", mode: "practice", findingsDisplay: "show" }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not start the session");
      setOpen(false);
      router.push(`/station/${body.sessionId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const items: Item[] = useMemo(
    () => [
      { id: "nav-home", group: "Go to", label: "Station library", icon: Home, run: () => (setOpen(false), router.push("/")) },
      { id: "nav-coach", group: "Go to", label: "Coach view", hint: "needs the coach code", icon: Users, run: () => (setOpen(false), router.push("/coach")) },
      ...stations.map((s) => ({
        id: `start-${s.id}`,
        group: "Start a practice station",
        label: s.title,
        hint: s.mode === "screening" ? "Screening exam" : "Case encounter",
        icon: s.mode === "screening" ? ClipboardList : Stethoscope,
        run: () => start(s.id),
      })),
      { id: "theme", group: "Preferences", label: "Toggle dark mode", icon: Moon, run: () => (window.dispatchEvent(new Event(TOGGLE_THEME)), setOpen(false)) },
    ],
    [stations], // eslint-disable-line react-hooks/exhaustive-deps -- start/router are stable for the palette's lifetime
  );
  const shown = items.filter((i) => `${i.label} ${i.hint ?? ""} ${i.group}`.toLowerCase().includes(q.trim().toLowerCase()));
  const groups = [...new Set(shown.map((i) => i.group))];

  if (!open) return null;
  return (
    <Dialog
      id="command-palette"
      kind="modal"
      title="Search stations and pages"
      hideTitle
      onClose={() => setOpen(false)}
      initialFocus={input}
      backdropClassName="items-start justify-center pt-[14vh]"
      className="relative w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-pop"
    >
        <div className="flex items-center gap-2 border-b border-slate-200 pr-10 pl-4">
          <Search aria-hidden className="size-4 text-slate-400" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, shown.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && shown[active]) {
                e.preventDefault();
                void shown[active]!.run();
              }
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={shown[active] ? `palette-${shown[active]!.id}` : undefined}
            placeholder="Search stations and pages…"
            className="h-12 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 focus-visible:outline-none"
          />
        </div>
        <ul id="palette-list" role="listbox" aria-label="Commands" className="max-h-80 overflow-y-auto p-1.5">
          {shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">No matches.</li>}
          {groups.map((g) => (
            <li key={g} role="presentation">
              <p className="px-2.5 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">{g}</p>
              <ul role="presentation">
                {shown
                  .filter((i) => i.group === g)
                  .map((i) => {
                    const idx = shown.indexOf(i);
                    return (
                      <li
                        key={i.id}
                        id={`palette-${i.id}`}
                        role="option"
                        aria-selected={idx === active}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => void i.run()}
                        className={`flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm ${idx === active ? "bg-cyan-50 text-cyan-900" : "text-slate-700"}`}
                      >
                        <i.icon className={`size-4 shrink-0 ${idx === active ? "text-cyan-700" : "text-slate-400"}`} />
                        <span className="min-w-0 flex-1 truncate">{i.label}</span>
                        {busy === i.id.replace("start-", "") ? <span className="text-xs text-slate-500">Starting…</span> : i.hint && <span className="shrink-0 text-xs text-slate-400">{i.hint}</span>}
                        {idx === active && <ArrowRight aria-hidden className="size-3.5 shrink-0 text-cyan-700" />}
                      </li>
                    );
                  })}
              </ul>
            </li>
          ))}
        </ul>
        {error && (
          <p role="alert" className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800">
            {error}
          </p>
        )}
        <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
          <span>
            <kbd className="font-mono">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="font-mono">↵</kbd> open
          </span>
          <span>
            <kbd className="font-mono">Esc</kbd> close
          </span>
          <span className="ml-auto">Practice, findings shown</span>
        </div>
    </Dialog>
  );
}
