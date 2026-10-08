/**
 * Pure model of a manual BP cuff: bulb, release valve and aneroid gauge. No DOM, no clock — the
 * caller passes elapsed time to tick(). Unit-tested in tests/bpCuff.test.ts; BpGauge.tsx drives it.
 *
 * Deflation rate (mmHg/s) = LEAK_MMHG_S + OPEN_RATE_MMHG_S × valve². The quadratic valve curve gives
 * fine control near closed: VALVE.slow lets air out at ~2.5 mmHg/s (the recommended 2–3 mmHg/s),
 * fully open dumps ~40 mmHg/s.
 */
import { inAuscultatoryGap, korotkoffBoundaries, korotkoffPhase, type KorotkoffParams } from "@/audio/korotkoff";

export const MAX_MMHG = 300;
/**
 * A closed valve still leaks a little: 3 mmHg/min, inside the 4 mmHg/min a manual sphygmomanometer
 * may lose (ISO 81060-1), so a cuff held closed while palpating barely moves.
 */
export const LEAK_MMHG_S = 0.05;
/** extra deflation with the valve fully open */
export const OPEN_RATE_MMHG_S = 40;
const SLOW_TARGET_MMHG_S = 2.5;

export const VALVE = {
  closed: 0,
  /** ≈ 2.5 mmHg/s */
  slow: Math.sqrt((SLOW_TARGET_MMHG_S - LEAK_MMHG_S) / OPEN_RATE_MMHG_S),
  open: 1,
} as const;

/** Valve openings up to this count as closed for squeezing and for recording a deflation. */
const NEARLY_CLOSED = 0.05;
/** minimum spacing of deflation samples (s) */
const SAMPLE_EVERY_S = 0.1;

export interface DeflationSample {
  t: number;
  pressure: number;
}

export interface CuffState {
  /** mmHg, 0–300 */
  pressure: number;
  /** 0 closed … 1 fully open */
  valve: number;
  /** seconds since the cuff model started */
  t: number;
  /** highest pressure of the current inflation */
  peak: number;
  /** pressure samples while air was being let out (valve open) since the last inflation */
  deflation: DeflationSample[];
}

export function createCuff(): CuffState {
  return { pressure: 0, valve: VALVE.closed, t: 0, peak: 0, deflation: [] };
}

export function deflationRate(valve: number): number {
  const v = clamp(valve, 0, 1);
  return LEAK_MMHG_S + OPEN_RATE_MMHG_S * v * v;
}

/** Pressure added by one bulb squeeze at this pressure and valve opening. */
export function squeezeGain(pressure: number, valve: number): number {
  const base = 14 - 4 * (clamp(pressure, 0, MAX_MMHG) / MAX_MMHG); // 14 mmHg empty … 10 mmHg at 300
  const v = clamp(valve, 0, 1);
  if (v <= NEARLY_CLOSED) return base;
  return base * Math.max(0.05, (1 - v) ** 2); // most of the air escapes through an open valve
}

/**
 * One bulb squeeze. Pumping again after letting air out starts a new attempt: the earlier
 * deflation record is dropped and the peak restarts from here.
 */
export function squeeze(s: CuffState): CuffState {
  const pressure = Math.min(MAX_MMHG, s.pressure + squeezeGain(s.pressure, s.valve));
  const restart = s.deflation.length > 0;
  return { ...s, pressure, peak: restart ? pressure : Math.max(s.peak, pressure), deflation: restart ? [] : s.deflation };
}

export function setValve(s: CuffState, valve: number): CuffState {
  return { ...s, valve: clamp(valve, 0, 1) };
}

/** Advance the model by dtSec seconds. */
export function tick(s: CuffState, dtSec: number): CuffState {
  const dt = Math.max(0, Number.isFinite(dtSec) ? dtSec : 0);
  if (dt === 0) return s;
  const t = s.t + dt;
  const pressure = Math.max(0, s.pressure - deflationRate(s.valve) * dt);
  let deflation = s.deflation;
  if (s.valve > NEARLY_CLOSED && pressure < s.pressure) {
    const last = deflation[deflation.length - 1];
    if (!last) deflation = [{ t: s.t, pressure: s.pressure }, { t, pressure }];
    else if (t - last.t >= SAMPLE_EVERY_S || pressure === 0) deflation = [...deflation, { t, pressure }];
  }
  return { ...s, t, pressure, deflation };
}

/** What the gauge needle reads: real aneroid dials are read to the nearest 2 mmHg. */
export function gaugeReading(pressure: number): number {
  return Math.round(clamp(pressure, 0, MAX_MMHG) / 2) * 2;
}

