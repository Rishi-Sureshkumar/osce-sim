/**
 * `npx tsx scripts/assets/build-patient.ts` — builds public/models/patient.glb from MakeHuman CC0
 * sources (base mesh hm08, default rig + weights), plus src/scene/patientRig.generated.ts
 * (skeleton + skin-projected exam anchors) used by the runtime pose/anchor math.
 *
 * Output frame (glTF): metres, +Y up, the patient faces +Z, the patient's LEFT is +X.
 * Origin = the root joint (pelvis centre). Bones have identity rest rotation, so a bone's
 * local translation is (head - parent head) and posing is a pure rotation per bone.
 *
 * Re-run after changing anchor definitions (src/exam3d/anchorDefs.ts) or the build itself.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { Document, NodeIO, type Node as GNode, type Skin } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression, EXTTextureWebP } from "@gltf-transform/extensions";
import { reorder, quantize } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import { ANCHOR_DEFS, LANDMARK_DEFS, type Facing } from "../../src/exam3d/anchorDefs";
import { CACHE, applyTargets, ensureSources, readSources } from "./makehuman";

type V3 = [number, number, number];
/** Body variants: MakeHuman ethnicity × sex × age targets, averaged over three ethnicities. */
const ETHN = ["caucasian", "african", "asian"];
const VARIANTS = [
  // 68-year-old man (MakeHuman "old" = 90, "young" = 25 → 0.66 old)
  { id: "male", glb: "public/models/patient.glb", hair: [0.56, 0.54, 0.52, 1] as [number, number, number, number], targets: ETHN.flatMap((e) => [{ name: `${e}-male-old`, weight: 0.66 / 3 }, { name: `${e}-male-young`, weight: 0.34 / 3 }]) },
  // young adult woman
  { id: "female", glb: "public/models/patient-female.glb", hair: [0.16, 0.1, 0.07, 1] as [number, number, number, number], targets: ETHN.map((e) => ({ name: `${e}-female-young`, weight: 1 / 3 })) },
] as const;
const OUT_TS = path.join(process.cwd(), "src/scene/patientRig.generated.ts");
const DM = 0.1; // MakeHuman units are decimetres

// ---------------------------------------------------------------- skeleton reduction
/** Deforming bones kept in the GLB (≈60). Weights of dropped bones go to their nearest kept ancestor. */
const KEEP = new Set<string>([
  "root",
  "spine05", "spine04", "spine03", "spine02", "spine01",
  "neck01", "neck02", "neck03", "head", "jaw",
  "eye.L", "eye.R", "orbicularis03.L", "orbicularis03.R", "orbicularis04.L", "orbicularis04.R",
  ...["L", "R"].flatMap((s) => [
    `clavicle.${s}`, `shoulder01.${s}`, `upperarm01.${s}`, `upperarm02.${s}`, `lowerarm01.${s}`, `lowerarm02.${s}`, `wrist.${s}`,
    `finger1-1.${s}`, `finger2-1.${s}`, `finger3-1.${s}`, `finger4-1.${s}`, `finger5-1.${s}`,
    `pelvis.${s}`, `upperleg01.${s}`, `upperleg02.${s}`, `lowerleg01.${s}`, `lowerleg02.${s}`, `foot.${s}`, `toe1-1.${s}`,
  ]),
]);
/** Extra bones added by us (not in MakeHuman): pupils scale for the penlight. */
const PUPILS = ["pupil.L", "pupil.R"] as const;

/**
 * Body-part label per vertex (glTF attribute `_PART`, index into PART_NAMES). QA only: the
 * catalog test and hit probe report which part a ray hit first (ear, hair, scalp, …).
 */
export const PART_NAMES = [
  "torso", "neck", "face", "scalp", "ear_l", "ear_r", "upper_arm_l", "upper_arm_r", "forearm_l", "forearm_r", "hand_l", "hand_r",
  "thigh_l", "thigh_r", "leg_l", "leg_r", "foot_l", "foot_r", "eye_l", "eye_r", "hair", "mouth", "gown",
] as const;
const PART = Object.fromEntries(PART_NAMES.map((n, i) => [n, i])) as Record<(typeof PART_NAMES)[number], number>;

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const round = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;
/** GLB/runtime bone name: three's loader strips "." from node names, so ".L" becomes "_L". */
const safe = (b: string) => b.replace(/\./g, "_");
/** top-4 skin weights for the generated file (bone names made safe, weights rounded and renormalised) */
const skinWeights = (w: [string, number][]): [string, number][] => {
  const r = w.map(([b, x]) => [safe(b), round(x, 4)] as [string, number]).filter(([, x]) => x > 0);
  const sum = r.reduce((n, [, x]) => n + x, 0) || 1;
  return r.map(([b, x]) => [b, round(x / sum, 4)]);
};

