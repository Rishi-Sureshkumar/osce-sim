import type { Case, ConversationReply, ExamManeuver, Intent, MarkSheet, Region } from "@/domain/schemas";

/** content/lang: the deterministic language layer's shared data (Phase 4 M1). */
export interface LangContent {
  synonyms: { to: string; from: string[] }[];
  conversation: ConversationReply[];
  history: { id: string; topic: string; intents: Intent; reply: "negative" | "unknown" }[];
  topics: { id: string; label: string; group: string }[];
}

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
  lang: LangContent;
}

/** The slice of the catalog the browser needs (no case data). */
export interface PublicCatalog {
  regions: Region[];
  maneuvers: Pick<ExamManeuver, "id" | "fcmId" | "label" | "system" | "technique" | "allowedRegions" | "demo" | "interaction" | "tool" | "toolMode" | "steps">[];
}
