"use client";
import type { Tool, ToolMode } from "@/domain/schemas";

export const TOOL_LABELS: Record<Tool, string> = {
  stethoscope: "Stethoscope",
  tuning_fork: "Tuning fork",
  reflex_hammer: "Reflex hammer",
  penlight: "Penlight",
  bp_cuff: "BP cuff",
  hands: "Hands",
};

export const TOOL_HELP: Record<Tool, string> = {
  stethoscope: "Press and hold on the body to listen. Hold still for 3 s. Drag to slide it.",
  tuning_fork: "Strike the fork, then place it on the body.",
  reflex_hammer: "Click a tendon to tap it.",
  penlight: "Click an eye to shine the light.",
  bp_cuff: "Click an upper arm to place the cuff.",
  hands: "Click a region to palpate or percuss.",
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

/** Tool tray. "Pointer" (no tool) opens the full maneuver menu on click. */
export function ToolTray({ state, onChange, disabled }: { state: ToolState; onChange: (s: ToolState) => void; disabled?: boolean }) {
  const btn = (active: boolean) =>
    `rounded-md border px-2.5 py-1 text-xs ${active ? "border-cyan-700 bg-cyan-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`;
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Exam tools">
      <button type="button" aria-pressed={state.tool === null} disabled={disabled} className={btn(state.tool === null)} onClick={() => onChange({ ...state, tool: null })}>
        Pointer (menu)
      </button>
      {(Object.keys(TOOL_LABELS) as Tool[]).map((t) => (
        <button key={t} type="button" aria-pressed={state.tool === t} disabled={disabled} data-tool={t} className={btn(state.tool === t)} onClick={() => onChange({ ...state, tool: t })}>
          {TOOL_LABELS[t]}
        </button>
      ))}
      {state.tool === "stethoscope" && (
        <span role="radiogroup" aria-label="Stethoscope head" className="ml-1 flex overflow-hidden rounded-md border border-slate-300 text-xs">
          {(["diaphragm", "bell"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={state.stethMode === m} onClick={() => onChange({ ...state, stethMode: m })} className={`px-2 py-1 ${state.stethMode === m ? "bg-slate-800 text-white" : "bg-white"}`}>
              {m === "diaphragm" ? "Diaphragm" : "Bell"}
            </button>
          ))}
        </span>
      )}
      {state.tool === "tuning_fork" && (
        <>
          <span role="radiogroup" aria-label="Fork frequency" className="ml-1 flex overflow-hidden rounded-md border border-slate-300 text-xs">
            {(["128", "512"] as const).map((f) => (
              <button key={f} type="button" role="radio" aria-checked={state.forkFreq === f} onClick={() => onChange({ ...state, forkFreq: f, struckAt: null })} className={`px-2 py-1 ${state.forkFreq === f ? "bg-slate-800 text-white" : "bg-white"}`}>
                {f} Hz
              </button>
            ))}
          </span>
          <button type="button" className="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-600" onClick={() => onChange({ ...state, struckAt: performance.now() })}>
            Strike fork
          </button>
        </>
      )}
      {state.tool && <span className="basis-full text-xs text-slate-500">{TOOL_HELP[state.tool]}</span>}
    </div>
  );
}
