"use client";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/Overlay";
import type { CourtesyKind, DrapeZone, Position } from "@/domain/schemas";
import { POSITION_ANGLE, type PatientState } from "@/engine/patientState";
import { POSITION_LABELS } from "@/components/common/format";
import { HoldRing } from "./HoldRing";

/** Bed-angle slider stops (positions the bed itself can produce). */
export const BED_STOPS: Position[] = ["supine", "reclined_30", "reclined_45", "seated"];
/** Positions that need the patient to move: reachable by asking, or from the Actions menu. */
const OTHER_POSITIONS: Position[] = ["left_lateral_decubitus", "seated_leaning_forward", "standing", "prone"];
const ZONES: { zone: DrapeZone; label: string }[] = [
  { zone: "chest", label: "Chest" },
  { zone: "abdomen", label: "Abdomen" },
  { zone: "legs", label: "Legs" },
];

export interface Hold {
  progress: number;
  start: () => void;
  cancel: () => void;
}

export function EncounterBar({
  state,
  disabled,
  sanitise,
  onBed,
  onDrape,
  onMenu,
  onLeave,
}: {
  state: PatientState;
  disabled: boolean;
  sanitise: Hold;
  /** direct manipulation of the bed */
  onBed: (p: Position) => void;
  onDrape: (zone: DrapeZone, covered: boolean) => void;
  /** keyboard-accessible fallback actions */
  onMenu: (kind: CourtesyKind, position?: Position) => void;
  onLeave: () => void;
}) {
  // off-scale positions (e.g. left lateral) show the stop nearest the current bed angle
  const stop = BED_STOPS.includes(state.position)
    ? BED_STOPS.indexOf(state.position)
    : BED_STOPS.reduce((best, p, i) => (Math.abs(POSITION_ANGLE[p] - state.bedAngle) < Math.abs(POSITION_ANGLE[BED_STOPS[best]!] - state.bedAngle) ? i : best), 0);
  const [bed, setBed] = useState(stop);
  useEffect(() => {
    setBed(stop);
  }, [stop, state.position]);
  const commit = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveBed = (i: number) => {
    setBed(i);
    if (commit.current) clearTimeout(commit.current);
    commit.current = setTimeout(() => BED_STOPS[i] !== state.position && onBed(BED_STOPS[i]!), 350);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" role="group" aria-label="Encounter">
      <button
        type="button"
        disabled={disabled}
        onPointerDown={(e) => (e.preventDefault(), sanitise.start())}
        onPointerUp={sanitise.cancel}
        onPointerLeave={sanitise.cancel}
        onKeyDown={(e) => (e.key === " " || e.key === "Enter") && !e.repeat && (e.preventDefault(), sanitise.start())}
        onKeyUp={(e) => (e.key === " " || e.key === "Enter") && sanitise.cancel()}
        className="flex items-center gap-2 rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-sky-900 select-none hover:bg-sky-100 disabled:opacity-50"
        aria-describedby="hands-status"
      >
        <HoldRing progress={sanitise.progress} />
        Hold to sanitise hands
      </button>
      <span id="hands-status" data-testid="hands-status" className={`rounded px-1.5 py-0.5 text-xs ${state.handsClean ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
        Hands: {state.handsClean ? "clean" : "not cleaned"}
      </span>

      <label className="flex items-center gap-2">
        <span className="text-slate-600">Bed</span>
        <input
          type="range"
          min={0}
          max={BED_STOPS.length - 1}
          step={1}
          value={bed}
          disabled={disabled}
          onChange={(e) => moveBed(Number(e.target.value))}
          aria-label="Bed angle"
          aria-valuetext={POSITION_LABELS[BED_STOPS[bed]!]}
          className="w-28 accent-cyan-700"
        />
        <span className="w-36 text-xs text-slate-700" data-testid="position-label">
          {POSITION_LABELS[state.position]}
        </span>
      </label>

      <div className="flex items-center gap-1" role="group" aria-label="Drape">
        <span className="text-slate-600">Drape</span>
        {ZONES.map(({ zone, label }) => (
          <button
            key={zone}
            type="button"
            disabled={disabled}
            aria-pressed={state.drape[zone]}
            onClick={() => onDrape(zone, !state.drape[zone])}
            className={`rounded border px-2 py-0.5 text-xs ${state.drape[zone] ? "border-sky-400 bg-sky-100 text-sky-900" : "border-slate-300 bg-white text-slate-600"}`}
            title={state.drape[zone] ? `${label} covered — click to uncover` : `${label} uncovered — click to cover`}
          >
            {label}: {state.drape[zone] ? "covered" : "uncovered"}
          </button>
        ))}
      </div>

      <ActionsMenu disabled={disabled} onMenu={onMenu} />
      <button type="button" disabled={disabled} onClick={onLeave} className="ml-auto rounded-md border border-slate-400 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50">
        Leave the room
      </button>
    </div>
  );
}

/** Compact, keyboard-accessible fallback for the direct-manipulation controls. */
function ActionsMenu({ disabled, onMenu }: { disabled: boolean; onMenu: (kind: CourtesyKind, position?: Position) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const items: { label: string; run: () => void }[] = [
    { label: "Clean hands (no hold)", run: () => onMenu("hand_hygiene") },
    { label: "Re-drape the patient", run: () => onMenu("drape") },
    ...[...BED_STOPS, ...OTHER_POSITIONS].map((p) => ({ label: `Position: ${POSITION_LABELS[p]}`, run: () => onMenu("position", p) })),
  ];
  const onKey = (e: React.KeyboardEvent) => {
    const els = [...(ref.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      els[(i + (e.key === "ArrowDown" ? 1 : -1) + els.length) % els.length]?.focus();
    }
  };
  return (
    <div className="relative" ref={ref} onKeyDown={onKey}>
      <button ref={opener} type="button" disabled={disabled} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-50">
        Actions ▾
      </button>
      {open && (
        <Dialog id="actions-menu" kind="menu" title="Actions" hideTitle onClose={() => setOpen(false)} ignoreOutside={opener} className="absolute left-0 z-30 mt-1 w-60 rounded-md border border-slate-200 bg-white py-1 pt-7 shadow-lg">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.run();
              }}
              className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-100 focus:bg-slate-100 focus:outline-none"
            >
              {it.label}
            </button>
          ))}
        </Dialog>
      )}
    </div>
  );
}
