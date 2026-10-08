/**
 * Bug 5 (Phase 4 M2): exam landmarks drifted between views. Each anchor rode one bone rigidly while
 * the rendered skin blends several bones, so near joints (neck, abdomen when seated, groin, knees,
 * elbows) the hidden targets floated off the visible skin and slid along it from pose to pose.
 * Anchors and landmarks must now move like a skin vertex, in every position, for both body models:
 *  - within 3 mm of the skinned surface, and
 *  - within 3 mm of the same skin vertex they were snapped to (so they never slide along the skin).
 */
import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { POSITION_ANGLE } from "@/engine/patientState";
import { anchorWorldPoints, anchorsFor, poseFor, skinLandmark } from "@/exam3d/regionAnchors";
import { PATIENT_VARIANTS } from "@/scene/patientRig.generated";
import type { Position } from "@/domain/schemas";
import type { Vec3 } from "@/scene/rig";
import { loadPatient, skinnedPatient } from "../../scripts/qa/lib/patientMesh";

const POSITIONS: Position[] = ["supine", "reclined_30", "reclined_45", "seated", "sitting_dangling", "left_lateral_decubitus"];
const MAX_MM = 3;

/** index of the bind-pose skin vertex nearest to a bind-pose point */
function nearestVertex(positions: Float32Array, p: Vec3): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const d = (positions[i]! - p[0]) ** 2 + (positions[i + 1]! - p[1]) ** 2 + (positions[i + 2]! - p[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i / 3;
    }
  }
  return best;
}

describe("bug 5: anchors and landmarks follow the skin in every pose", () => {
  for (const variant of ["male", "female"] as const)
    it(`${variant}: every anchor and landmark stays on its own skin vertex (≤ ${MAX_MM} mm)`, async () => {
      const bindSkin = (await loadPatient(variant)).find((m) => m.name === "skin")!;
      const rig = PATIENT_VARIANTS[variant];
      // every point we serve, with the skin vertex it was snapped to in the bind pose
      const points: { id: string; at: (pose: ReturnType<typeof poseFor>) => Vec3; vertex: number }[] = [];
      for (const a of anchorsFor(variant))
        a.points.forEach((p, i) => points.push({ id: `${a.regionId}#${i}`, at: (pose) => anchorWorldPoints(a.regionId, pose)[i]!, vertex: nearestVertex(bindSkin.positions, p) }));
      for (const [name, lm] of Object.entries(rig.landmarks))
        points.push({ id: `landmark ${name}`, at: (pose) => skinLandmark(name, pose).point, vertex: nearestVertex(bindSkin.positions, lm.point) });

      const off: string[] = [];
      for (const position of POSITIONS) {
        const pose = poseFor(position, POSITION_ANGLE[position], variant);
        const skin = (await skinnedPatient(pose)).byName("skin")!;
        for (const pt of points) {
          const w = new Vector3(...pt.at(pose));
          const surface = (skin.bvh.closestPointToPoint(w)?.distance ?? 1) * 1000;
          const own = w.distanceTo(new Vector3().fromArray(skin.positions, pt.vertex * 3)) * 1000;
          if (surface > MAX_MM) off.push(`${position} ${pt.id}: ${surface.toFixed(1)} mm off the skin`);
          else if (own > MAX_MM) off.push(`${position} ${pt.id}: slid ${own.toFixed(1)} mm from its skin vertex`);
        }
      }
      expect(off, off.slice(0, 20).join("\n")).toEqual([]);
    }, 180_000);
});
