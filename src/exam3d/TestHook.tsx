"use client";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { Vector3 } from "three";
import { DISPENSER_POS } from "./Dispenser";
import { ANCHOR_BY_REGION, landmarkFor, toWorld, type Pose, type Vec3 } from "./regionAnchors";

declare global {
  interface Window {
    __osce3d?: {
      project: (regionId: string, landmark?: string) => { x: number; y: number } | null;
      /** page coordinates of a named scene object, e.g. "dispenser" */
      projectObject: (name: "dispenser") => { x: number; y: number };
      ready: boolean;
    };
  }
}

/**
 * Exposes `window.__osce3d.project(regionId)` → page coordinates of a region's anchor, so
 * automated tests can click the real canvas (going through raycasting) instead of a shortcut.
 */
export function TestHook({ pose }: { pose: Pose }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    const toPage = (world: Vec3) => {
      const v = new Vector3(...world).project(camera);
      const rect = gl.domElement.getBoundingClientRect();
      return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
    };
    window.__osce3d = {
      ready: true,
      projectObject: () => toPage(DISPENSER_POS),
      project(regionId, landmark) {
        const lm = landmark ? landmarkFor(landmark, regionId) : undefined;
        const a = ANCHOR_BY_REGION.get(regionId);
        if (!a && !lm) return null;
        return toPage(lm ? toWorld(lm.point, lm.segment, pose) : toWorld(a!.points[0]!, a!.segment, pose));
      },
    };
    return () => {
      delete window.__osce3d;
    };
  }, [camera, gl, pose]);
  return null;
}
