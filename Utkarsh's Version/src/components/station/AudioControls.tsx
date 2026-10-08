"use client";
import { useEffect, useState } from "react";
import { audioEngine } from "@/audio/engine";

const KEY = "osce.audio";

/** Mute and volume for exam sounds (remembered per browser). */
export function AudioControls() {
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as { muted: boolean; volume: number } | null;
      if (saved) {
        setMuted(saved.muted);
        setVolume(saved.volume);
      }
    } catch {
      /* defaults */
    }
  }, []);
  useEffect(() => {
    audioEngine.setMuted(muted);
    audioEngine.setVolume(volume);
    try {
      localStorage.setItem(KEY, JSON.stringify({ muted, volume }));
    } catch {
      /* ignore */
    }
  }, [muted, volume]);
  return (
    <div className="flex items-center gap-1.5 text-xs" role="group" aria-label="Exam sound">
      <button type="button" onClick={() => setMuted((m) => !m)} aria-pressed={muted} className="btn btn-secondary btn-sm">
        {muted ? "Sound off" : "Sound on"}
      </button>
      <label className="flex items-center gap-1">
        <span className="sr-only">Volume</span>
        <input type="range" min={0} max={1} step={0.05} value={volume} disabled={muted} onChange={(e) => setVolume(Number(e.target.value))} className="w-20 accent-cyan-700" aria-label="Volume" />
      </label>
    </div>
  );
}
