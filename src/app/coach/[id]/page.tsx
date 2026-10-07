import Link from "next/link";
import { notFound } from "next/navigation";
import { labelsFrom, modeLabel } from "@/components/common/format";
import { Timeline } from "@/components/common/Timeline";
import { OverrideForm } from "@/components/coach/OverrideForm";
import { RegradeButton } from "@/components/coach/RegradeButton";
import { DomainCard, StationVerdict } from "@/components/results/DomainCard";
import { PenReview } from "@/components/results/PenReview";
import { FeedbackSummary } from "@/components/results/FeedbackSummary";
import { FeedbackForm } from "@/components/common/FeedbackForm";
import { HttpError } from "@/server/errors";
import { getResultsView } from "@/server/results";

export const dynamic = "force-dynamic";

export default async function CoachSession({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let view;
  try {
    view = await getResultsView(id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  const { session, kase, run, runs, actions, sheets, overrides } = view;
  const labels = labelsFrom(view.catalog);
  const actionsById = new Map(actions.map((a) => [a.id, a]));
  const u = session.usage;
  const scoreByKey = new Map(sheets.flatMap((s) => s.scores.map((sc) => [`${sc.markSheetId}/${sc.itemId}`, sc] as const)));

  return (
    <main className="mx-auto max-w-[1400px] p-6">
      <Link href="/coach" className="text-sm text-cyan-700 underline">
        ← All sessions
      </Link>
      <header className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {session.studentLabel} — {kase.title}
          </h1>
          <p className="text-sm text-slate-500">
            <span data-testid="coach-mode">{modeLabel(session.mode)}</span> · {session.status} · started {new Date(session.startedAt).toLocaleString()} · {session.patientTurns} patient turns ·{" "}
            {actions.filter((a) => a.type === "hint").length} hints used · {runs.length} grading run(s)
          </p>
          <p className="text-xs text-slate-500" data-testid="tokens">
            Tokens — input {u.inputTokens.toLocaleString()}, output {u.outputTokens.toLocaleString()}, cache read {u.cacheReadTokens.toLocaleString()}, cache write{" "}
            {u.cacheWriteTokens.toLocaleString()}
          </p>
        </div>
        {session.status !== "active" && <RegradeButton sessionId={id} label={run ? "Re-run grading" : "Grade now"} />}
      </header>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          {run ? (
            <>
              <FeedbackSummary run={run} />
              <StationVerdict pass={view.pass} domains={view.domains} />
              {view.domains.map((d) => (
                <DomainCard
                  key={d.domain}
                  domain={d}
                  sheets={sheets}
                  actionsById={actionsById}
                  labels={labels}
                  timelineHref={(aid) => `#a-${aid}`}
                  renderExtra={(sheetId, itemId) => {
                    const sc = scoreByKey.get(`${sheetId}/${itemId}`);
                    if (!sc || sc.status === "not_assessable") return null;
                    return <OverrideForm sessionId={id} markSheetId={sheetId} itemId={itemId} maxPoints={sc.maxPoints} currentPoints={sc.points} />;
                  }}
                />
              ))}
            </>
          ) : (
            <p className="rounded-md bg-slate-100 p-3 text-sm">Not graded yet.</p>
          )}

          <FeedbackForm sessionId={id} page="coach-session" prompt="Coach feedback on this simulator / grading" />

          <section className="rounded-lg border border-slate-200 bg-white p-4" aria-labelledby="ovr-h">
            <h2 id="ovr-h" className="font-semibold">
              Override history
            </h2>
            {overrides.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">No overrides yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100 text-sm" data-testid="override-history">
                {overrides.map((o) => (
                  <li key={o.id} className="py-1.5">
                    <span className="text-slate-500">{new Date(o.createdAt).toLocaleString()}</span> — <span className="font-medium">{o.coach}</span> changed{" "}
                    <code className="text-xs">
                      {o.markSheetId}/{o.itemId}
                    </code>{" "}
                    from {o.originalPoints} to {o.newPoints}: “{o.reason}”{o.gradingRunId !== run?.id && <span className="ml-1 text-xs text-slate-400">(earlier grading run)</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section aria-labelledby="tl-h" className="space-y-2 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          {view.penReview && <PenReview pen={view.penReview.pen} check={view.penReview.check} actionsById={actionsById} timelineHref={(aid) => `#a-${aid}`} />}
          <h2 id="tl-h" className="font-semibold">
            Transcript &amp; timeline
          </h2>
          <Timeline actions={actions} labels={labels} />
        </section>
      </div>
    </main>
  );
}
