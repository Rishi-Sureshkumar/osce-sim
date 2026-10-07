"use client";
/**
 * Drape props around the gown: a sheet over the legs, and a folded roll at the edge of any
 * uncovered zone. Clicking a covered sheet/gown folds it back (uncovers); clicking a roll covers
 * the zone again. Positions come from the patient's pose so they follow every position.
 */
import { useMemo } from "react";
import { Matrix4, Quaternion, Vector3 } from "three";
import type { DrapeZone } from "@/domain/schemas";
import { anchorWorldPoints, skinLandmark, type Pose, type Vec3 } from "@/exam3d/regionAnchors";
import { clickable } from "./room/ExamRoom";

const SHEET = "#9cc3d3";

/** Frame for a cylinder whose axis runs from a to b, with its +Z side facing `up`. */
function frameBetween(a: Vec3, b: Vec3, up: Vec3) {
  const va = new Vector3(...a);
  const vb = new Vector3(...b);
  const y = vb.clone().sub(va);
  const len = y.length();
  y.normalize();
  const z = new Vector3(...up).sub(y.clone().multiplyScalar(new Vector3(...up).dot(y))).normalize();
  const x = y.clone().cross(z).normalize();
  const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
  return { mid: va.add(vb).multiplyScalar(0.5), q, len, up: z };
}

export function Drapes({ pose, drape, onDrape, disabled }: { pose: Pose; drape: Record<DrapeZone, boolean>; onDrape?: (zone: DrapeZone, covered: boolean) => void; disabled?: boolean }) {
  const lateral = pose.position === "left_lateral_decubitus";
  const legs = useMemo(() => {
    const hip = anchorWorldPoints("hip_right", pose)[0]!;
    const hipL = anchorWorldPoints("hip_left", pose)[0]!;
    const ankle = anchorWorldPoints("ankle_right", pose)[0]!;
    const ankleL = anchorWorldPoints("ankle_left", pose)[0]!;
    // the sheet's axis runs down the middle of the legs, ~20 cm below the top of the arc
    const top: Vec3 = [(hip[0] + hipL[0]) / 2, Math.max(hip[1], hipL[1]) - 0.17, (hip[2] + hipL[2]) / 2];
    const bottom: Vec3 = [(ankle[0] + ankleL[0]) / 2, Math.max(ankle[1], ankleL[1]) - 0.16, (ankle[2] + ankleL[2]) / 2 + 0.12];
    return frameBetween(top, bottom, [0, 1, 0]);
  }, [pose]);
  const rolls = useMemo(() => {
    const nr = skinLandmark("nipple_r", pose).point;
    const nl = skinLandmark("nipple_l", pose).point;
    const xiph = skinLandmark("xiphoid", pose);
    const umb = skinLandmark("umbilicus", pose);
    const across = new Vector3(nl[0] - nr[0], nl[1] - nr[1], nl[2] - nr[2]).normalize();
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), across);
    const at = (p: Vec3, n: Vec3, out: number): Vec3 => [p[0] + n[0] * out, p[1] + n[1] * out, p[2] + n[2] * out];
    return {
      chest: { pos: at(xiph.point, xiph.normal, 0.035), q },
      abdomen: { pos: at(umb.point, umb.normal, 0.03).map((v, i) => v + [0, 0, 0.1][i]!) as Vec3, q },
    };
  }, [pose]);
  const act = (zone: DrapeZone, covered: boolean) => (disabled || !onDrape ? undefined : () => onDrape(zone, covered));

  return (
    <group>
      {/* sheet over the legs (or a folded sheet at the foot of the bed when uncovered) */}
      {!lateral && drape.legs && (
        <mesh position={legs.mid} quaternion={legs.q} name="sheet-legs" castShadow receiveShadow {...clickable(act("legs", false))}>
          <cylinderGeometry args={[0.24, 0.24, legs.len, 24, 1, true, -Math.PI * 0.4, Math.PI * 0.8]} />
          <meshStandardMaterial color={SHEET} roughness={0.95} side={2} />
        </mesh>
      )}
      {!lateral && !drape.legs && (
        <mesh position={[legs.mid.x, 0.9, 1.0]} rotation={[0, 0, Math.PI / 2]} name="roll-legs" castShadow {...clickable(act("legs", true))}>
          <cylinderGeometry args={[0.05, 0.05, 0.55, 16]} />
          <meshStandardMaterial color={SHEET} roughness={0.95} />
        </mesh>
      )}
      {/* gown hem tabs: click to fold the gown back from the chest / abdomen */}
      {drape.chest && (
        <mesh position={rolls.chest.pos} quaternion={rolls.chest.q} name="fold-chest" castShadow {...clickable(act("chest", false))}>
          <capsuleGeometry args={[0.009, 0.2, 4, 10]} />
          <meshStandardMaterial color="#7fb0c4" roughness={0.9} />
        </mesh>
      )}
      {drape.abdomen && (
        <mesh position={rolls.abdomen.pos} quaternion={rolls.abdomen.q} name="fold-abdomen" castShadow {...clickable(act("abdomen", false))}>
          <capsuleGeometry args={[0.009, 0.22, 4, 10]} />
          <meshStandardMaterial color="#7fb0c4" roughness={0.9} />
        </mesh>
      )}
      {/* folded gown edges, to cover the chest/abdomen again */}
      {!drape.chest && (
        <mesh position={rolls.chest.pos} quaternion={rolls.chest.q} name="roll-chest" castShadow {...clickable(act("chest", true))}>
          <capsuleGeometry args={[0.022, 0.26, 4, 12]} />
          <meshStandardMaterial color="#9ec5d4" roughness={0.92} />
        </mesh>
      )}
      {!drape.abdomen && (
        <mesh position={rolls.abdomen.pos} quaternion={rolls.abdomen.q} name="roll-abdomen" castShadow {...clickable(act("abdomen", true))}>
          <capsuleGeometry args={[0.022, 0.28, 4, 12]} />
          <meshStandardMaterial color="#9ec5d4" roughness={0.92} />
        </mesh>
      )}
    </group>
  );
}
