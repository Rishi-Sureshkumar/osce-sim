"use client";
import { useRef, useState } from "react";
import { Dialog } from "@/components/ui/Overlay";
import type { Tool, ToolMode } from "@/domain/schemas";
import type { TableItem } from "@/scene/room/ToolTable";

export const TOOL_LABELS: Record<Tool, string> = {
  stethoscope: "Stethoscope",
  tuning_fork: "Tuning fork",
  reflex_hammer: "Reflex hammer",
  penlight: "Penlight",
  bp_cuff: "BP cuff",
  hands: "Hands",
  cotton_swab: "Cotton swab",
  pin: "Neurotip (pin)",
};

export const TOOL_HELP: Record<Tool, string> = {
  stethoscope: "Move over the body, then press and hold to listen. Hold still for 3 s.",
  tuning_fork: "Strike the fork, then place it on the body.",
  reflex_hammer: "Click a tendon to tap it.",
  penlight: "Shine the light onto a pupil. Drag it from eye to eye and back for the swinging-light test.",
  bp_cuff: "Click an upper arm to place the cuff.",
  hands: "Click a region to palpate or percuss.",
  cotton_swab: "Touch the skin lightly to test light-touch sensation.",
  pin: "Touch the skin with the sharp end to test pinprick sensation.",
};

export interface ToolState {
  tool: Tool | null;
  stethMode: Extract<ToolMode, "diaphragm" | "bell">;
  forkFreq: Extract<ToolMode, "128" | "512">;
  /** performance.now() when the fork was last struck */
  struckAt: number | null;
}

export function toolModeOf(s: ToolState): ToolMode | undefined {
  if (s.tool === "stethoscope") return s.stethMode;
  if (s.tool === "tuning_fork") return s.forkFreq;
  return undefined;
}

/** Picking an instrument from the tool table (or the Tools… menu) → tool state. */
export function pickFromTable(state: ToolState, item: TableItem): ToolState {
  switch (item) {
    case "stethoscope":
      return { ...state, tool: "stethoscope" };
    case "fork_128":
      return { ...state, tool: "tuning_fork", forkFreq: "128", struckAt: null };
    case "fork_512":
      return { ...state, tool: "tuning_fork", forkFreq: "512", struckAt: null };
    case "reflex_hammer":
      return { ...state, tool: "reflex_hammer" };
    case "penlight":
      return { ...state, tool: "penlight" };
    case "bp_cuff":
      return { ...state, tool: "bp_cuff" };
    case "swabs":
      return { ...state, tool: "cotton_swab" };
    case "pin":
      return { ...state, tool: "pin" };
    default:
      return state; // the otoscope is shown for realism; its exams are menu-driven
  }
}

/** Which table item is in hand (hidden from the table while held). */
export function itemInHand(s: ToolState): TableItem | null {
  if (s.tool === "stethoscope") return "stethoscope";
  if (s.tool === "tuning_fork") return s.forkFreq === "128" ? "fork_128" : "fork_512";
  if (s.tool === "reflex_hammer") return "reflex_hammer";
  if (s.tool === "penlight") return "penlight";
  if (s.tool === "bp_cuff") return "bp_cuff";
  if (s.tool === "cotton_swab") return "swabs";
  if (s.tool === "pin") return "pin";
  return null;
}

const MENU: { label: string; tool: Tool | null; item?: TableItem }[] = [
  { label: "Nothing (point and click)", tool: null },
  { label: "Stethoscope", tool: "stethoscope", item: "stethoscope" },
  { label: "Tuning fork 512 Hz", tool: "tuning_fork", item: "fork_512" },
  { label: "Tuning fork 128 Hz", tool: "tuning_fork", item: "fork_128" },
  { label: "Reflex hammer", tool: "reflex_hammer", item: "reflex_hammer" },
  { label: "Penlight", tool: "penlight", item: "penlight" },
  { label: "BP cuff", tool: "bp_cuff", item: "bp_cuff" },
  { label: "Cotton swab (light touch)", tool: "cotton_swab", item: "swabs" },
  { label: "Neurotip (pinprick)", tool: "pin", item: "pin" },
  { label: "Hands (palpate / percuss)", tool: "hands" },
];

