"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RegradeButton({ sessionId, label = "Re-run grading" }: { sessionId: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await fetch(`/api/coach/sessions/${sessionId}/regrade`, { method: "POST" });
          if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Failed");
          setBusy(false);
          router.refresh();
        }}
        className="rounded-md border border-line-strong bg-white px-3 py-1.5 text-sm disabled:opacity-50"
      >
        {busy ? "Grading…" : label}
      </button>
      {error && <span className="text-sm text-red-700">{error}</span>}
    </span>
  );
}
