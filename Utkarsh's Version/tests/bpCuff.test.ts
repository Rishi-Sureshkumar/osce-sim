import { describe, expect, it } from "vitest";
import type { KorotkoffParams } from "@/audio/korotkoff";
import { createCuff, crossings, deflationRate, gaugeReading, readingQuality, setValve, squeeze, tick, TOO_FAST_MMHG_S, VALVE, type CuffState } from "@/exam3d/tools/bpCuff";

const BP: KorotkoffParams = { systolic: 150, diastolic: 90, muffleMmHg: 6, intensity: 0.7 };
const FRAME = 1 / 60;

function pumpTo(target: number, s: CuffState = createCuff()): CuffState {
  let c = s;
  while (c.pressure < target) c = squeeze(c);
  return c;
}
function run(s: CuffState, seconds: number, dt = FRAME): CuffState {
  let c = s;
  for (let t = 0; t < seconds - 1e-9; t += dt) c = tick(c, dt);
  return c;
}
/** Deflate with the valve at `valve` until the pressure reaches `until`, collecting crossings frame by frame. */
function deflate(s: CuffState, valve: number, until: number, bp: KorotkoffParams = BP) {
  let c = setValve(s, valve);
  const events: string[] = [];
  while (c.pressure > until) {
    const next = tick(c, FRAME);
    events.push(...crossings(c.pressure, next.pressure, bp, c.peak).map((e) => e.kind));
    c = next;
  }
  return { cuff: c, events };
}
/** Run with the valve at `valve` for `seconds`. */
const hold = (s: CuffState, valve: number, seconds: number) => run(setValve(s, valve), seconds);
const judge = (c: CuffState) => readingQuality({ ...c, systolic: 150, diastolic: 90 });

describe("bulb", () => {
  it("one squeeze adds 10–15 mmHg, a little less at high pressure", () => {
    const one = squeeze(createCuff());
    expect(one.pressure).toBeGreaterThanOrEqual(10);
    expect(one.pressure).toBeLessThanOrEqual(15);
    const high = { ...createCuff(), pressure: 250, peak: 250 };
    const inc = squeeze(high).pressure - 250;
    expect(inc).toBeGreaterThanOrEqual(10);
    expect(inc).toBeLessThan(one.pressure);
    expect(one.peak).toBe(one.pressure);
  });

  it("is capped at 300 mmHg", () => {
    let c = createCuff();
    for (let i = 0; i < 60; i++) c = squeeze(c);
    expect(c.pressure).toBe(300);
    expect(c.peak).toBe(300);
  });

  it("adds much less with the valve open", () => {
    const closed = squeeze(createCuff()).pressure;
    const slow = squeeze(setValve(createCuff(), VALVE.slow)).pressure;
    const open = squeeze(setValve(createCuff(), VALVE.open)).pressure;
    expect(slow).toBeLessThan(closed);
    expect(open).toBeLessThan(1);
  });
});

describe("valve and leak", () => {
  it("a closed valve leaks slowly (0.02–0.1 mmHg/s, within the 4 mmHg/min a sphygmomanometer may lose)", () => {
    const c = pumpTo(180);
    const after = run(c, 10);
    const rate = (c.pressure - after.pressure) / 10;
    expect(rate).toBeGreaterThanOrEqual(0.02);
    expect(rate).toBeLessThanOrEqual(0.1);
    expect(c.pressure - run(c, 30).pressure).toBeLessThan(2); // palpating for 30 s barely moves the needle
    expect(after.deflation).toEqual([]); // a leak is not a deliberate deflation
  });

  it("the slow setting releases 2–3 mmHg/s", () => {
    expect(deflationRate(VALVE.slow)).toBeCloseTo(2.5, 6);
    const c = setValve(pumpTo(180), VALVE.slow);
    const after = run(c, 10);
    const rate = (c.pressure - after.pressure) / 10;
    expect(rate).toBeGreaterThanOrEqual(2);
    expect(rate).toBeLessThanOrEqual(3);
  });

  it("fully open dumps 30–50 mmHg/s and never goes below 0", () => {
    const c = setValve(pumpTo(200), VALVE.open);
    const half = run(c, 1);
    const rate = c.pressure - half.pressure;
    expect(rate).toBeGreaterThanOrEqual(30);
    expect(rate).toBeLessThanOrEqual(50);
    const empty = run(c, 20);
    expect(empty.pressure).toBe(0);
    expect(tick(empty, 1).pressure).toBe(0);
  });

  it("ignores zero or invalid time steps", () => {
    const c = pumpTo(100);
    expect(tick(c, 0)).toBe(c);
    expect(tick(c, Number.NaN)).toBe(c);
    expect(tick(c, -1)).toBe(c);
  });

  it("pumping again after letting air out starts a new attempt", () => {
    let c = setValve(pumpTo(200), VALVE.slow);
    c = run(c, 5);
    expect(c.deflation.length).toBeGreaterThan(0);
    c = squeeze(setValve(c, VALVE.closed));
    expect(c.deflation).toEqual([]);
    expect(c.peak).toBe(c.pressure);
  });

  it("the gauge reads to the nearest 2 mmHg", () => {
    expect(gaugeReading(143.2)).toBe(144);
    expect(gaugeReading(142.9)).toBe(142);
    expect(gaugeReading(-3)).toBe(0);
    expect(gaugeReading(400)).toBe(300);
  });
});

