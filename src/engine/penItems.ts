/**
 * Mark-sheet items generated at grading time from case data, so adding a case never needs code:
 * - the case's `peChecklist` (SP physical-exam checklist, auto rules) → patient-encounter domain;
 * - the case's `penKey` → one AI item per history point, exam point and accepted diagnosis, plus
 *   a justification item and the deterministic "no unperformed findings reported" item.
 */
import type { Case, MarkSheet, MarkSheetItem } from "@/domain/schemas";

export const CASE_PE_SHEET = "case-pe";
export const PEN_SHEET = "pen";
/** scored by penCheck (src/engine/penCheck.ts) after the rule pass */
export const PEN_CONSISTENCY_ITEM = "pen-no-unperformed";

export function casePeSheet(kase: Case, threshold: number | undefined): MarkSheet | null {
  if (!kase.peChecklist?.length) return null;
  return {
    id: CASE_PE_SHEET,
    title: "Physical exam checklist (this case)",
    kind: "exam",
    domain: "patient_encounter",
    ...(threshold !== undefined ? { passThreshold: threshold } : {}),
    sourceNote: `Case-specific SP physical exam checklist from ${kase.id}.`,
    items: kase.peChecklist,
  };
}

export function penSheet(kase: Case, threshold: number | undefined): MarkSheet | null {
  const key = kase.penKey;
  if (!key) return null;
  const items: MarkSheetItem[] = [
    { id: "pen-submitted", section: "Post-encounter note", label: "Submits the post-encounter note", weight: 1, scoring: "auto", rule: { submitted: "submit_pen" }, sourceText: "" },
    ...key.history.map(
      (h): MarkSheetItem => ({
        id: `pen-hx-${h.id}`,
        section: "PEN: history",
        label: `Documents ${h.kind === "negative" ? "pertinent negative" : "pertinent positive"}: ${h.text}`,
        weight: 1,
        scoring: "match",
        guidance: `Credit only if the POST-ENCOUNTER NOTE history section documents this ${h.kind === "negative" ? "pertinent negative" : "pertinent positive"}: ${h.text}. Quote the note.`,
        mockKeywords: h.keywords,
        sourceText: "",
      }),
    ),
    ...key.exam.map(
      (e): MarkSheetItem => ({
        id: `pen-ex-${e.id}`,
        section: "PEN: physical exam",
        label: `Documents exam finding: ${e.text}`,
        weight: 1,
        scoring: "match",
        guidance: `Credit only if the POST-ENCOUNTER NOTE exam section documents: ${e.text}, AND the transcript shows the student performed the exam that elicits it. Quote the note.`,
        mockKeywords: e.keywords,
        sourceText: "",
      }),
    ),
    ...key.differential.map(
      (d): MarkSheetItem => ({
        id: `pen-dx-${d.id}`,
        section: "PEN: differential",
        label: d.rank === 1 ? `Leading diagnosis: ${d.diagnosis}` : `Includes reasonable alternative: ${d.diagnosis}`,
        weight: d.rank === 1 ? 2 : 1,
        scoring: "match",
        guidance: `Credit if the note's diagnoses list ${d.diagnosis}${d.aliases.length ? ` (or: ${d.aliases.join(", ")})` : ""}${d.rank === 1 ? ", ideally first" : ""}. Rationale: ${d.rationale}. Quote the note.`,
        mockKeywords: [d.diagnosis, ...d.aliases],
        sourceText: "",
      }),
    ),
    {
      id: "pen-justification",
      section: "PEN: differential",
      label: "Diagnoses are justified by findings the student elicited",
      weight: 2,
      scoring: "match",
      guidance:
        "Credit when each listed diagnosis is supported by history or exam findings that appear in the transcript (supporting findings field or the note's sections). Half credit if support is thin or generic. Quote the note.",
      mockKeywords: ["because", "supported by", "given", "consistent with", "crackles", "S3"],
      sourceText: "",
    },
    {
      id: PEN_CONSISTENCY_ITEM,
      section: "PEN: physical exam",
      label: "Reports only exam findings that were performed",
      weight: 2,
      scoring: "auto",
      // the rule only requires a note; penCheck then deducts for every unperformed claim
      rule: { submitted: "submit_pen" },
      sourceText: "",
    },
  ];
  return {
    id: PEN_SHEET,
    title: "Post-encounter note (faculty key)",
    kind: "history",
    domain: "patient_encounter",
    ...(threshold !== undefined ? { passThreshold: threshold } : {}),
    sourceNote: `Generated from the penKey of ${kase.id}.`,
    items,
  };
}
