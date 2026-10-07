import type { Action, Case, Domain, MarkSheet } from "@/domain/schemas";
import { casePeSheet, penSheet } from "./penItems";

/**
 * Mark sheets for a case: the listed sheets (restricted to Case.markSheetSections), then the
 * sheets generated from case data — the SP physical-exam checklist (`peChecklist`) and the
 * post-encounter note key (`penKey`) — which join the patient-encounter domain.
 */
export function sheetsForCase(kase: Case, markSheetById: Map<string, MarkSheet>): MarkSheet[] {
  const listed = kase.markSheetIds.map((id) => {
    const sheet = markSheetById.get(id);
    if (!sheet) throw new Error(`case ${kase.id}: unknown mark sheet ${id}`);
    const sections = kase.markSheetSections?.[id];
    return sections ? { ...sheet, items: sheet.items.filter((i) => sections.includes(i.section)) } : sheet;
  });
  const peThreshold = listed.find((s) => domainOf(s) === "patient_encounter")?.passThreshold;
  return [...listed, casePeSheet(kase, peThreshold), penSheet(kase, peThreshold)].filter((s): s is MarkSheet => s !== null);
}

/** A sheet's domain: explicit, else exam sheets count toward the patient encounter and history sheets toward communication. */
export function domainOf(sheet: Pick<MarkSheet, "domain" | "kind">): Domain {
  return sheet.domain ?? (sheet.kind === "exam" ? "patient_encounter" : "communication");
}

/** Key abnormal findings in the case that the student never elicited (deterministic). */
export function missedKeyFindings(kase: Case, log: Action[]): { maneuverId: string; regionId: string | null }[] {
  const out: { maneuverId: string; regionId: string | null }[] = [];
  for (const [maneuverId, byRegion] of Object.entries(kase.abnormalFindings)) {
    const exams = log.filter((a) => a.type === "examine" && a.payload.maneuverId === maneuverId);
    const regions = Object.keys(byRegion).filter((r) => r !== "default");
    if (!exams.length) out.push({ maneuverId, regionId: regions[0] ?? null });
    else if (regions.length && !exams.some((a) => a.type === "examine" && regions.includes(a.payload.regionId))) {
      out.push({ maneuverId, regionId: regions[0]! });
    }
  }
  return out;
}
