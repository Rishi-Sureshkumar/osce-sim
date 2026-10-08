"use client";
import type { ThreeEvent } from "@react-three/fiber";
import type { BufferGeometry, Intersection, Mesh } from "three";
import type { DrapeZone } from "@/domain/schemas";
import { PatientModel } from "@/scene/PatientModel";
import { PART_NAMES } from "@/scene/patientRig.generated";
import type { VariantId } from "@/scene/rig";
import type { Jerk } from "@/scene/animation/reflex";
import type { CursorPoint } from "@/scene/tools/ToolCursor";
import { resolveHit, type BodyHit, type RawHit } from "./hit";
import { QA, recordPointer, type ProbeHit } from "./qa";
import type { Pose, Vec3 } from "./regionAnchors";

export type { BodyHit };

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
  /** eye exam: hold the head still */
  steadyHead?: boolean;
  quality: "high" | "low";
  pupilScale: number | { left: number; right: number };
  angle: { current: number };
  jerk?: (Jerk & { at: number }) | null;
  /** regions a click can resolve to (examinable + prohibited, or the tool's regions) */
  pickableRegionIds: readonly string[];
  toolActive: boolean;
  onBodyClick: (hit: BodyHit) => void;
  onToolDown: (hit: BodyHit) => void;
  onToolMove: (hit: BodyHit) => void;
  onToolUp: () => void;
  onHover: (hit: BodyHit | null) => void;
}

/**
 * The rigged patient. Hits come from BVH proxies baked from the posed skin and gown; a hit is
 * resolved to the nearest canonical region anchor. Nothing about the anchors is drawn.
 */
export function Patient3D(p: Patient3DProps) {
  const toHit = (e: ThreeEvent<MouseEvent | PointerEvent>, record = false): BodyHit | null => {
    const raw: RawHit[] = e.intersections.map((x) => ({ kind: x.object.userData.kind as string | undefined, point: [x.point.x, x.point.y, x.point.z] as Vec3, normal: worldNormal(x) }));
    const h = resolveHit(raw, p.pickableRegionIds, p.pose);
    if (record && QA.enabled) recordPointer({ hits: e.intersections.map(probeHitOf), bodyHit: h ? { point: h.point, kind: h.kind, regionId: h.regionId } : null });
    return h;
  };

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        if (p.toolActive) return;
        const h = toHit(e, true);
        if (h) p.onBodyClick(h);
      }}
      onPointerDown={(e) => {
        if (!p.toolActive) return;
        e.stopPropagation();
        const h = toHit(e, true);
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
        steadyHead={p.steadyHead}
        quality={p.quality}
      />
    </group>
  );
}

/** QA: a ray hit described by kind and body part (from the asset build's `_PART` labels). */
export function probeHitOf(x: Intersection): ProbeHit {
  const geom = (x.object as Mesh).geometry as BufferGeometry | undefined;
  const partAttr = geom?.getAttribute("_part");
  const part = partAttr && x.face ? (PART_NAMES[partAttr.getX(x.face.a)] ?? null) : null;
  return { name: x.object.name, kind: String(x.object.userData.kind ?? "prop"), part, point: [x.point.x, x.point.y, x.point.z], distance: x.distance };
}

function worldNormal(i: Intersection): Vec3 {
  if (!i.face) return [0, 1, 0];
  const n = i.face.normal.clone().transformDirection(i.object.matrixWorld);
  return [n.x, n.y, n.z];
}

export type { CursorPoint };
