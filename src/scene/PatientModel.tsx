"use client";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Bone, Matrix4, Mesh, MeshStandardMaterial, Object3D, Quaternion, SkinnedMesh, Vector3, type Material } from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { DrapeZone, Position } from "@/domain/schemas";
import { PATIENT_VARIANTS } from "./patientRig.generated";
import { placement, poseRotations, rotationOf, type VariantId } from "./rig";

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
  /** 1 = rest; < 1 constricted (penlight) */
  pupilScale: number;
  /** the patient is talking: turn the head toward the camera */
  speaking: boolean;
  quality: "high" | "low";
}

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
  const drapeAlpha = useRef<Record<string, number>>({ gown_chest: 1, gown_abdomen: 1, gown_back: 1 });
  const root = useRef<Object3D>(null);

  useFrame(({ clock, camera }, dt) => {
    const t = clock.elapsedTime;
    const rot = poseRotations(p.position, p.bedAngle);
    // breathing: chest rises at the case RR (deeper and with accessory motion when laboured)
    const breath = Math.sin((t * p.rr * 2 * Math.PI) / 60);
    const amp = (p.laboured ? 2.2 : 1) * DEG;
    const add = (b: string, x: number, y = 0, z = 0) => {
      const r = rot[b] ?? [0, 0, 0];
      rot[b] = [r[0] + x, r[1] + y, r[2] + z];
    };
    add("spine02", -breath * amp * 0.6);
    add("spine01", breath * amp);
    if (p.laboured) {
      add("clavicle_L", 0, 0, breath * 1.5 * DEG);
      add("clavicle_R", 0, 0, -breath * 1.5 * DEG);
    }
    // idle sway
    add("neck02", Math.sin(t * 0.31) * 0.6 * DEG, Math.sin(t * 0.23) * 1.2 * DEG);
    // blink every 3–6 s
    const b = blink.current;
    if (t > b.next && b.t < 0) b.t = 0;
    if (b.t >= 0) {
      b.t += dt;
      const k = b.t < 0.08 ? b.t / 0.08 : b.t < 0.18 ? 1 - (b.t - 0.08) / 0.1 : 0;
      add("orbicularis03_L", k * 26 * DEG);
      add("orbicularis03_R", k * 26 * DEG);
      add("orbicularis04_L", -k * 6 * DEG);
      add("orbicularis04_R", -k * 6 * DEG);
      if (b.t > 0.2) {
        b.t = -1;
        b.next = t + 3 + Math.random() * 3;
      }
    }
    // head turns toward the student while the patient speaks
    const neck = bones.get("neck03");
    const target = { yaw: 0, pitch: 0 };
    if (p.speaking && neck?.parent) {
      tmpM.copy(neck.parent.matrixWorld).invert();
      tmpV.copy(camera.position).applyMatrix4(tmpM).sub(neck.position);
      target.yaw = Math.max(-55 * DEG, Math.min(55 * DEG, Math.atan2(tmpV.x, tmpV.z)));
      target.pitch = Math.max(-20 * DEG, Math.min(25 * DEG, -Math.atan2(tmpV.y, Math.hypot(tmpV.x, tmpV.z))));
    }
    const lk = look.current;
    const kk = 1 - Math.exp(-dt * 3);
    lk.yaw += (target.yaw - lk.yaw) * kk;
    lk.pitch += (target.pitch - lk.pitch) * kk;
    add("neck03", lk.pitch * 0.5, lk.yaw * 0.5);
    add("head", lk.pitch * 0.5, lk.yaw * 0.5);

    for (const [name, bone] of bones) {
      if (name.startsWith("pupil_")) {
        bone.scale.setScalar(p.pupilScale);
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
    if (shader.current) {
      shader.current.uniforms.uTime!.value = t;
    }
  });

  // skinned meshes cache their raycast bounds from the first hit test: drop them when the pose
  // changes so clicks and tools find the body where it is now drawn
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      for (const m of meshes.values()) {
        // three's types say non-null, but null is its "recompute on next raycast" marker
        (m as unknown as { boundingSphere: null; boundingBox: null }).boundingSphere = null;
        (m as unknown as { boundingSphere: null; boundingBox: null }).boundingBox = null;
      }
    });
    return () => cancelAnimationFrame(id);
  }, [meshes, p.position, p.bedAngle]);

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
    <group ref={root}>
      <primitive object={scene} />
    </group>
  );
}

/** Preload both patient variants (small GLBs) so the station opens without a pause. */
export function preloadPatients() {
  for (const v of Object.values(PATIENT_VARIANTS)) useGLTF.preload(v.glb, false, true, (loader) => loader.setMeshoptDecoder(MeshoptDecoder));
}

export function isBody(o: Object3D): boolean {
  return (o as Mesh).userData?.kind === "body";
}
