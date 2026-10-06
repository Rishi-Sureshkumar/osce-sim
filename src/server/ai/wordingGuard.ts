/** Reject rewordings that introduce numbers or sidedness not present in the raw finding. */
export function passesWordingGuard(raw: string, worded: string): boolean {
  if (!worded || worded.length > raw.length * 3 + 80) return false;
  const nums = (s: string) => new Set(s.match(/\d+(\.\d+)?/g) ?? []);
  const rawNums = nums(raw);
  for (const n of nums(worded)) if (!rawNums.has(n)) return false;
  const sides = (s: string) => new Set((s.toLowerCase().match(/\b(left|right|bilateral(ly)?)\b/g) ?? []).map((x) => x.replace("bilaterally", "bilateral")));
  const rawSides = sides(raw);
  for (const s of sides(worded)) if (!rawSides.has(s)) return false;
  return true;
}