async function main() {
  await ensureSources(VARIANTS.flatMap((v) => v.targets.map((t) => t.name)));
  const results: Record<string, Awaited<ReturnType<typeof buildVariant>>> = {};
  for (const v of VARIANTS) results[v.id] = await buildVariant(v.id, path.join(process.cwd(), v.glb), [...v.targets], v.hair);
  const ts = `// GENERATED by scripts/assets/build-patient.ts from MakeHuman CC0 assets — do not edit by hand.
// Frame: metres, +Y up, patient faces +Z, patient's left = +X, origin = root joint (pelvis centre).
// Bones have identity rest rotation: local translation = head - parent.head.

export interface RigBone { name: string; parent: string | null; head: [number, number, number] }
/** weights: the skin vertex's bone weights (top 4), so the point is skinned like the surface. */
export interface SkinPoint { point: [number, number, number]; normal: [number, number, number]; bone: string; weights: [string, number][] }
export interface GeneratedAnchor { regionId: string; points: [number, number, number][]; normals: [number, number, number][]; bones: string[]; weights: [string, number][][] }
export interface PatientVariant { glb: string; stats: { triangles: number; bones: number; glbBytes: number }; rig: RigBone[]; landmarks: Record<string, SkinPoint>; anchors: GeneratedAnchor[] }

export const PATIENT_VARIANTS: Record<"male" | "female", PatientVariant> = ${JSON.stringify(results)};

/** QA: body-part names for the meshes' \`_PART\` vertex attribute (index → name). */
export const PART_NAMES = ${JSON.stringify(PART_NAMES)} as const;
`;
  fs.writeFileSync(OUT_TS, ts);
}

