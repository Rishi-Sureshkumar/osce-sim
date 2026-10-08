"use client";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/**
 * Pulls its child gently toward the cursor. Adapted from the 21st.dev MagneticButton (via BoloBridge),
 * as a wrapper so the real <button> (and its data attributes) is untouched. Off for reduced motion and
 * under browser automation, so tests always click a still target.
 */
export function Magnetic({ children, className = "", distance = 90, strength = 0.22 }: { children: React.ReactNode; className?: string; distance?: number; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const [enabled, setEnabled] = useState(false);
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 18 });
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 18 });
  useEffect(() => {
    setEnabled(!reduce && !navigator.webdriver && window.matchMedia("(pointer: fine)").matches);
  }, [reduce]);
  useEffect(() => {
    if (!enabled) return;
    const move = (e: MouseEvent) => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy);
      const k = d < distance ? (1 - d / distance) * strength : 0;
      x.set(dx * k);
      y.set(dy * k);
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, [enabled, distance, strength, x, y]);
  return (
    <motion.span ref={ref} className={`inline-flex ${className}`} style={enabled ? { x, y } : undefined}>
      {children}
    </motion.span>
  );
}
