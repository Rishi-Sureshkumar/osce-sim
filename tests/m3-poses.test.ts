/**
 * Phase 4 M3.2: poses against the table — the patient rests on it instead of sinking in or hovering.
 * V-ARMS (arms hover lying flat), V-LLD (left lateral: arm flung up / hanging off the edge, shoulder in
 * the mattress), V-BACKREST (sitting inside the raised backrest), hands sinking into the thighs, calves
 * in the mattress end when sitting with the legs dangling.
 */
import { DoubleSide, Ray, Vector3 } from "three";
import { MeshBVH } from "three-mesh-bvh";
import { describe, expect, it } from "vitest";
import type { Position } from "@/domain/schemas";
import { POSITION_ANGLE } from "@/engine/patientState";
import { poseFor } from "@/exam3d/regionAnchors";
import { PART_NAMES } from "@/scene/patientRig.generated";
import { TABLE, type VariantId } from "@/scene/rig";
import { SIDE_PILLOW, insideBox, tableAngle, tableBoxes } from "@/scene/room/tableGeometry";
import { geometryOf, loadPatient, skinMesh } from "../scripts/qa/lib/patientMesh";

const VARIANTS: VariantId[] = ["male", "female"];

async function posed(variant: VariantId, position: Position) {
  const pose = poseFor(position, POSITION_ANGLE[position], variant);
  const mesh = (await loadPatient(variant)).find((m) => m.name === "skin")!;
  const { positions, normals } = skinMesh(mesh, pose);
  const part = (i: number) => PART_NAMES[mesh.parts![i]!]!;
  return { pose, mesh, positions, normals, part, count: positions.length / 3 };
}

/** deepest skin point inside the table (cm along the vertical), per part */
function bedDepth(p: Awaited<ReturnType<typeof posed>>, position: Position, variant: VariantId): Record<string, number> {
  const boxes = tableBoxes(tableAngle(position, POSITION_ANGLE[position]), variant);
  const out: Record<string, number> = {};
  for (let i = 0; i < p.count; i++) {
    const v = [p.positions[i * 3]!, p.positions[i * 3 + 1]!, p.positions[i * 3 + 2]!];
    for (const b of boxes) {
      if (!insideBox(v, b, 0.004)) continue;
      const dy = v[1]! - b.center[1];
      const dz = v[2]! - b.center[2];
      const ly = dy * Math.cos(-b.rotX) - dz * Math.sin(-b.rotX);
      const depth = (b.size[1] / 2 - ly) * 100;
      out[p.part(i)] = Math.max(out[p.part(i)] ?? 0, depth);
    }
  }
  return out;
}

