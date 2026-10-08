/**
 * Bug 7 (Phase 4 M2): reflexes didn't move the leg. Every jerk flexed the same small amount from the
 * elbow/knee/ankle regions (so the triceps and Achilles moved the wrong way), there was no sitting
 * position with the legs hanging, the left-lateral pose bent the hips and knees backwards, and the
 * reflex sites were off the tendons. Now:
 *  - each tendon moves its joint the right way: knee extends, ankle plantarflexes, elbow flexes
 *    (biceps, brachioradialis) or extends (triceps), scaled by the grade, with clonus at grade 4;
 *  - "sitting, legs dangling" puts the knees just past the foot end of the table with the shanks
 *    hanging; left lateral flexes the hips and knees and brings the arms forward;
 *  - the reflex sites are on the tendons (anatomy oracle), and the reflexes are examined there.
 */
import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { loadContentFromDisk } from "@/content/loadFromDisk";
import { anchorsFor } from "@/exam3d/regionAnchors";
import { JERK_RISE, REFLEX_JERK, jerkDelta, jerkDuration } from "@/scene/animation/reflex";
import { TABLE, computePose, dirToWorld, type BoneRotations, type VariantId } from "@/scene/rig";
import type { Position } from "@/domain/schemas";
import { oracleFor } from "../../qa/anatomy/oracle";

const content = loadContentFromDisk();
const joint = (pose: ReturnType<typeof computePose>, bone: string) => {
  const e = pose.world.get(bone)!.elements;
  return new Vector3(e[12]!, e[13]!, e[14]!);
};
/** the pose at the peak of a grade-2 jerk on this tendon */
function jerked(variant: VariantId, position: Position, angle: number, tendon: string, grade = 2) {
  const j = REFLEX_JERK[tendon]!;
  const extra: BoneRotations = { [j.bone]: [jerkDelta({ ...j, grade }, JERK_RISE), 0, 0] };
  return { rest: computePose(variant, position, angle), peak: computePose(variant, position, angle, extra) };
}

describe("bug 7: reflexes move the right joint the right way", () => {
  for (const variant of ["male", "female"] as const) {
    it(`${variant}: knee jerk extends the knee and the ankle jerk plantarflexes, sitting with the legs hanging`, () => {
      for (const side of ["R", "L"] as const) {
        const lr = side === "R" ? "right" : "left";
        const k = jerked(variant, "sitting_dangling", 90, `patellar_tendon_${lr}`);
        const kneeAngle = (p: ReturnType<typeof computePose>) => {
          const hip = joint(p, `upperleg01_${side}`);
          const knee = joint(p, `lowerleg01_${side}`);
          const ankle = joint(p, `foot_${side}`);
          return hip.clone().sub(knee).angleTo(ankle.clone().sub(knee));
        };
        expect(kneeAngle(k.peak), `${lr} knee straightens`).toBeGreaterThan(kneeAngle(k.rest) + 0.08);
        const a = jerked(variant, "sitting_dangling", 90, `achilles_${lr}`);
        const toeDrop = (p: ReturnType<typeof computePose>) => joint(p, `toe1-1_${side}`).y - joint(p, `foot_${side}`).y;
        expect(toeDrop(a.peak), `${lr} toes point down`).toBeLessThan(toeDrop(a.rest) - 0.005);
      }
    });

    it(`${variant}: biceps and brachioradialis flex the elbow; triceps extends it`, () => {
      for (const side of ["R", "L"] as const) {
        const lr = side === "R" ? "right" : "left";
        const reach = (p: ReturnType<typeof computePose>) => joint(p, `upperarm01_${side}`).distanceTo(joint(p, `wrist_${side}`));
        for (const t of [`biceps_tendon_${lr}`, `brachioradialis_${lr}`]) {
          const j = jerked(variant, "seated", 80, t);
          expect(reach(j.peak), `${t} flexes`).toBeLessThan(reach(j.rest) - 0.003);
        }
        const tri = jerked(variant, "seated", 80, `triceps_tendon_${lr}`);
        expect(reach(tri.peak), "triceps extends").toBeGreaterThan(reach(tri.rest) + 0.003);
      }
    });
  }

  it("the movement scales with the grade, and grade 4 adds clonus beats", () => {
    const knee = { ...REFLEX_JERK.patellar_tendon_right!, grade: 0 };
    expect(jerkDelta(knee, JERK_RISE)).toBe(0);
    const g1 = Math.abs(jerkDelta({ ...knee, grade: 1 }, JERK_RISE));
    const g2 = Math.abs(jerkDelta({ ...knee, grade: 2 }, JERK_RISE));
    const g3 = Math.abs(jerkDelta({ ...knee, grade: 3 }, JERK_RISE));
    expect(g1).toBeGreaterThan(0);
    expect(g2).toBeGreaterThan(g1);
    expect(g3).toBeGreaterThan(g2);
    const brisk = { ...knee, grade: 4 };
    expect(jerkDuration(brisk)).toBeGreaterThan(jerkDuration({ ...knee, grade: 2 }));
    // after the jerk has settled (> 0.6 s) a grade-4 reflex is still beating; grade 2 is not
    const late = Array.from({ length: 30 }, (_, i) => 0.6 + i * 0.01);
    expect(late.some((t) => Math.abs(jerkDelta(brisk, t)) > 0.01)).toBe(true);
    expect(late.every((t) => jerkDelta({ ...knee, grade: 2 }, t) === 0)).toBe(true);
  });
});