async function buildVariant(id: string, OUT_GLB: string, targets: { name: string; weight: number }[], hairColour: [number, number, number, number]) {
  const src = readSources();
  const { skel, weights } = src;
  const obj = { ...src.obj, v: applyTargets(src.obj.v, targets) };

  // ---- joints → bone heads (metres, origin at root head)
  const jointPos = (name: string): V3 => {
    const ids = skel.joints[name];
    if (!ids?.length) throw new Error(`joint ${name} missing`);
    const s = ids.reduce<V3>((acc, i) => add(acc, obj.v[i]!), [0, 0, 0]);
    return scale(s, DM / ids.length);
  };
  const rootHead = jointPos(skel.bones.root!.head);
  const P = (raw: V3): V3 => sub(scale(raw, DM), rootHead); // obj vertex → output frame
  const headOf = (b: string) => sub(jointPos(skel.bones[b]!.head), rootHead);
  const tailOf = (b: string) => sub(jointPos(skel.bones[b]!.tail), rootHead);
  const keptAncestor = (b: string): string => {
    let cur: string | null = b;
    while (cur && !KEEP.has(cur)) cur = skel.bones[cur]?.parent ?? null;
    if (!cur) throw new Error(`no kept ancestor for ${b}`);
    return cur;
  };
  const kept = Object.keys(skel.bones).filter((b) => KEEP.has(b));
  for (const k of KEEP) if (!skel.bones[k]) throw new Error(`bone ${k} not in rig`);
  const parentOf = (b: string): string | null => {
    const p = skel.bones[b]!.parent;
    return p ? keptAncestor(p) : null;
  };
  // order parents before children
  const order: string[] = [];
  const visit = (b: string) => {
    if (order.includes(b)) return;
    const p = parentOf(b);
    if (p) visit(p);
    order.push(b);
  };
  kept.forEach(visit);

  // ---- per-vertex skin weights (original vertex index → up to 4 [bone, w])
  const vw = new Map<number, Map<string, number>>();
  for (const [bone, list] of Object.entries(weights)) {
    const target = keptAncestor(bone);
    for (const [vi, w] of list) {
      const m = vw.get(vi) ?? new Map<string, number>();
      m.set(target, (m.get(target) ?? 0) + w);
      vw.set(vi, m);
    }
  }
  const top4 = (vi: number, fallback: string): [string, number][] => {
    const m = vw.get(vi);
    if (!m || m.size === 0) return [[fallback, 1]];
    const arr = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const s = arr.reduce((n, [, w]) => n + w, 0);
    return arr.map(([b, w]) => [b, w / s]);
  };

  // ---- geometry per group, with UV seams split
  const GROUPS: Record<string, string> = {
    body: "skin",
    "helper-l-eye": "eyes",
    "helper-r-eye": "eyes",
    "helper-upper-teeth": "mouth",
    "helper-lower-teeth": "mouth",
    "helper-tongue": "mouth",
  };
  interface Built {
    pos: V3[];
    uv: [number, number][];
    src: number[]; // original vertex index
    idx: number[];
  }
  const built: Record<string, Built> = {};
  for (const f of obj.faces) {
    const mesh = GROUPS[f.group];
    if (!mesh) continue;
    const b = (built[mesh] ??= { pos: [], uv: [], src: [], idx: [] });
    const keyMap = ((b as Built & { _k?: Map<string, number> })._k ??= new Map());
    const ids = f.v.map((vi, k) => {
      const ti = f.vt[k] ?? -1;
      const key = `${vi}/${ti}`;
      let id = keyMap.get(key);
      if (id === undefined) {
        id = b.pos.length;
        keyMap.set(key, id);
        b.pos.push(P(obj.v[vi]!));
        const t = obj.vt[ti] ?? [0, 0];
        b.uv.push([t[0], 1 - t[1]]);
        b.src.push(vi);
      }
      return id;
    });
    for (let k = 1; k + 1 < ids.length; k++) b.idx.push(ids[0]!, ids[k]!, ids[k + 1]!);
  }
  const skin = built.skin!;
  const normals = vertexNormals(skin.pos, skin.idx);

  // ---- landmarks and anchors on the skin (bind pose)
  const dominant = (srcVi: number) => top4(srcVi, "root")[0]![0];
  // skin weights of the snapped vertex: anchors and landmarks are skinned exactly like the surface (bug 5)
  const weightsOf = (srcVi: number) => top4(srcVi, "root");
  // pupil centre on each eye's forward axis, just in front of the iris (the pupil discs below)
  const pupilCentre = (side: "L" | "R") => {
    const eh = headOf(`eye.${side}`);
    const fwd = norm(sub(tailOf(`eye.${side}`), eh));
    const ev = built.eyes!.pos.filter((p) => Math.sign(p[0]) === (side === "L" ? 1 : -1));
    const r = ev.reduce((m, p) => Math.max(m, dot(sub(p, eh), fwd)), 0);
    return { centre: add(eh, scale(fwd, r + 0.0004)), fwd };
  };
  // front-most skin near (x, y), from front-facing vertices: for dimple landmarks (the navel)
  const frontZ = (x: number, y: number) => {
    let z = -Infinity;
    for (let i = 0; i < skin.pos.length; i++) {
      const q = skin.pos[i]!;
      if (normals[i]![2] < 0.3 || Math.abs(q[0] - x) > 0.006 || Math.abs(q[1] - y) > 0.006) continue;
      if (q[2] > z) z = q[2];
    }
    return z;
  };
  /** how far a front-surface vertex sits below the front skin `r` metres around it */
  const dimpleDepth = (p: V3, r: number) => {
    if (frontZ(p[0], p[1]) > p[2] + 0.002) return -Infinity; // not on the front surface
    const ring = [frontZ(p[0] + r, p[1]), frontZ(p[0] - r, p[1]), frontZ(p[0], p[1] + r), frontZ(p[0], p[1] - r)];
    return ring.reduce((a, b) => a + b, 0) / ring.length - p[2];
  };
  const findLandmark = (def: (typeof LANDMARK_DEFS)[number]): { point: V3; normal: V3; bone: string; weights: [string, number][] } => {
    if (def.near) {
      const from = landmarks[def.near.landmark];
      if (!from) throw new Error(`landmark ${def.id}: ${def.near.landmark} must be defined before it`);
      const target = add(from.point, scale(def.near.offsetCm, 0.01));
      // skin of the head and neck, but never the ear (the same rule as the QA part labels)
      const earX = Math.abs(landmarks.ear_canal_l!.point[0]);
      const earY = landmarks.ear_canal_l!.point[1];
      const headC = headOf("head");
      let bestI = -1;
      let bestD = Infinity;
      for (let i = 0; i < skin.pos.length; i++) {
        const b = dominant(skin.src[i]!);
        if (!/^(head|jaw|neck)/.test(b)) continue;
        const p = skin.pos[i]!;
        if (/^(head|jaw)/.test(b) && Math.abs(p[0]) > earX - 0.012 && p[1] < earY + 0.035 && p[1] > earY - 0.035 && p[2] > headC[2] - 0.03) continue;
        const d = len(sub(p, target));
        if (d < bestD) {
          bestD = d;
          bestI = i;
        }
      }
      if (bestI < 0) throw new Error(`landmark ${def.id}: no skin near its target`);
      return { point: skin.pos[bestI]!, normal: normals[bestI]!, bone: dominant(skin.src[bestI]!), weights: weightsOf(skin.src[bestI]!) };
    }
    if (def.pupil) {
      const side = def.id.endsWith("_r") ? "R" : "L";
      const { centre, fwd } = pupilCentre(side);
      return { point: centre, normal: fwd, bone: `eye.${side}`, weights: [[`eye.${side}`, 1]] };
    }
    const ref = def.ref.kind === "mid" ? scale(add(headOf(def.ref.bone), headOf(def.ref.other)), 0.5) : def.ref.end === "tail" ? tailOf(def.ref.bone) : headOf(def.ref.bone);
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < skin.pos.length; i++) {
      const p = skin.pos[i]!;
      const d = sub(p, ref);
      if (def.box) {
        const [bx, by, bz] = def.box;
        if (Math.abs(d[0] - bx[0]) > bx[1] || Math.abs(d[1] - by[0]) > by[1] || Math.abs(d[2] - bz[0]) > bz[1]) continue;
      }
      const sc = def.dimple ? dimpleDepth(p, def.dimple) : dot(p, def.pick);
      if (sc > bestScore) {
        bestScore = sc;
        best = i;
      }
    }
    if (best < 0) throw new Error(`landmark ${def.id}: no vertex in box`);
    return { point: skin.pos[best]!, normal: normals[best]!, bone: dominant(skin.src[best]!), weights: weightsOf(skin.src[best]!) };
  };
  const landmarks: Record<string, { point: V3; normal: V3; bone: string; weights: [string, number][] }> = {};
  for (const def of LANDMARK_DEFS) landmarks[def.id] = findLandmark(def);

  const FACING: Record<Facing, V3 | null> = { front: [0, 0, 1], back: [0, 0, -1], left: [1, 0, 0], right: [-1, 0, 0], up: [0, 1, 0], down: [0, -1, 0], any: null };
  const projectToSkin = (target: V3, facing: Facing, allow?: (bone: string) => boolean) => {
    const f = FACING[facing];
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < skin.pos.length; i++) {
      if (f && dot(normals[i]!, f) < 0.25) continue;
      if (allow && !allow(dominant(skin.src[i]!))) continue;
      const d = len(sub(skin.pos[i]!, target));
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) throw new Error("projection failed");
    return { point: skin.pos[best]!, normal: normals[best]!, bone: dominant(skin.src[best]!), weights: weightsOf(skin.src[best]!), offBy: bestD };
  };
  const anchors: { regionId: string; points: V3[]; normals: V3[]; bones: string[]; weights: [string, number][][] }[] = [];
  for (const def of ANCHOR_DEFS) {
    const sides = def.bilateral ? [1, -1] : [def.mirror ? -1 : 1];
    const pts: V3[] = [];
    const nrm: V3[] = [];
    const bones: string[] = [];
    const weights: [string, number][][] = [];
    for (const s of sides) {
      const lmId = s === -1 ? mirrorId(def.landmark) : def.landmark;
      const lm = landmarks[lmId];
      if (!lm) throw new Error(`anchor ${def.regionId}: landmark ${lmId} missing`);
      if (def.onLandmark) {
        pts.push(lm.point);
        nrm.push(lm.normal);
        bones.push(lm.bone);
        weights.push(lm.weights);
        continue;
      }
      let from = lm.point;
      if (def.between) {
        const toId = s === -1 ? mirrorId(def.between.to) : def.between.to;
        const to = landmarks[toId];
        if (!to) throw new Error(`anchor ${def.regionId}: landmark ${toId} missing`);
        from = add(from, scale(sub(to.point, from), def.between.t));
      }
      const cm = def.offsetCmBy?.[id as "male" | "female"] ?? def.offsetCm;
      const off: V3 = [cm[0] * 0.01 * s, cm[1] * 0.01, cm[2] * 0.01];
      const facing: Facing = s === -1 ? mirrorFacing(def.facing) : def.facing;
      const r = projectToSkin(add(from, off), facing, def.bones ? (b) => def.bones!.some((x) => b.startsWith(x)) : undefined);
      if (r.offBy > 0.06) console.warn(`anchor ${def.regionId} side ${s}: projected ${(r.offBy * 100).toFixed(1)} cm from its target`);
      pts.push(r.point);
      nrm.push(r.normal);
      bones.push(r.bone);
      weights.push(r.weights);
    }
    anchors.push({ regionId: def.regionId, points: pts, normals: nrm, bones, weights });
  }

  // ---- gown panels (offset shell over the torso)
  const TORSO = (b: string) => /^(root|spine0\d|clavicle|shoulder01|pelvis)/.test(b);
  const xiphoidY = landmarks.xiphoid!.point[1];
  const gown: Record<string, Built> = { gown_chest: { pos: [], uv: [], src: [], idx: [] }, gown_abdomen: { pos: [], uv: [], src: [], idx: [] }, gown_back: { pos: [], uv: [], src: [], idx: [] } };
  const gownMaps: Record<string, Map<number, number>> = { gown_chest: new Map(), gown_abdomen: new Map(), gown_back: new Map() };
  const inGown = (i: number) => {
    const b = dominant(skin.src[i]!);
    const p = skin.pos[i]!;
    if (TORSO(b)) return true;
    if (b.startsWith("upperarm01")) return len(sub(p, headOf(b))) < 0.12; // short sleeve
    if (b.startsWith("upperleg01")) return p[1] > -0.16; // to upper thigh
    return false;
  };
  for (let t = 0; t < skin.idx.length; t += 3) {
    const tri = [skin.idx[t]!, skin.idx[t + 1]!, skin.idx[t + 2]!];
    if (!tri.every(inGown)) continue;
    const c = scale(add(add(skin.pos[tri[0]!]!, skin.pos[tri[1]!]!), skin.pos[tri[2]!]!), 1 / 3);
    const n = norm(add(add(normals[tri[0]!]!, normals[tri[1]!]!), normals[tri[2]!]!));
    const panel = n[2] < -0.2 ? "gown_back" : c[1] > xiphoidY ? "gown_chest" : "gown_abdomen";
    const g = gown[panel]!;
    const map = gownMaps[panel]!;
    for (const v of tri) {
      let id = map.get(v);
      if (id === undefined) {
        id = g.pos.length;
        map.set(v, id);
        const off = normals[v]![2] < 0 ? 0.014 : 0.01;
        g.pos.push(add(skin.pos[v]!, scale(normals[v]!, off)));
        g.uv.push(skin.uv[v]!);
        g.src.push(skin.src[v]!);
      }
      g.idx.push(id);
    }
  }

  // ---- hair: a close cap over the scalp (offset shell of head-dominated faces above the brow)
  const hair: Built = { pos: [], uv: [], src: [], idx: [] };
  const hairMap = new Map<number, number>();
  const browY = headOf("orbicularis03.L")[1] + 0.03;
  const earY = landmarks.ear_canal_l!.point[1];
  const headC = headOf("head");
  const inHair = (i: number) => {
    const p = skin.pos[i]!;
    if (dominant(skin.src[i]!) !== "head") return false;
    const n = normals[i]!;
    if (n[2] > 0.35 && p[1] < browY + 0.02) return false; // forehead and face stay bare
    if (Math.abs(p[0]) > Math.abs(landmarks.ear_canal_l!.point[0]) - 0.012 && p[1] < earY + 0.035 && p[2] > headC[2] - 0.03) return false; // ears
    if (len(sub(p, landmarks.mastoid_l!.point)) < 0.022 || len(sub(p, landmarks.mastoid_r!.point)) < 0.022) return false; // bare skin over the mastoid
    return p[1] > (p[2] < headC[2] - 0.02 ? earY - 0.035 : earY + 0.01);
  };
  for (let t = 0; t < skin.idx.length; t += 3) {
    const tri = [skin.idx[t]!, skin.idx[t + 1]!, skin.idx[t + 2]!];
    if (!tri.every(inHair)) continue;
    for (const v of tri) {
      let hid = hairMap.get(v);
      if (hid === undefined) {
        hid = hair.pos.length;
        hairMap.set(v, hid);
        hair.pos.push(add(skin.pos[v]!, scale(normals[v]!, 0.004)));
        hair.uv.push(skin.uv[v]!);
        hair.src.push(skin.src[v]!);
      }
      hair.idx.push(hid);
    }
  }

  // ---- body-part labels (QA): dominant bone + head geometry (ear / scalp / face)
  const earX = Math.abs(landmarks.ear_canal_l!.point[0]);
  const earZ = landmarks.ear_canal_l!.point[2];
  const partOf = (i: number): number => {
    const bone = dominant(skin.src[i]!);
    const p = skin.pos[i]!;
    const side = bone.endsWith(".L") ? "l" : bone.endsWith(".R") ? "r" : p[0] >= 0 ? "l" : "r";
    if (/^(head|jaw|orbicularis|eye)/.test(bone)) {
      // the pinna: lateral, at ear height, from behind the head joint to 1 cm in front of the canal
      // (the pre-auricular skin further forward is face)
      const nearEar = Math.abs(p[0]) > earX - 0.012 && p[1] < earY + 0.035 && p[1] > earY - 0.035 && p[2] > headC[2] - 0.03 && p[2] < earZ + 0.01;
      if (nearEar) return PART[`ear_${side}` as "ear_l"];
      return inHair(i) ? PART.scalp : PART.face;
    }
    if (bone.startsWith("neck")) return PART.neck;
    if (/^(upperarm)/.test(bone)) return PART[`upper_arm_${side}` as "upper_arm_l"];
    if (/^(lowerarm)/.test(bone)) return PART[`forearm_${side}` as "forearm_l"];
    if (/^(wrist|finger)/.test(bone)) return PART[`hand_${side}` as "hand_l"];
    if (/^(upperleg)/.test(bone)) return PART[`thigh_${side}` as "thigh_l"];
    if (/^(lowerleg)/.test(bone)) return PART[`leg_${side}` as "leg_l"];
    if (/^(foot|toe)/.test(bone)) return PART[`foot_${side}` as "foot_l"];
    return PART.torso;
  };
  const skinParts = skin.pos.map((_, i) => partOf(i));

  // ---- pupils: small discs in front of each iris, on their own bones
  const eyes = built.eyes!;
  const pupilBones: Record<string, { head: V3; parent: string }> = {};
  const pupilMesh: Built = { pos: [], uv: [], src: [], idx: [] };
  const pupilBone: string[] = [];
  for (const side of ["L", "R"] as const) {
    const { centre, fwd } = pupilCentre(side);
    pupilBones[`pupil.${side}`] = { head: centre, parent: `eye.${side}` };
    const right = norm(cross(fwd, [0, 1, 0]));
    const up = cross(right, fwd);
    const base = pupilMesh.pos.length;
    pupilMesh.pos.push(centre);
    pupilMesh.uv.push([0.5, 0.5]);
    pupilBone.push(`pupil.${side}`);
    const N = 20;
    const pr = 0.0021; // ~4 mm pupil at rest
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2;
      pupilMesh.pos.push(add(centre, add(scale(right, Math.cos(a) * pr), scale(up, Math.sin(a) * pr))));
      pupilMesh.uv.push([0.5, 0.5]);
      pupilBone.push(`pupil.${side}`);
    }
    for (let k = 0; k < N; k++) pupilMesh.idx.push(base, base + 1 + ((k + 1) % N), base + 1 + k);
  }

  // ---- eye UVs: planar projection on each eye's forward axis (iris texture)
  for (let i = 0; i < eyes.pos.length; i++) {
    const p = eyes.pos[i]!;
    const side = p[0] >= 0 ? "L" : "R";
    const eh = headOf(`eye.${side}`);
    const fwd = norm(sub(tailOf(`eye.${side}`), eh));
    const right = norm(cross(fwd, [0, 1, 0]));
    const up = cross(right, fwd);
    const d = sub(p, eh);
    const front = dot(d, fwd) > 0;
    const R = 0.0125;
    eyes.uv[i] = front ? [0.5 + dot(d, right) / (2 * R) * 0.98, 0.5 - dot(d, up) / (2 * R) * 0.98] : [0.02, 0.02];
  }

  // ---- skin texture (1024², painted in UV space from 3D landmark distances)
  const TEX = 1024;
  const rgba = paintSkin(skin, normals, landmarks, TEX, headOf);
  const skinPng = await sharp(Buffer.from(rgba), { raw: { width: TEX, height: TEX, channels: 4 } }).webp({ quality: 82 }).toBuffer();
  const eyePng = await sharp(Buffer.from(paintEye(256)), { raw: { width: 256, height: 256, channels: 4 } }).webp({ quality: 90 }).toBuffer();

  // ---------------------------------------------------------------- glTF document
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene("patient");
  const top = doc.createNode("patient");
  scene.addChild(top);

  const allBones = [...order, ...PUPILS];
  const worldHead = (b: string): V3 => (b.startsWith("pupil.") ? pupilBones[b]!.head : headOf(b));
  const parentName = (b: string): string | null => (b.startsWith("pupil.") ? pupilBones[b]!.parent : parentOf(b));
  const nodes = new Map<string, GNode>();
  for (const b of allBones) {
    const p = parentName(b);
    const t = p ? sub(worldHead(b), worldHead(p)) : worldHead(b);
    const n = doc.createNode(safe(b)).setTranslation(t.map((x) => round(x, 5)) as V3);
    nodes.set(b, n);
    (p ? nodes.get(p)! : top).addChild(n);
  }
  const skinObj: Skin = doc.createSkin("patientSkin").setSkeleton(nodes.get("root")!);
  const ibm = new Float32Array(allBones.length * 16);
  allBones.forEach((b, i) => {
    skinObj.addJoint(nodes.get(b)!);
    const h = worldHead(b);
    ibm.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -h[0], -h[1], -h[2], 1], i * 16);
  });
  skinObj.setInverseBindMatrices(doc.createAccessor().setType("MAT4").setArray(ibm).setBuffer(buffer));
  const boneIndex = new Map(allBones.map((b, i) => [b, i]));

  const tex = (name: string, data: Buffer) => doc.createTexture(name).setImage(new Uint8Array(data)).setMimeType("image/webp");
  const mats = {
    skin: doc.createMaterial("skin").setBaseColorTexture(tex("skin", skinPng)).setRoughnessFactor(0.58).setMetallicFactor(0),
    eyes: doc.createMaterial("eyes").setBaseColorTexture(tex("eye", eyePng)).setRoughnessFactor(0.15).setMetallicFactor(0),
    mouth: doc.createMaterial("mouth").setBaseColorFactor([0.86, 0.72, 0.68, 1]).setRoughnessFactor(0.45).setMetallicFactor(0),
    gown: doc.createMaterial("gown").setBaseColorFactor([0.62, 0.78, 0.86, 1]).setRoughnessFactor(0.92).setDoubleSided(true).setMetallicFactor(0),
    hair: doc.createMaterial("hair").setBaseColorFactor(hairColour).setRoughnessFactor(0.85).setMetallicFactor(0),
    pupils: doc.createMaterial("pupils").setBaseColorFactor([0.01, 0.01, 0.01, 1]).setRoughnessFactor(0.1).setMetallicFactor(0),
  };

  const addMesh = (name: string, b: Built, mat: keyof typeof mats, boneFor?: (i: number) => [string, number][], part?: (i: number) => number) => {
    const n = b.pos.length;
    const nrm = vertexNormals(b.pos, b.idx);
    const joints = new Uint8Array(n * 4);
    const wts = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const list = boneFor ? boneFor(i) : top4(b.src[i]!, "head");
      list.forEach(([bone, w], k) => {
        joints[i * 4 + k] = boneIndex.get(bone)!;
        wts[i * 4 + k] = w;
      });
    }
    const acc = (type: "VEC2" | "VEC3" | "VEC4" | "SCALAR", arr: Float32Array | Uint8Array | Uint16Array | Uint32Array) => doc.createAccessor().setType(type).setArray(arr as never).setBuffer(buffer);
    const prim = doc
      .createPrimitive()
      .setAttribute("POSITION", acc("VEC3", new Float32Array(b.pos.flat())))
      .setAttribute("NORMAL", acc("VEC3", new Float32Array(nrm.flat())))
      .setAttribute("TEXCOORD_0", acc("VEC2", new Float32Array(b.uv.flat())))
      .setAttribute("JOINTS_0", acc("VEC4", joints))
      .setAttribute("WEIGHTS_0", acc("VEC4", wts))
      .setIndices(acc("SCALAR", n > 65535 ? new Uint32Array(b.idx) : new Uint16Array(b.idx)))
      .setMaterial(mats[mat]);
    if (part) prim.setAttribute("_PART", acc("SCALAR", Uint8Array.from({ length: n }, (_, i) => part(i))));
    const mesh = doc.createMesh(name).addPrimitive(prim);
    top.addChild(doc.createNode(name).setMesh(mesh).setSkin(skinObj));
  };
  addMesh("skin", skin, "skin", undefined, (i) => skinParts[i]!);
  addMesh("eyes", eyes, "eyes", undefined, (i) => (eyes.pos[i]![0] >= 0 ? PART.eye_l : PART.eye_r));
  addMesh("mouth", built.mouth!, "mouth", undefined, () => PART.mouth);
  for (const g of Object.keys(gown)) addMesh(g, gown[g]!, "gown", undefined, () => PART.gown);
  addMesh("hair", hair, "hair", undefined, () => PART.hair);
  addMesh("pupils", pupilMesh, "pupils", (i) => [[pupilBone[i]!, 1]], (i) => (pupilMesh.pos[i]![0] >= 0 ? PART.eye_l : PART.eye_r));

  doc.createExtension(EXTTextureWebP).setRequired(true);
  // positions stay float (metres) so shaders can use bind-space distances (JVP pulse, edema)
  await doc.transform(reorder({ encoder: MeshoptEncoder }), quantize({ pattern: /^(NORMAL|TEXCOORD_0|JOINTS_0|WEIGHTS_0)$/ }));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
  fs.mkdirSync(path.dirname(OUT_GLB), { recursive: true });
  await io.write(OUT_GLB, doc);

  // ---------------------------------------------------------------- generated data
  const tris = Object.values(built).reduce((n, b) => n + b.idx.length / 3, 0) + Object.values(gown).reduce((n, b) => n + b.idx.length / 3, 0);
  console.log(`${id}: ${path.basename(OUT_GLB)} ${(fs.statSync(OUT_GLB).size / 1e6).toFixed(2)} MB, ${tris} triangles, ${allBones.length} bones; anchors ${anchors.length}; sources ${CACHE}`);
  return {
    glb: "/models/" + path.basename(OUT_GLB),
    stats: { triangles: tris, bones: allBones.length, glbBytes: fs.statSync(OUT_GLB).size },
    rig: allBones.map((b) => ({ name: safe(b), parent: parentName(b) ? safe(parentName(b)!) : null, head: worldHead(b).map((x) => round(x)) })),
    landmarks: Object.fromEntries(Object.entries(landmarks).map(([k, v]) => [k, { point: v.point.map((x) => round(x)), normal: v.normal.map((x) => round(x, 3)), bone: safe(v.bone), weights: skinWeights(v.weights) }])),
    anchors: anchors.map((a) => ({ regionId: a.regionId, points: a.points.map((p) => p.map((x) => round(x))), normals: a.normals.map((p) => p.map((x) => round(x, 3))), bones: a.bones.map(safe), weights: a.weights.map(skinWeights) })),
  };
}

