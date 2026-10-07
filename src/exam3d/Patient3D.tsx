"use client";
import type { ThreeEvent } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Mesh, MeshBasicMaterial } from "three";
import type { DrapeZone } from "@/domain/schemas";
import { PatientModel } from "@/scene/PatientModel";
import type { VariantId } from "@/scene/rig";
import { anchorWorldPoints, anchorsFor, pickRegion, type Pose, type RegionAnchor, type Vec3 } from "./regionAnchors";

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
  /** regions the current tool/menu can act on (others are hidden markers) */
  showMarkers: boolean;
  selectedRegionId?: string | null;
  performingRegionId?: string | null;
  examinedRegionIds: Set<string>;
  enabledRegionIds: Set<string>;
  onPick: (regionId: string, e: ThreeEvent<MouseEvent>) => void;
  /** a tool is in hand: pointer down/move/up report world points instead of picking */
  toolActive: boolean;
  onToolDown: (point: Vec3) => void;
  onToolMove: (point: Vec3) => void;
  onToolUp: () => void;
  pupilScale: number;
  onDoublePick: (regionId: string) => void;
  onHover: (regionId: string | null) => void;
}

/** Where the ray meets the skin (not an invisible collider): tool placements are measured from it. */
function surfacePoint(e: ThreeEvent<PointerEvent>): Vec3 {
  const body = e.intersections.find((i) => i.object.userData.kind === "body");
  const pt = body?.point ?? e.point;
  return [pt.x, pt.y, pt.z];
}

/**
 * The rigged patient plus invisible anchor colliders at the pose's world anchor points. Picking
 * resolves ray hits to a canonical regionId, ignoring anchors hidden behind the skin.
 */
export function Patient3D(p: Patient3DProps) {
  const resolve = (e: ThreeEvent<MouseEvent | PointerEvent>): string | null => {
    const bodyHit = e.intersections.find((i) => i.object.userData.kind === "body");
    const limit = bodyHit ? bodyHit.distance + 0.03 : Infinity;
    const hits = e.intersections
      .filter((i) => typeof i.object.userData.regionId === "string" && i.distance <= limit)
      .map((i) => ({ regionId: i.object.userData.regionId as string, distance: i.distance }))
      .filter((h) => p.enabledRegionIds.has(h.regionId));
    return pickRegion(hits);
  };
  const anchors = anchorsFor(p.variant);
  const placed = useMemo(() => anchors.map((a) => ({ a, points: anchorWorldPoints(a.regionId, p.pose) })), [anchors, p.pose]);

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        if (p.toolActive) return;
        const id = resolve(e);
        if (id) p.onPick(id, e);
      }}
      onPointerDown={(e) => {
        if (!p.toolActive) return;
        e.stopPropagation();
        (e.target as unknown as Element).setPointerCapture?.(e.pointerId);
        p.onToolDown(surfacePoint(e));
      }}
      onPointerUp={(e) => {
        if (!p.toolActive) return;
        e.stopPropagation();
        (e.target as unknown as Element).releasePointerCapture?.(e.pointerId);
        p.onToolUp();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        const id = resolve(e);
        if (id) p.onDoublePick(id);
      }}
      onPointerMove={(e) => {
        e.stopPropagation();
        if (p.toolActive && e.buttons) p.onToolMove(surfacePoint(e));
        p.onHover(resolve(e));
      }}
      onPointerOut={() => p.onHover(null)}
    >
      <PatientModel
        variant={p.variant}
        position={p.pose.position}
        bedAngle={p.pose.bedAngle}
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
      {placed.map(({ a, points }) => points.map((pt, i) => <AnchorMesh key={`${a.regionId}-${i}`} anchor={a} point={pt} {...p} />))}
    </group>
  );
}

function AnchorMesh({
  anchor,
  point,
  showMarkers,
  selectedRegionId,
  performingRegionId,
  examinedRegionIds,
  enabledRegionIds,
}: Patient3DProps & { anchor: RegionAnchor; point: Vec3 }) {
  const dot = useRef<Mesh>(null);
  const performing = performingRegionId === anchor.regionId;
  const selected = selectedRegionId === anchor.regionId;
  const examined = examinedRegionIds.has(anchor.regionId);
  const enabled = enabledRegionIds.has(anchor.regionId);
  const visible = enabled && (showMarkers || selected || performing || examined);
  useFrame(({ clock }) => {
    const m = dot.current?.material as MeshBasicMaterial | undefined;
    if (!m) return;
    m.opacity = !visible ? 0 : performing ? 0.55 + 0.4 * Math.sin(clock.elapsedTime * 9) : selected ? 0.95 : examined ? 0.85 : 0.6;
  });
  const color = selected || performing ? "#0e7490" : examined ? "#059669" : "#0891b2";
  return (
    <group position={point}>
      <mesh userData={{ regionId: anchor.regionId }}>
        <sphereGeometry args={[Math.max(0.015, anchor.radius), 12, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      <mesh ref={dot} raycast={() => null} renderOrder={2}>
        <sphereGeometry args={[0.008, 12, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