describe("bug 7: positions for the reflexes", () => {
  for (const variant of ["male", "female"] as const) {
    it(`${variant}: sitting with the legs dangling — knees past the foot end, shanks hanging, feet off the floor`, () => {
      const p = computePose(variant, "sitting_dangling", 90);
      const footEnd = TABLE.hingeZ + TABLE.footLen;
      for (const side of ["R", "L"] as const) {
        const knee = joint(p, `lowerleg01_${side}`);
        const ankle = joint(p, `foot_${side}`);
        expect(knee.z, `${side} knee at the edge`).toBeGreaterThan(footEnd - 0.02);
        expect(knee.z).toBeLessThan(footEnd + 0.12);
        expect(ankle.y, `${side} ankle below the table top`).toBeLessThan(TABLE.topY - 0.25);
        expect(ankle.y, `${side} feet off the floor`).toBeGreaterThan(0.05);
        const shank = ankle.clone().sub(knee).normalize();
        expect(shank.angleTo(new Vector3(0, -1, 0)) * (180 / Math.PI), `${side} shank hangs`).toBeLessThan(20);
      }
    });

    it(`${variant}: left lateral flexes the hips and knees and brings the arms forward`, () => {
      const p = computePose(variant, "left_lateral_decubitus", 0);
      const front = new Vector3(...dirToWorld([0, 0, 1], "root", p));
      for (const side of ["R", "L"] as const) {
        const hip = joint(p, `upperleg01_${side}`);
        const knee = joint(p, `lowerleg01_${side}`);
        const ankle = joint(p, `foot_${side}`);
        expect(knee.clone().sub(hip).dot(front), `${side} hip flexed (knee in front of the hip)`).toBeGreaterThan(0.1);
        expect(hip.clone().sub(knee).angleTo(ankle.clone().sub(knee)) * (180 / Math.PI), `${side} knee bent`).toBeLessThan(150);
        const shoulder = joint(p, `upperarm01_${side}`);
        expect(joint(p, `lowerarm01_${side}`).sub(shoulder).dot(front), `${side} arm forward`).toBeGreaterThan(0.05);
      }
    });
  }
});

describe("bug 7: the reflexes are struck on the tendons", () => {
  for (const variant of ["male", "female"] as const)
    it(`${variant}: each reflex site is within its tolerance of the anatomical tendon point`, async () => {
      const oracle = await oracleFor(variant);
      for (const t of ["triceps_tendon", "brachioradialis", "patellar_tendon", "achilles", "biceps_tendon"]) {
        const o = oracle.find((x) => x.id === `${t}_left`)!;
        const a = anchorsFor(variant).find((x) => x.regionId === `${t}_left`)!;
        const cm = new Vector3(...a.points[0]!).distanceTo(new Vector3(...o.sample.bind)) * 100;
        expect(cm, `${t}_left`).toBeLessThanOrEqual(o.toleranceCm);
      }
    });

  it("the catalog examines each reflex at its tendon, and has an ankle clonus test", () => {
    const m = new Map(content.maneuvers.map((x) => [x.id, x]));
    expect(m.get("reflex_patellar")!.allowedRegions).toEqual(expect.arrayContaining(["patellar_tendon_right", "patellar_tendon_left"]));
    expect(m.get("reflex_achilles")!.allowedRegions).toEqual(expect.arrayContaining(["achilles_right", "achilles_left"]));
    expect(m.get("reflex_biceps")!.allowedRegions).toEqual(expect.arrayContaining(["biceps_tendon_right"]));
    expect(m.get("reflex_triceps")!.allowedRegions).toEqual(expect.arrayContaining(["triceps_tendon_right"]));
    expect(m.get("reflex_brachioradialis")!.allowedRegions).toEqual(expect.arrayContaining(["brachioradialis_right"]));
    expect(m.get("reflex_patellar")!.allowedRegions).not.toContain("knee_right");
    expect(m.get("ankle_clonus")).toBeDefined();
  });
});
