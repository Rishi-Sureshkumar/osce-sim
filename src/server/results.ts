import "server-only";
import { getContent, getPublicCatalog, toPublicCase } from "@/content/load";
import type { Action, Case, GradingRun, MarkSheet, Override, PublicCase, Session } from "@/domain/schemas";
import { applyOverrides, totals, type EffectiveScore, type SheetTotals } from "@/engine/scoring";
import { getRepo } from "./db";
import { missedKeyFindings, sheetsForCase } from "./grading";
import { getCaseOr404, getSessionOr404 } from "./session";

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
  /** Only revealed once the station has ended. */
  debrief: { expectedDifferential: Case["expectedDifferential"]; missed: { label: string; region: string | null }[] } | null;
  catalog: ReturnType<typeof getPublicCatalog>;
}

export async function getResultsView(sessionId: string): Promise<ResultsView> {
  const repo = await getRepo();
  const session = await getSessionOr404(sessionId);
  const kase = getCaseOr404(session.caseId);
  const [actions, runs, overrides] = await Promise.all([repo.listActions(sessionId), repo.listGradingRuns(sessionId), repo.listOverrides(sessionId)]);
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
  return {
    session,
    kase: toPublicCase(kase),
    actions,
    run,
    runs,
    overrides,
    sheets,
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
