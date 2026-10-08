"use client";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Bone, BufferGeometry, Float32BufferAttribute, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Quaternion, SkinnedMesh, Vector3, type Material } from "three";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { DrapeZone, Position } from "@/domain/schemas";
import { QA } from "@/exam3d/qa";
import { liveRotations } from "./livePose";
import { PATIENT_VARIANTS } from "./patientRig.generated";
import { placement, rotationOf, type VariantId } from "./rig";

export interface PatientModelProps {
  variant: VariantId;
  position: Position;
  bedAngle: number;
  drape: Record<DrapeZone, boolean>;
  hr: number;
  rr: number;
  laboured: boolean;
  /** JVP height (cm above the sternal angle); a venous pulsation is drawn when > 3 */
  jvpCm: number;
  /** regionId → edema grade 1–4 (drawn as swelling) */
  edema: Record<string, number>;
  /** 1 = rest; < 1 constricted (penlight). Per eye: light in one eye constricts it (direct) and the other (consensual). */
  pupilScale: number | { left: number; right: number };
  /** the patient is talking: turn the head toward the camera */
  speaking: boolean;
  /** eye exam: the head stays still and the eyes look ahead at a far point (no sway, no turn) */
  steadyHead?: boolean;
  quality: "high" | "low";
  /** animated head-section angle (degrees), shared with the table so posture follows it smoothly */
  angle?: { current: number };
  /** a reflex jerk to animate: bone, size (grade), when (seconds, performance clock) */
  jerk?: { bone: string; amount: number; at: number } | null;
}

/**
 * Kinds of the invisible, BVH-accelerated raycast proxies baked from the posed meshes.
 * Only "body" and "gown:*" resolve clicks (Patient3D); hair and eyes are there so a ray can be
 * checked for what it hits first (QA probe).
 */
export const PROXY_KIND: Record<string, string> = {
  skin: "body",
  gown_chest: "gown:chest",
  gown_abdomen: "gown:abdomen",
  gown_back: "gown:chest",
  hair: "hair",
  eyes: "eye",
};

const DEG = Math.PI / 180;
const tmpQ = new Quaternion();
const tmpV = new Vector3();
const tmpM = new Matrix4();

