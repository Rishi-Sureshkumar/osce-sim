/**
 * Bug 5 (Phase 4 M2): exam landmarks drifted between views. Each anchor rode one bone rigidly while
 * the rendered skin blends several bones, so near joints (neck, abdomen when seated, groin, knees,
 * elbows) the hidden targets floated off the visible skin and slid along it from pose to pose.
 * Anchors and landmarks must now move like a skin vertex, in every position, for both body models:
 *  - within 3 mm of the skinned surface, and
 *  - within 3 mm of the same skin vertex they were snapped to (so they never slide along the skin).
 * (Since bug 1 the eye targets are the pupils: they are held to the eye's own vertices.)
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

/** the surfaces a target can be snapped to: the skin, or (the pupils, bug 1) the eye */
const SURFACES = ["skin", "eyes", "pupils"];

/** mesh and index of the bind-pose vertex nearest to a bind-pose point */
function nearestVertex(meshes: { name: string; positions: Float32Array }[], p: Vec3): { mesh: string; index: number } {
  let best = { mesh: "skin", index: -1 };
  let bestD = Infinity;
  for (const m of meshes)
    for (let i = 0; i < m.positions.length; i += 3) {
      const d = (m.positions[i]! - p[0]) ** 2 + (m.positions[i + 1]! - p[1]) ** 2 + (m.positions[i + 2]! - p[2]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { mesh: m.name, index: i / 3 };
      }
    }
  return best;
}

describe("bug 5: anchors and landmarks follow the skin in every pose", () => {
  for (const variant of ["male", "female"] as const)
    it(`${variant}: every anchor and landmark stays on its own skin vertex (≤ ${MAX_MM} mm)`, async () => {
      const bind = (await loadPatient(variant)).filter((m) => SURFACES.includes(m.name));
      const rig = PATIENT_VARIANTS[variant];
      // every point we serve, with the vertex it was snapped to in the bind pose
      const points: { id: string; at: (pose: ReturnType<typeof poseFor>) => Vec3; vertex: { mesh: string; index: number } }[] = [];
      for (const a of anchorsFor(variant))
        a.points.forEach((p, i) => points.push({ id: `${a.regionId}#${i}`, at: (pose) => anchorWorldPoints(a.regionId, pose)[i]!, vertex: nearestVertex(bind, p) }));
      for (const [name, lm] of Object.entries(rig.landmarks))
        points.push({ id: `landmark ${name}`, at: (pose) => skinLandmark(name, pose).point, vertex: nearestVertex(bind, lm.point) });

      const off: string[] = [];
      for (const position of POSITIONS) {
        const pose = poseFor(position, POSITION_ANGLE[position], variant);
        const sp = await skinnedPatient(pose);
        for (const pt of points) {
          const w = new Vector3(...pt.at(pose));
          const mesh = sp.byName(pt.vertex.mesh)!;
          const surface = (mesh.bvh.closestPointToPoint(w)?.distance ?? 1) * 1000;
          const own = w.distanceTo(new Vector3().fromArray(mesh.positions, pt.vertex.index * 3)) * 1000;
          if (surface > MAX_MM) off.push(`${position} ${pt.id}: ${surface.toFixed(1)} mm off the ${pt.vertex.mesh}`);
          else if (own > MAX_MM) off.push(`${position} ${pt.id}: slid ${own.toFixed(1)} mm from its skin vertex`);
        }
      }
      expect(off, off.slice(0, 20).join("\n")).toEqual([]);
    }, 180_000);
});
