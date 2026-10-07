"use client";
/**
 * "Enhanced patient" (Phase 4 M1, optional, off by default): loads WebLLM in the student's browser
 * (WebGPU only, after the student confirms the download) and rewords the patient's chosen reply for
 * display. The log, the transcript coaches see and grading always keep the original text.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { loadWebLLM, WEBLLM_MODEL, hasWebGPU, type ChatEngine } from "@/lang/webllm/engine";
import { rephrase } from "@/lang/webllm/rephrase";

export type EnhancedState = { status: "off" } | { status: "confirm" } | { status: "loading"; progress: number } | { status: "ready" } | { status: "error"; message: string };

export function useEnhancedPatient() {
  const [state, setState] = useState<EnhancedState>({ status: "off" });
  const [reworded, setReworded] = useState<Record<string, string>>({});
  const engine = useRef<ChatEngine | null>(null);
  // decided after mount (the server render has no navigator), so hydration matches
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    // presence only: the adapter is requested when the user opts in (a probe on every page load costs time and warns in headless browsers)
    setAvailable(hasWebGPU());
  }, []);

  const request = useCallback(() => setState(engine.current ? { status: "ready" } : { status: "confirm" }), []);
  const turnOff = useCallback(() => setState({ status: "off" }), []);
  const load = useCallback(async () => {
    setState({ status: "loading", progress: 0 });
    try {
      engine.current ??= await loadWebLLM((p) => setState({ status: "loading", progress: p }));
      setState({ status: "ready" });
    } catch (e) {
      setState({ status: "error", message: (e as Error).message });
    }
  }, []);

  /** Reword a patient reply for display (resolves to the original on timeout, error or an unfaithful rewording). */
  const reword = useCallback(
    async (actionId: string, text: string): Promise<string> => {
      if (state.status !== "ready" || !engine.current) return text;
      const r = await rephrase(engine.current, text);
      if (r.rephrased) setReworded((m) => ({ ...m, [actionId]: r.text }));
      return r.text;
    },
    [state.status],
  );

  return { available, state, request, load, turnOff, reword, reworded: state.status === "ready" ? reworded : {}, sizeMB: WEBLLM_MODEL.downloadMB };
}
