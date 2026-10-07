import { describe, expect, it } from "vitest";
import { backgroundKind, contactOutcome, contactSound, recordsFinding } from "@/exam3d/tools/contact";
import { anchorWorldPoints, poseFor, snapToAnchor } from "@/exam3d/regionAnchors";
import { regionsForTool } from "@/exam3d/tools/toolLogic";
import { loadContentFromDisk } from "@/content/loadFromDisk";

describe("hidden-anchor tolerance bands", () => {
  it("inside the tolerance is a finding; up to 2× is near; beyond is background on the torso, nothing elsewhere", () => {
    expect(contactOutcome(1.5, 2.5, "cardiac_mitral")).toBe("finding");
    expect(contactOutcome(2.5, 2.5, "cardiac_mitral")).toBe("finding");
    expect(contactOutcome(4, 2.5, "cardiac_mitral")).toBe("near");
    expect(contactOutcome(5.1, 2.5, "cardiac_mitral")).toBe("background");
    expect(contactOutcome(9, 4, "lung_post_rl")).toBe("background");
    expect(contactOutcome(9, 3.5, "knee_left")).toBe("nothing");
  });

  it("near placements are quieter and more muffled the further they are; background is faint", () => {
    const edge = contactSound("near", 2.6, 2.5)!;
    const far = contactSound("near", 4.9, 2.5)!;
    expect(edge.attenuation).toBeGreaterThan(far.attenuation);
    expect(edge.lowpassHz).toBeGreaterThan(far.lowpassHz);
    expect(contactSound("finding", 0, 2.5)).toEqual({ attenuation: 1, lowpassHz: 8000 });
    expect(contactSound("background", 8, 2)!.attenuation).toBeLessThan(0.5);
    expect(contactSound("nothing", 20, 2)).toBeNull();
    expect(backgroundKind("cardiac_aortic")).toBe("heart");
    expect(backgroundKind("lung_post_ll")).toBe("breath");
  });

  it("a stethoscope records a finding only after 3 s inside the tolerance", () => {
    expect(recordsFinding("finding", 3200, "stethoscope")).toBe(true);
    expect(recordsFinding("finding", 2000, "stethoscope")).toBe(false);
    expect(recordsFinding("near", 9000, "stethoscope")).toBe(false);
    expect(recordsFinding("finding", 0, "reflex_hammer")).toBe(true);
  });

  it("definition of done: 4 cm off the apex in left lateral decubitus gives no S3 finding and an attenuated sound", () => {
    const pose = poseFor("left_lateral_decubitus", 0);
    const apex = anchorWorldPoints("cardiac_mitral", pose)[0]!;
    // 4 cm toward the patient's head along the table, with every stethoscope region in play
    const bellRegions = regionsForTool(loadContentFromDisk().maneuvers, "stethoscope");
    const s = snapToAnchor([apex[0], apex[1], apex[2] - 0.04], bellRegions, pose)!;
    expect(s.regionId).toBe("cardiac_mitral");
    expect(s.distanceCm).toBeCloseTo(4, 2);
    const outcome = contactOutcome(s.distanceCm, s.toleranceCm, s.regionId);
    expect(outcome).toBe("near");
    expect(recordsFinding(outcome, 10_000, "stethoscope")).toBe(false);
    const sound = contactSound(outcome, s.distanceCm, s.toleranceCm)!;
    expect(sound.attenuation).toBeLessThan(1);
    expect(sound.lowpassHz).toBeLessThan(8000);
  });

  it("a placement near the apex resolves to the apex, not the broader breast zone around it", () => {
    const pose = poseFor("reclined_30", 30);
    const apex = anchorWorldPoints("cardiac_mitral", pose)[0]!;
    const s = snapToAnchor([apex[0], apex[1] + 0.012, apex[2]], ["cardiac_mitral", "breast_left"], pose)!;
    expect(s.regionId).toBe("cardiac_mitral");
  });
});
