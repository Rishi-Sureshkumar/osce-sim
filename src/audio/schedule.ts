/**
 * Pure sound schedules for the procedural audio engine. No Web Audio here, so they're unit-testable.
 * All timing follows the case's heart rate / respiratory rate; all content comes from AudioSpec data.
 */
import type { AudioSpec } from "@/domain/schemas";

export type HeartParams = Extract<AudioSpec, { generator: "heart" }>["params"];
export type BreathParams = Extract<AudioSpec, { generator: "breath" }>["params"];
export type ToneParams = Extract<AudioSpec, { generator: "tone" }>["params"];

export interface HeartEvent {
  kind: "S1" | "S2" | "A2" | "P2" | "S3" | "S4" | "murmur";
  /** seconds from the start of the loop */
  t: number;
  dur: number;
  gain: number;
  /** centre frequency (Hz) */
  freq: number;
  /** murmur envelope shape */
  shape?: "holosystolic" | "crescendo_decrescendo" | "decrescendo" | "plateau";
}

/** Systole is ~1/3 of the cycle at normal rates, shortening less than diastole as HR rises. */
export function cycleTiming(hr: number) {
  const period = 60 / Math.max(30, Math.min(200, hr));
  const systole = Math.min(0.42, 0.18 + 0.2 * period); // s
  return { period, systole, diastole: period - systole };
}

const murmurFreq = { low: 120, medium: 220, high: 380 } as const;

export function heartSchedule(p: HeartParams, hr: number, seconds: number): HeartEvent[] {
  const { period, systole, diastole } = cycleTiming(hr);
  const g = p.intensity ?? 0.8;
  const out: HeartEvent[] = [];
  for (let start = 0; start < seconds - 1e-9; start += period) {
    if (p.s4) out.push({ kind: "S4", t: start - 0.09 < 0 ? start : start - 0.09, dur: 0.05, gain: g * p.s4 * 0.6, freq: 45 });
    out.push({ kind: "S1", t: start, dur: 0.07, gain: g, freq: 70 });
    const s2 = start + systole;
    if ((p.s2SplitMs ?? 0) > 0) {
      out.push({ kind: "A2", t: s2, dur: 0.05, gain: g * 0.85, freq: 95 });
      out.push({ kind: "P2", t: s2 + p.s2SplitMs! / 1000, dur: 0.045, gain: g * 0.6, freq: 100 });
    } else {
      out.push({ kind: "S2", t: s2, dur: 0.055, gain: g * 0.85, freq: 95 });
    }
    // S3: early diastole, ~120–160 ms after S2 (never later than mid-diastole)
    if (p.s3) out.push({ kind: "S3", t: s2 + Math.min(0.15, diastole * 0.4), dur: 0.06, gain: g * p.s3 * 0.7, freq: 40 });
    if (p.murmur) {
      const m = p.murmur;
      const gain = g * (0.12 + 0.11 * m.grade); // grade 1 ≈ soft … 6 ≈ loud
      const freq = murmurFreq[m.pitch ?? "medium"];
      if (m.phase === "systolic") out.push({ kind: "murmur", t: start + 0.06, dur: systole - 0.08, gain, freq, shape: m.shape });
      else out.push({ kind: "murmur", t: s2 + 0.05, dur: Math.max(0.1, diastole * 0.55), gain, freq, shape: m.shape });
    }
  }
  return out.filter((e) => e.t >= 0 && e.t < seconds).sort((a, b) => a.t - b.t);
}

export interface BreathPhase {
  kind: "inspiration" | "expiration";
  t: number;
  dur: number;
  gain: number;
  /** band-pass centre (Hz): vesicular is soft/low, bronchial harsher/higher */
  freq: number;
}
export interface BreathSchedule {
  phases: BreathPhase[];
  crackles: { t: number; gain: number; coarse: boolean }[];
  wheezes: { t: number; dur: number; freq: number; gain: number }[];
}

