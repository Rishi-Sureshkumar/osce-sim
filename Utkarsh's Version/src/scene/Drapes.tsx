"use client";
/**
 * Drape props around the gown: a sheet over the legs, and a folded roll at the edge of any
 * uncovered zone. Clicking a covered sheet/gown folds it back (uncovers); clicking a roll covers
 * the zone again. Positions come from the patient's pose so they follow every position.
 */
import { useMemo } from "react";
import type { DrapeZone } from "@/domain/schemas";
import type { Pose } from "@/exam3d/regionAnchors";
import { LEG_SHEET, gownRollFrames, legSheetFrame } from "./drapeGeometry";
import { clickable } from "./room/ExamRoom";

const SHEET = "#9cc3d3";

export function Drapes({ pose, drape, onDrape, disabled }: { pose: Pose; drape: Record<DrapeZone, boolean>; onDrape?: (zone: DrapeZone, covered: boolean) => void; disabled?: boolean }) {
  const lateral = pose.position === "left_lateral_decubitus";
  const legs = useMemo(() => legSheetFrame(pose), [pose]);
  const rolls = useMemo(() => gownRollFrames(pose), [pose]);
  const act = (zone: DrapeZone, covered: boolean) => (disabled || !onDrape ? undefined : () => onDrape(zone, covered));

  return (
    <group>
      {/* sheet over the legs (or a folded sheet at the foot of the bed when uncovered) */}
      {!lateral && drape.legs && (
        <mesh position={legs.mid} quaternion={legs.q} name="sheet-legs" castShadow receiveShadow {...clickable(act("legs", false))}>
          <cylinderGeometry args={[LEG_SHEET.radius, LEG_SHEET.radius, legs.len, LEG_SHEET.segments, 1, true, LEG_SHEET.thetaStart, LEG_SHEET.thetaLength]} />
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
