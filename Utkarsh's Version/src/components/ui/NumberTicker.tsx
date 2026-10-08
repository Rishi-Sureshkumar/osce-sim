"use client";
import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

/**
 * Count-up number that starts when scrolled into view (ease-out cubic).
 * Adapted from a 21st.dev component (via BoloBridge). Screen readers get the final value.
 */
export function NumberTicker({ value, duration = 1100, delay = 0, suffix = "", className = "" }: { value: number; duration?: number; delay?: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) return setDisplay(value);
    let frame = 0;
    const timeout = setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - start) / duration, 1);
        setDisplay(Math.round((1 - Math.pow(1 - p, 3)) * value));
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(frame);
    };
  }, [inView, reduce, value, duration, delay]);

  return (
    <span ref={ref} className={className} aria-label={`${value}${suffix}`}>
      <span aria-hidden>
        {display.toLocaleString()}
        {suffix}
      </span>
    </span>
  );
}
