import type { AudioSpec, Case, ExamManeuver, FindingValue, Position, Vitals } from "@/domain/schemas";

export type Resolution = "case_region" | "case_default" | "catalog_region" | "catalog_default";

export interface ResolvedFinding {
  findingText: string;
  resolvedFrom: Resolution;
  /** Sound for this finding, from data only (never chosen by a model). */
  audio?: AudioSpec;
  visual?: Record<string, number>;
}

export class InvalidExamError extends Error {}

/** Text of a finding value (phase-1 plain strings or phase-2 objects). */
export function findingValueText(v: FindingValue): string {
  return typeof v === "string" ? v : v.text;
}

/**
 * INVARIANT: findings are resolved in code, never by a model.
 *
 *   case.abnormalFindings[maneuverId][regionId]
 *   ?? case.abnormalFindings[maneuverId].default
 *   ?? catalog[maneuverId].normalFinding[regionId]
 *   ?? catalog[maneuverId].normalFinding.default
 *
 * The chosen entry may carry a `byPosition` variant for the patient's current position
 * (e.g. an S3 that is loudest in left lateral decubitus), which overrides its text/audio/visual.
 * Finally {vitals.*} placeholders are filled from the case's vitals.
 */
export function resolveFinding(
  kase: Pick<Case, "abnormalFindings" | "vitals">,
  maneuver: ExamManeuver,
  regionId: string,
  ctx: { position?: Position } = {},
): ResolvedFinding {
  if (!maneuver.allowedRegions.includes(regionId)) {
    throw new InvalidExamError(`Maneuver "${maneuver.id}" cannot be performed on region "${regionId}"`);
  }
  const abnormal = kase.abnormalFindings[maneuver.id];
  let value: FindingValue;
  let from: Resolution;
  if (abnormal?.[regionId] !== undefined) {
    value = abnormal[regionId];
    from = "case_region";
  } else if (abnormal?.default !== undefined) {
    value = abnormal.default;
    from = "case_default";
  } else if (regionId !== "default" && maneuver.normalFinding[regionId] !== undefined) {
    value = maneuver.normalFinding[regionId]!;
    from = "catalog_region";
  } else {
    value = maneuver.normalFinding.default;
    from = "catalog_default";
  }

  let text = findingValueText(value);
  let audio: AudioSpec | undefined;
  let visual: Record<string, number> | undefined;
  if (typeof value !== "string") {
    audio = value.audio;
    visual = value.visual;
    const variant = ctx.position ? value.byPosition?.[ctx.position] : undefined;
    if (variant) {
      text = variant.text ?? text;
      audio = variant.audio ?? audio;
      visual = variant.visual ?? visual;
    }
  }
  // Korotkoff sounds default to the case's blood pressure
  if (audio && "generator" in audio && audio.generator === "korotkoff")
    audio = { ...audio, params: { ...audio.params, systolic: audio.params.systolic ?? kase.vitals.bpSystolic, diastolic: audio.params.diastolic ?? kase.vitals.bpDiastolic } };
  return {
    findingText: fillVitals(text, kase.vitals),
    resolvedFrom: from,
    ...(audio ? { audio } : {}),
    ...(visual ? { visual } : {}),
  };
}

export function fillVitals(text: string, vitals: Vitals): string {
  return text.replace(/\{vitals\.(\w+)\}/g, (match, key: string) => {
    const v = (vitals as Record<string, unknown>)[key];
    return v === undefined ? match : String(v);
  });
}

/** Does this maneuver involve physical contact? (catalog `touch`, else everything but inspection) */
export function isTouch(m: Pick<ExamManeuver, "touch" | "technique">): boolean {
  return m.touch ?? m.technique !== "inspect";
}
