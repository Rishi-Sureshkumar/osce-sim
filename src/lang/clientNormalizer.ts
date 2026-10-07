/**
 * The normaliser with the shared synonym table, for the browser (it must split and normalise a
 * turn exactly as the server does, so client clause vectors line up with server clauses).
 * The synonym table is not secret: it holds no case content.
 */
import synonyms from "../../content/lang/synonyms.json";
import { makeNormalizer, type Normalizer } from "./normalize";

let n: Normalizer | null = null;
export function clientNormalizer(): Normalizer {
  n ??= makeNormalizer((synonyms as { entries: { to: string; from: string[] }[] }).entries);
  return n;
}
