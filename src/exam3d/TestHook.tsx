"use client";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { Vector3 } from "three";
import { ANCHOR_BY_REGION, toWorld, type Pose } from "./regionAnchors";

declare global {
  interface Window {
    __osce3d?: { project: (regionId: string) => { x: number; y: number } | null; ready: boolean };
  }
}

/**
 * Exposes `window.__osce3d.project(regionId)` → page coordinates of a region's anchor, so
 * automated tests can click the real canvas (going through raycasting) instead of a shortcut.
 */
export function TestHook({ pose }: { pose: Pose }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    window.__osce3d = {
      ready: true,
      project(regionId) {
        const a = ANCHOR_BY_REGION.get(regionId);
        if (!a) return null;
        const v = new Vector3(...toWorld(a.points[0]!, a.segment, pose)).project(camera);
        const rect = gl.domElement.getBoundingClientRect();
        return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
      },
    };
    return () => {
      delete window.__osce3d;
    };
  }, [camera, gl, pose]);
  return null;
}
