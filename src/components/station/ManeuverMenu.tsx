"use client";
import type { Region } from "@/domain/schemas";
import { Dialog } from "@/components/ui/Overlay";
import type { PublicCatalog } from "@/content/types";

type M = PublicCatalog["maneuvers"][number];
const TECHNIQUE_ORDER = ["inspect", "palpate", "percuss", "auscultate", "special"] as const;
const TECHNIQUE_LABEL: Record<string, string> = {
  inspect: "Inspect",
  palpate: "Palpate",
  percuss: "Percuss",
  auscultate: "Auscultate",
  special: "Special tests",
};

export function ManeuverMenu({
  region,
  maneuvers,
  busy,
  onChoose,
  onShowMe,
  onClose,
  dialogId = "maneuver-menu",
}: {
  /** "tool-chooser": several exams fit the tool placement — the student picks one */
  dialogId?: "maneuver-menu" | "tool-chooser";
  region: Region;
  maneuvers: M[];
  busy: boolean;
  onChoose: (m: M) => void;
  /** practice mode: technique demo without performing */
  onShowMe?: (m: M) => void;
  onClose: () => void;
}) {
  const available = maneuvers.filter((m) => m.allowedRegions.includes(region.id));
  return (
    <Dialog id={dialogId} kind="popover" title={dialogId === "tool-chooser" ? `Which exam? ${region.label}` : region.label} onClose={onClose} className="rounded-lg border border-cyan-200 bg-white p-3 shadow-md">
      {available.length === 0 && <p className="text-sm text-slate-500">No examinations are defined for this region yet.</p>}
      {TECHNIQUE_ORDER.map((t) => {
        const list = available.filter((m) => m.technique === t);
        if (!list.length) return null;
        return (
          <div key={t} className="mb-2">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{TECHNIQUE_LABEL[t]}</p>
            <ul className="mt-1 space-y-1">
              {list.map((m) => (
                <li key={m.id} className="flex items-center gap-1">
                  <button
                    disabled={busy}
                    onClick={() => onChoose(m)}
                    data-maneuver={m.id}
                    className="flex-1 rounded-md px-2 py-1.5 text-left text-sm hover:bg-cyan-50 disabled:opacity-50"
                  >
                    {m.label}
                    {m.fcmId && <span className="ml-2 rounded bg-slate-100 px-1.5 text-xs text-slate-500">#{m.fcmId}</span>}
                  </button>
                  {onShowMe && (
                    <button type="button" onClick={() => onShowMe(m)} className="shrink-0 rounded px-1.5 py-1 text-xs text-emerald-800 underline" data-show-me={m.id}>
                      Show me
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </Dialog>
  );
}
