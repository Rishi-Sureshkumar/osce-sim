"use client";
import type { CourtesyKind, Position } from "@/domain/schemas";
import { Position as PositionEnum } from "@/domain/schemas";
import { POSITION_LABELS } from "@/components/common/format";

const BUTTONS: { kind: Exclude<CourtesyKind, "position">; label: string }[] = [
  { kind: "hand_hygiene", label: "Wash hands" },
  { kind: "introduce", label: "Introduce self" },
  { kind: "consent", label: "Obtain consent" },
  { kind: "drape", label: "Drape" },
  { kind: "close_encounter", label: "Close encounter" },
];

export function CourtesyToolbar({
  currentPosition,
  disabled,
  onCourtesy,
}: {
  currentPosition?: Position;
  disabled?: boolean;
  onCourtesy: (kind: CourtesyKind, position?: Position) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Clinical courtesy">
      {BUTTONS.map((b) => (
        <button
          key={b.kind}
          type="button"
          disabled={disabled}
          onClick={() => onCourtesy(b.kind)}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          {b.label}
        </button>
      ))}
      <label className="ml-2 flex items-center gap-2 text-sm">
        <span className="text-slate-600">Patient position:</span>
        <select
          aria-label="Patient position"
          disabled={disabled}
          value={currentPosition ?? ""}
          onChange={(e) => e.target.value && onCourtesy("position", e.target.value as Position)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5"
        >
          <option value="" disabled>
            Choose…
          </option>
          {PositionEnum.options.map((p) => (
            <option key={p} value={p}>
              {POSITION_LABELS[p]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
