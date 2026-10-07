"use client";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { Box3, Vector3 } from "three";
import { anchorWorldPoints, landmarkWorld, type Pose, type Vec3 } from "./regionAnchors";

declare global {
  interface Window {
    __osce3d?: {
      project: (regionId: string, landmark?: string) => { x: number; y: number } | null;
      /** page coordinates of a world point */
      projectPoint: (p: Vec3) => { x: number; y: number };
      /** page coordinates of a named scene object's centre (e.g. "door", "sanitiser-dispenser", "tool:stethoscope", "stool") */
      projectObject: (name: string) => { x: number; y: number } | null;
      /** world position of a region's anchor (for tests that move the cursor near it) */
      anchor: (regionId: string) => Vec3 | null;
      shot: string;
      ready: boolean;
    };
  }
}

/**
 * Exposes `window.__osce3d` so automated tests can click the real canvas (through raycasting)
 * at projected anchors and scene objects, instead of using shortcuts.
 */
export function TestHook({ pose, shot }: { pose: Pose; shot: string }) {
  const { camera, gl, scene } = useThree();
  useEffect(() => {
    const toPage = (world: Vec3) => {
      const v = new Vector3(...world).project(camera);
      const rect = gl.domElement.getBoundingClientRect();
      return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
    };
    window.__osce3d = {
      ready: true,
      shot,
      projectPoint: toPage,
      projectObject(name) {
        const alias: Record<string, string> = { dispenser: "sanitiser-dispenser" };
        const o = scene.getObjectByName(alias[name] ?? name);
        if (!o) return null;
        const c = new Box3().setFromObject(o).getCenter(new Vector3());
        return toPage([c.x, c.y, c.z]);
      },
      anchor: (regionId) => anchorWorldPoints(regionId, pose)[0] ?? null,
      project(regionId, landmark) {
        const w = landmark ? landmarkWorld(landmark, regionId, pose) : (anchorWorldPoints(regionId, pose)[0] ?? null);
        return w ? toPage(w) : null;
      },
    };
    return () => {
      delete window.__osce3d;
    };
  }, [camera, gl, pose, scene, shot]);
  return null;
}
