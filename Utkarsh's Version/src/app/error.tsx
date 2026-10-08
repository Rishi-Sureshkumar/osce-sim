"use client";
import { AlertTriangle } from "lucide-react";

/** Any page that throws shows this instead of a blank screen. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto mt-16 max-w-md px-4" role="alert">
      <div className="card p-7">
        <span className="flex size-10 items-center justify-center rounded-lg bg-red-50 text-red-600 ring-1 ring-red-200">
          <AlertTriangle aria-hidden className="size-5" />
        </span>
        <h1 className="mt-4 text-lg font-semibold tracking-tight text-slate-900">Something went wrong</h1>
        <p className="mt-1 text-sm text-slate-600">{error.message || "An unexpected error occurred."}</p>
        {error.digest && <p className="mt-2 text-xs text-slate-500">Reference: {error.digest}</p>}
        <button type="button" onClick={reset} className="btn btn-primary mt-5">
          Try again
        </button>
      </div>
    </main>
  );
}
