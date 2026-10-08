import "server-only";
import { getContent, getPublicCatalog, toPublicCase } from "@/content/load";
import type { Action, Case, GradingRun, MarkSheet, Override, PublicCase, Session } from "@/domain/schemas";
import { applyOverrides, domainTotals, stationPass, totals, type DomainTotal, type EffectiveScore, type SheetTotals } from "@/engine/scoring";
import { penCheck, type PenCheckResult } from "@/engine/penCheck";
import { getRepo } from "./db";
import { missedKeyFindings } from "@/engine/sheets";
import { penFor, sheetsForCase } from "./grading";
import { getCaseOr404, getSessionOr404, redactForStudent, visibleToStudent } from "./session";

export interface SheetView {
  sheet: MarkSheet;
  scores: EffectiveScore[];
  totals: SheetTotals;
}

export interface ResultsView {
  session: Session;
  kase: PublicCase;
  actions: Action[];
  run: GradingRun | null;
  runs: GradingRun[];
  overrides: Override[];
  sheets: SheetView[];
  /** 1B pass/fail per domain (from the latest run with overrides); empty before grading */
  domains: DomainTotal[];
  pass: boolean | null;
  /** the post-encounter note with each exam claim linked to the log or flagged */
  penReview: { pen: Extract<Action, { type: "submit_pen" }>; check: PenCheckResult } | null;
  /** Only revealed once the station has ended. */
  debrief: { expectedDifferential: Case["expectedDifferential"]; missed: { label: string; region: string | null }[] } | null;
  catalog: ReturnType<typeof getPublicCatalog>;
}

/**
 * Results for a session. `audience: "student"` gets the log the student may see (the same redaction
 * as the station: no matcher data ever, no hidden anchors or withheld findings while active);
 * coaches get the full log.
 */
export async function getResultsView(sessionId: string, audience: "student" | "coach"): Promise<ResultsView> {
  const repo = await getRepo();
  const session = await getSessionOr404(sessionId);
  const kase = getCaseOr404(session.caseId);
  const [log, runs, overrides] = await Promise.all([repo.listActions(sessionId), repo.listGradingRuns(sessionId), repo.listOverrides(sessionId)]);
  const actions = audience === "coach" ? log : log.filter((a) => visibleToStudent(a, session)).map((a) => redactForStudent(a, kase, session));
  const run = runs.at(-1) ?? null;
  const sheets = sheetsForCase(kase).map((sheet) => {
    const scores = applyOverrides(
      (run?.scores ?? []).filter((s) => s.markSheetId === sheet.id),
      overrides.filter((o) => o.gradingRunId === run?.id),
    );
    return { sheet, scores, totals: totals(scores) };
  });
  const content = getContent();
  const ended = session.status !== "active";
  const domains = run ? domainTotals(sheets.flatMap((s) => s.scores), sheets.map((s) => s.sheet)) : [];
  const pen = ended ? penFor(actions) : undefined;
  return {
    session,
    kase: toPublicCase(kase),
    actions,
    run,
    runs,
    overrides,
    sheets,
    domains,
    pass: stationPass(domains),
    penReview: pen ? { pen, check: penCheck(pen.payload.exam, content.maneuvers, kase.penKey?.exam ?? [], actions) } : null,
    debrief: ended
      ? {
          expectedDifferential: kase.expectedDifferential,
          missed: missedKeyFindings(kase, actions).map((m) => ({
            label: content.maneuverById.get(m.maneuverId)?.label ?? m.maneuverId,
            region: m.regionId ? (content.regionById.get(m.regionId)?.label ?? m.regionId) : null,
          })),
        }
      : null,
    catalog: getPublicCatalog(),
  };
}
