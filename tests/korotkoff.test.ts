import { describe, expect, it } from "vitest";
import { demoDeflation, inAuscultatoryGap, korotkoffBoundaries, korotkoffPhase, korotkoffSchedule, korotkoffSound, pulsePalpable, type KorotkoffParams } from "@/audio/korotkoff";
import { captionFor, cycleTiming } from "@/audio/schedule";

const BP: KorotkoffParams = { systolic: 150, diastolic: 90, muffleMmHg: 6, intensity: 0.7 };

describe("korotkoffBoundaries", () => {
  it("uses the nominal 14/20 mmHg widths when the span is wide (150/90, muffle 6)", () => {
    expect(korotkoffBoundaries(BP)).toEqual({ systolic: 150, phase2At: 136, phase3At: 116, muffleAt: 96, diastolic: 90 });
  });

  it("shrinks phases I and II to 30%/40% of the span below 50 mmHg (120/80, muffle 6)", () => {
    const b = korotkoffBoundaries({ systolic: 120, diastolic: 80, muffleMmHg: 6, intensity: 0.7 });
    expect(b.systolic).toBe(120);
    expect(b.phase2At).toBeCloseTo(109.8, 9);
    expect(b.phase3At).toBeCloseTo(96.2, 9);
    expect(b.muffleAt).toBe(86);
    expect(b.diastolic).toBe(80);
  });

  it("caps phase IV at 40% of a narrow pulse pressure so the first sound is still a clear tap", () => {
    const narrow: KorotkoffParams = { systolic: 100, diastolic: 85, muffleMmHg: 20, intensity: 0.7 };
    const b = korotkoffBoundaries(narrow);
    expect(b.muffleAt).toBeCloseTo(91, 9); // 85 + 0.4 × 15, not 85 + 20 (which would swallow phases I–III)
    expect(korotkoffPhase(100, narrow)).toBe(1);
    expect(korotkoffSound(100, narrow).texture).toBe("tap");
    const seen = new Set<number>();
    for (let p = 100; p > 85; p -= 0.25) seen.add(korotkoffPhase(p, narrow));
    expect([...seen].sort()).toEqual([1, 2, 3, 4]);
  });
});

