/**
 * Recognition (Phase 4 M4, hide-findings mode), pure and informational: for each exam that had a
 * sound or visual to interpret, how well the student's written interpretation matches the finding.
 * Deterministic word matching over the finding text (no model): the finding's content words, with
 * crude stemming, against the student's words. Normal findings match words like "normal"/"no".
 */
import type { Action } from "@/domain/schemas";
import { orderLog } from "./order";

export type RecognitionVerdict = "recognized" | "partial" | "missed" | "not_attempted";

export interface RecognitionRow {
  examActionId: string;
  maneuverId: string;
  regionId: string;
  findingText: string;
  interpretation: string | null;
  interpretationActionId: string | null;
  verdict: RecognitionVerdict;
  /** finding words the interpretation used */
  matched: string[];
}

const STOP = new Set(
  "a an and are as at be by for from has have in into is it its of on or over the this to was were with without both each left right side sides area areas heard felt seen there their they then than also very".split(" "),
);
const stem = (w: string) => w.replace(/(ies|es|s|ed|ing|ly)$/, "").slice(0, 6);
const words = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9/+\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length >= 2 && !STOP.has(w));

/** Score one interpretation against one finding text. */
export function scoreInterpretation(findingText: string, interpretation: string): { verdict: Exclude<RecognitionVerdict, "not_attempted">; matched: string[] } {
  const key = [...new Set(words(findingText))];
  const said = new Set(words(interpretation).map(stem));
  const matched = key.filter((w) => said.has(stem(w)));
  const ratio = key.length ? matched.length / key.length : 0;
  const verdict = matched.length >= 3 || ratio >= 0.5 ? "recognized" : matched.length >= 1 ? "partial" : "missed";
  return { verdict, matched };
}

/** Every interpretable exam in the log (not text-only "reported" findings), with the student's last interpretation. */
export function recognitionRows(log: readonly Action[]): RecognitionRow[] {
  const ordered = orderLog([...log]);
  const last = new Map<string, Extract<Action, { type: "interpretation" }>>();
  for (const a of ordered) if (a.type === "interpretation") last.set(a.payload.examActionId, a);
  const rows: RecognitionRow[] = [];
  for (const a of ordered) {
    if (a.type !== "examine" || !a.result || a.result.reported || !a.result.findingText) continue;
    const i = last.get(a.id);
    const scored = i ? scoreInterpretation(a.result.findingText, i.payload.text) : null;
    rows.push({
      examActionId: a.id,
      maneuverId: a.payload.maneuverId,
      regionId: a.payload.regionId,
      findingText: a.result.findingText,
      interpretation: i?.payload.text ?? null,
      interpretationActionId: i?.id ?? null,
      verdict: scored?.verdict ?? "not_attempted",
      matched: scored?.matched ?? [],
    });
  }
  return rows;
}
