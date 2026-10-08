"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Kicks off (idempotent) grading after submission and refreshes the page when done. */
export function GradeTrigger({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    fetch(`/api/sessions/${sessionId}/grade`, { method: "POST" })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Grading failed");
        router.refresh();
      })
      .catch((e: Error) => setError(e.message));
  }, [sessionId, router]);
  return error ? (
    <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
      {error}
    </p>
  ) : (
    <p className="animate-pulse rounded-md bg-cyan-50 p-3 text-sm text-cyan-900" data-testid="grading">
      Grading your station… this can take up to a minute.
    </p>
  );
}
