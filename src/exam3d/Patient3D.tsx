"use client";
import type { ThreeEvent } from "@react-three/fiber";
import type { Intersection } from "three";
import type { DrapeZone } from "@/domain/schemas";
import { PatientModel } from "@/scene/PatientModel";
import type { VariantId } from "@/scene/rig";
import type { CursorPoint } from "@/scene/tools/ToolCursor";
import { snapToAnchor, type Pose, type Vec3 } from "./regionAnchors";

export interface BodyHit {
  point: Vec3;
  normal: Vec3;
  /** "body", or "gown:<zone>" when the click landed on the gown */
  kind: string;
  /** nearest region anchor (by tolerance boundary), when within reach */
  regionId: string | null;
}

export interface Patient3DProps {
  pose: Pose;
  variant: VariantId;
  drape: Record<DrapeZone, boolean>;
  rr: number;
  hr: number;
  laboured: boolean;
  jvpCm: number;
  edema: Record<string, number>;
  speaking: boolean;
  quality: "high" | "low";
  pupilScale: number;
  angle: { current: number };
  jerk?: { bone: string; amount: number; at: number } | null;
  /** regions a click can resolve to (examinable + prohibited, or the tool's regions) */
  pickableRegionIds: readonly string[];
  toolActive: boolean;
  onBodyClick: (hit: BodyHit) => void;
  onToolDown: (hit: BodyHit) => void;
  onToolMove: (hit: BodyHit) => void;
  onToolUp: () => void;
  onHover: (hit: BodyHit | null) => void;
}

/** A body hit is only resolved to a region when it lands this close to the region's tolerance boundary. */
const REACH_CM = 9;

/**
 * The rigged patient. Hits come from BVH proxies baked from the posed skin and gown; a hit is
 * resolved to the nearest canonical region anchor. Nothing about the anchors is drawn.
 */
export function Patient3D(p: Patient3DProps) {
  const toHit = (e: ThreeEvent<MouseEvent | PointerEvent>): BodyHit | null => {
    const i = e.intersections.find((x) => typeof x.object.userData.kind === "string" && (x.object.userData.kind === "body" || String(x.object.userData.kind).startsWith("gown:")));
    if (!i) return null;
    const point: Vec3 = [i.point.x, i.point.y, i.point.z];
    const normal = worldNormal(i);
    // gown hits measure from the skin underneath (the gown is ~1 cm out)
    const skin = e.intersections.find((x) => x.object.userData.kind === "body");
    const measure: Vec3 = skin ? [skin.point.x, skin.point.y, skin.point.z] : point;
    const snap = snapToAnchor(measure, p.pickableRegionIds, p.pose);
    const regionId = snap && snap.distanceCm - snap.toleranceCm <= REACH_CM ? snap.regionId : null;
    return { point: measure, normal, kind: String(i.object.userData.kind), regionId };
  };

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        if (p.toolActive) return;
        const h = toHit(e);
        if (h) p.onBodyClick(h);
      }}
      onPointerDown={(e) => {
        if (!p.toolActive) return;
        e.stopPropagation();
        const h = toHit(e);
        if (!h) return;
        (e.target as unknown as Element).setPointerCapture?.(e.pointerId);
        p.onToolDown(h);
      }}
      onPointerUp={(e) => {
        if (!p.toolActive) return;
        e.stopPropagation();
        (e.target as unknown as Element).releasePointerCapture?.(e.pointerId);
        p.onToolUp();
      }}
      onPointerMove={(e) => {
        e.stopPropagation();
        const h = toHit(e);
        if (p.toolActive && e.buttons && h) p.onToolMove(h);
        p.onHover(h);
      }}
      onPointerOut={() => p.onHover(null)}
    >
      <PatientModel
        variant={p.variant}
        position={p.pose.position}
        bedAngle={p.pose.bedAngle}
        angle={p.angle}
        jerk={p.jerk}
        drape={p.drape}
        hr={p.hr}
        rr={p.rr}
        laboured={p.laboured}
        jvpCm={p.jvpCm}
        edema={p.edema}
        pupilScale={p.pupilScale}
        speaking={p.speaking}
        quality={p.quality}
      />
    </group>
  );
}

function worldNormal(i: Intersection): Vec3 {
  if (!i.face) return [0, 1, 0];
  const n = i.face.normal.clone().transformDirection(i.object.matrixWorld);
  return [n.x, n.y, n.z];
}

export type { CursorPoint };
