import Link from "next/link";
import { notFound } from "next/navigation";
import { labelsFrom } from "@/components/common/format";
import { Timeline } from "@/components/common/Timeline";
import { Debrief } from "@/components/results/Debrief";
import { FeedbackForm } from "@/components/common/FeedbackForm";
import { FeedbackSummary } from "@/components/results/FeedbackSummary";
import { GradeTrigger } from "@/components/results/GradeTrigger";
import { SheetCard } from "@/components/results/SheetCard";
import { HttpError } from "@/server/errors";
import { getResultsView } from "@/server/results";

export const dynamic = "force-dynamic";

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let view;
  try {
    view = await getResultsView(id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  const { session, kase, run, actions, sheets, debrief } = view;
  const labels = labelsFrom(view.catalog);
  const actionsById = new Map(actions.map((a) => [a.id, a]));
  const href = (actionId: string) => `#a-${actionId}`;

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-cyan-700 uppercase">Results</p>
          <h1 className="text-xl font-semibold">{kase.title}</h1>
          <p className="text-sm text-slate-500">
            {session.studentLabel} · started {new Date(session.startedAt).toLocaleString()}
          </p>
        </div>
        <Link href="/" className="text-sm text-cyan-700 underline">
          Try another station
        </Link>
      </header>

      {session.status === "active" ? (
        <p className="rounded-md bg-slate-100 p-3 text-sm">
          This station is still in progress. <Link href={`/station/${id}`} className="text-cyan-700 underline">Return to the station</Link>.
        </p>
      ) : !run ? (
        <GradeTrigger sessionId={id} />
      ) : (
        <>
          {run.mocked && <p className="rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600">AI_MOCK is on: transcript-graded items and feedback use canned logic, not the model.</p>}
          <FeedbackSummary run={run} />
          {debrief && <Debrief debrief={debrief} />}
          {sheets.map((s) => (
            <SheetCard key={s.sheet.id} view={s} actionsById={actionsById} labels={labels} timelineHref={href} />
          ))}
          <FeedbackForm sessionId={id} page="results" />
        </>
      )}

      <section aria-labelledby="timeline-h" className="space-y-2">
        <h2 id="timeline-h" className="font-semibold">
          Timeline
        </h2>
        <Timeline actions={actions} labels={labels} />
      </section>
    </main>
  );
}
