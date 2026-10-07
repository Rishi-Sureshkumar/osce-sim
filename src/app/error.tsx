"use client";

/** Any page that throws shows this instead of a blank screen. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl space-y-3 p-6" role="alert">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-sm text-slate-700">{error.message || "An unexpected error occurred."}</p>
      {error.digest && <p className="text-xs text-slate-500">Reference: {error.digest}</p>}
      <button type="button" onClick={reset} className="rounded-md bg-cyan-700 px-3 py-1.5 text-sm font-medium text-white">
        Try again
      </button>
    </main>
  );
}
