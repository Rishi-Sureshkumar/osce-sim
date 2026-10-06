"use client";
import { useEffect, useRef, useState } from "react";
import type { AudioSpec } from "@/domain/schemas";
import { audioEngine, type Playing } from "@/audio/engine";
import { captionFor } from "@/audio/schedule";

/** Short "performed" visualisation: steps appear one by one while the finding resolves. */
export function PerformOverlay({
  title,
  steps,
  finding,
  audio,
  hr = 72,
  rr = 14,
  onDone,
}: {
  title: string;
  steps: string[];
  finding: string | null;
  /** 2D/menu path: the finding's sound, played on request (the 3D tools play it live) */
  audio?: AudioSpec;
  hr?: number;
  rr?: number;
  onDone: () => void;
}) {
  const [shown, setShown] = useState(1);
  const playing = useRef<Playing | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  useEffect(() => () => playing.current?.stop(), []);
  const toggleSound = async () => {
    if (!audio) return;
    if (playing.current) {
      playing.current.stop();
      playing.current = null;
      setIsPlaying(false);
      return;
    }
    playing.current = "generator" in audio && audio.generator === "tone" ? await audioEngine.tone(audio, 0, {}) : await audioEngine.loop(audio, { hr, rr });
    setIsPlaying(true);
  };
  useEffect(() => {
    if (shown >= steps.length) return;
    const id = setTimeout(() => setShown((n) => n + 1), 550);
    return () => clearTimeout(id);
  }, [shown, steps.length]);
  const stepsDone = shown >= steps.length;

  return (
    <section aria-live="polite" className="rounded-lg border border-cyan-300 bg-cyan-50 p-3 shadow-md">
      <h3 className="font-semibold text-cyan-900">{title}</h3>
      <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-cyan-950">
        {steps.slice(0, shown).map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {stepsDone && (
        <div className="mt-2 rounded-md bg-white p-2 text-sm" data-testid="perform-finding">
          {finding === null ? <span className="text-slate-500">Examining…</span> : <span className="font-medium">{finding}</span>}
          {audio && finding !== null && (
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
              <button type="button" onClick={toggleSound} className="rounded border border-slate-300 px-2 py-0.5">
                {isPlaying ? "Stop sound" : "Play sound"}
              </button>
              <span>{captionFor(audio)}</span>
            </div>
          )}
        </div>
      )}
      <div className="mt-2 flex justify-end gap-2">
        {!stepsDone && (
          <button className="text-xs text-cyan-800 underline" onClick={() => setShown(steps.length)}>
            Skip
          </button>
        )}
        {stepsDone && finding !== null && (
          <button
            className="rounded-md bg-cyan-700 px-3 py-1 text-sm text-white"
            onClick={() => {
              playing.current?.stop();
              onDone();
            }}
          >
            Continue
          </button>
        )}
      </div>
    </section>
  );
}
