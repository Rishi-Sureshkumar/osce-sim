/**
 * Node-side patient geometry for QA (test:anchors, test:intersections): loads the patient GLBs
 * with gltf-transform (meshopt-decoded) and CPU-skins them through the same forward kinematics
 * the renderer and the anchors use (src/scene/rig.ts). The GLB's inverse bind matrices are pure
 * translations by −head (bones have identity rest rotation), so a skinned vertex is
 * Σ wᵢ · world(boneᵢ) · (v − headᵢ).
 */
import fs from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { BufferAttribute, BufferGeometry, Matrix4, Vector3 } from "three";
import { MeshBVH } from "three-mesh-bvh";
import { PART_NAMES, PATIENT_VARIANTS } from "@/scene/patientRig.generated";
import type { Pose, VariantId } from "@/scene/rig";

export interface PatientMesh {
  /** glTF mesh name: skin, eyes, mouth, gown_*, hair, pupils */
  name: string;
  /** bind-pose positions (model space, metres) */
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  /** 4 joint names' indices into `jointNames` per vertex */
  joints: Uint16Array;
  weights: Float32Array;
  /** per-vertex body part (index into PART_NAMES), when the GLB carries `_PART` */
  parts: Uint8Array | null;
  jointNames: string[];
}

const cache = new Map<VariantId, PatientMesh[]>();

export async function loadPatient(variant: VariantId): Promise<PatientMesh[]> {
  const hit = cache.get(variant);
  if (hit) return hit;
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  const file = path.join(process.cwd(), "public", PATIENT_VARIANTS[variant].glb);
  const doc = await io.readBinary(new Uint8Array(fs.readFileSync(file)));
  const out: PatientMesh[] = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    const skin = node.getSkin();
    if (!mesh || !skin) continue;
    const jointNames = skin.listJoints().map((j) => j.getName());
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION")!;
      const nrm = prim.getAttribute("NORMAL");
      const jts = prim.getAttribute("JOINTS_0")!;
      const wts = prim.getAttribute("WEIGHTS_0")!;
      const part = prim.getAttribute("_PART");
      const n = pos.getCount();
      const positions = new Float32Array(n * 3);
      const normals = new Float32Array(n * 3);
      const joints = new Uint16Array(n * 4);
      const weights = new Float32Array(n * 4);
      const parts = part ? new Uint8Array(n) : null;
      const v3: number[] = [0, 0, 0];
      const v4: number[] = [0, 0, 0, 0];
      for (let i = 0; i < n; i++) {
        pos.getElement(i, v3);
        positions.set(v3, i * 3);
        if (nrm) {
          nrm.getElement(i, v3);
          normals.set(v3, i * 3);
        }
        jts.getElement(i, v4);
        joints.set(v4, i * 4);
        wts.getElement(i, v4);
        const sum = v4[0]! + v4[1]! + v4[2]! + v4[3]! || 1;
        weights.set(v4.map((w) => w / sum), i * 4);
        if (parts && part) parts[i] = part.getScalar(i);
      }
      const idx = prim.getIndices()!;
      const indices = new Uint32Array(idx.getCount());
      for (let i = 0; i < indices.length; i++) indices[i] = idx.getScalar(i);
      out.push({ name: mesh.getName() || node.getName(), positions, normals, indices, joints, weights, parts, jointNames });
    }
  }
  cache.set(variant, out);
  return out;
}

/** Per-joint skinning matrices for a pose: world(bone) · translate(−head). */
function jointMatrices(mesh: PatientMesh, pose: Pose): Matrix4[] {
  return mesh.jointNames.map((name) => {
    const w = pose.world.get(name) ?? pose.world.get("root")!;
    const h = pose.heads.get(name) ?? new Vector3();
    return w.clone().multiply(new Matrix4().makeTranslation(-h.x, -h.y, -h.z));
  });
}

/** World-space positions (and normals) of a mesh in a pose. */
export function skinMesh(mesh: PatientMesh, pose: Pose): { positions: Float32Array; normals: Float32Array } {
  const mats = jointMatrices(mesh, pose);
  const n = mesh.positions.length / 3;
  const positions = new Float32Array(n * 3);
  const normals = new Float32Array(n * 3);
  const v = new Vector3();
  const nv = new Vector3();
  const acc = new Vector3();
  const accN = new Vector3();
  const tmp = new Vector3();
  const e = new Float32Array(16);
  for (let i = 0; i < n; i++) {
    acc.set(0, 0, 0);
    accN.set(0, 0, 0);
    v.fromArray(mesh.positions, i * 3);
    nv.fromArray(mesh.normals, i * 3);
    for (let k = 0; k < 4; k++) {
      const w = mesh.weights[i * 4 + k]!;
      if (w === 0) continue;
      const m = mats[mesh.joints[i * 4 + k]!]!;
      acc.addScaledVector(tmp.copy(v).applyMatrix4(m), w);
      m.toArray(e);
      // rotation part only (rigid bones, no scale): transform the normal
      accN.addScaledVector(tmp.set(e[0]! * nv.x + e[4]! * nv.y + e[8]! * nv.z, e[1]! * nv.x + e[5]! * nv.y + e[9]! * nv.z, e[2]! * nv.x + e[6]! * nv.y + e[10]! * nv.z), w);
    }
    acc.toArray(positions, i * 3);
    accN.normalize().toArray(normals, i * 3);
  }
  return { positions, normals };
}

export function geometryOf(positions: Float32Array, indices: Uint32Array): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(positions, 3));
  g.setIndex(new BufferAttribute(indices, 1));
  return g;
}

export interface SkinnedPatient {
  variant: VariantId;
  meshes: { mesh: PatientMesh; positions: Float32Array; normals: Float32Array; geometry: BufferGeometry; bvh: MeshBVH }[];
  byName(name: string): SkinnedPatient["meshes"][number] | undefined;
}

/** Skin every mesh of a variant in a pose, with a BVH per mesh. */
export async function skinnedPatient(pose: Pose): Promise<SkinnedPatient> {
  const meshes = (await loadPatient(pose.variant)).map((mesh) => {
    const { positions, normals } = skinMesh(mesh, pose);
    const geometry = geometryOf(positions, mesh.indices);
    return { mesh, positions, normals, geometry, bvh: new MeshBVH(geometry) };
  });
  return { variant: pose.variant, meshes, byName: (name) => meshes.find((m) => m.mesh.name === name) };
}

export const partName = (i: number | undefined) => (i === undefined ? null : (PART_NAMES[i] ?? null));
