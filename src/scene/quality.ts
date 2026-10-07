"use client";
import { useEffect, useState } from "react";

export type Quality = "high" | "low";
const KEY = "osce.quality";

/** Graphics quality (high/low), remembered per browser. Low: dpr 1, no shadows, smaller shadow maps. */
export function useQuality(): [Quality, (q: Quality) => void] {
  const [q, setQ] = useState<Quality>("high");
  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v === "high" || v === "low") setQ(v);
      else if (typeof navigator !== "undefined" && /iPad|iPhone|Android/i.test(navigator.userAgent)) setQ("low");
    } catch {
      /* storage unavailable */
    }
  }, []);
  const set = (v: Quality) => {
    setQ(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* ignore */
    }
  };
  return [q, set];
}
