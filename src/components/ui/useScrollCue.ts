"use client";
import { useEffect, type RefObject } from "react";

/**
 * Marks a scroll area `data-at-end` once it is scrolled to the bottom (or has nothing to scroll), so
 * the `.scroll-cue` fade (globals.css) shows only while there is more below (V-MENUSCROLL).
 */
export function useScrollCue(ref: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) el.dataset.atEnd = "";
      else delete el.dataset.atEnd;
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, ...deps]);
}
