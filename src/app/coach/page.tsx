import Link from "next/link";
import { mmss, modeLabel } from "@/components/common/format";
import { listSessionRows } from "@/server/coach";

export const dynamic = "force-dynamic";

export default async function CoachHome() {
  const rows = await listSessionRows();
  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Coach view — sessions</h1>
        <Link href="/coach/feedback" className="text-sm text-cyan-700 underline">
          In-app feedback
        </Link>
      </div>
      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">Case</th>
              <th className="px-3 py-2">Mode</th>
              <th className="px-3 py-2">Started</th>
              <th className="px-3 py-2">Duration</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Score</th>
              <th className="px-3 py-2">Review</th>
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
                <td className="px-3 py-2">
                  <Link href={`/coach/${r.session.id}`} className="font-medium text-cyan-700 hover:underline">
                    {r.session.studentLabel}
                  </Link>
                </td>
                <td className="px-3 py-2">{r.caseTitle}</td>
                <td className="px-3 py-2">{modeLabel(r.session.mode)}</td>
                <td className="px-3 py-2 whitespace-nowrap" data-volatile>{new Date(r.session.startedAt).toLocaleString()}</td>
                <td className="px-3 py-2 font-mono" data-volatile>{r.session.endedAt ? mmss(Date.parse(r.session.endedAt) - Date.parse(r.session.startedAt)) : "—"}</td>
                <td className="px-3 py-2">{r.session.status}</td>
                <td className="px-3 py-2 font-mono">{r.points === null ? "—" : `${r.points}/${r.maxPoints}`}</td>
                <td className="px-3 py-2">
                  {r.needsReview > 0 && <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-900">{r.needsReview} needs review</span>}
                  {r.overrides > 0 && <span className="ml-1 rounded bg-indigo-100 px-1.5 text-xs text-indigo-800">{r.overrides} overrides</span>}
                  {r.hints > 0 && <span className="ml-1 rounded bg-emerald-100 px-1.5 text-xs text-emerald-900">{r.hints} hints</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
