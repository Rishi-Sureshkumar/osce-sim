import Link from "next/link";
import { getRepo } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function FeedbackList() {
  const items = await (await getRepo()).listFeedback(500);
  return (
    <main className="mx-auto max-w-4xl p-6">
      <Link href="/coach" className="text-sm text-cyan-700 underline">
        ← Sessions
      </Link>
      <h1 className="mt-2 text-xl font-semibold">In-app feedback ({items.length})</h1>
      <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-card">
        {items.length === 0 && <li className="p-4 text-sm text-slate-500">No feedback yet.</li>}
        {items.map((f) => (
          <li key={f.id} className="p-3 text-sm">
            <p className="text-xs text-slate-500">
              {new Date(f.createdAt).toLocaleString()} · {f.role} · {f.page}
              {f.sessionId && (
                <>
                  {" "}
                  ·{" "}
                  <Link href={`/coach/${f.sessionId}`} className="text-cyan-700 underline">
                    session
                  </Link>
                </>
              )}
            </p>
            <p>
              {f.rating && <span className="mr-2 font-mono">{f.rating}/5</span>}
              {f.fairness && <span className="mr-2 rounded bg-slate-100 px-1.5 text-xs">scoring: {f.fairness.replace("_", " ")}</span>}
              {f.text}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