export type CrossingKind = "sounds_start" | "gap_start" | "gap_end" | "muffle" | "sounds_stop";

export interface Crossing {
  kind: CrossingKind;
  /** pressure at which it happens */
  mmHg: number;
}

type Heard = "silent" | "clear" | "muffled";

/** What a listener hears at cuff pressure P: the phase, silenced by the auscultatory gap. */
function heardAt(pressure: number, p: KorotkoffParams): Heard {
  const phase = korotkoffPhase(pressure, p);
  if (phase === 0 || phase === 5 || inAuscultatoryGap(pressure, p)) return "silent";
  return phase === 4 ? "muffled" : "clear";
}

interface Transition {
  mmHg: number;
  /** "at": the change happens on reaching mmHg (prev > B, next ≤ B); "below": on going below it (prev ≥ B, next < B) */
  edge: "at" | "below";
  above: Heard;
  below: Heard;
}

/** Probe offset around a boundary; far below any meaningful spacing of two boundaries (mmHg). */
const EPS = 1e-6;

/** Every change in what is heard, highest pressure first (at one pressure, "at" before "below"). */
function transitions(p: KorotkoffParams): Transition[] {
  const b = korotkoffBoundaries(p);
  const points = [b.systolic, b.muffleAt, b.diastolic, ...(p.auscultatoryGap ?? [])].filter((x) => Number.isFinite(x));
  const out: Transition[] = [];
  for (const mmHg of [...new Set(points)].sort((x, y) => y - x)) {
    const over = heardAt(mmHg + EPS, p);
    const on = heardAt(mmHg, p);
    const under = heardAt(mmHg - EPS, p);
    if (over !== on) out.push({ mmHg, edge: "at", above: over, below: on });
    if (on !== under) out.push({ mmHg, edge: "below", above: on, below: under });
  }
  return out;
}

/**
 * Events passed while the pressure falls from `prev` to `next` (nothing when it rises), highest
 * pressure first. They follow what is actually heard (korotkoffSound), not the configured edges:
 * - sounds_start: the first sound of this deflation (systolic, or the lower edge of an auscultatory
 *   gap when the gap reaches systolic or the cuff was only inflated into the gap);
 * - gap_start / gap_end: sounds already heard fall silent and come back lower down (callers that
 *   caption these should not reveal a gap before the student has heard it end);
 * - muffle: the sounds turn muffled (phase IV) after clear sounds were heard;
 * - sounds_stop: the last sound (diastolic, or the gap's upper edge when the gap reaches diastolic).
 * `from` is the pressure this deflation started from — pass the cuff's peak when calling frame by
 * frame, so sounds returning below a gap count as gap_end. It defaults to `prev` (one big step).
 * Sounds already audible at `from` (cuff inflated below systolic) produce no sounds_start.
 */
export function crossings(prev: number, next: number, p: KorotkoffParams, from: number = prev): Crossing[] {
  if (!(next < prev)) return [];
  const start = Math.max(from, prev);
  const list = transitions(p);
  const out: Crossing[] = [];
  /** last texture heard in this deflation above the current point */
  let heard: Exclude<Heard, "silent"> | null = null;
  list.forEach((tr, i) => {
    // the stretch just above this point was heard if the deflation reached part of it
    const reached = tr.edge === "at" ? tr.mmHg < start : tr.mmHg <= start;
    const earlier = heard;
    if (tr.above !== "silent" && reached) heard = tr.above;
    const kinds: CrossingKind[] = [];
    if (tr.above === "silent" && tr.below !== "silent") {
      kinds.push(earlier ? "gap_end" : "sounds_start");
      if (tr.below === "muffled" && earlier === "clear") kinds.push("muffle");
    } else if (tr.above !== "silent" && tr.below === "silent") {
      const returns = list.slice(i + 1).some((later) => later.above === "silent" && later.below !== "silent");
      kinds.push(returns ? "gap_start" : "sounds_stop");
    } else if (tr.above === "clear" && tr.below === "muffled") {
      kinds.push("muffle");
    }
    const passed = tr.edge === "at" ? prev > tr.mmHg && next <= tr.mmHg : prev >= tr.mmHg && next < tr.mmHg;
    if (passed) for (const kind of kinds) out.push({ kind, mmHg: tr.mmHg });
  });
  return out;
}

export interface ReadingSummary {
  peak: number;
  deflation: DeflationSample[];
  /** the reference reading (case vitals), or the student's recorded values when not known */
  systolic: number;
  diastolic: number;
}

