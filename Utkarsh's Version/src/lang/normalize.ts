/**
 * Text normalisation for deterministic matching (Phase 4 M1). Runs the same in the browser and on
 * the server: lowercase, typographic quotes, contractions, number words, punctuation, then the
 * synonym table (content/lang/synonyms.json, longest phrase first, whole words only).
 * Bump NORMALIZER_VERSION whenever the output can change: precomputed vectors embed normalised text.
 */
export const NORMALIZER_VERSION = 3;

export interface SynonymEntry {
  to: string;
  from: string[];
}

const CONTRACTIONS: [RegExp, string][] = [
  [/\bwon't\b/g, "will not"],
  [/\bcan't\b/g, "cannot"],
  [/\bshan't\b/g, "shall not"],
  [/\bain't\b/g, "is not"],
  [/\blet's\b/g, "let us"],
  [/\by'all\b/g, "you all"],
  [/n't\b/g, " not"],
  [/\bi'm\b/g, "i am"],
  [/'re\b/g, " are"],
  [/'ve\b/g, " have"],
  [/'ll\b/g, " will"],
  [/'d\b/g, " would"],
  // "what's / it's / that's / there's / how's / who's / where's" → "is"; possessive 's is dropped below
  [/\b(what|it|that|there|here|how|who|where|when|why|he|she)'s\b/g, "$1 is"],
  [/'s\b/g, ""],
  // typed without the apostrophe (unambiguous ones only: not "its", "ill", "id", "were", "well", "lets", "hell")
  [/\b(do|does|did|is|are|was|have|has|had|could|would|should)nt\b/g, "$1 not"],
  [/\bcant\b/g, "cannot"],
  [/\bwont\b/g, "will not"],
  [/\bim\b/g, "i am"],
  [/\bive\b/g, "i have"],
  [/\b(you|they)re\b/g, "$1 are"],
  [/\b(you|they|we)ve\b/g, "$1 have"],
  [/\b(what|that|there|how|who|where)s\b/g, "$1 is"],
  [/\bgonna\b/g, "going to"],
  [/\bwanna\b/g, "want to"],
  [/\bgotta\b/g, "have to"],
  [/\bkinda\b/g, "kind of"],
];

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};
const NUMBER_RE = new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join("|")})\\b`, "g");

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export interface Normalizer {
  (text: string): string;
  version: number;
}

/** Text → canonical form: lowercase words and digits separated by single spaces. */
export function basicNormalize(text: string): string {
  let t = text
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-");
  for (const [re, to] of CONTRACTIONS) t = t.replace(re, to);
  t = t.replace(/(\d+)\s*-\s*(\d+)/g, "$1 to $2"); // "2-3 weeks"
  t = t.replace(/%/g, " percent "); // "EF 30%" must not match "30 minutes"
  t = t.replace(/[^a-z0-9\s/]/g, " ").replace(/\//g, " / ");
  t = t.replace(NUMBER_RE, (w) => String(NUMBER_WORDS[w]));
  return t.replace(/\s+/g, " ").trim();
}

/** Builds a normaliser with a synonym table (longest phrase first, whole words). */
export function makeNormalizer(synonyms: readonly SynonymEntry[] = []): Normalizer {
  const pairs = synonyms.flatMap((e) => e.from.map((f) => [basicNormalize(f), basicNormalize(e.to)] as const)).filter(([f, to]) => f && f !== to);
  pairs.sort((a, b) => b[0].length - a[0].length);
  const map = new Map(pairs);
  const re = pairs.length ? new RegExp(`(?<![a-z0-9])(${pairs.map(([f]) => escapeRe(f)).join("|")})(?![a-z0-9])`, "g") : null;
  const fn = ((text: string) => {
    const t = basicNormalize(text);
    if (!re) return t;
    return t.replace(re, (m) => map.get(m) ?? m).replace(/\s+/g, " ").trim();
  }) as Normalizer;
  fn.version = NORMALIZER_VERSION;
  return fn;
}

/** Does `phrase` (already normalised) occur in `text` (already normalised) as whole words? */
export function hasPhrase(text: string, phrase: string): boolean {
  if (!phrase) return false;
  const i = text.indexOf(phrase);
  if (i < 0) return false;
  for (let at = i; at >= 0; at = text.indexOf(phrase, at + 1)) {
    const before = at === 0 || text[at - 1] === " ";
    const end = at + phrase.length;
    const after = end === text.length || text[end] === " ";
    if (before && after) return true;
  }
  return false;
}

/** Words of a normalised text. */
export const words = (t: string) => (t ? t.split(" ") : []);