describe("crossings", () => {
  it("fire in order while deflating through the reading", () => {
    const { events } = deflate(pumpTo(180), VALVE.slow, 60);
    expect(events).toEqual(["sounds_start", "muffle", "sounds_stop"]);
  });

  it("include the auscultatory gap and work even in one big step", () => {
    const gapBp: KorotkoffParams = { ...BP, auscultatoryGap: [125, 140] };
    const all = crossings(200, 0, gapBp);
    expect(all.map((e) => e.kind)).toEqual(["sounds_start", "gap_start", "gap_end", "muffle", "sounds_stop"]);
    expect(all.map((e) => e.mmHg)).toEqual([150, 140, 125, 96, 90]);
  });

  it("nothing while the pressure rises or holds", () => {
    expect(crossings(80, 200, BP)).toEqual([]);
    expect(crossings(150, 150, BP)).toEqual([]);
  });

  it("a boundary is passed once, at the step that reaches it", () => {
    expect(crossings(151, 150, BP).map((e) => e.kind)).toEqual(["sounds_start"]);
    expect(crossings(150, 149, BP)).toEqual([]);
    expect(crossings(90.5, 90, BP).map((e) => e.kind)).toEqual(["sounds_stop"]);
  });

  it("frame by frame with the peak as `from`, sounds returning below a gap are gap_end", () => {
    const gapBp: KorotkoffParams = { ...BP, auscultatoryGap: [125, 140] };
    const { events } = deflate(pumpTo(180), VALVE.slow, 60, gapBp);
    expect(events).toEqual(["sounds_start", "gap_start", "gap_end", "muffle", "sounds_stop"]);
  });

  it("inflated only into the gap: the first sound heard is sounds_start at the gap's lower edge", () => {
    const gapBp: KorotkoffParams = { ...BP, auscultatoryGap: [125, 140] };
    expect(crossings(135, 0, gapBp)).toEqual([
      { kind: "sounds_start", mmHg: 125 },
      { kind: "muffle", mmHg: 96 },
      { kind: "sounds_stop", mmHg: 90 },
    ]);
    // frame by frame from a peak inside the gap: no gap event can leak out
    const c = { ...createCuff(), pressure: 135, peak: 135 };
    expect(deflate(c, VALVE.slow, 60, gapBp).events).toEqual(["sounds_start", "muffle", "sounds_stop"]);
  });

  it("a gap overlapping systolic: sounds start where the first tap is heard, below the gap", () => {
    const gapBp: KorotkoffParams = { ...BP, auscultatoryGap: [140, 160] };
    const all = crossings(200, 0, gapBp);
    expect(all).toEqual([
      { kind: "sounds_start", mmHg: 140 },
      { kind: "muffle", mmHg: 96 },
      { kind: "sounds_stop", mmHg: 90 },
    ]);
    expect(crossings(150.5, 149.5, gapBp)).toEqual([]); // passing systolic inside the gap is silent
    expect(crossings(140, 139.9, gapBp).map((e) => e.kind)).toEqual(["sounds_start"]);
  });

  it("a gap reaching diastolic: sounds stop at the gap's upper edge, no muffle or return", () => {
    const gapBp: KorotkoffParams = { ...BP, auscultatoryGap: [85, 100] };
    expect(crossings(200, 0, gapBp)).toEqual([
      { kind: "sounds_start", mmHg: 150 },
      { kind: "sounds_stop", mmHg: 100 },
    ]);
    expect(crossings(97, 96, gapBp)).toEqual([]);
    expect(crossings(90.5, 90, gapBp, 180)).toEqual([]);
    expect(crossings(90, 89, gapBp, 180)).toEqual([]);
    expect(deflate(pumpTo(180), VALVE.slow, 60, gapBp).events).toEqual(["sounds_start", "sounds_stop"]);
  });

  it("cuff inflated below systolic: sounds are audible from the start, so no sounds_start", () => {
    expect(crossings(140, 0, BP).map((e) => e.kind)).toEqual(["muffle", "sounds_stop"]);
  });
});

