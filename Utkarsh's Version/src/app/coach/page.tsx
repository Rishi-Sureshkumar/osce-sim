import Link from "next/link";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { ActivityHeatmap } from "@/components/coach/ActivityHeatmap";
import { mmss, modeLabel } from "@/components/common/format";
import { listSessionRows } from "@/server/coach";

export const dynamic = "force-dynamic";

export default async function CoachHome() {
  const rows = await listSessionRows();
  const scored = rows.filter((r) => r.points !== null && r.maxPoints);
  const avg = scored.length ? Math.round((scored.reduce((n, r) => n + r.points! / r.maxPoints!, 0) / scored.length) * 100) : null;
  const kpis = [
    { label: "Sessions", value: rows.length, suffix: "" },
    { label: "Completed", value: rows.filter((r) => r.session.status !== "active").length, suffix: "" },
    { label: "Awaiting review", value: rows.filter((r) => r.needsReview > 0).length, suffix: "" },
    { label: "Average score", value: avg, suffix: "%" },
  ];
  // per-station spread: attempts, average score, practice vs exam
  const byCase = [...rows.reduce((m, r) => {
    const e = m.get(r.caseTitle) ?? { title: r.caseTitle, n: 0, practice: 0, scores: [] as number[] };
    e.n += 1;
    if (r.session.mode === "practice") e.practice += 1;
    if (r.points !== null && r.maxPoints) e.scores.push(r.points / r.maxPoints);
    return m.set(r.caseTitle, e);
  }, new Map<string, { title: string; n: number; practice: number; scores: number[] }>()).values()].sort((a, b) => b.n - a.n);
  return (
    <main className="mx-auto max-w-6xl px-4 pt-8 pb-16 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-cyan-700">Faculty</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Coach view — sessions</h1>
          <p className="mt-1 text-sm text-slate-500">Review transcripts and evidence, confirm flagged items and override scores.</p>
        </div>
        <Link href="/coach/feedback" className="btn btn-secondary">
          In-app feedback
        </Link>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
            <dt className="text-xs font-medium text-slate-500">{k.label}</dt>
            <dd className="mt-1 font-mono text-2xl font-medium tracking-tight text-slate-900 tabular-nums">{k.value === null ? "—" : <NumberTicker value={k.value} suffix={k.suffix} />}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 grid gap-3 lg:grid-cols-[auto_1fr]">
        <section aria-labelledby="activity-h" className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
          <h2 id="activity-h" className="text-sm font-semibold text-slate-900">
            Activity
          </h2>
          <p className="mb-3 text-xs text-slate-500">Sessions started per day, last 20 weeks</p>
          <div className="overflow-x-auto">
            <ActivityHeatmap dates={rows.map((r) => r.session.startedAt)} />
          </div>
        </section>
        <section aria-labelledby="by-station-h" className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
          <h2 id="by-station-h" className="text-sm font-semibold text-slate-900">
            By station
          </h2>
          <p className="mb-3 text-xs text-slate-500">Attempts and average score</p>
          {byCase.length === 0 ? (
            <p className="text-sm text-slate-500">No sessions yet.</p>
          ) : (
            <ul className="space-y-3">
              {byCase.map((c) => {
                const a = c.scores.length ? c.scores.reduce((x, y) => x + y, 0) / c.scores.length : null;
                return (
                  <li key={c.title}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-slate-800">{c.title}</span>
                      <span className="shrink-0 font-mono text-xs text-slate-500">
                        {c.n} {c.n === 1 ? "attempt" : "attempts"} · {c.practice} practice · {a === null ? "—" : `${Math.round(a * 100)}%`}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${a === null ? "" : a >= 0.7 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${Math.round((a ?? 0) * 100)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
            <tr>
              <th className="px-3 py-2.5">Student</th>
              <th className="px-3 py-2.5">Case</th>
              <th className="px-3 py-2.5">Mode</th>
              <th className="px-3 py-2.5">Started</th>
              <th className="px-3 py-2.5">Duration</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Score</th>
              <th className="px-3 py-2.5">Review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                  No sessions yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.session.id} className="hover:bg-slate-50">
                <td className="px-3 py-2.5">
                  <Link href={`/coach/${r.session.id}`} className="font-medium text-cyan-700 hover:underline">
                    {r.session.studentLabel}
                  </Link>
                </td>
                <td className="px-3 py-2.5">{r.caseTitle}</td>
                <td className="px-3 py-2.5">
                  <span className={`badge ${r.session.mode === "practice" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-900 text-white"}`}>{modeLabel(r.session.mode)}</span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-slate-600" data-volatile>{new Date(r.session.startedAt).toLocaleString()}</td>
                <td className="px-3 py-2.5 text-slate-600 tabular-nums" data-volatile>{r.session.endedAt ? mmss(Date.parse(r.session.endedAt) - Date.parse(r.session.startedAt)) : "—"}</td>
                <td className="px-3 py-2.5">
                  <span className={`badge capitalize ring-1 ${r.session.status === "active" ? "bg-cyan-50 text-cyan-700 ring-cyan-200" : "bg-slate-50 text-slate-600 ring-slate-200"}`}>{r.session.status}</span>
                </td>
                <td className="px-3 py-2.5 font-medium text-slate-900 tabular-nums">{r.points === null ? "—" : `${r.points}/${r.maxPoints}`}</td>
                <td className="px-3 py-2.5">
                  {r.needsReview > 0 && <span className="badge bg-amber-50 text-amber-800 ring-1 ring-amber-200">{r.needsReview} needs review</span>}
                  {r.overrides > 0 && <span className="badge ml-1 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200">{r.overrides} overrides</span>}
                  {r.hints > 0 && <span className="badge ml-1 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">{r.hints} hints</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
