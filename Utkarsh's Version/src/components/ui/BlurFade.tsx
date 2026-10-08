"use client";
import { motion, useInView, useReducedMotion, type Variants } from "framer-motion";
import { useRef } from "react";

/**
 * Subtle fade-up entrance for page sections (once, on mount or when scrolled into view).
 * Adapted from a 21st.dev component (via BoloBridge). Skipped when the user prefers reduced motion.
 */
export function BlurFade({ children, className, delay = 0, duration = 0.4, yOffset = 6, inView = false }: { children: React.ReactNode; className?: string; delay?: number; duration?: number; yOffset?: number; inView?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "100px" });
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  const variants: Variants = {
    hidden: { y: yOffset, opacity: 0, filter: "blur(4px)" },
    visible: { y: 0, opacity: 1, filter: "blur(0px)" },
  };
  return (
    <motion.div ref={ref} initial="hidden" animate={!inView || seen ? "visible" : "hidden"} variants={variants} transition={{ delay: 0.04 + delay, duration, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  );
}