describe("readingQuality", () => {
  it("a textbook run: inflated 30 above systolic, slow release", () => {
    const { cuff } = deflate(pumpTo(180), VALVE.slow, 60);
    const q = readingQuality({ ...cuff, systolic: 150, diastolic: 90 });
    expect(q.inflatedEnough).toBe(true);
    expect(q.measured).toBe(true);
    expect(q.deflationRate).toBeGreaterThan(2);
    expect(q.deflationRate).toBeLessThan(3);
    expect(q.tooFast).toBe(false);
    expect(q.tooSlow).toBe(false);
  });

  it("flags too little inflation", () => {
    const { cuff } = deflate(pumpTo(155), VALVE.slow, 60);
    const q = readingQuality({ ...cuff, systolic: 150, diastolic: 90 });
    expect(cuff.peak).toBeLessThan(170);
    expect(q.inflatedEnough).toBe(false);
  });

  it("flags dumping the cuff as too fast", () => {
    const { cuff } = deflate(pumpTo(180), VALVE.open, 0);
    const q = readingQuality({ ...cuff, systolic: 150, diastolic: 90 });
    expect(q.deflationRate).toBeGreaterThan(4);
    expect(q.tooFast).toBe(true);
    expect(q.tooSlow).toBe(false);
  });

  it("flags a crawl (opening and closing the valve) as too slow", () => {
    let c = setValve(pumpTo(180), VALVE.slow);
    while (c.pressure > 70) {
      c = run(setValve(c, VALVE.slow), 0.5);
      c = run(setValve(c, VALVE.closed), 1);
    }
    const q = judge(c);
    expect(q.averageRate).toBeLessThan(1.5);
    expect(q.deflationRate).toBeLessThanOrEqual(2.6);
    expect(q.tooSlow).toBe(true);
    expect(q.tooFast).toBe(false);
  });

  it("regression: open fast through systolic, wait with the valve closed, open fast through diastolic", () => {
    let c = pumpTo(180);
    c = deflate(c, VALVE.open, 120).cuff;
    c = hold(c, VALVE.closed, 20);
    c = deflate(c, VALVE.open, 60).cuff;
    const q = judge(c);
    expect(q.averageRate).toBeGreaterThan(1.5); // the old whole-band average (≈ 3.5) looked textbook
    expect(q.averageRate).toBeLessThan(4);
    expect(q.deflationRate).toBeGreaterThan(30);
    expect(q.tooFast).toBe(true);
    expect(q.coveredRange).toBe(true);
  });

  it("regression: toggling Open 0.4 s / Closed 4 s (≈ 16 mmHg per step) is too fast", () => {
    let c = pumpTo(180);
    while (c.pressure > 70) {
      c = hold(c, VALVE.open, 0.4);
      c = hold(c, VALVE.closed, 4);
    }
    const q = judge(c);
    expect(q.averageRate).toBeGreaterThan(1.5);
    expect(q.averageRate).toBeLessThan(4);
    expect(q.deflationRate).toBeGreaterThan(TOO_FAST_MMHG_S);
    expect(q.tooFast).toBe(true);
  });

  it("regression: a slow approach, a pause just above systolic, then dumping the cuff is too fast", () => {
    let c = deflate(pumpTo(180), VALVE.slow, 152).cuff;
    c = hold(c, VALVE.closed, 20);
    c = deflate(c, VALVE.open, 60).cuff;
    const q = judge(c);
    expect(q.tooFast).toBe(true);
    expect(q.deflationRate).toBeGreaterThan(30);
  });

  it("a quick drop to just above systolic before a slow release is fine", () => {
    let c = deflate(pumpTo(200), VALVE.open, 158).cuff;
    c = deflate(c, VALVE.slow, 70).cuff;
    const q = judge(c);
    expect(q.deflationRate).toBeCloseTo(2.5, 1);
    expect(q.tooFast).toBe(false);
    expect(q.tooSlow).toBe(false);
    expect(q.coveredRange).toBe(true);
  });

  it("a deflation that never reached systolic is not a measurement", () => {
    let c = deflate(pumpTo(200), VALVE.slow, 165).cuff;
    c = hold(c, VALVE.closed, 5);
    const q = judge(c);
    expect(c.deflation.length).toBeGreaterThan(2);
    expect(q).toMatchObject({ measured: false, coveredRange: false, deflationRate: 0, averageRate: 0, tooFast: false, tooSlow: false, inflatedEnough: true });
    // one frame of slow release (two samples) is not a measurement either
    const blip = hold(hold(pumpTo(200), VALVE.slow, FRAME), VALVE.closed, 1);
    expect(blip.deflation.length).toBe(2);
    expect(judge(blip)).toMatchObject({ measured: false, deflationRate: 0 });
    // and neither is a cuff that was never let down
    expect(judge(pumpTo(180))).toMatchObject({ measured: false, deflationRate: 0, tooFast: false, tooSlow: false, inflatedEnough: true });
  });

  it("coveredRange: true across the whole band, false when the deflation stops between the values", () => {
    const whole = judge(deflate(pumpTo(180), VALVE.slow, 80).cuff);
    expect(whole).toMatchObject({ measured: true, coveredRange: true });
    const half = judge(hold(deflate(pumpTo(180), VALVE.slow, 120).cuff, VALVE.closed, 2));
    expect(half).toMatchObject({ measured: true, coveredRange: false, tooFast: false });
    expect(half.deflationRate).toBeCloseTo(2.5, 1);
    // inflated below systolic, let down through diastolic only
    const low = judge(deflate(pumpTo(140), VALVE.slow, 80).cuff);
    expect(low).toMatchObject({ measured: true, coveredRange: false, inflatedEnough: false });
  });
});
