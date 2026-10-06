"use client";
import { useState } from "react";

export function GateForm({ next }: { next: string }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-4 space-y-3"
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
        <span className="font-medium">Access code</span>
        <input type="password" value={code} onChange={(e) => setCode(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" autoFocus required />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button disabled={busy} className="w-full rounded-md bg-cyan-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
        Continue
      </button>
    </form>
  );
}
