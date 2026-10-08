import Link from "next/link";
import { ScrollProgress } from "@/components/ui/ScrollProgress";
import { notFound } from "next/navigation";
import { labelsFrom, modeLabel } from "@/components/common/format";
import { Timeline } from "@/components/common/Timeline";
import { Debrief } from "@/components/results/Debrief";
import { FeedbackForm } from "@/components/common/FeedbackForm";
import { FeedbackSummary } from "@/components/results/FeedbackSummary";
import { GradeTrigger } from "@/components/results/GradeTrigger";
import { DomainCard, StationVerdict } from "@/components/results/DomainCard";
import { PenReview } from "@/components/results/PenReview";
import { SkillsHexagon } from "@/components/results/SkillsHexagon";
import { MistakesSection, RecognitionSection } from "@/components/results/HideModeSections";
import { HttpError } from "@/server/errors";
import { getResultsView } from "@/server/results";

export const dynamic = "force-dynamic";

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let view;
  try {
    view = await getResultsView(id, "student");
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  const { session, kase, run, actions, sheets, debrief } = view;
  const labels = labelsFrom(view.catalog);
  const actionsById = new Map(actions.map((a) => [a.id, a]));
  const href = (actionId: string) => `#a-${actionId}`;

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 pt-8 pb-16 sm:px-6">
      <ScrollProgress />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <Link href="/" className="hover:text-slate-800">
              Stations
            </Link>
            <span aria-hidden className="text-slate-300">/</span>
            <span className="font-medium text-cyan-700">Results</span>
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{kase.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {session.studentLabel} · started <span data-volatile>{new Date(session.startedAt).toLocaleString()}</span> ·{" "}
            <span className={`badge ${session.mode === "practice" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-900 text-white"}`} data-testid="mode-badge">
              {modeLabel(session.mode)}
            </span>
          </p>
        </div>
        <Link href="/" className="btn btn-secondary">
          Try another station
        </Link>
      </header>

      {session.status === "active" ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-card">
          This station is still in progress. <Link href={`/station/${id}`} className="text-cyan-700 underline">Return to the station</Link>.
        </p>
      ) : !run ? (
        <GradeTrigger sessionId={id} />
      ) : (
        <>
          {session.mode === "practice" && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Practice attempt: scored for feedback. Time-dependent items only count in exam mode.
            </p>
          )}
          <StationVerdict pass={view.pass} domains={view.domains} />
          <SkillsHexagon sheets={sheets} passMark={view.domains.reduce((m, d) => Math.max(m, d.threshold ?? 0), 0) || 0.7} />
          <FeedbackSummary run={run} />
          {debrief && <Debrief debrief={debrief} />}
          {view.domains.map((d) => (
            <DomainCard key={d.domain} domain={d} sheets={sheets} actionsById={actionsById} labels={labels} timelineHref={href} />
          ))}
          {view.penReview && <PenReview pen={view.penReview.pen} check={view.penReview.check} actionsById={actionsById} timelineHref={href} />}
          {session.settings?.findingsDisplay === "hide" && <RecognitionSection actions={actions} labels={labels} timelineHref={href} />}
          <MistakesSection actions={actions} timelineHref={href} />
          <FeedbackForm sessionId={id} page="results" />
        </>
      )}

      <section aria-labelledby="timeline-h" className="space-y-3 pt-2">
        <h2 id="timeline-h" className="border-b border-slate-200 pb-2 text-lg font-semibold tracking-tight text-slate-900">
          Timeline
        </h2>
        <Timeline actions={actions} labels={labels} />
      </section>
    </main>
  );
}
