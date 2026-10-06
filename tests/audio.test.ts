import { describe, expect, it } from "vitest";
import { breathSchedule, captionFor, cycleTiming, heartSchedule, toneEnvelope } from "@/audio/schedule";

describe("heart schedule", () => {
  it("follows the heart rate", () => {
    const ev = heartSchedule({ intensity: 0.8, s2SplitMs: 0 }, 60, 5);
    expect(ev.filter((e) => e.kind === "S1").map((e) => e.t)).toEqual([0, 1, 2, 3, 4]);
    const fast = heartSchedule({ intensity: 0.8, s2SplitMs: 0 }, 104, 3);
    const s1 = fast.filter((e) => e.kind === "S1").map((e) => e.t);
    expect(s1[1]! - s1[0]!).toBeCloseTo(60 / 104, 5);
  });
  it("puts an S3 in early diastole after S2 and an S4 just before S1", () => {
    const ev = heartSchedule({ s3: 0.9, s4: 0.5, intensity: 0.8, s2SplitMs: 0 }, 104, 2);
    const s2 = ev.find((e) => e.kind === "S2")!;
    const s3 = ev.find((e) => e.kind === "S3")!;
    const { diastole } = cycleTiming(104);
    expect(s3.t - s2.t).toBeGreaterThan(0.08);
    expect(s3.t - s2.t).toBeLessThan(diastole / 2);
    const s1b = ev.filter((e) => e.kind === "S1")[1]!;
    const s4 = ev.filter((e) => e.kind === "S4").find((e) => e.t < s1b.t && e.t > s3.t)!;
    expect(s1b.t - s4.t).toBeCloseTo(0.09, 5);
  });
  it("a holosystolic murmur fills systole; loudness rises with grade", () => {
    const g2 = heartSchedule({ murmur: { phase: "systolic", shape: "holosystolic", grade: 2, pitch: "high" }, intensity: 0.8, s2SplitMs: 0 }, 60, 1);
    const g5 = heartSchedule({ murmur: { phase: "systolic", shape: "holosystolic", grade: 5, pitch: "high" }, intensity: 0.8, s2SplitMs: 0 }, 60, 1);
    const m2 = g2.find((e) => e.kind === "murmur")!;
    const s2 = g2.find((e) => e.kind === "S2")!;
    expect(m2.t).toBeGreaterThan(0);
    expect(m2.t + m2.dur).toBeLessThanOrEqual(s2.t);
    expect(g5.find((e) => e.kind === "murmur")!.gain).toBeGreaterThan(m2.gain);
  });
  it("splits S2 when asked", () => {
    const ev = heartSchedule({ s2SplitMs: 40, intensity: 0.8 }, 60, 1);
    const a2 = ev.find((e) => e.kind === "A2")!;
    const p2 = ev.find((e) => e.kind === "P2")!;
    expect(p2.t - a2.t).toBeCloseTo(0.04, 5);
  });
});

describe("breath schedule", () => {
  it("follows the respiratory rate; vesicular expiration is softer", () => {
    const s = breathSchedule({ type: "vesicular", cracklesDensity: 0.5, wheeze: false, intensity: 0.7 }, 24, 5);
    const insp = s.phases.filter((p) => p.kind === "inspiration");
    expect(insp[1]!.t - insp[0]!.t).toBeCloseTo(2.5, 5);
    const exp = s.phases.find((p) => p.kind === "expiration")!;
    expect(exp.gain).toBeLessThan(insp[0]!.gain);
  });
  it("fine crackles sit in late inspiration; density scales the count", () => {
    const dense = breathSchedule({ type: "vesicular", crackles: "fine", cracklesDensity: 1, wheeze: false, intensity: 0.7 }, 20, 3);
    const sparse = breathSchedule({ type: "vesicular", crackles: "fine", cracklesDensity: 0.2, wheeze: false, intensity: 0.7 }, 20, 3);
    expect(dense.crackles.length).toBeGreaterThan(sparse.crackles.length);
    const insp = dense.phases[0]!;
    for (const c of dense.crackles.filter((c) => c.t < insp.t + insp.dur)) expect(c.t).toBeGreaterThanOrEqual(insp.t + insp.dur * 0.45);
  });
  it("reduced breath sounds are quieter; absent are silent", () => {
    const red = breathSchedule({ type: "reduced", cracklesDensity: 0.5, wheeze: false, intensity: 0.7 }, 20, 3);
    const abs = breathSchedule({ type: "absent", cracklesDensity: 0.5, wheeze: false, intensity: 0.7 }, 20, 3);
    expect(red.phases[0]!.gain).toBeCloseTo(0.21, 5);
    expect(abs.phases[0]!.gain).toBe(0);
  });
  it("wheeze is expiratory", () => {
    const s = breathSchedule({ type: "vesicular", cracklesDensity: 0.5, wheeze: true, intensity: 0.7 }, 20, 3);
    const exp = s.phases.find((p) => p.kind === "expiration")!;
    expect(s.wheezes[0]!.t).toBeGreaterThanOrEqual(exp.t - 1e-9);
  });
});

describe("tuning fork", () => {
  it("Rinne: normal air conduction lasts about twice bone conduction", () => {
    const t = toneEnvelope({ freq: 512, pan: 0, decaySec: 9, airBoneRatio: 2 });
    expect(t.boneSec).toBeCloseTo(3, 5);
    expect(t.airSec).toBeCloseTo(6, 5);
  });
  it("captions describe Weber lateralisation from the pan sign", () => {
    expect(captionFor({ generator: "tone", params: { freq: 512, pan: 0.7, decaySec: 8, airBoneRatio: 2 } })).toContain("right ear");
    expect(captionFor({ generator: "tone", params: { freq: 512, pan: -0.7, decaySec: 8, airBoneRatio: 2 } })).toContain("left ear");
    expect(captionFor({ generator: "tone", params: { freq: 512, pan: 0, decaySec: 8, airBoneRatio: 2 } })).toContain("equally");
  });
  it("captions name the heart and lung sounds in the spec", () => {
    expect(captionFor({ generator: "heart", params: { s3: 0.9, intensity: 0.8, s2SplitMs: 0 } })).toBe("Heart sounds: S1, S2, S3 (loud)");
    expect(captionFor({ generator: "breath", params: { type: "reduced", crackles: "fine", cracklesDensity: 0.5, wheeze: false, intensity: 0.7 } })).toBe("Reduced breath sounds, fine crackles");
  });
});
