/**
 * Sentence vectors (Phase 4 M1): 384-d MiniLM embeddings, L2-normalised, stored as int8 with a
 * per-vector scale (base64), so precomputed banks stay small. Same code in browser and server.
 */
export const EMBED_DIMS = 384;
export const EMBED_MODEL = "Xenova/all-MiniLM-L6-v2:q8";

export interface PackedVector {
  /** base64 int8 components */
  q: string;
  /** value = q[i] * s */
  s: number;
}

export function l2normalize(v: ArrayLike<number>): Float32Array {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i]! * v[i]!;
  const k = n > 0 ? 1 / Math.sqrt(n) : 0;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i]! * k;
  return out;
}

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function fromBase64(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"));
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function pack(v: ArrayLike<number>): PackedVector {
  let max = 0;
  for (let i = 0; i < v.length; i++) max = Math.max(max, Math.abs(v[i]!));
  const s = max > 0 ? max / 127 : 1;
  const q = new Int8Array(v.length);
  for (let i = 0; i < v.length; i++) q[i] = Math.max(-127, Math.min(127, Math.round(v[i]! / s)));
  return { q: toBase64(new Uint8Array(q.buffer)), s };
}

export function unpack(p: PackedVector): Float32Array {
  const bytes = fromBase64(p.q);
  const q = new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Float32Array(q.length);
  for (let i = 0; i < q.length; i++) out[i] = q[i]! * p.s;
  return out;
}

/** cosine similarity (inputs need not be normalised) */
export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Is this a plausible embedding from our model (right length, finite, roughly unit norm)? */
export function isValidEmbedding(v: unknown): v is number[] {
  if (!Array.isArray(v) || v.length !== EMBED_DIMS) return false;
  let n = 0;
  for (const x of v) {
    if (typeof x !== "number" || !Number.isFinite(x)) return false;
    n += x * x;
  }
  return n > 0.8 && n < 1.2;
}
