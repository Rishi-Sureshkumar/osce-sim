"use client";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Magnetic } from "@/components/ui/Magnetic";

export function GateForm({ next }: { next: string }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const res = await fetch("/api/gate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
        if (res.ok) {
          window.location.assign(next);
        } else {
          setError((await res.json().catch(() => ({}))).error ?? "Something went wrong");
          setBusy(false);
        }
      }}
    >
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Access code</span>
        <input type="password" value={code} onChange={(e) => setCode(e.target.value)} className="input mt-1.5" autoFocus required />
      </label>
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <Magnetic className="w-full">
        <button disabled={busy} className="group btn btn-primary w-full">
          Continue
          <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </Magnetic>
    </form>
  );
}
