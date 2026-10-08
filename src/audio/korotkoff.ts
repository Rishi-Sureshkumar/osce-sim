/**
 * Korotkoff sounds heard over the brachial artery while a BP cuff deflates. Pure: no Web Audio, so
 * every boundary is unit-tested (tests/korotkoff.test.ts). Pressures come already resolved from the
 * case (AudioSpec "korotkoff" params default to the case vitals at resolve time).
 *
 * Phases, from the cuff pressure P (mmHg):
 *   0  P > systolic                              artery occluded, nothing heard
 *   I  from systolic down to phase2At             clear tapping, growing louder (first tap = systolic)
 *   II from phase2At down to phase3At             softer, swishing taps
 *   III down to the muffle point                  crisp, louder taps
 *   IV muffle point down to just above diastolic  abrupt muffling
 *   V  P ≤ diastolic                              silence (recorded as the diastolic value)
 * Widths: the muffle point is diastolic + muffleMmHg, but never more than 40% of the pulse
 * pressure above diastolic, so phases I–III keep at least 60% of it and the first sound is always a
 * clear tap. With span = systolic − muffle point, phase I is min(PHASE1_MMHG, 30% of span) and
 * phase II min(PHASE2_MMHG, 40% of span): the nominal 14/20 mmHg apply only from a span of about
 * 47/50 mmHg (e.g. 150/90 → 136/116/96, but 120/80 → 109.8/96.2/86). Every phase exists whenever
 * systolic > diastolic (phase IV needs muffleMmHg > 0).
 * An auscultatory gap is a silent band (either order, inclusive); it silences whatever it overlaps
 * (clinically it sits inside phases I–II). One sound per heartbeat while audible.
 */
import { cycleTiming } from "./schedule";

export type KorotkoffParams = {
  systolic: number;
  diastolic: number;
  /** phase IV starts this many mmHg above diastolic */
  muffleMmHg: number;
  /** silent band [mmHg, mmHg], either order */
  auscultatoryGap?: [number, number];
  /** 0–1 overall loudness */
  intensity: number;
};

export type KorotkoffPhase = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Nominal widths of phases I and II (mmHg), used when systolic − muffle point ≥ 50 mmHg (phase I
 * from ≈ 47); below that they are 30% / 40% of that span.
 */
export const PHASE1_MMHG = 14;
export const PHASE2_MMHG = 20;
/** Phase IV is at most this fraction of the pulse pressure (a narrow pulse pressure keeps phases I–III). */
export const MAX_MUFFLE_FRACTION = 0.4;

/** Pressure (mmHg) at which each phase starts, falling from systolic. */
export function korotkoffBoundaries(p: KorotkoffParams) {
  const systolic = p.systolic;
  const diastolic = Math.min(p.diastolic, systolic);
  const pulsePressure = systolic - diastolic;
  const muffleAt = diastolic + Math.min(Math.max(0, p.muffleMmHg), pulsePressure * MAX_MUFFLE_FRACTION);
  const span = systolic - muffleAt;
  const phase2At = systolic - Math.min(PHASE1_MMHG, span * 0.3);
  const phase3At = phase2At - Math.min(PHASE2_MMHG, span * 0.4);
  return { systolic, phase2At, phase3At, muffleAt, diastolic };
}

export function korotkoffPhase(pressure: number, p: KorotkoffParams): KorotkoffPhase {
  const b = korotkoffBoundaries(p);
  if (!Number.isFinite(pressure) || pressure > b.systolic) return 0;
  if (pressure <= b.diastolic) return 5;
  if (pressure <= b.muffleAt) return 4;
  if (pressure <= b.phase3At) return 3;
  if (pressure <= b.phase2At) return 2;
  return 1;
}

/** True when the pressure sits inside the auscultatory gap (inclusive, either order). */
export function inAuscultatoryGap(pressure: number, p: KorotkoffParams): boolean {
  if (!p.auscultatoryGap) return false;
  const [a, b] = p.auscultatoryGap;
  return pressure >= Math.min(a, b) && pressure <= Math.max(a, b);
}

export type KorotkoffTexture = "tap" | "swish" | "muffled";

export interface KorotkoffSound {
  audible: boolean;
  /** 0–1 (already scaled by intensity); 0 when silent */
  gain: number;
  /** centre frequency of the tap (Hz); 0 when silent */
  freq: number;
  phase: KorotkoffPhase;
  /** how the tap should be voiced by the renderer */
  texture: KorotkoffTexture;
  /** silent only because of the auscultatory gap */
  gap: boolean;
}

const VOICE: Record<1 | 2 | 3 | 4, { gain: number; freq: number; texture: KorotkoffTexture }> = {
  1: { gain: 0.6, freq: 110, texture: "tap" },
  2: { gain: 0.4, freq: 90, texture: "swish" },
  3: { gain: 0.9, freq: 130, texture: "tap" },
  4: { gain: 0.3, freq: 60, texture: "muffled" },
};

export function korotkoffSound(pressure: number, p: KorotkoffParams): KorotkoffSound {
  const phase = korotkoffPhase(pressure, p);
  if (phase === 0 || phase === 5) return { audible: false, gain: 0, freq: 0, phase, texture: "tap", gap: false };
  const gap = inAuscultatoryGap(pressure, p);
  const v = VOICE[phase];
  const intensity = Math.max(0, Math.min(1, p.intensity));
  // phase I grows from a faint first tap at systolic to full phase-I loudness
  let shape = 1;
  if (phase === 1) {
    const b = korotkoffBoundaries(p);
    const width = Math.max(1e-6, b.systolic - b.phase2At);
    shape = 0.6 + 0.4 * Math.min(1, (b.systolic - pressure) / width);
  }
  const gain = gap ? 0 : v.gain * shape * intensity;
  return { audible: gain > 0, gain, freq: gap ? 0 : v.freq, phase, texture: v.texture, gap };
}

export interface KorotkoffEvent {
  /** seconds from the start */
  t: number;
  gain: number;
  freq: number;
  phase: KorotkoffPhase;
  texture: KorotkoffTexture;
  /** cuff pressure at this beat (mmHg) */
  pressure: number;
}

/** One tap per heartbeat while the cuff pressure at that beat makes a sound. */
export function korotkoffSchedule(p: KorotkoffParams, hr: number, pressureAt: (tSec: number) => number, seconds: number): KorotkoffEvent[] {
  const { period } = cycleTiming(hr);
  const out: KorotkoffEvent[] = [];
  for (let i = 0; i * period < seconds - 1e-9; i++) {
    const t = i * period;
    const pressure = pressureAt(t);
    const s = korotkoffSound(pressure, p);
    if (s.audible) out.push({ t, gain: s.gain, freq: s.freq, phase: s.phase, texture: s.texture, pressure });
  }
  return out;
}

/** The radial/brachial pulse can be felt only once the cuff is below systolic (palpatory estimate). */
export function pulsePalpable(pressure: number, systolic: number): boolean {
  return Number.isFinite(pressure) && pressure < systolic;
}

/** A standard teaching deflation: from 20 mmHg above systolic down to 10 below diastolic at `rate` mmHg/s. */
export function demoDeflation(p: KorotkoffParams, rate = 2.5) {
  const from = p.systolic + 20;
  const to = Math.max(0, p.diastolic - 10);
  const seconds = Math.max(1, (from - to) / rate);
  return { seconds, pressureAt: (t: number) => Math.max(to, from - rate * t) };
}
