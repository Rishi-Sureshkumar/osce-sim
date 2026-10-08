import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { Case, ConversationBankFile, HistoryBankFile, ManeuversFile, MarkSheet, MistakesFile, RegionsFile, SynonymsFile, TopicsFile } from "@/domain/schemas";
import type { ContentIndex } from "./types";
import { validateContentGraph } from "./validate";

const CONTENT_DIR = path.join(process.cwd(), "content");

function readJson<T>(file: string, schema: z.ZodType<T>): T {
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid content file ${path.relative(process.cwd(), file)}:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

function jsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => path.join(dir, f));
}

/** Reads and validates every JSON file under /content. Adding a file needs no code change. */
export function loadContentFromDisk(root = CONTENT_DIR): ContentIndex {
  const regions = readJson(path.join(root, "catalog/regions.json"), RegionsFile).regions;
  const maneuvers = jsonFiles(path.join(root, "catalog/maneuvers")).flatMap((f) => readJson(f, ManeuversFile).maneuvers);
  const cases = jsonFiles(path.join(root, "cases")).map((f) => readJson(f, Case));
  const markSheets = jsonFiles(path.join(root, "marksheets")).map((f) => readJson(f, MarkSheet));
  const optional = <T>(file: string, schema: z.ZodType<T>, empty: T): T => (fs.existsSync(path.join(root, file)) ? readJson(path.join(root, file), schema) : empty);
  const lang = {
    synonyms: optional("lang/synonyms.json", SynonymsFile, { entries: [] }).entries,
    conversation: optional("lang/conversation.json", ConversationBankFile, { replies: [] }).replies,
    history: optional("lang/history-bank.json", HistoryBankFile, { entries: [] }).entries,
    topics: optional("lang/topics.json", TopicsFile, { topics: [] }).topics,
  };

  const index: ContentIndex = {
    regions,
    regionById: new Map(regions.map((r) => [r.id, r])),
    maneuvers,
    maneuverById: new Map(maneuvers.map((m) => [m.id, m])),
    cases,
    caseById: new Map(cases.map((c) => [c.id, c])),
    markSheets,
    markSheetById: new Map(markSheets.map((m) => [m.id, m])),
    lang,
    mistakes: optional("mistakes.json", MistakesFile, { mistakes: [] }).mistakes,
  };
  const errors = validateContentGraph(index);
  if (errors.length) throw new Error(`Content cross-reference errors:\n- ${errors.join("\n- ")}`);
  return index;
}