export function PatientModel(p: PatientModelProps) {
  const info = PATIENT_VARIANTS[p.variant];
  const gltf = useGLTF(info.glb, false, true, (loader) => loader.setMeshoptDecoder(MeshoptDecoder));
  const scene = gltf.scene;
  const bones = useMemo(() => {
    const m = new Map<string, Bone>();
    scene.traverse((o) => {
      if ((o as Bone).isBone) m.set(o.name, o as Bone);
    });
    return m;
  }, [scene]);
  const meshes = useMemo(() => {
    const m = new Map<string, SkinnedMesh>();
    scene.traverse((o) => {
      if ((o as SkinnedMesh).isSkinnedMesh) {
        const sm = o as SkinnedMesh;
        sm.castShadow = true;
        sm.receiveShadow = true;
        sm.frustumCulled = false; // skinned bounds don't follow poses
        m.set(o.name, sm);
      }
    });
    const skin = m.get("skin");
    if (skin) skin.userData.kind = "body";
    for (const g of ["gown_chest", "gown_abdomen", "gown_back"]) {
      const mesh = m.get(g);
      if (mesh) {
        mesh.userData.kind = "gown";
        mesh.material = (mesh.material as Material).clone();
        (mesh.material as MeshStandardMaterial).transparent = true;
      }
    }
    return m;
  }, [scene]);

  // ---- shader: venous pulsation at the neck and pitting edema, displaced in bind space
  const shader = useRef<{ uniforms: Record<string, { value: unknown }> } | null>(null);
  const jvpAnchor = info.anchors.find((a) => a.regionId === "neck_jvp_right");
  useEffect(() => {
    const skin = meshes.get("skin");
    if (!skin) return;
    const mat = (skin.material as MeshStandardMaterial).clone();
    const edemaList = Object.entries(p.edema)
      .flatMap(([regionId, grade]) => (info.anchors.find((x) => x.regionId === regionId)?.points ?? []).map((pt) => ({ pt, grade })))
      .slice(0, 6);
    mat.onBeforeCompile = (s) => {
      s.uniforms.uTime = { value: 0 };
      s.uniforms.uHr = { value: p.hr };
      s.uniforms.uJvp = { value: new Vector3(...(jvpAnchor?.points[0] ?? [0, -10, 0])) };
      s.uniforms.uJvpAmp = { value: p.jvpCm > 3 ? Math.min(1, (p.jvpCm - 3) / 6) : 0 };
      s.uniforms.uEdema = { value: Array.from({ length: 6 }, (_, i) => (edemaList[i] ? new Vector3(...edemaList[i]!.pt) : new Vector3(0, -10, 0))) };
      s.uniforms.uEdemaGrade = { value: Array.from({ length: 6 }, (_, i) => edemaList[i]?.grade ?? 0) };
      s.vertexShader = s.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
uniform float uTime; uniform float uHr; uniform vec3 uJvp; uniform float uJvpAmp; uniform vec3 uEdema[6]; uniform float uEdemaGrade[6];`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
{
  // venous pulse: a soft double-peaked flicker (a and v waves) over the right internal jugular,
  // spread upward along the neck in proportion to the column height
  vec3 d = position - uJvp;
  float along = clamp(d.y / 0.06, -0.3, 1.0);
  float w = exp(-(d.x * d.x) / (0.012 * 0.012) - (d.z * d.z) / (0.02 * 0.02)) * smoothstep(-0.3, 0.0, along) * (1.0 - smoothstep(0.6 * uJvpAmp + 0.2, 1.0, along));
  float ph = fract(uTime * uHr / 60.0);
  float wave = exp(-pow((ph - 0.12) / 0.06, 2.0)) + 0.6 * exp(-pow((ph - 0.55) / 0.08, 2.0));
  transformed += normal * (0.0018 * uJvpAmp * w * wave);
  // pitting edema: swelling around the lower shins / ankles, scaled by grade
  for (int i = 0; i < 6; i++) {
    if (uEdemaGrade[i] <= 0.0) continue;
    float r = length(position - uEdema[i]);
    transformed += normal * (0.0022 * uEdemaGrade[i] * exp(-(r * r) / (0.07 * 0.07)));
  }
}`,
        );
      shader.current = s as unknown as { uniforms: Record<string, { value: unknown }> };
    };
    skin.material = mat;
    return () => {
      mat.dispose();
    };
  }, [meshes, p.edema, p.hr, p.jvpCm, info, jvpAnchor]);

  // ---- per-frame pose: base rotations + breathing, blink, head turn
  const blink = useRef({ next: 2 + Math.random() * 3, t: -1 });
  const look = useRef({ yaw: 0, pitch: 0 });
  const pupils = useRef({ left: 1, right: 1 });
  const drapeAlpha = useRef<Record<string, number>>({ gown_chest: 1, gown_abdomen: 1, gown_back: 1 });
  const root = useRef<Object3D>(null);

  useFrame(({ clock, camera, scene: world }, dt) => {
    const frozen = QA.enabled && QA.freeze;
    const t = frozen ? 0 : clock.elapsedTime;
    // blink every 3–6 s
    const b = blink.current;
    let blinkK = 0;
    if (!frozen && t > b.next && b.t < 0) b.t = 0;
    if (!frozen && b.t >= 0) {
      b.t += dt;
      blinkK = b.t < 0.08 ? b.t / 0.08 : b.t < 0.18 ? 1 - (b.t - 0.08) / 0.1 : 0;
      if (b.t > 0.2) {
        b.t = -1;
        b.next = t + 3 + Math.random() * 3;
      }
    }
    // head turns toward the student while the patient speaks
    const neck = bones.get("neck03");
    const target = { yaw: 0, pitch: 0 };
    if (p.speaking && !p.steadyHead && !frozen && neck?.parent) {
      tmpM.copy(neck.parent.matrixWorld).invert();
      tmpV.copy(camera.position).applyMatrix4(tmpM).sub(neck.position);
      target.yaw = Math.max(-55 * DEG, Math.min(55 * DEG, Math.atan2(tmpV.x, tmpV.z)));
      target.pitch = Math.max(-20 * DEG, Math.min(25 * DEG, -Math.atan2(tmpV.y, Math.hypot(tmpV.x, tmpV.z))));
    }
    const lk = look.current;
    const kk = 1 - Math.exp(-dt * 3);
    lk.yaw += (target.yaw - lk.yaw) * kk;
    lk.pitch += (target.pitch - lk.pitch) * kk;
    if (frozen) {
      lk.yaw = 0;
      lk.pitch = 0;
    }
    const rot = liveRotations({
      position: p.position,
      angle: p.angle?.current ?? p.bedAngle,
      t,
      rr: p.rr,
      laboured: p.laboured,
      blink: blinkK,
      look: lk,
      steady: !!p.steadyHead,
      jerk: p.jerk ? { bone: p.jerk.bone, amount: p.jerk.amount, ageSec: performance.now() / 1000 - p.jerk.at } : null,
    });

    // pupils ease toward their targets: constrict quickly (~0.15 s), widen slowly (~0.6 s)
    const pupilGoal = typeof p.pupilScale === "number" ? { left: p.pupilScale, right: p.pupilScale } : p.pupilScale;
    for (const side of ["left", "right"] as const) {
      const cur = pupils.current[side];
      const tau = pupilGoal[side] < cur ? 0.15 : 0.6;
      pupils.current[side] = cur + (pupilGoal[side] - cur) * (1 - Math.exp(-dt / tau));
    }
    for (const [name, bone] of bones) {
      if (name.startsWith("pupil_")) {
        bone.scale.setScalar(name.endsWith("L") ? pupils.current.left : pupils.current.right);
        continue;
      }
      bone.quaternion.copy(rot[name] ? rotationOf(rot[name]) : tmpQ.identity());
    }
    // drape: gown panels fade out when uncovered (and back in when covered)
    const want: Record<string, number> = { gown_chest: p.drape.chest ? 1 : 0, gown_back: p.drape.chest ? 1 : 0, gown_abdomen: p.drape.abdomen ? 1 : 0 };
    for (const [g, target] of Object.entries(want)) {
      const mesh = meshes.get(g);
      if (!mesh) continue;
      const cur = drapeAlpha.current[g] ?? 1;
      const next = cur + (target - cur) * (1 - Math.exp(-dt * 8));
      drapeAlpha.current[g] = next;
      const mat = mesh.material as MeshStandardMaterial;
      mat.opacity = next;
      mesh.visible = next > 0.02;
      mat.depthWrite = next > 0.98;
    }
    QA.gownSettled = drapeSettled();
    if (shader.current) {
      shader.current.uniforms.uTime!.value = t;
    }
    // re-bake the raycast proxies once the posture has settled after a change (and when the gown changes)
    const settled = Math.abs((p.angle?.current ?? p.bedAngle) - p.bedAngle) < 0.3;
    const key = `${p.position}|${p.bedAngle}|${p.drape.chest}|${p.drape.abdomen}`;
    QA.wantKey = key;
    if (!settled || !drapeSettled()) stableFrames.current = 0;
    else stableFrames.current++;
    // wait a few frames after the pose settles so bone and root matrices are current
    if (stableFrames.current >= 3 && bakedKey.current !== key && proxyRoot.current) {
      bakedKey.current = key;
      world.updateMatrixWorld(true);
      bakeProxies(meshes, proxyRoot.current);
      QA.bakedKey = key;
    }
  });
  const drapeSettled = () => Object.values(drapeAlpha.current).every((a) => a < 0.03 || a > 0.97);
  const bakedKey = useRef<string>("");
  const stableFrames = useRef(0);
  const proxyRoot = useRef<Object3D>(null);
  useEffect(() => {
    // the skinned meshes are only drawn; hit testing uses the baked proxies (fast and pose-exact)
    for (const m of meshes.values()) m.raycast = () => undefined;
  }, [meshes]);

  const rootMatrix = useMemo(() => placement(p.position), [p.position]);
  useEffect(() => {
    const r = root.current;
    if (!r) return;
    r.matrixAutoUpdate = false;
    r.matrix.copy(rootMatrix);
    r.matrixWorldNeedsUpdate = true;
  }, [rootMatrix]);

  useEffect(() => {
    for (const m of meshes.values()) {
      m.castShadow = p.quality === "high";
    }
  }, [meshes, p.quality]);

  return (
    <>
      <group ref={root}>
        <primitive object={scene} />
      </group>
      <group ref={proxyRoot} name="patient-proxies" />
    </>
  );
}

