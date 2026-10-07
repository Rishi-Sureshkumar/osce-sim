import { describe, expect, it } from "vitest";
import { loadContentFromDisk } from "@/content/loadFromDisk";
import { candidatesFor, placementSound, regionsForTool, sequenceProgress, stepForPlacement, toolFor } from "@/exam3d/tools/toolLogic";
import { landmarkWorld, poseFor } from "@/exam3d/regionAnchors";

const { maneuvers, maneuverById } = loadContentFromDisk();

describe("tool → maneuver resolution", () => {
  it("bell vs diaphragm at the apex picks the matching maneuver", () => {
    expect(candidatesFor(maneuvers, "stethoscope", "bell", "cardiac_mitral").map((m) => m.id)).toEqual(["auscultate_heart_bell"]);
    expect(candidatesFor(maneuvers, "stethoscope", "diaphragm", "cardiac_mitral").map((m) => m.id)).toEqual(["auscultate_heart_diaphragm"]);
  });
  it("a wrong setting still resolves (and is logged with that setting)", () => {
    expect(candidatesFor(maneuvers, "stethoscope", "bell", "lung_post_rl").map((m) => m.id)).toEqual(["auscultate_lungs"]);
  });
  it("hands cover palpation and percussion; tool-specific maneuvers need their tool", () => {
    expect(toolFor(maneuverById.get("pmi_palpation")!)).toBe("hands");
    expect(toolFor(maneuverById.get("chest_percussion")!)).toBe("hands");
    expect(toolFor(maneuverById.get("general_appearance")!)).toBeUndefined();
    expect(regionsForTool(maneuvers, "tuning_fork").sort()).toEqual(["ear_left", "ear_right", "scalp", "toe_great_left", "toe_great_right", "neuro_sensory"].sort());
  });
  it("a reflex hammer on the elbow is ambiguous (biceps/triceps) → the student chooses", () => {
    expect(candidatesFor(maneuvers, "reflex_hammer", undefined, "elbow_right").map((m) => m.id).sort()).toEqual(["reflex_biceps", "reflex_triceps"]);
  });
});

describe("placement sound", () => {
  it("inside the tolerance is full; up to 2× is quieter and band-limited; beyond is muffled", () => {
    expect(placementSound(0.5)).toMatchObject({ attenuation: 1, onTarget: true });
    expect(placementSound(1.5)).toMatchObject({ attenuation: 0.75, onTarget: false });
    expect(placementSound(2.5)).toMatchObject({ attenuation: 0.25, lowpassHz: 350, onTarget: false });
  });
});

describe("Rinne sequence", () => {
  const steps = maneuverById.get("rinne_test")!.steps!;
  it("validates step order", () => {
    expect(sequenceProgress(steps, []).next?.id).toBe("bone");
    expect(sequenceProgress(steps, ["bone"]).next?.id).toBe("signal");
    expect(sequenceProgress(steps, ["bone", "signal", "air"])).toMatchObject({ complete: true, outOfOrder: false });
    expect(sequenceProgress(steps, ["bone", "air"])).toMatchObject({ outOfOrder: true, complete: true });
  });
  it("maps a placement to the nearest landmark step", () => {
    const pose = poseFor("seated", 80);
    const mastoid = landmarkWorld("mastoid", "ear_left", pose)!;
    const canal = landmarkWorld("ear_canal", "ear_left", pose)!;
    const bone = stepForPlacement(steps, "ear_left", mastoid, pose)!;
    expect(bone.id).toBe("bone");
    expect(bone.error).toBeCloseTo(0, 5);
    expect(stepForPlacement(steps, "ear_left", canal, pose)?.id).toBe("air");
  });
});

describe("Weber lateralisation comes from case data", () => {
  it("a case's pan value drives the sound and its caption", async () => {
    const { resolveFinding } = await import("@/engine/resolveFinding");
    const { captionFor } = await import("@/audio/schedule");
    const weber = maneuverById.get("weber_test")!;
    const kase = {
      vitals: { hr: 70, rr: 14, bpSystolic: 120, bpDiastolic: 80, tempC: 37, spo2: 99, spo2Context: "on room air" },
      abnormalFindings: { weber_test: { default: { text: "Lateralises to the right ear.", audio: { generator: "tone" as const, params: { freq: 512, pan: 0.8, decaySec: 8, airBoneRatio: 2 } } } } },
    };
    const r = resolveFinding(kase, weber, "scalp");
    expect(r.findingText).toBe("Lateralises to the right ear.");
    expect(r.audio && captionFor(r.audio)).toContain("louder in the right ear");
    // the normal catalog default is centred
    const normal = resolveFinding({ ...kase, abnormalFindings: {} }, weber, "scalp");
    expect(normal.audio && captionFor(normal.audio)).toContain("equally");
  });
});
