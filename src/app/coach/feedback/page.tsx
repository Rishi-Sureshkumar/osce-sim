import Link from "next/link";
import { getRepo } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function FeedbackList() {
  const items = await (await getRepo()).listFeedback(500);
  return (
    <main className="mx-auto max-w-4xl p-6">
      <Link href="/coach" className="text-sm text-brand underline">
        ← Sessions
      </Link>
      <h1 className="mt-2 text-xl font-semibold">In-app feedback ({items.length})</h1>
      <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-line bg-surface">
        {items.length === 0 && <li className="p-4 text-sm text-ink-3">No feedback yet.</li>}
        {items.map((f) => (
          <li key={f.id} className="p-3 text-sm">
            <p className="text-xs text-ink-3">
              {new Date(f.createdAt).toLocaleString()} · {f.role} · {f.page}
              {f.sessionId && (
                <>
                  {" "}
                  ·{" "}
                  <Link href={`/coach/${f.sessionId}`} className="text-brand underline">
                    session
                  </Link>
                </>
              )}
            </p>
            <p>
              {f.rating && <span className="mr-2 font-mono">{f.rating}/5</span>}
              {f.fairness && <span className="mr-2 rounded bg-subtle px-1.5 text-xs">scoring: {f.fairness.replace("_", " ")}</span>}
              {f.text}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
