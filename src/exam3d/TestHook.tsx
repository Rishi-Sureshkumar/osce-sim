"use client";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { Box3, Mesh, Object3D, Quaternion, Raycaster, SkinnedMesh, Vector2, Vector3 } from "three";
import { probeHitOf } from "./Patient3D";
import { QA, qaSettled, type PointerRecord, type ProbeHit } from "./qa";
import { anchorWorldNormals, anchorWorldPoints, landmarkWorld, skinLandmarkWorld, type Pose, type Vec3 } from "./regionAnchors";

export interface SkinPoint {
  dir: number;
  world: Vec3;
  page: { x: number; y: number };
}

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
      anchorNormal: (regionId: string) => Vec3 | null;
      /** world position of a named skin landmark (e.g. "ear_canal_l") */
      landmark: (name: string) => Vec3 | null;
      shot: string;
      ready: boolean;
      /** camera tween done, table/trunk/door at target, raycast proxies baked for this pose, gown faded, not busy */
      settled: () => boolean;
      pose: () => { position: string; bedAngle: number; variant: string };
      /** world position of a skeleton bone (rendered pose) */
      bone: (name: string) => Vec3 | null;
      objectState: (name: string) => { min: Vec3; max: Vec3; center: Vec3; quaternion: [number, number, number, number] } | null;
      /** everything visible under a page point, nearest first (geometry, not click handlers) */
      probe: (x: number, y: number) => ProbeHit[];
      /** the last pointer interaction on the patient: hits, resolved body hit, tool decision */
      lastPointer: () => PointerRecord | null;
      /** skin points `cm` from a region's anchor, in `n` tangent directions, projected onto the posed skin */
      skinPointNear: (regionId: string, cm: number, n?: number) => SkinPoint[];
      qa: { fast: boolean; freeze: boolean };
    };
  }
}

const SKIP = new Set(["tool-cursor", "hand-wash"]);

function chainVisible(o: Object3D): boolean {
  for (let x: Object3D | null = o; x; x = x.parent) if (!x.visible) return false;
  return true;
}
function named(o: Object3D, names: (n: string) => boolean): string | null {
  for (let x: Object3D | null = o; x; x = x.parent) if (x.name && names(x.name)) return x.name;
  return null;
}

/**
 * Exposes `window.__osce3d` so automated tests can click the real canvas (through raycasting)
 * at projected anchors and scene objects, instead of using shortcuts. Mounted only with QA_HOOKS.
 */
export function TestHook({ pose, shot }: { pose: Pose; shot: string }) {
  const { camera, gl, scene } = useThree();
  useEffect(() => {
    const rect = () => gl.domElement.getBoundingClientRect();
    const toPage = (world: Vec3) => {
      const v = new Vector3(...world).project(camera);
      const r = rect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    };
    const proxies = () => {
      const root = scene.getObjectByName("patient-proxies");
      return (root?.children ?? []) as Mesh[];
    };
    const probe = (x: number, y: number): ProbeHit[] => {
      const r = rect();
      const ndc = new Vector2(((x - r.left) / r.width) * 2 - 1, -(((y - r.top) / r.height) * 2 - 1));
      const ray = new Raycaster();
      ray.setFromCamera(ndc, camera);
      const out: ProbeHit[] = [];
      scene.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh || (o as SkinnedMesh).isSkinnedMesh || !chainVisible(o) || named(o, (n) => SKIP.has(n))) return;
        const isProxy = o.parent?.name === "patient-proxies";
        const hits: import("three").Intersection[] = [];
        if (isProxy) m.raycast(ray, hits);
        else Mesh.prototype.raycast.call(m, ray, hits); // ignore click-handler overrides: what is physically there
        for (const h of hits) {
          if (isProxy) {
            out.push(probeHitOf(h));
            continue;
          }
          const drape = named(o, (n) => /^(sheet-|roll-|fold-|drape)/.test(n));
          const bed = named(o, (n) => n === "exam-table");
          // an unnamed object is reported by its geometry and position, so a failure says what was in the way
          const anon = () => {
            const c = new Vector3().setFromMatrixPosition(m.matrixWorld);
            return `${m.geometry?.type ?? "mesh"}@${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)}`;
          };
          out.push({ name: named(o, () => true) ?? anon(), kind: drape ? "drape" : bed ? "bed" : "prop", part: null, point: [h.point.x, h.point.y, h.point.z], distance: h.distance });
        }
      });
      return out.sort((a, b) => a.distance - b.distance);
    };
    const skinPointNear = (regionId: string, cm: number, n = 8): SkinPoint[] => {
      const p = anchorWorldPoints(regionId, pose)[0];
      const nn = anchorWorldNormals(regionId, pose)[0];
      if (!p || !nn) return [];
      const normal = new Vector3(...nn).normalize();
      const t1 = new Vector3().crossVectors(normal, Math.abs(normal.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)).normalize();
      const t2 = new Vector3().crossVectors(normal, t1).normalize();
      const body = proxies().filter((m) => m.userData.kind === "body");
      const out: SkinPoint[] = [];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const q = new Vector3(...p).addScaledVector(t1, (Math.cos(a) * cm) / 100).addScaledVector(t2, (Math.sin(a) * cm) / 100);
        const ray = new Raycaster(q.clone().addScaledVector(normal, 0.06), normal.clone().negate(), 0, 0.15);
        const hits = ray.intersectObjects(body, false);
        const h = hits[0];
        if (h) out.push({ dir: k, world: [h.point.x, h.point.y, h.point.z], page: toPage([h.point.x, h.point.y, h.point.z]) });
      }
      return out;
    };
    window.__osce3d = {
      ready: true,
      shot,
      qa: { fast: QA.fast, freeze: QA.freeze },
      projectPoint: toPage,
      projectObject(name) {
        const alias: Record<string, string> = { dispenser: "sanitiser-dispenser" };
        const o = scene.getObjectByName(alias[name] ?? name);
        if (!o) return null;
        const c = new Box3().setFromObject(o).getCenter(new Vector3());
        return toPage([c.x, c.y, c.z]);
      },
      anchor: (regionId) => anchorWorldPoints(regionId, pose)[0] ?? null,
      anchorNormal: (regionId) => anchorWorldNormals(regionId, pose)[0] ?? null,
      landmark: (name) => skinLandmarkWorld(name, pose),
      project(regionId, landmark) {
        const w = landmark ? landmarkWorld(landmark, regionId, pose) : (anchorWorldPoints(regionId, pose)[0] ?? null);
        return w ? toPage(w) : null;
      },
      settled: () => qaSettled(),
      pose: () => ({ position: pose.position, bedAngle: pose.bedAngle, variant: pose.variant }),
      bone(name) {
        let found: Object3D | undefined;
        scene.traverse((o) => {
          if (!found && (o as unknown as { isBone?: boolean }).isBone && o.name === name) found = o;
        });
        if (!found) return null;
        const v = found.getWorldPosition(new Vector3());
        return [v.x, v.y, v.z];
      },
      objectState(name) {
        const o = scene.getObjectByName(name);
        if (!o) return null;
        const b = new Box3().setFromObject(o);
        const c = b.getCenter(new Vector3());
        const q = o.getWorldQuaternion(new Quaternion());
        return { min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z], center: [c.x, c.y, c.z], quaternion: [q.x, q.y, q.z, q.w] };
      },
      probe,
      lastPointer: () => QA.lastPointer,
      skinPointNear,
    };
    return () => {
      delete window.__osce3d;
    };
  }, [camera, gl, pose, scene, shot]);
  return null;
}
