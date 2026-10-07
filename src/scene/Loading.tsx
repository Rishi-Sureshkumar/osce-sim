"use client";
import { useProgress } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";

/** Progress overlay while the patient model and textures stream in (drawn over the canvas). */
export function LoadingOverlay() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-slate-100/90 text-sm text-slate-700" role="status" data-testid="scene-loading">
      <p>Preparing the exam room…</p>
      <div className="h-1.5 w-48 overflow-hidden rounded bg-slate-300">
        <div className="h-full bg-cyan-700 transition-[width]" style={{ width: `${Math.round(progress)}%` }} />
      </div>
    </div>
  );
}

/** Frame-rate readout for performance checks: add ?fps to the URL. Renders nothing otherwise. */
export function FpsMeter() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(typeof window !== "undefined" && new URLSearchParams(window.location.search).has("fps")), []);
  const frames = useRef(0);
  const since = useRef(performance.now());
  useFrame(() => {
    if (!on) return;
    frames.current++;
    const now = performance.now();
    if (now - since.current > 1000) {
      const fps = (frames.current * 1000) / (now - since.current);
      (window as unknown as { __osceFps?: number }).__osceFps = Math.round(fps);
      const el = document.getElementById("osce-fps");
      if (el) el.textContent = `${Math.round(fps)} fps`;
      frames.current = 0;
      since.current = now;
    }
  });
  useEffect(() => {
    if (!on) return;
    const el = document.createElement("div");
    el.id = "osce-fps";
    el.style.cssText = "position:fixed;right:8px;top:40px;z-index:9999;background:#0f172a;color:#fff;font:12px monospace;padding:2px 6px;border-radius:4px";
    document.body.appendChild(el);
    return () => el.remove();
  }, [on]);
  return null;
}
