import type { Action, Case, MarkSheet } from "@/domain/schemas";

/** Mark sheets for a case, restricted to the case's configured sections (Case.markSheetSections). */
export function sheetsForCase(kase: Case, markSheetById: Map<string, MarkSheet>): MarkSheet[] {
  return kase.markSheetIds.map((id) => {
    const sheet = markSheetById.get(id);
    if (!sheet) throw new Error(`case ${kase.id}: unknown mark sheet ${id}`);
    const sections = kase.markSheetSections?.[id];
    return sections ? { ...sheet, items: sheet.items.filter((i) => sections.includes(i.section)) } : sheet;
  });
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
