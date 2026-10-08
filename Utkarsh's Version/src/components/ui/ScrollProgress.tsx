"use client";
import { motion, useScroll, useSpring } from "framer-motion";

/** Thin reading-progress bar pinned to the top of long pages. Adapted from a 21st.dev component (via BoloBridge). */
export function ScrollProgress({ className = "bg-cyan-700" }: { className?: string }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 });
  return <motion.div aria-hidden className={`fixed inset-x-0 top-0 z-50 h-0.5 origin-left ${className}`} style={{ scaleX }} />;
}
