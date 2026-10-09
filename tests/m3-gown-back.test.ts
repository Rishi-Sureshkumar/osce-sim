/**
 * Found in the M3 screenshot review: with the back "covered", the gown left the spine bare from the neck
 * to the buttocks (the neckline was cut as an unbounded cylinder around the neck's axis, and the back
 * comes within its radius). Sitting up, the back panel must cover the back's midline from just below the
 * neck's base down to the hips.
 */
import { describe, expect, it } from "vitest";
import { Ray, Vector3 } from "three";
import type { Position } from "@/domain/schemas";
import { POSITION_ANGLE } from "@/engine/patientState";
import { poseFor } from "@/exam3d/regionAnchors";
import { PATIENT_VARIANTS } from "@/scene/patientRig.generated";
import { loadPatient, skinnedPatient } from "../scripts/qa/lib/patientMesh";

const SITTING: Position[] = ["seated", "seated_leaning_forward", "sitting_dangling"];

describe("M3 gown: the back panel covers the spine", () => {
  for (const variant of ["male", "female"] as const) {
    it(`${variant}: sitting up, every back-midline skin point between the neck's base and the hips is under the back panel`, async () => {
      const skin = (await loadPatient(variant)).find((m) => m.name === "skin")!;
      const neckBase = PATIENT_VARIANTS[variant].rig.find((b) => b.name === "neck01")!.head[1];
      // the back's midline in the bind pose (facing backwards), from 6 cm under the neck's base to the hips
      const midline: number[] = [];
      for (let i = 0; i < skin.positions.length / 3; i++) {
        const [x, y] = [skin.positions[i * 3]!, skin.positions[i * 3 + 1]!];
        if (Math.abs(x) <= 0.02 && skin.normals[i * 3 + 2]! < -0.7 && y < neckBase - 0.06 && y > 0) midline.push(i);
      }
      expect(midline.length).toBeGreaterThan(20);
      for (const position of SITTING) {
        const sp = await skinnedPatient(poseFor(position, POSITION_ANGLE[position], variant));
        const s = sp.byName("skin")!;
        const back = sp.byName("gown_back")!;
        const bare = midline.filter((i) => {
          const p = new Vector3().fromArray(s.positions, i * 3);
          const n = new Vector3().fromArray(s.normals, i * 3).normalize();
          const hit = back.bvh.raycastFirst(new Ray(p.clone().addScaledVector(n, -0.01), n), 2);
          return !hit || hit.distance > 0.08;
        });
        expect(bare.length, `${position}: ${bare.length} of ${midline.length} back-midline points bare`).toBe(0);
      }
    });
  }
});
