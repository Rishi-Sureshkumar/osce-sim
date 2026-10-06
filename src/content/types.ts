import type { Case, ExamManeuver, MarkSheet, Region } from "@/domain/schemas";

/** Everything in /content, validated and indexed. */
export interface ContentIndex {
  regions: Region[];
  regionById: Map<string, Region>;
  maneuvers: ExamManeuver[];
  maneuverById: Map<string, ExamManeuver>;
  cases: Case[];
  caseById: Map<string, Case>;
  markSheets: MarkSheet[];
  markSheetById: Map<string, MarkSheet>;
}

/** The slice of the catalog the browser needs (no case data). */
export interface PublicCatalog {
  regions: Region[];
  maneuvers: Pick<ExamManeuver, "id" | "fcmId" | "label" | "system" | "technique" | "allowedRegions" | "demo" | "interaction" | "tool" | "toolMode" | "steps">[];
}