/** Preload both patient variants (small GLBs) so the station opens without a pause. */
export function preloadPatients() {
  for (const v of Object.values(PATIENT_VARIANTS)) useGLTF.preload(v.glb, false, true, (loader) => loader.setMeshoptDecoder(MeshoptDecoder));
}

export function isBody(o: Object3D): boolean {
  return (o as Mesh).userData?.kind === "body";
}

const PROXY_MATERIAL = new MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, opacity: 0 });

/** Bakes the posed skin (and visible gown panels) into static, BVH-indexed meshes for raycasting. */
function bakeProxies(meshes: Map<string, SkinnedMesh>, root: Object3D) {
  for (const old of [...root.children]) {
    root.remove(old);
    (old as Mesh).geometry?.dispose();
  }
  const v = new Vector3();
  for (const [name, kind] of Object.entries(PROXY_KIND)) {
    const src = meshes.get(name);
    if (!src || (name.startsWith("gown") && !src.visible)) continue;
    src.updateMatrixWorld(true);
    src.skeleton.update();
    const pos = src.geometry.getAttribute("position");
    const out = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      src.getVertexPosition(i, v); // skinned, in the mesh's local space
      v.applyMatrix4(src.matrixWorld);
      out[i * 3] = v.x;
      out[i * 3 + 1] = v.y;
      out[i * 3 + 2] = v.z;
    }
    const geom = new BufferGeometry();
    geom.setAttribute("position", new Float32BufferAttribute(out, 3));
    // QA body-part labels (asset build `_PART`) travel with the proxy
    const part = src.geometry.getAttribute("_part");
    if (part) geom.setAttribute("_part", part.clone());
    if (src.geometry.index) geom.setIndex(src.geometry.index.clone());
    geom.boundsTree = new MeshBVH(geom);
    const proxy = new Mesh(geom, PROXY_MATERIAL);
    proxy.raycast = acceleratedRaycast;
    proxy.userData.kind = kind;
    proxy.name = `proxy:${name}`;
    root.add(proxy);
  }
}
