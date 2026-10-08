/**
 * Bug 2 (Phase 4 M2): the mastoid was not detected. Its landmark sat ~5 cm behind the ear canal
 * (on the back of the head), under the hair cap, so the Rinne bone-conduction step and the
 * post-auricular nodes could not be found where a clinician puts them. Now:
 *  - the mastoid is 1.2–3.2 cm from the ear canal, behind and below it, in every position;
 *  - the skin over it is bare (no hair cap), and a click that meets hair is measured on the scalp
 *    beneath it;
 *  - the Rinne fork placed on the mastoid records the bone step, and beside the canal the air step;
 *  - the ear views look at the side of the head (ear and mastoid), not at the back of it.
 */
import { describe, expect, it } from "vitest";
import { POSITION_ANGLE } from "@/engine/patientState";
import { loadContentFromDisk } from "@/content/loadFromDisk";
import { distance, landmarkWorld, poseFor } from "@/exam3d/regionAnchors";
import { resolveHit } from "@/exam3d/hit";
import { decidePlacement } from "@/exam3d/tools/decide";
import { regionsForTool } from "@/exam3d/tools/toolLogic";
import { PATIENT_VARIANTS } from "@/scene/patientRig.generated";
import { dirToWorld, type Vec3 } from "@/scene/rig";
import { shotCamera } from "@/scene/shots";
import type { Position } from "@/domain/schemas";
import { loadPatient } from "../../scripts/qa/lib/patientMesh";

const maneuvers = loadContentFromDisk().maneuvers;
const forkRegions = regionsForTool(maneuvers, "tuning_fork");
const POSITIONS: Position[] = ["supine", "reclined_30", "reclined_45", "seated", "sitting_dangling", "left_lateral_decubitus"];
const SIDES = [
  { side: "left", lr: "l", region: "ear_left" },
  { side: "right", lr: "r", region: "ear_right" },
] as const;

describe("bug 2: the mastoid is behind and below the ear canal, bare and findable", () => {
  for (const variant of ["male", "female"] as const) {
    it(`${variant}: mastoid 1.2–3.2 cm from the ear canal, behind and below it, in every position`, () => {
      const lm = PATIENT_VARIANTS[variant].landmarks;
      for (const { lr } of SIDES) {
        const m = lm[`mastoid_${lr}`]!.point;
        const c = lm[`ear_canal_${lr}`]!.point;
        expect(m[1], `${lr} below the canal (bind y)`).toBeLessThan(c[1] - 0.005);
        expect(m[2], `${lr} behind the canal (bind z)`).toBeLessThan(c[2] - 0.008);
      }
      for (const position of POSITIONS) {
        const pose = poseFor(position, POSITION_ANGLE[position], variant);
        for (const { region } of SIDES) {
          const cm = distance(landmarkWorld("mastoid", region, pose)!, landmarkWorld("ear_canal", region, pose)!) * 100;
          expect(cm, `${position} ${region}`).toBeGreaterThan(1.2);
          expect(cm, `${position} ${region}`).toBeLessThan(3.2);
        }
      }
    });

    it(`${variant}: no hair over the mastoid`, async () => {
      const hair = (await loadPatient(variant)).find((m) => m.name === "hair")!;
      for (const { lr } of SIDES) {
        const m = PATIENT_VARIANTS[variant].landmarks[`mastoid_${lr}`]!.point;
        let nearest = Infinity;
        for (let i = 0; i < hair.positions.length; i += 3) nearest = Math.min(nearest, Math.hypot(hair.positions[i]! - m[0], hair.positions[i + 1]! - m[1], hair.positions[i + 2]! - m[2]));
        expect(nearest * 100, `${lr}: nearest hair (cm)`).toBeGreaterThan(1.2);
      }
    });

    it(`${variant}: the Rinne fork on the mastoid records the bone step; beside the canal, the air step`, () => {
      const pose = poseFor("seated", POSITION_ANGLE.seated, variant);
      for (const { region } of SIDES) {
        const onMastoid = decidePlacement({ point: landmarkWorld("mastoid", region, pose)!, tool: "tuning_fork", mode: "512", maneuvers, toolRegions: forkRegions, pose })!;
        expect(onMastoid.regionId).toBe(region);
        expect(onMastoid.maneuverId).toBe("rinne_test");
        expect(onMastoid.stepId).toBe("bone");
        expect(onMastoid.outcome).toBe("finding");
        const atCanal = decidePlacement({ point: landmarkWorld("ear_canal", region, pose)!, tool: "tuning_fork", mode: "512", maneuvers, toolRegions: forkRegions, pose })!;
        expect(atCanal.stepId).toBe("air");
      }
    });

    it(`${variant}: each ear view looks at the side of the head`, () => {
      const pose = poseFor("supine", 0, variant);
      for (const { side, lr } of SIDES) {
        const cam = shotCamera(`ear_${side}`, pose);
        const canal = landmarkWorld("ear_canal", `ear_${side}`, pose)!;
        const toCam: Vec3 = [cam.position[0] - canal[0], cam.position[1] - canal[1], cam.position[2] - canal[2]];
        const lateral = dirToWorld([lr === "l" ? 1 : -1, 0, 0], "head", pose);
        const cos = (toCam[0] * lateral[0] + toCam[1] * lateral[1] + toCam[2] * lateral[2]) / Math.hypot(...toCam);
        expect(Math.acos(cos) * (180 / Math.PI), `ear_${side}: angle from the head's lateral axis`).toBeLessThan(30);
      }
    });
  }

  it("a click that meets hair is measured on the scalp beneath it", () => {
    const pose = poseFor("seated", POSITION_ANGLE.seated, "male");
    const m = landmarkWorld("mastoid", "ear_right", pose)!;
    const h = resolveHit(
      [
        { kind: "hair", point: [m[0] - 0.004, m[1], m[2]], normal: [-1, 0, 0] },
        { kind: "body", point: m, normal: [-1, 0, 0] },
      ],
      ["ear_right", "ln_post_auricular", "scalp"],
      pose,
    )!;
    expect(h.kind).toBe("body");
    expect(distance(h.point, m)).toBeLessThan(0.001);
  });
});
