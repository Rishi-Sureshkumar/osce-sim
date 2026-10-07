/**
 * Anatomy oracle (Phase 4 M0.3): where a clinician would put the instrument, worked out
 * INDEPENDENTLY of src/exam3d/anchorDefs.ts. The anchors are checked against these points, so a
 * misplaced anchor (mastoid on the ear, a cuff site on the forearm) shows up as a failure instead
 * of the anchor agreeing with itself.
 *
 * Rules use joint centres (MakeHuman skeleton) and a few unambiguous surface landmarks (ear canal,
 * sternal notch, xiphoid, umbilicus, pupils), in bind space (metres; +X = patient's left,
 * +Y = up, +Z = front). Each rule finds a skin point by a ray from inside the body (or the nearest
 * skin vertex of allowed body parts), and the point is carried into any pose by skinning
 * (scripts/qa/lib/patientMesh.ts), so it moves with the skin.
 */
import { DoubleSide, Ray, Vector3 } from "three";
import { MeshBVH } from "three-mesh-bvh";
import { PART_NAMES, PATIENT_VARIANTS } from "@/scene/patientRig.generated";
import type { VariantId, Vec3 } from "@/scene/rig";
import { geometryOf, loadPatient, type PatientMesh } from "../../scripts/qa/lib/patientMesh";

/** A point on a mesh surface: barycentric weights over vertices of one mesh. */
export interface SurfaceSample {
  mesh: string;
  vertices: [number, number, number];
  weights: [number, number, number];
  bind: Vec3;
}

export interface OracleRule {
  /** `<regionId>` or `<regionId>#<sequence landmark>` (e.g. "ear_left#mastoid") */
  id: string;
  regionId: string;
  landmark?: string;
  /** anchor–oracle distance allowed (cm) */
  toleranceCm: number;
  /** measure only along this limb axis (joint → joint), e.g. a cuff's height on the arm: anywhere around the arm is fine */
  axis?: { from: string; to: string };
  note: string;
}

export interface OraclePoint extends OracleRule {
  sample: SurfaceSample;
}

type Side = "left" | "right";
const SIDES: Side[] = ["left", "right"];
const B = (side: Side) => (side === "left" ? "L" : "R");
/** +1 toward the patient's left */
const sx = (side: Side) => (side === "left" ? 1 : -1);

interface Ctx {
  variant: VariantId;
  skin: PatientMesh;
  bvh: MeshBVH;
  meshes: Map<string, { mesh: PatientMesh; bvh: MeshBVH }>;
  joint(name: string): Vector3;
  landmark(name: string): Vector3;
}

const v = (a: Vec3 | Vector3) => (a instanceof Vector3 ? a.clone() : new Vector3(...a));
const perp = (d: Vector3, axis: Vector3) => d.clone().sub(axis.clone().multiplyScalar(d.dot(axis))).normalize();

/** exit point of a ray from inside the body through a mesh (default: the skin) */
function rayToSkin(c: Ctx, origin: Vector3, dir: Vector3, meshName = "skin"): SurfaceSample | null {
  const m = c.meshes.get(meshName);
  if (!m) return null;
  const hit = m.bvh.raycastFirst(new Ray(origin, dir.clone().normalize()), DoubleSide);
  if (!hit || hit.faceIndex === undefined || hit.faceIndex === null) return null;
  return sampleOnFace(m.mesh, hit.faceIndex, hit.point);
}

function sampleOnFace(mesh: PatientMesh, face: number, p: Vector3): SurfaceSample {
  const ids = [mesh.indices[face * 3]!, mesh.indices[face * 3 + 1]!, mesh.indices[face * 3 + 2]!] as [number, number, number];
  const [a, b, cc] = ids.map((i) => new Vector3().fromArray(mesh.positions, i * 3));
  // barycentric of p in (a, b, c)
  const v0 = b!.clone().sub(a!);
  const v1 = cc!.clone().sub(a!);
  const v2 = p.clone().sub(a!);
  const d00 = v0.dot(v0);
  const d01 = v0.dot(v1);
  const d11 = v1.dot(v1);
  const d20 = v2.dot(v0);
  const d21 = v2.dot(v1);
  const den = d00 * d11 - d01 * d01 || 1;
  const wb = (d11 * d20 - d01 * d21) / den;
  const wc = (d00 * d21 - d01 * d20) / den;
  return { mesh: mesh.name, vertices: ids, weights: [1 - wb - wc, wb, wc], bind: [p.x, p.y, p.z] };
}

