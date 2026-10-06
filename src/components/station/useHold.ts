"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** How long hand sanitiser must be held (a real rub is ~20 s; 3 s keeps the station moving). */
export const SANITISE_HOLD_MS = 3000;

/**
 * Press-and-hold helper: start() on pointer/key down, cancel() on release. Calls onComplete once
 * when held for `ms`. `progress` is 0–1 for a ring or bar.
 */
export function useHold(ms: number, onComplete: () => void) {
  const [progress, setProgress] = useState(0);
  const startedAt = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const done = useRef(onComplete);
  done.current = onComplete;

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    startedAt.current = null;
  }, []);

  const start = useCallback(() => {
    if (startedAt.current !== null) return;
    startedAt.current = performance.now();
    setProgress(0);
    timer.current = setInterval(() => {
      if (startedAt.current === null) return;
      const p = Math.min(1, (performance.now() - startedAt.current) / ms);
      setProgress(p);
      if (p >= 1) {
        stop();
        done.current();
        setTimeout(() => setProgress(0), 600);
      }
    }, 50);
  }, [ms, stop]);

  const cancel = useCallback(() => {
    if (startedAt.current === null) return;
    stop();
    setProgress(0);
  }, [stop]);

  useEffect(() => stop, [stop]);
  return { progress, holding: progress > 0 && progress < 1, start, cancel };
}
