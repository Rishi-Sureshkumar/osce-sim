"use client";
import { motion, useReducedMotion } from "framer-motion";

function FloatingPaths({ position, still }: { position: number; still: boolean }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.8 + i * 0.04,
  }));
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="-60 40 420 340" fill="none" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {paths.map((p) => (
        <motion.path
          key={p.id}
          d={p.d}
          stroke="currentColor"
          strokeWidth={p.width}
          strokeOpacity={0.1 + p.id * 0.03}
          initial={{ pathLength: 0.3, opacity: 0.6 }}
          animate={still ? { pathLength: 1, opacity: 0.45 } : { pathLength: 1, opacity: [0.3, 0.6, 0.3], pathOffset: [0, 1, 0] }}
          transition={still ? { duration: 0 } : { duration: 20 + (p.id % 10), repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
        />
      ))}
    </svg>
  );
}

/** Slow-drifting line field for brand panels; colour comes from the parent's text colour. Adapted from 21st.dev "Background Paths" (via BoloBridge). */
export function BackgroundPaths({ className = "" }: { className?: string }) {
  const still = !!useReducedMotion();
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <FloatingPaths position={1} still={still} />
      <FloatingPaths position={-1} still={still} />
    </div>
  );
}