describe("M3.2 the patient rests on the table", () => {
  for (const variant of VARIANTS) {
    it(`${variant}: no body part sinks more than 1.5 cm into the table in any position`, async () => {
      for (const position of ["supine", "reclined_30", "reclined_45", "seated", "sitting_dangling", "left_lateral_decubitus", "seated_leaning_forward"] as Position[]) {
        const depth = bedDepth(await posed(variant, position), position, variant);
        for (const [part, cm] of Object.entries(depth)) expect(cm, `${position} ${part}`).toBeLessThan(1.5);
      }
    });

    it(`${variant}: lying flat the arms and hands rest on the mattress (V-ARMS)`, async () => {
      const p = await posed(variant, "supine");
      for (const side of ["l", "r"]) {
        for (const part of ["upper_arm", "forearm", "hand"]) {
          let min = Infinity;
          for (let i = 0; i < p.count; i++) if (p.part(i) === `${part}_${side}`) min = Math.min(min, p.positions[i * 3 + 1]! - TABLE.topY);
          // touching: within 1.5 cm above the mattress (it used to hover 2.4–16 cm)
          expect(min * 100, `${part}_${side}`).toBeGreaterThan(-1);
          expect(min * 100, `${part}_${side}`).toBeLessThan(1.5);
        }
      }
    });

    it(`${variant}: left lateral — both arms on the table, the upper arm along the flank, the head on the side pillow (V-LLD)`, async () => {
      const p = await posed(variant, "left_lateral_decubitus");
      const at = (bone: string) => new Vector3().setFromMatrixPosition(p.pose.world.get(bone)!);
      // nothing hangs off the table's long edges (arm skin near the mattress stays over it)
      let headLow = Infinity;
      for (let i = 0; i < p.count; i++) {
        if (/^(face|scalp|ear_l)$/.test(p.part(i))) headLow = Math.min(headLow, p.positions[i * 3 + 1]!);
        if (!/^(upper_arm|forearm|hand)/.test(p.part(i)) || p.positions[i * 3 + 1]! > TABLE.topY + 0.15) continue;
        expect(Math.abs(p.positions[i * 3]! - TABLE.x), p.part(i)).toBeLessThan(TABLE.width / 2);
      }
      // the head lies on the side pillow (within 1.5 cm of its top), not in the air above the mattress
      expect(Math.abs(headLow - (SIDE_PILLOW.center[1] + SIDE_PILLOW.size[1] / 2)) * 100).toBeLessThan(1.5);
      // the upper (right) arm lies along the body: the wrist is no higher than the shoulder
      expect(at("wrist_R").y).toBeLessThan(at("upperarm01_R").y);
      // the lower (left) arm lies on the mattress: elbow and wrist within 6 cm of it
      expect(at("lowerarm01_L").y - TABLE.topY).toBeLessThan(0.06);
      expect(at("wrist_L").y - TABLE.topY).toBeLessThan(0.06);
      // the lower shoulder is lifted off the mattress by the side bend
      expect(at("upperarm01_L").y - TABLE.topY).toBeGreaterThan(0.03);
    });

    it(`${variant}: sitting on the end of the table the calves hang clear of the mattress`, async () => {
      const p = await posed(variant, "sitting_dangling");
      const edge = TABLE.hingeZ + TABLE.footLen;
      for (let i = 0; i < p.count; i++) {
        if (!/^(leg|foot)_/.test(p.part(i))) continue;
        const y = p.positions[i * 3 + 1]!;
        if (y < TABLE.topY - 0.01 && y > TABLE.topY - 0.13) expect(p.positions[i * 3 + 2]!, p.part(i)).toBeGreaterThan(edge);
      }
    });

    it(`${variant}: sitting up, the hands rest on the lap instead of sinking into the thighs`, async () => {
      for (const position of ["reclined_30", "reclined_45", "seated", "sitting_dangling", "seated_leaning_forward"] as Position[]) {
        const p = await posed(variant, position);
        const idx: number[] = [];
        for (let t = 0; t < p.mesh.indices.length; t += 3) if (/^(thigh|torso)/.test(p.part(p.mesh.indices[t]!))) idx.push(p.mesh.indices[t]!, p.mesh.indices[t + 1]!, p.mesh.indices[t + 2]!);
        const lap = new MeshBVH(geometryOf(p.positions, new Uint32Array(idx)));
        const full = new MeshBVH(geometryOf(p.positions, p.mesh.indices));
        let inside = 0;
        let closest = Infinity;
        const v = new Vector3();
        const n = new Vector3();
        for (let i = 0; i < p.count; i++) {
          if (!/^(hand|forearm)_l$/.test(p.part(i))) continue;
          v.fromArray(p.positions, i * 3);
          n.fromArray(p.normals, i * 3);
          // a skin point pushed 3 mm out along its normal is inside another body part if a ray crosses the skin an odd number of times
          if (full.raycast(new Ray(v.clone().addScaledVector(n, 0.003), n.clone()), DoubleSide).length % 2 === 1) inside++;
          else closest = Math.min(closest, lap.closestPointToPoint(v)?.distance ?? Infinity);
        }
        expect(inside, `${position}: hand/forearm vertices inside the thighs`).toBeLessThan(10);
        // resting (on the gown and sheet), not hovering
        expect(closest * 100, `${position}: hand above the lap`).toBeLessThan(3);
      }
    });
  }
});
