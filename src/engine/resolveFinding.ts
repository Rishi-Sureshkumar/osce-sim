import type { Case, ExamManeuver, Vitals } from "@/domain/schemas";

export type Resolution = "case_region" | "case_default" | "catalog_region" | "catalog_default";

export interface ResolvedFinding {
  findingText: string;
  resolvedFrom: Resolution;
}

export class InvalidExamError extends Error {}

/**
 * INVARIANT: findings are resolved in code, never by a model.
 *
 *   case.abnormalFindings[maneuverId][regionId]
 *   ?? case.abnormalFindings[maneuverId].default
 *   ?? catalog[maneuverId].normalFinding[regionId]
 *   ?? catalog[maneuverId].normalFinding.default
 *
 * then {vitals.*} placeholders are filled from the case's vitals.
 */
export function resolveFinding(
  kase: Pick<Case, "abnormalFindings" | "vitals">,
  maneuver: ExamManeuver,
  regionId: string,
): ResolvedFinding {
  if (!maneuver.allowedRegions.includes(regionId)) {
    throw new InvalidExamError(`Maneuver "${maneuver.id}" cannot be performed on region "${regionId}"`);
  }
  const abnormal = kase.abnormalFindings[maneuver.id];
  let text: string | undefined;
  let from: Resolution;
  if (abnormal?.[regionId] !== undefined) {
    text = abnormal[regionId];
    from = "case_region";
  } else if (abnormal?.default !== undefined) {
    text = abnormal.default;
    from = "case_default";
  } else if (regionId !== "default" && maneuver.normalFinding[regionId] !== undefined) {
    text = maneuver.normalFinding[regionId];
    from = "catalog_region";
  } else {
    text = maneuver.normalFinding.default;
    from = "catalog_default";
  }
  return { findingText: fillVitals(text!, kase.vitals), resolvedFrom: from };
}

export function fillVitals(text: string, vitals: Vitals): string {
  return text.replace(/\{vitals\.(\w+)\}/g, (match, key: string) => {
    const v = (vitals as Record<string, unknown>)[key];
    return v === undefined ? match : String(v);
  });
}
