"use client";
import { useEffect, useState } from "react";
import { mmss } from "@/components/common/format";

export function Timer({ startedAt, limitMinutes, stopped }: { startedAt: string; limitMinutes: number; stopped?: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    if (stopped) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [stopped]);
  if (now === null) return <div className="rounded-md bg-slate-100 px-3 py-1 font-mono text-lg">--:--</div>;
  const remaining = limitMinutes * 60_000 - (now - Date.parse(startedAt));
  const over = remaining < 0;
  return (
    <div className={`rounded-md px-3 py-1 font-mono text-lg tabular-nums ${over ? "bg-red-100 text-red-800" : "bg-slate-100"}`} aria-label="Time remaining">
      {over ? "+" : ""}
      {mmss(Math.abs(remaining))}
    </div>
  );
}