export interface ReadingQuality {
  /** inflated at least 20 mmHg above systolic before deflating */
  inflatedEnough: boolean;
  /** the deflation went from at or above systolic to at or below diastolic */
  coveredRange: boolean;
  /** the deflation passed systolic or diastolic, so at least one value was read during it */
  measured: boolean;
  /**
   * The fastest local deflation (mmHg/s) where a value is read: the largest drop within any
   * LOCAL_WINDOW_S that contains the moment the cuff passed systolic or diastolic (that drop is the
   * possible error of the reading). 0 if not measured.
   */
  deflationRate: number;
  /** mean rate from systolic + 10 down to diastolic − 10 (or the part covered), pauses included; 0 if not measured */
  averageRate: number;
  /** deflationRate above 4 mmHg/s: the reading is unreliable */
  tooFast: boolean;
  /** averageRate below 1.5 mmHg/s: venous congestion, uncomfortable */
  tooSlow: boolean;
}

export const TOO_FAST_MMHG_S = 4;
export const TOO_SLOW_MMHG_S = 1.5;
/** window for the local deflation rate: about one heartbeat (s) */
export const LOCAL_WINDOW_S = 1;

/**
 * Technique of one deflation, judged where the reading is taken. A quick release with the valve
 * held closed in between (open–wait–open, or toggling Open/Closed) is caught by the local rate even
 * though its average looks textbook; a fast drop to just above systolic before a slow release is fine.
 */
export function readingQuality(summary: ReadingSummary): ReadingQuality {
  const d = summary.deflation;
  const inflatedEnough = summary.peak >= summary.systolic + 20;
  const first = d[0];
  const last = d[d.length - 1];
  const none = { inflatedEnough, coveredRange: false, measured: false, deflationRate: 0, averageRate: 0, tooFast: false, tooSlow: false };
  if (!first || !last || !(last.t > first.t) || !(first.pressure > last.pressure)) return none;
  const passes = (x: number) => first.pressure >= x && last.pressure <= x;
  const passedSys = passes(summary.systolic);
  const passedDia = passes(summary.diastolic);
  if (!passedSys && !passedDia) return none;

  const local = (x: number) => localRate(d, x);
  const deflationRate = Math.max(passedSys ? local(summary.systolic) : 0, passedDia ? local(summary.diastolic) : 0);
  const top = Math.min(summary.systolic + 10, first.pressure);
  const bottom = Math.max(summary.diastolic - 10, last.pressure);
  const dt = timeReaching(d, bottom) - timeReaching(d, top);
  const averageRate = top > bottom && dt > 0 ? (top - bottom) / dt : 0;
  return {
    inflatedEnough,
    coveredRange: passedSys && passedDia,
    measured: true,
    deflationRate,
    averageRate,
    tooFast: deflationRate > TOO_FAST_MMHG_S,
    tooSlow: averageRate > 0 && averageRate < TOO_SLOW_MMHG_S,
  };
}

/** Cuff pressure at time t from the (falling) deflation samples, held flat outside them. */
function pressureAt(d: DeflationSample[], t: number): number {
  let prev: DeflationSample | undefined;
  for (const s of d) {
    if (t <= s.t) {
      if (!prev || s.t <= prev.t) return s.pressure;
      return prev.pressure + ((s.pressure - prev.pressure) * (t - prev.t)) / (s.t - prev.t);
    }
    prev = s;
  }
  return prev?.pressure ?? 0;
}

/** First time the deflation reached pressure x (interpolated); the first sample's time if it started at or below x. */
function timeReaching(d: DeflationSample[], x: number): number {
  let prev: DeflationSample | undefined;
  for (const s of d) {
    if (s.pressure <= x) {
      if (!prev || !(prev.pressure > s.pressure)) return s.t;
      return prev.t + ((prev.pressure - x) * (s.t - prev.t)) / (prev.pressure - s.pressure);
    }
    prev = s;
  }
  return prev?.t ?? 0;
}

/** Largest drop over any LOCAL_WINDOW_S window containing the moment the cuff reached x, in mmHg/s. */
function localRate(d: DeflationSample[], x: number): number {
  const w = LOCAL_WINDOW_S;
  const tx = timeReaching(d, x);
  // the drop over [a, a + w] is piecewise linear in a: its maximum sits at a window edge or a sample
  const starts = [tx - w, tx];
  for (const s of d) starts.push(s.t, s.t - w);
  let best = 0;
  for (const a of starts) {
    if (a < tx - w - 1e-9 || a > tx + 1e-9) continue;
    best = Math.max(best, pressureAt(d, a) - pressureAt(d, a + w));
  }
  return best / w;
}

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Number.isFinite(x) ? x : lo));
}
