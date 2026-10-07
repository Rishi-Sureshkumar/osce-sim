/**
 * Sentence splitting that keeps the verbatim text (evidence quotes are substrings) and doesn't
 * break after common abbreviations ("Mr. Bennett", "e.g. the", "Dr. Patel").
 */
const ABBREV = /\b(?:mr|mrs|ms|mx|dr|prof|st|vs|etc|e\.g|i\.e|approx|no|wk|wks|yr|yrs|hr|hrs|min|mins)\.$/i;

export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (const piece of text.split(/(?<=[.!?;])\s+|\n+/)) {
    cur = cur ? `${cur} ${piece}` : piece;
    if (ABBREV.test(cur.trim())) continue;
    if (cur.trim()) out.push(cur.trim());
    cur = "";
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
