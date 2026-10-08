import { ShieldAlert } from "lucide-react";

export function SafetyBanner() {
  return (
    <div role="note" className="inline-flex items-center gap-1.5 rounded-full whitespace-nowrap border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
      <ShieldAlert aria-hidden className="size-3.5 shrink-0" />
      <span className="hidden sm:inline">Educational prototype. Synthetic cases. Not for clinical use.</span>
      <span className="sm:hidden">Not for clinical use</span>
    </div>
  );
}