function mirrorId(id: string): string {
  return id.endsWith("_l") ? id.slice(0, -2) + "_r" : id.endsWith("_r") ? id.slice(0, -2) + "_l" : id;
}
function mirrorFacing(f: Facing): Facing {
  return f === "left" ? "right" : f === "right" ? "left" : f;
}

function vertexNormals(pos: V3[], idx: number[]): V3[] {
  const n: V3[] = pos.map(() => [0, 0, 0]);
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t]!, idx[t + 1]!, idx[t + 2]!];
    const fn = cross(sub(pos[b]!, pos[a]!), sub(pos[c]!, pos[a]!));
    for (const v of [a, b, c]) n[v] = add(n[v]!, fn);
  }
  // weld normals of coincident vertices (UV seams) so shading is smooth across them
  const key = (p: V3) => `${p[0].toFixed(5)},${p[1].toFixed(5)},${p[2].toFixed(5)}`;
  const acc = new Map<string, V3>();
  pos.forEach((p, i) => acc.set(key(p), add(acc.get(key(p)) ?? [0, 0, 0], n[i]!)));
  return pos.map((p) => norm(acc.get(key(p))!));
}

// ---------------------------------------------------------------- texture painting
function hash3(x: number, y: number, z: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise3(p: V3, f: number) {
  const x = p[0] * f, y = p[1] * f, z = p[2] * f;
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t: number) => t * t * (3 - 2 * t);
  let v = 0;
  for (let dx = 0; dx < 2; dx++)
    for (let dy = 0; dy < 2; dy++)
      for (let dz = 0; dz < 2; dz++) {
        const w = (dx ? s(xf) : 1 - s(xf)) * (dy ? s(yf) : 1 - s(yf)) * (dz ? s(zf) : 1 - s(zf));
        v += w * hash3(xi + dx, yi + dy, zi + dz);
      }
  return v;
}
const mix = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

