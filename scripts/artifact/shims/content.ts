import { z } from "zod";
import { Case, ManeuversFile, MarkSheet, RegionsFile } from "@/domain/schemas";
import type { ContentIndex } from "@/content/types";
import { validateContentGraph } from "@/content/validate";

export type RawContent = { regions: { file: string; data: unknown }; maneuvers: { file: string; data: unknown }[]; cases: { file: string; data: unknown }[]; markSheets: { file: string; data: unknown }[] };

function parse<T>(f: { file: string; data: unknown }, schema: z.ZodType<T>): T {
  const parsed = schema.safeParse(f.data);
  if (!parsed.success) throw new Error(`Invalid content file ${f.file}:\n${z.prettifyError(parsed.error)}`);
  return parsed.data;
}

/** Same validation as src/content/loadFromDisk.ts, over the JSON the build embedded. */
export function buildIndex(raw: RawContent): ContentIndex {
  const regions = parse(raw.regions, RegionsFile).regions;
  const maneuvers = raw.maneuvers.flatMap((f) => parse(f, ManeuversFile).maneuvers);
  const cases = raw.cases.map((f) => parse(f, Case));
  const markSheets = raw.markSheets.map((f) => parse(f, MarkSheet));
  const index: ContentIndex = {
    regions,
    regionById: new Map(regions.map((r) => [r.id, r])),
    maneuvers,
    maneuverById: new Map(maneuvers.map((m) => [m.id, m])),
    cases,
    caseById: new Map(cases.map((c) => [c.id, c])),
    markSheets,
    markSheetById: new Map(markSheets.map((m) => [m.id, m])),
  };
  const errors = validateContentGraph(index);
  if (errors.length) throw new Error(`Content cross-reference errors:\n- ${errors.join("\n- ")}`);
  return index;
}