/** nearest skin vertex to a target among the given body parts, optionally facing a direction */
function nearestSkin(c: Ctx, target: Vector3, parts: string[], facing?: Vector3): SurfaceSample | null {
  const allowed = new Set(parts.map((p) => PART_NAMES.indexOf(p as never)));
  let best = -1;
  let bestD = Infinity;
  const p = new Vector3();
  const n = new Vector3();
  for (let i = 0; i < c.skin.positions.length / 3; i++) {
    if (c.skin.parts && !allowed.has(c.skin.parts[i]!)) continue;
    if (facing && n.fromArray(c.skin.normals, i * 3).dot(facing) < 0.2) continue;
    const d = p.fromArray(c.skin.positions, i * 3).distanceToSquared(target);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  if (best < 0) return null;
  const q = new Vector3().fromArray(c.skin.positions, best * 3);
  return { mesh: c.skin.name, vertices: [best, best, best], weights: [1, 0, 0], bind: [q.x, q.y, q.z] };
}

/** front-most skin at (x, y), cast from in front of the body (bind space) */
function frontSkin(c: Ctx, x: number, y: number): SurfaceSample | null {
  return rayToSkin(c, new Vector3(x, y, 0.6), new Vector3(0, 0, -1));
}

/**
 * The navel, found from the mesh itself: the deepest dimple on the front midline between the hip
 * joints and the lower ribs (depth relative to the skin 2 cm around it).
 */
function navel(c: Ctx): Vector3 {
  const z = (x: number, y: number) => {
    const s = frontSkin(c, x, y);
    return s ? s.bind[2] : NaN;
  };
  const lo = c.joint("upperleg01_L").y + 0.03;
  const hi = c.joint("spine01").y - 0.05;
  let best = { y: (lo + hi) / 2, d: -Infinity };
  for (let y = lo; y <= hi; y += 0.0025) {
    const ring = (z(0.02, y) + z(-0.02, y) + z(0, y + 0.02) + z(0, y - 0.02)) / 4;
    const d = ring - z(0, y);
    if (d > best.d) best = { y, d };
  }
  return new Vector3(0, best.y, z(0, best.y));
}

type Builder = (c: Ctx) => SurfaceSample | null;

function rules(): { rule: OracleRule; build: Builder }[] {
  const out: { rule: OracleRule; build: Builder }[] = [];
  const add = (rule: OracleRule, build: Builder) => {
    out.push({ rule, build });
  };
  const FRONT = new Vector3(0, 0, 1);
  const BACK = new Vector3(0, 0, -1);
  const DOWN = new Vector3(0, -1, 0);

  for (const side of SIDES) {
    const b = B(side);
    const lr = side === "left" ? "l" : "r";
    // ---- head
    add(
      { id: `ear_${side}#mastoid`, regionId: `ear_${side}`, landmark: "mastoid", toleranceCm: 1.2, note: "mastoid process: ~2 cm behind and ~1.5 cm below the ear canal, on the scalp/neck skin (not the ear)" },
      (c) => nearestSkin(c, c.landmark(`ear_canal_${lr}`).add(new Vector3(0, -0.015, -0.02)), ["scalp", "neck", "face"]),
    );
    add(
      { id: `eye_${side}`, regionId: `eye_${side}`, toleranceCm: 0.6, note: "front of the pupil (the penlight's target), on the eye surface" },
      (c) => {
        const pupil = c.joint(`pupil_${b}`);
        return rayToSkin(c, pupil.clone().add(new Vector3(0, 0, 0.05)), BACK, "eyes");
      },
    );
    // ---- arm (joints: shoulder = upperarm01, elbow = lowerarm01, wrist = wrist)
    const arm = (c: Ctx) => {
      const S = c.joint(`upperarm01_${b}`);
      const E = c.joint(`lowerarm01_${b}`);
      const W = c.joint(`wrist_${b}`);
      const T = c.joint(`finger1-1_${b}`);
      return { S, E, W, T, up: S.clone().sub(E).normalize(), fore: E.clone().sub(W).normalize() };
    };
    add(
      { id: `upper_arm_${side}`, regionId: `upper_arm_${side}`, toleranceCm: 3, axis: { from: `lowerarm01_${b}`, to: `upperarm01_${b}` }, note: "BP cuff centre: lower edge 2–3 cm above the antecubital crease + half a cuff width (~6 cm), front of the arm over the brachial artery" },
      (c) => {
        const a = arm(c);
        return rayToSkin(c, a.E.clone().addScaledVector(a.up, 0.085), perp(FRONT, a.up));
      },
    );
    add(
      { id: `biceps_tendon_${side}`, regionId: `biceps_tendon_${side}`, toleranceCm: 2, note: "biceps tendon: in the antecubital fossa, front of the elbow joint" },
      (c) => {
        const a = arm(c);
        return rayToSkin(c, a.E.clone(), perp(FRONT, a.up));
      },
    );
    add(
      { id: `triceps_tendon_${side}`, regionId: `triceps_tendon_${side}`, toleranceCm: 2, note: "triceps tendon: 2–3 cm above the olecranon, back of the arm" },
      (c) => {
        const a = arm(c);
        return rayToSkin(c, a.E.clone().addScaledVector(a.up, 0.025), perp(BACK, a.up));
      },
    );
    add(
      { id: `brachioradialis_${side}`, regionId: `brachioradialis_${side}`, toleranceCm: 2, note: "brachioradialis: distal radius 3–5 cm above the wrist, thumb side" },
      (c) => {
        const a = arm(c);
        return rayToSkin(c, a.W.clone().addScaledVector(a.fore, 0.04), perp(a.T.clone().sub(a.W), a.fore));
      },
    );
    add(
      { id: `wrist_${side}`, regionId: `wrist_${side}`, toleranceCm: 2.5, note: "radial pulse: ~2 cm above the wrist crease on the thumb side" },
      (c) => {
        const a = arm(c);
        return rayToSkin(c, a.W.clone().addScaledVector(a.fore, 0.02), perp(a.T.clone().sub(a.W), a.fore));
      },
    );
    // ---- leg (knee = lowerleg01, ankle = foot, toes = toe1-1)
    const leg = (c: Ctx) => {
      const K = c.joint(`lowerleg01_${b}`);
      const A = c.joint(`foot_${b}`);
      const T = c.joint(`toe1-1_${b}`);
      return { K, A, T, down: A.clone().sub(K).normalize() };
    };
    add(
      { id: `patellar_tendon_${side}`, regionId: `patellar_tendon_${side}`, toleranceCm: 2, note: "patellar tendon: just below the lower pole of the patella, front of the knee" },
      (c) => {
        const l = leg(c);
        return rayToSkin(c, l.K.clone().addScaledVector(l.down, 0.03), perp(FRONT, l.down));
      },
    );
    add(
      { id: `achilles_${side}`, regionId: `achilles_${side}`, toleranceCm: 2, note: "Achilles tendon: back of the ankle, 2–4 cm above the heel" },
      (c) => {
        const l = leg(c);
        return rayToSkin(c, l.A.clone().addScaledVector(l.down, -0.03), perp(BACK, l.down));
      },
    );
    add(
      { id: `sole_${side}`, regionId: `sole_${side}`, toleranceCm: 3, note: "sole of the foot, mid-foot (plantar surface)" },
      (c) => {
        const l = leg(c);
        return rayToSkin(c, l.A.clone().lerp(l.T, 0.45), DOWN);
      },
    );
    add(
      { id: `foot_lateral_${side}`, regionId: `foot_lateral_${side}`, toleranceCm: 4, note: "lateral border of the foot (S1 dermatome), mid-foot (a broad area)" },
      (c) => {
        const l = leg(c);
        return rayToSkin(c, l.A.clone().lerp(l.T, 0.5).add(new Vector3(0, -0.02, 0)), new Vector3(sx(side), 0, 0));
      },
    );
    add(
      { id: `leg_medial_${side}`, regionId: `leg_medial_${side}`, toleranceCm: 5, note: "medial lower leg (L4 dermatome), mid-shin (a broad area)" },
      (c) => {
        const l = leg(c);
        return rayToSkin(c, l.K.clone().lerp(l.A, 0.5), perp(new Vector3(-sx(side), 0, 0.4), l.down));
      },
    );
  }

  // ---- abdomen: quadrant centres ~6.5 cm lateral and ~6 cm above/below the navel (found from
  // the skin, not the umbilicus landmark), on the front surface
  const quad = (id: string, side: Side, upper: boolean): void =>
    add({ id, regionId: id, toleranceCm: 4, note: `${upper ? "upper" : "lower"} ${side} quadrant centre: ~6.5 cm ${side} of the midline, ~6 cm ${upper ? "above" : "below"} the navel (navel found as the deepest midline dimple)` }, (c) => {
      const n = navel(c);
      return frontSkin(c, sx(side) * 0.065, n.y + (upper ? 0.06 : -0.06));
    });
  quad("abd_ruq", "right", true);
  quad("abd_luq", "left", true);
  quad("abd_rlq", "right", false);
  quad("abd_llq", "left", false);

  // ---- precordium: intercostal spaces from the sternal notch → xiphoid length (L)
  const ics = (frac: number, x: number) => (c: Ctx) => {
    const N = c.landmark("sternal_notch");
    const X = c.landmark("xiphoid");
    const y = N.y + (X.y - N.y) * frac;
    return frontSkin(c, x, y);
  };
  add({ id: "cardiac_aortic", regionId: "cardiac_aortic", toleranceCm: 2, note: "2nd ICS, right sternal border (~27% notch→xiphoid, 2.5 cm right)" }, ics(0.27, -0.025));
  add({ id: "cardiac_pulmonic", regionId: "cardiac_pulmonic", toleranceCm: 2, note: "2nd ICS, left sternal border" }, ics(0.27, 0.025));
  add({ id: "cardiac_erbs", regionId: "cardiac_erbs", toleranceCm: 2, note: "3rd ICS, left sternal border (~45%)" }, ics(0.45, 0.025));
  add({ id: "cardiac_tricuspid", regionId: "cardiac_tricuspid", toleranceCm: 2, note: "4th–5th ICS, left lower sternal border (~80%)" }, ics(0.8, 0.02));
  add({ id: "cardiac_mitral", regionId: "cardiac_mitral", toleranceCm: 2.5, note: "apex: 5th ICS, mid-clavicular line (~9 cm left of the midline, ~95%)" }, ics(0.95, 0.09));
  return out;
}

const oracleCache = new Map<VariantId, OraclePoint[]>();

/** The oracle points for a body variant (bind-space surface samples). */
export async function oracleFor(variant: VariantId): Promise<OraclePoint[]> {
  const hit = oracleCache.get(variant);
  if (hit) return hit;
  const meshes = await loadPatient(variant);
  const byName = new Map(meshes.map((m) => [m.name, { mesh: m, bvh: new MeshBVH(geometryOf(m.positions, m.indices)) }]));
  const skin = byName.get("skin")!;
  const rig = new Map(PATIENT_VARIANTS[variant].rig.map((r) => [r.name, r.head]));
  const lms = PATIENT_VARIANTS[variant].landmarks;
  const ctx: Ctx = {
    variant,
    skin: skin.mesh,
    bvh: skin.bvh,
    meshes: byName,
    joint: (name) => {
      const h = rig.get(name);
      if (!h) throw new Error(`oracle: no joint ${name}`);
      return v(h);
    },
    landmark: (name) => {
      const l = lms[name];
      if (!l) throw new Error(`oracle: no landmark ${name}`);
      return v(l.point);
    },
  };
  const out: OraclePoint[] = [];
  for (const { rule, build } of rules()) {
    const sample = build(ctx);
    if (!sample) throw new Error(`oracle: rule ${rule.id} found no surface on the ${variant} model`);
    out.push({ ...rule, sample });
  }
  oracleCache.set(variant, out);
  return out;
}

/** World position of a surface sample, given that mesh's skinned positions. */
export function sampleWorld(s: SurfaceSample, skinnedPositions: Float32Array): Vec3 {
  const out = [0, 0, 0];
  s.vertices.forEach((vi, k) => {
    for (let d = 0; d < 3; d++) out[d] = out[d]! + skinnedPositions[vi * 3 + d]! * s.weights[k]!;
  });
  return out as Vec3;
}