describe("korotkoffPhase", () => {
  it("places representative pressures for 150/90 (muffle 6) in the right phase", () => {
    const at = (p: number) => korotkoffPhase(p, BP);
    expect(at(160)).toBe(0);
    expect(at(150.5)).toBe(0);
    expect(at(150)).toBe(1);
    expect(at(140)).toBe(1);
    expect(at(135)).toBe(2);
    expect(at(120)).toBe(2);
    expect(at(110)).toBe(3);
    expect(at(97)).toBe(3);
    expect(at(96)).toBe(4);
    expect(at(93)).toBe(4);
    expect(at(90)).toBe(5);
    expect(at(80)).toBe(5);
    expect(at(0)).toBe(5);
  });

  it("phases never go back up as the pressure falls", () => {
    let prev = 0;
    for (let p = 200; p >= 0; p -= 0.5) {
      const ph = korotkoffPhase(p, BP);
      expect(ph).toBeGreaterThanOrEqual(prev);
      prev = ph;
    }
  });

  it("keeps every phase with a narrow pulse pressure", () => {
    const narrow: KorotkoffParams = { systolic: 100, diastolic: 88, muffleMmHg: 4, intensity: 0.7 };
    const b = korotkoffBoundaries(narrow);
    expect(b.systolic).toBeGreaterThan(b.phase2At);
    expect(b.phase2At).toBeGreaterThan(b.phase3At);
    expect(b.phase3At).toBeGreaterThan(b.muffleAt);
    expect(b.muffleAt).toBe(92);
    const seen = new Set<number>();
    for (let p = 110; p >= 80; p -= 0.25) seen.add(korotkoffPhase(p, narrow));
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("with no muffle margin phase IV is skipped", () => {
    const p = { ...BP, muffleMmHg: 0 };
    expect(korotkoffPhase(91, p)).toBe(3);
    expect(korotkoffPhase(90, p)).toBe(5);
  });
});

describe("korotkoffSound", () => {
  it("is silent above systolic and at/below diastolic", () => {
    for (const p of [200, 151, 90, 70]) {
      const s = korotkoffSound(p, BP);
      expect(s.audible).toBe(false);
      expect(s.gain).toBe(0);
    }
  });

  it("phase I grows louder from the first tap, and late phase I is louder than phase II", () => {
    const first = korotkoffSound(150, BP);
    const late = korotkoffSound(137, BP);
    expect(first.phase).toBe(1);
    expect(late.phase).toBe(1);
    expect(first.gain).toBeGreaterThan(0);
    expect(first.gain).toBeLessThan(late.gain);
    expect(late.gain).toBeGreaterThan(korotkoffSound(125, BP).gain);
  });

  it("phase III is louder than II, phase IV quieter and lower-pitched (muffled)", () => {
    const ii = korotkoffSound(125, BP);
    const iii = korotkoffSound(105, BP);
    const iv = korotkoffSound(93, BP);
    expect(iii.gain).toBeGreaterThan(ii.gain);
    expect(iv.gain).toBeLessThan(iii.gain);
    expect(iv.freq).toBeLessThan(iii.freq);
    expect(iv.texture).toBe("muffled");
    expect(ii.texture).toBe("swish");
  });

  it("scales with intensity", () => {
    const loud = korotkoffSound(105, { ...BP, intensity: 1 });
    const soft = korotkoffSound(105, { ...BP, intensity: 0.25 });
    expect(soft.gain).toBeCloseTo(loud.gain * 0.25, 6);
    expect(korotkoffSound(105, { ...BP, intensity: 0 }).audible).toBe(false);
  });

  it("an auscultatory gap is silent (either order) and sounds return below it", () => {
    const gap: KorotkoffParams = { ...BP, auscultatoryGap: [125, 140] };
    const reversed: KorotkoffParams = { ...BP, auscultatoryGap: [140, 125] };
    expect(korotkoffSound(145, gap).audible).toBe(true);
    for (const p of [140, 133, 125]) {
      expect(korotkoffSound(p, gap)).toMatchObject({ audible: false, gain: 0, gap: true });
      expect(korotkoffSound(p, reversed).audible).toBe(false);
      expect(inAuscultatoryGap(p, reversed)).toBe(true);
    }
    expect(korotkoffSound(124, gap).audible).toBe(true);
    expect(korotkoffPhase(133, gap)).toBe(2); // the phase is still known; only the sound is missing
  });

  it("a gap edge is inclusive, also when it sits exactly on systolic", () => {
    const atSystolic: KorotkoffParams = { ...BP, auscultatoryGap: [150, 140] };
    expect(korotkoffSound(150, atSystolic)).toMatchObject({ audible: false, phase: 1, gap: true });
    expect(korotkoffSound(140, atSystolic).audible).toBe(false);
    expect(korotkoffSound(139.5, atSystolic).audible).toBe(true);
  });
});

describe("korotkoffSchedule", () => {
  it("gives one tap per heartbeat only while audible", () => {
    const hr = 60;
    // deflating at 3 mmHg/s from 170: audible from 150 (t = 6.67 s) to just above 90 (t = 26.67 s)
    const pressureAt = (t: number) => 170 - 3 * t;
    const ev = korotkoffSchedule(BP, hr, pressureAt, 40);
    const { period } = cycleTiming(hr);
    expect(ev.length).toBeGreaterThan(0);
    for (const e of ev) {
      expect(e.gain).toBeGreaterThan(0);
      expect(e.pressure).toBeLessThanOrEqual(150);
      expect(e.pressure).toBeGreaterThan(90);
      expect(Math.abs(e.t / period - Math.round(e.t / period))).toBeLessThan(1e-9);
    }
    for (let i = 1; i < ev.length; i++) expect(ev[i]!.t - ev[i - 1]!.t).toBeCloseTo(period, 9);
    // beats at t = 7 … 26 s → 20 taps
    expect(ev.length).toBe(20);
    expect(ev[0]!.t).toBe(7);
    expect(ev.at(-1)!.t).toBe(26);
    expect(ev[0]!.phase).toBe(1);
    expect(ev.at(-1)!.phase).toBe(4);
  });

  it("follows the heart rate and leaves a hole for the gap", () => {
    const flat = korotkoffSchedule(BP, 120, () => 110, 5);
    expect(flat.length).toBe(10);
    const gap = korotkoffSchedule({ ...BP, auscultatoryGap: [140, 125] }, 60, (t) => 170 - 3 * t, 40);
    expect(gap.some((e) => e.pressure <= 140 && e.pressure >= 125)).toBe(false);
    expect(gap.some((e) => e.pressure > 140)).toBe(true);
    expect(gap.some((e) => e.pressure < 125)).toBe(true);
  });

  it("is silent when the cuff stays above systolic", () => {
    expect(korotkoffSchedule(BP, 80, () => 180, 10)).toEqual([]);
  });

  it("the demo deflation covers the whole audible range", () => {
    const d = demoDeflation(BP, 2.5);
    expect(d.pressureAt(0)).toBe(170);
    expect(d.pressureAt(d.seconds)).toBeCloseTo(80, 6);
    const ev = korotkoffSchedule(BP, 75, d.pressureAt, d.seconds);
    expect(new Set(ev.map((e) => e.phase))).toEqual(new Set([1, 2, 3, 4]));
  });

  it("captions the generator", () => {
    expect(captionFor({ generator: "korotkoff", params: { systolic: 150, diastolic: 90, muffleMmHg: 6, intensity: 0.7 } })).toBe("Korotkoff sounds");
  });
});

describe("pulsePalpable", () => {
  it("is felt only below systolic", () => {
    expect(pulsePalpable(160, 150)).toBe(false);
    expect(pulsePalpable(150, 150)).toBe(false);
    expect(pulsePalpable(149, 150)).toBe(true);
    expect(pulsePalpable(0, 150)).toBe(true);
    expect(pulsePalpable(Number.NaN, 150)).toBe(false);
  });
});
