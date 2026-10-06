import "server-only";
import { loadContentFromDisk } from "./loadFromDisk";
import type { ContentIndex, PublicCatalog } from "./types";
import type { Case, PublicCase } from "@/domain/schemas";

let cached: ContentIndex | null = null;

/** Validated content, cached per server instance. Throws with a readable message if content is invalid. */
export function getContent(): ContentIndex {
  if (!cached || process.env.NODE_ENV === "development") cached = loadContentFromDisk();
  return cached;
}

export function getPublicCatalog(): PublicCatalog {
  const c = getContent();
  return {
    regions: c.regions,
    maneuvers: c.maneuvers.map(({ id, fcmId, label, system, technique, allowedRegions, demo, interaction, tool, toolMode, steps }) => ({
      id,
      fcmId,
      label,
      system,
      technique,
      allowedRegions,
      demo,
      ...(interaction ? { interaction } : {}),
      ...(tool ? { tool } : {}),
      ...(toolMode ? { toolMode } : {}),
      ...(steps ? { steps } : {}),
    })),
  };
}

export function toPublicCase(c: Case): PublicCase {
  const { name, age, sex, pronouns, chiefComplaint, setting } = c.patient;
  return {
    id: c.id,
    title: c.title,
    mode: c.mode,
    doorSign: c.doorSign,
    markSheetIds: c.markSheetIds,
    ...(c.findingsVisibility ? { findingsVisibility: c.findingsVisibility } : {}),
    patient: { name, age, sex, pronouns, chiefComplaint, setting },
    presentation: { visibleSigns: c.visibleSigns ?? {}, hr: c.vitals.hr, rr: c.vitals.rr },
    timeLimitSeconds: Number(process.env.TIME_LIMIT_SECONDS_OVERRIDE) > 0 ? Number(process.env.TIME_LIMIT_SECONDS_OVERRIDE) : c.doorSign.timeLimitMinutes * 60,
  };
}
