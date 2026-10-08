import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto mt-16 max-w-md px-4">
      <div className="card p-7">
        <p className="eyebrow text-cyan-700">404</p>
        <h1 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">Page not found</h1>
        <p className="mt-1 text-sm text-slate-600">That station or session doesn&apos;t exist, or it was removed.</p>
        <Link href="/" className="btn btn-primary mt-5">
          Back to stations
        </Link>
      </div>
    </main>
  );
}