/**
 * What's in hand and its controls (bell/diaphragm, strike the fork, put it down), plus a
 * keyboard-operable "Tools…" menu as the non-visual route to the tool table.
 */
export function ToolHud({
  state,
  onChange,
  disabled,
  onOpenTable,
  listeningFor,
}: {
  state: ToolState;
  onChange: (s: ToolState) => void;
  disabled?: boolean;
  onOpenTable?: () => void;
  /** the exam a stethoscope hold records when several fit the same spot (the student's last pick) */
  listeningFor?: { label: string; onChange: () => void } | null;
}) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs" role="toolbar" aria-label="Exam tools" data-testid="tool-hud">
      <span className="rounded bg-subtle px-2 py-1 text-ink-2" data-testid="tool-in-hand">
        In hand: <b>{state.tool ? TOOL_LABELS[state.tool] + (state.tool === "tuning_fork" ? ` ${state.forkFreq} Hz` : "") : "nothing"}</b>
      </span>
      {state.tool === "stethoscope" && (
        <span role="radiogroup" aria-label="Stethoscope head" className="flex overflow-hidden rounded-md border border-line-strong">
          {(["diaphragm", "bell"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={state.stethMode === m} onClick={() => onChange({ ...state, stethMode: m })} className={`px-2 py-1 ${state.stethMode === m ? "bg-ink text-white" : "bg-white"}`}>
              {m === "diaphragm" ? "Diaphragm" : "Bell"}
            </button>
          ))}
        </span>
      )}
      {state.tool === "stethoscope" && listeningFor && (
        <span className="flex items-center gap-1 rounded bg-brand-soft px-2 py-1 text-cyan-900" data-testid="listening-for">
          Listening for: <b>{listeningFor.label}</b>
          <button type="button" onClick={listeningFor.onChange} className="ml-1 underline">
            Change exam
          </button>
        </span>
      )}
      {state.tool === "tuning_fork" && (
        <button type="button" disabled={disabled} onClick={() => onChange({ ...state, struckAt: performance.now() })} className="rounded-md border border-amber-500 bg-amber-500 px-2.5 py-1 text-white">
          Strike fork
        </button>
      )}
      {state.tool && (
        <button type="button" onClick={() => onChange({ ...state, tool: null, struckAt: null })} className="rounded-md border border-line-strong bg-white px-2.5 py-1">
          Put down
        </button>
      )}
      {onOpenTable && (
        <button type="button" disabled={disabled} onClick={onOpenTable} className="rounded-md border border-line-strong bg-white px-2.5 py-1">
          Go to tool table
        </button>
      )}
      <div className="relative">
        <button ref={opener} type="button" disabled={disabled} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="rounded-md border border-line-strong bg-white px-2.5 py-1">
          Tools…
        </button>
        {open && (
          <Dialog id="tools-menu" kind="menu" title="Tools" hideTitle onClose={() => setOpen(false)} ignoreOutside={opener} className="absolute bottom-full left-0 z-30 mb-1 w-56 rounded-md border border-line bg-surface py-1 pt-7 shadow-lg">
            {MENU.map((m) => (
              <button
                key={m.label}
                type="button"
                role="menuitem"
                data-tool={m.item === "fork_128" ? "tuning_fork_128" : (m.tool ?? "pointer")}
                onClick={() => {
                  setOpen(false);
                  onChange(m.item ? pickFromTable(state, m.item) : { ...state, tool: m.tool, struckAt: null });
                }}
                className="block w-full px-3 py-1.5 text-left hover:bg-subtle focus:bg-subtle focus:outline-none"
              >
                {m.label}
              </button>
            ))}
          </Dialog>
        )}
      </div>
      {state.tool && <span className="text-ink-3">{TOOL_HELP[state.tool]}</span>}
    </div>
  );
}
