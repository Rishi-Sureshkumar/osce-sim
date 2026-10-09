"use client";
/**
 * Advisory second opinion on a needs-review item (Phase 4 M1, optional WebLLM in the coach's browser,
 * WebGPU only). It never changes a score: the coach still decides with an override.
 */
import { useEffect, useState } from "react";
import { loadWebLLM, WEBLLM_MODEL, hasWebGPU, type ChatEngine } from "@/lang/webllm/engine";
import { secondOpinion, type SecondOpinion as Opinion } from "@/lang/webllm/secondOpinion";

let shared: Promise<ChatEngine> | null = null;

export function SecondOpinion({ label, guidance, lines }: { label: string; guidance?: string; lines: string[] }) {
  const [state, setState] = useState<"idle" | "confirm" | "working" | Opinion>("idle");
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    // presence only: the adapter is requested when the user opts in (a probe on every page load costs time and warns in headless browsers)
    setAvailable(hasWebGPU());
  }, []);
  if (!available || !lines.length) return null;
  const ask = async () => {
    setState("working");
    try {
      shared ??= loadWebLLM();
      setState(await secondOpinion(await shared, { label, guidance }, lines));
    } catch (e) {
      shared = null;
      setState({ verdict: "unsure", quote: null, note: (e as Error).message });
    }
  };
  if (state === "idle")
    return (
      <button type="button" className="mt-1 text-xs text-brand hover:underline" onClick={() => (shared ? void ask() : setState("confirm"))}>
        Second opinion (in-browser model, advisory)
      </button>
    );
  if (state === "confirm")
    return (
      <p className="mt-1 text-xs text-ink-3">
        Downloads a {WEBLLM_MODEL.downloadMB} MB model once.{" "}
        <button type="button" className="text-brand hover:underline" onClick={() => void ask()}>
          Continue
        </button>{" "}
        ·{" "}
        <button type="button" className="text-ink-3 hover:underline" onClick={() => setState("idle")}>
          Cancel
        </button>
      </p>
    );
  if (state === "working") return <p className="mt-1 text-xs text-ink-3">Asking the in-browser model…</p>;
  return (
    <p className="mt-1 text-xs text-ink-3" data-testid="second-opinion">
      Advisory: <span className="font-medium">{state.verdict === "likely_credit" ? "likely credit" : state.verdict === "likely_no_credit" ? "likely no credit" : "unsure"}</span>
      {state.quote ? <> — “{state.quote}”</> : null}
      {state.note ? <span className="text-ink-3"> · {state.note}</span> : null}
    </p>
  );
}