function paintSkin(
  b: { pos: V3[]; uv: [number, number][]; idx: number[] },
  normals: V3[],
  lm: Record<string, { point: V3 }>,
  size: number,
  headOf: (bone: string) => V3,
): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  const BASE: V3 = [0.78, 0.6, 0.5];
  const AREOLA: V3 = [0.55, 0.36, 0.32];
  const LIP: V3 = [0.72, 0.42, 0.42];
  const BROW: V3 = [0.25, 0.18, 0.14];
  const NAIL: V3 = [0.9, 0.76, 0.72];
  const nipL = lm.nipple_l!.point, nipR = lm.nipple_r!.point, umb = lm.umbilicus!.point, mouth = lm.mouth!.point;
  const browL = add(headOf("orbicularis03.L"), [0, 0.016, 0.006]);
  const browR = add(headOf("orbicularis03.R"), [0, 0.016, 0.006]);
  const tips = ["finger1-1.L", "finger2-1.L", "finger3-1.L", "finger4-1.L", "finger5-1.L", "finger1-1.R", "finger2-1.R", "finger3-1.R", "finger4-1.R", "finger5-1.R"].map(headOf);
  const colour = (p: V3, n: V3): V3 => {
    let c = BASE;
    const tone = noise3(p, 9) * 0.6 + noise3(p, 31) * 0.4;
    c = mix(c, [0.72, 0.52, 0.44], (tone - 0.5) * 0.5 + 0.15);
    // redder knees, elbows, knuckles, cheeks
    const knuckle = Math.min(...tips.map((t) => len(sub(p, t))));
    c = mix(c, [0.8, 0.5, 0.45], 0.25 * (1 - smooth(0.0, 0.025, knuckle)));
    for (const nip of [nipL, nipR]) {
      const d = len(sub(p, nip));
      c = mix(c, AREOLA, 1 - smooth(0.012, 0.018, d));
      c = mix(c, [0.45, 0.28, 0.25], 1 - smooth(0.003, 0.006, d));
    }
    const du = len(sub(p, umb));
    c = mix(c, [0.5, 0.34, 0.3], 1 - smooth(0.004, 0.009, du));
    const dm = sub(p, add(mouth, [0, -0.005, 0]));
    const lipD = Math.hypot(dm[0] / 0.025, dm[1] / 0.013, dm[2] / 0.03);
    if (n[2] > 0.2) c = mix(c, LIP, 1 - smooth(0.75, 1.0, lipD));
    for (const br of [browL, browR]) {
      const d = sub(p, br);
      const bd = Math.hypot(d[0] / 0.024, d[1] / 0.0045, d[2] / 0.03);
      if (n[2] > 0) c = mix(c, BROW, 0.85 * (1 - smooth(0.7, 1.0, bd)));
    }
    return c;
  };
  void NAIL;
  // fill background with base colour (bleeds into seams)
  for (let i = 0; i < size * size; i++) {
    out[i * 4] = Math.round(BASE[0] * 255);
    out[i * 4 + 1] = Math.round(BASE[1] * 255);
    out[i * 4 + 2] = Math.round(BASE[2] * 255);
    out[i * 4 + 3] = 255;
  }
  for (let t = 0; t < b.idx.length; t += 3) {
    const ids = [b.idx[t]!, b.idx[t + 1]!, b.idx[t + 2]!];
    const uv = ids.map((i) => [b.uv[i]![0] * size, b.uv[i]![1] * size]);
    const minX = Math.max(0, Math.floor(Math.min(...uv.map((u) => u[0]!))) - 1), maxX = Math.min(size - 1, Math.ceil(Math.max(...uv.map((u) => u[0]!))) + 1);
    const minY = Math.max(0, Math.floor(Math.min(...uv.map((u) => u[1]!))) - 1), maxY = Math.min(size - 1, Math.ceil(Math.max(...uv.map((u) => u[1]!))) + 1);
    const [a, bb, c] = uv as [number[], number[], number[]];
    const den = (bb[1]! - c[1]!) * (a[0]! - c[0]!) + (c[0]! - bb[0]!) * (a[1]! - c[1]!);
    if (Math.abs(den) < 1e-9) continue;
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((bb[1]! - c[1]!) * (px - c[0]!) + (c[0]! - bb[0]!) * (py - c[1]!)) / den;
        const w1 = ((c[1]! - a[1]!) * (px - c[0]!) + (a[0]! - c[0]!) * (py - c[1]!)) / den;
        const w2 = 1 - w0 - w1;
        if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue;
        const p = add(add(scale(b.pos[ids[0]!]!, w0), scale(b.pos[ids[1]!]!, w1)), scale(b.pos[ids[2]!]!, w2));
        const n = norm(add(add(scale(normals[ids[0]!]!, w0), scale(normals[ids[1]!]!, w1)), scale(normals[ids[2]!]!, w2)));
        const col = colour(p, n);
        const o = (y * size + x) * 4;
        out[o] = Math.round(Math.min(1, col[0]) * 255);
        out[o + 1] = Math.round(Math.min(1, col[1]) * 255);
        out[o + 2] = Math.round(Math.min(1, col[2]) * 255);
      }
  }
  return out;
}

function paintEye(size: number): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5, dy = (y + 0.5) / size - 0.5;
      const r = Math.hypot(dx, dy) * 2; // 0 centre … 1 edge
      const ang = Math.atan2(dy, dx);
      let c: V3 = [0.95, 0.93, 0.9]; // sclera
      c = mix(c, [0.93, 0.8, 0.78], smooth(0.7, 1.0, r) * 0.4);
      const iris = 1 - smooth(0.36, 0.4, r);
      const fib = 0.5 + 0.5 * Math.sin(ang * 40 + r * 25) * 0.5;
      const irisCol = mix([0.32, 0.2, 0.1], [0.5, 0.35, 0.18], fib * (r / 0.4));
      c = mix(c, irisCol, iris);
      c = mix(c, [0.12, 0.08, 0.05], (1 - smooth(0.34, 0.38, r)) * smooth(0.3, 0.38, r) * 0.8); // limbal ring
      c = mix(c, [0.02, 0.02, 0.02], 1 - smooth(0.12, 0.14, r));
      const o = (y * size + x) * 4;
      out[o] = c[0] * 255;
      out[o + 1] = c[1] * 255;
      out[o + 2] = c[2] * 255;
      out[o + 3] = 255;
    }
  return out;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