/** Deterministic pseudo-random (so schedules are testable and identical each loop). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

export function breathSchedule(p: BreathParams, rr: number, seconds: number): BreathSchedule {
  const period = 60 / Math.max(6, Math.min(50, rr));
  const type = p.type ?? "vesicular";
  const base = (p.intensity ?? 0.7) * (type === "absent" ? 0 : type === "reduced" ? 0.3 : 1);
  // vesicular: inspiration longer & louder; bronchial: expiration as long and loud, gap between
  const inspFrac = type === "bronchial" ? 0.4 : 0.42;
  const expFrac = type === "bronchial" ? 0.45 : 0.4;
  const expGain = type === "bronchial" ? 1 : 0.35;
  const freq = type === "bronchial" ? 900 : 380;
  const rand = rng(17);
  const out: BreathSchedule = { phases: [], crackles: [], wheezes: [] };
  for (let start = 0; start < seconds - 1e-9; start += period) {
    const insp = period * inspFrac;
    out.phases.push({ kind: "inspiration", t: start, dur: insp, gain: base, freq });
    out.phases.push({ kind: "expiration", t: start + insp + (type === "bronchial" ? period * 0.05 : 0), dur: period * expFrac, gain: base * expGain, freq });
    if (p.crackles) {
      // crackles in late inspiration (fine) or throughout inspiration (coarse)
      const n = Math.round((p.cracklesDensity ?? 0.5) * (p.crackles === "fine" ? 14 : 8));
      const from = p.crackles === "fine" ? 0.45 : 0.1;
      for (let i = 0; i < n; i++) {
        out.crackles.push({ t: start + insp * (from + (1 - from) * rand()), gain: (p.crackles === "fine" ? 0.35 : 0.6) * (0.6 + 0.4 * rand()), coarse: p.crackles === "coarse" });
      }
    }
    if (p.wheeze) out.wheezes.push({ t: start + insp + period * 0.05, dur: period * expFrac * 0.85, freq: 420, gain: 0.25 });
  }
  const within = <T extends { t: number }>(xs: T[]) => xs.filter((x) => x.t < seconds).sort((a, b) => a.t - b.t);
  return { phases: within(out.phases), crackles: within(out.crackles), wheezes: within(out.wheezes) };
}

/** Tuning fork: an exponentially decaying sine. Weber uses `pan`; Rinne uses `airBoneRatio`. */
export function toneEnvelope(p: ToneParams) {
  const decay = p.decaySec ?? 8;
  const ratio = p.airBoneRatio ?? 2;
  // with bone conduction heard for B seconds and air for A = ratio × B, total ≈ decay
  const bone = decay / (1 + ratio);
  return { freq: p.freq ?? 512, pan: p.pan ?? 0, decaySec: decay, boneSec: bone, airSec: bone * ratio };
}

/**
 * Plain-language caption of what a sound contains, derived only from the spec (for accessibility
 * and noisy rooms). Not a diagnosis: it names the sounds that are playing.
 */
export function captionFor(spec: AudioSpec): string {
  if ("clipId" in spec) return "Recorded sound";
  if (spec.generator === "heart") {
    const p = spec.params;
    const parts = [(p.s2SplitMs ?? 0) > 0 ? "S1, split S2" : "S1, S2"];
    if (p.s3) parts.push(`S3 (${p.s3 >= 0.6 ? "loud" : "soft"})`);
    if (p.s4) parts.push(`S4 (${p.s4 >= 0.6 ? "loud" : "soft"})`);
    if (p.murmur) parts.push(`${p.murmur.phase} murmur grade ${p.murmur.grade}/6`);
    if ((p.intensity ?? 0.8) < 0.4) parts.push("distant");
    return `Heart sounds: ${parts.join(", ")}`;
  }
  if (spec.generator === "breath") {
    const p = spec.params;
    const parts = [`${p.type ?? "vesicular"} breath sounds`];
    if (p.crackles) parts.push(`${p.crackles} crackles`);
    if (p.wheeze) parts.push("wheeze");
    return parts.join(", ").replace(/^./, (c) => c.toUpperCase());
  }
  if (spec.generator === "korotkoff") return "Korotkoff sounds";
  if (spec.generator === "percussion") return `Percussion note: ${spec.params.note.replace("_", " ")}`;
  if (spec.generator === "voice") return spec.params.egophony ? "Transmitted voice: \"ee\" sounds like \"ay\"" : `Transmitted voice (${spec.params.transmission})`;
  const t = toneEnvelope(spec.params);
  const side = t.pan < -0.2 ? "louder in the left ear" : t.pan > 0.2 ? "louder in the right ear" : "heard equally in both ears";
  return `Tuning fork ${t.freq} Hz, ${side}`;
}
