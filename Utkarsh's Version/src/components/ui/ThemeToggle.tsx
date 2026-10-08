"use client";
import { useEffect, useState } from "react";

export const THEME_KEY = "osce-theme";

/** Sun/moon switch (adapted from the 21st.dev dark mode toggle via BoloBridge). Light is the default; dark is opt-in. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    const onToggle = () => flipTo(!document.documentElement.classList.contains("dark"));
    window.addEventListener("osce:toggle-theme", onToggle);
    return () => window.removeEventListener("osce:toggle-theme", onToggle);
  }, []);
  const flip = () => flipTo(!dark);
  function flipTo(next: boolean) {
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {}
  }
  return (
    <label className="relative inline-block h-[22px] w-[40px] shrink-0 cursor-pointer" title={dark ? "Switch to light mode" : "Switch to dark mode"}>
      <span className="sr-only">Dark mode</span>
      <input type="checkbox" role="switch" checked={dark} onChange={flip} className="peer absolute h-0 w-0 opacity-0" />
      <span
        aria-hidden
        className="absolute inset-0 rounded-full border border-slate-300 bg-slate-100 transition-colors duration-300 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cyan-500 before:absolute before:top-[3px] before:left-[3px] before:size-[14px] before:rounded-full before:bg-amber-400 before:transition-all before:duration-300 peer-checked:before:translate-x-[18px] peer-checked:before:bg-transparent peer-checked:before:shadow-[inset_-4px_-2px_0_0_var(--color-cyan-500)]"
      />
    </label>
  );
}

/** Inline, before paint: apply a saved dark preference without a flash. */
export const themeScript = `try{if(localStorage.getItem("${THEME_KEY}")==="dark")document.documentElement.classList.add("dark")}catch(e){}`;
