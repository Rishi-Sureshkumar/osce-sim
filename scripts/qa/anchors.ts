/**
 * npm run test:anchors — Node pre-flight for the hidden exam anchors (Phase 4 M0.3), ~10 s.
 * For both body models in every drawn position:
 *   skin       every anchor point lies on the (CPU-skinned) skin: ≤ ANCHOR_SKIN_CM from it
 *   oracle     anchors agree with the independent anatomy oracle (qa/anatomy/oracle.ts)
 *   occlusion  from the region's camera shot, the first thing a click ray meets on the way to the
 *              anchor is that body part's skin, within the anchor's tolerance — not hair, an ear,
 *              another limb or the table
 * Known failures are listed in qa/xfail.json (owner M2/M3). Writes qa/anchors.json.
 */
import fs from "node:fs";
import path from "node:path";
import { DoubleSide, Ray, Vector3 } from "three";
import type { Position } from "@/domain/schemas";
import { POSITION_ANGLE } from "@/engine/patientState";
import { anchorsFor, anchorWorldNormals, anchorWorldPoints, landmarkWorld, poseFor, type Vec3 } from "@/exam3d/regionAnchors";
import { PART_NAMES } from "@/scene/patientRig.generated";
import { shotCamera } from "@/scene/shots";
import type { Pose, VariantId } from "@/scene/rig";
import { tableBoxes, type OrientedBox } from "@/scene/room/tableGeometry";
import { oracleFor, sampleWorld } from "../../qa/anatomy/oracle";
import { examinedAnchors } from "../../e2e/qa/catalogPlan";
import { skinnedPatient, type SkinnedPatient } from "./lib/patientMesh";
import { classify, report, type CheckResult } from "./lib/xfail";

/** Anchors are skinned like skin vertices (M2 bug 5), so they must sit within 3 mm of the deformed skin. */
const ANCHOR_SKIN_CM = Number(process.env.ANCHOR_SKIN_CM ?? 0.3);
export const POSITIONS: Position[] = ["supine", "reclined_30", "reclined_45", "seated", "sitting_dangling", "left_lateral_decubitus"];
const VARIANTS: VariantId[] = ["male", "female"];

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const jointWorld = (bone: string, pose: Pose): Vec3 => {
  const e = pose.world.get(bone)!.elements;
  return [e[12]!, e[13]!, e[14]!];
};

/** body parts a region's skin may legitimately belong to (regions not listed: anything but hair) */
function partsOk(regionId: string, part: string | null): boolean {
  if (part === "hair") return false;
  if (/^ear_/.test(regionId)) return true;
  if (part?.startsWith("ear_")) return false;
  const side = /_left$|_l$|_lu$|_ll$/.test(regionId) ? "l" : /_right$|_r$|_ru$|_rl$/.test(regionId) ? "r" : null;
  const limb: Record<string, string[]> = {
    hand: ["hand", "forearm"],
    wrist: ["forearm", "hand"],
    brachioradialis: ["forearm"],
    elbow: ["upper_arm", "forearm"],
    biceps: ["upper_arm", "forearm"],
    triceps: ["upper_arm"],
    upper: ["upper_arm"],
    arm: ["upper_arm", "forearm"],
    knee: ["thigh", "leg"],
    patellar: ["thigh", "leg"],
    shin: ["leg"],
    calf: ["leg"],
    leg: ["leg"],
    ankle: ["leg", "foot"],
    achilles: ["leg", "foot"],
    foot: ["foot"],
    sole: ["foot"],
    hip: ["thigh", "torso"],
  };
  const key = Object.keys(limb).find((k) => regionId.startsWith(k));
  if (!key || !side || !part) return true;
  return limb[key]!.some((p) => part === `${p}_${side}`);
}

function rayBox(ray: Ray, b: OrientedBox): number | null {
  // into the box frame: translate to centre, rotate by −rotX about X
  const c = Math.cos(-b.rotX);
  const s = Math.sin(-b.rotX);
  const tr = (v: Vector3, point: boolean) => {
    const x = point ? v.x - b.center[0] : v.x;
    const y = point ? v.y - b.center[1] : v.y;
    const z = point ? v.z - b.center[2] : v.z;
    return new Vector3(x, y * c - z * s, y * s + z * c);
  };
  const o = tr(ray.origin, true);
  const d = tr(ray.direction, false);
  let t0 = -Infinity;
  let t1 = Infinity;
  for (let k = 0; k < 3; k++) {
    const h = b.size[k]! / 2;
    const ok = o.getComponent(k);
    const dk = d.getComponent(k);
    if (Math.abs(dk) < 1e-9) {
      if (ok < -h || ok > h) return null;
      continue;
    }
    const a = (-h - ok) / dk;
    const bb = (h - ok) / dk;
    t0 = Math.max(t0, Math.min(a, bb));
    t1 = Math.min(t1, Math.max(a, bb));
  }
  return t1 >= Math.max(t0, 0) ? Math.max(t0, 0) : null;
}

/** first surface a ray from the camera meets on its way to `target`, among the patient's visible meshes and the table */
function firstHit(p: SkinnedPatient, from: Vec3, target: Vec3, angle: number) {
  const o = new Vector3(...from);
  const dir = new Vector3(...target).sub(o).normalize();
  const ray = new Ray(o, dir);
  let best: { what: string; part: string | null; t: number; point: Vec3 } | null = null;
  for (const m of p.meshes) {
    if (m.mesh.name.startsWith("gown")) continue; // the region is exposed for its exam
    const h = m.bvh.raycastFirst(ray, DoubleSide);
    if (!h) continue;
    if (best && h.distance >= best.t) continue;
    let part: string | null = null;
    if (m.mesh.parts && h.face) part = PART_NAMES[m.mesh.parts[h.face.a]!] ?? null;
    best = { what: m.mesh.name, part, t: h.distance, point: [h.point.x, h.point.y, h.point.z] };
  }
  for (const b of tableBoxes(angle)) {
    const t = rayBox(ray, b);
    if (t !== null && (!best || t < best.t)) {
      const q = o.clone().addScaledVector(dir, t);
      best = { what: `table:${b.name}`, part: null, t, point: [q.x, q.y, q.z] };
    }
  }
  return best;
}

async function main() {
  const t0 = Date.now();
  const results: CheckResult[] = [];
  const rows: Record<string, unknown>[] = [];
  for (const variant of VARIANTS) {
    const oracle = await oracleFor(variant);
    const examined = examinedAnchors(variant);
    for (const position of POSITIONS) {
      const angle = POSITION_ANGLE[position];
      const pose = poseFor(position, angle, variant);
      const sp = await skinnedPatient(pose);
      const skin = sp.byName("skin")!;
      // ---- skin (the eye targets are the pupils: measured against the eye surface)
      const eyeSurface = ["eyes", "pupils"].map((n) => sp.byName(n)).filter((m): m is NonNullable<typeof m> => !!m);
      for (const a of anchorsFor(variant)) {
        const surfaces = /^eye_/.test(a.regionId) ? [skin, ...eyeSurface] : [skin];
        anchorWorldPoints(a.regionId, pose).forEach((w, i) => {
          const cm = Math.min(...surfaces.map((m) => m.bvh.closestPointToPoint(new Vector3(...w))?.distance ?? 1)) * 100;
          const id = `anchors:skin:${variant}:${position}:${a.regionId}${a.points.length > 1 ? `#${i}` : ""}`;
          results.push({ id, pass: cm <= ANCHOR_SKIN_CM, detail: `${cm.toFixed(2)} cm from the ${surfaces.length > 1 ? "eye or skin" : "skin"} (max ${ANCHOR_SKIN_CM})` });
          rows.push({ check: "skin", variant, position, regionId: a.regionId, cm: +cm.toFixed(2) });
        });
      }
      // ---- oracle
      for (const o of oracle) {
        const mesh = sp.byName(o.sample.mesh)!;
        const truth = sampleWorld(o.sample, mesh.positions);
        const pts = o.landmark ? [landmarkWorld(o.landmark, o.regionId, pose)].filter((x): x is Vec3 => !!x) : anchorWorldPoints(o.regionId, pose);
        // along a limb axis (cuff height): only the component along the axis counts, if the point is on that limb (≤ 8 cm)
        const along = (p: Vec3) => {
          if (!o.axis) return dist(p, truth);
          const a = jointWorld(o.axis.from, pose);
          const b = jointWorld(o.axis.to, pose);
          const ax = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
          const l = Math.hypot(ax[0]!, ax[1]!, ax[2]!) || 1;
          const d = [p[0] - truth[0], p[1] - truth[1], p[2] - truth[2]];
          return dist(p, truth) > 0.08 ? dist(p, truth) : Math.abs((d[0]! * ax[0]! + d[1]! * ax[1]! + d[2]! * ax[2]!) / l);
        };
        const cm = pts.length ? Math.min(...pts.map(along)) * 100 : Infinity;
        const id = `anchors:oracle:${variant}:${position}:${o.id}`;
        results.push({ id, pass: cm <= o.toleranceCm, detail: `${Number.isFinite(cm) ? cm.toFixed(1) : "no anchor"} cm from the anatomical point (max ${o.toleranceCm}) — ${o.note}` });
        rows.push({ check: "oracle", variant, position, rule: o.id, cm: +cm.toFixed(2), max: o.toleranceCm });
      }
      // ---- occlusion (only where the region is actually examined)
      for (const e of examined) {
        if (!e.positions.includes(position) || !e.shot) continue;
        const cam = shotCamera(e.shot, pose).position;
        const tol = anchorsFor(variant).find((a) => a.regionId === e.regionId)!.toleranceCm;
        const normals = anchorWorldNormals(e.regionId, pose);
        for (const [i, w] of anchorWorldPoints(e.regionId, pose).entries()) {
          // a ray at the anchor itself, and one aimed 3 mm under the skin: an anchor on a silhouette
          // (the lateral hip seen from above) is clickable if either reaches the right skin
          const n = normals[i] ?? [0, 0, 0];
          const tries = [w, [w[0] - n[0] * 0.003, w[1] - n[1] * 0.003, w[2] - n[2] * 0.003] as Vec3].map((aim) => {
            const h = firstHit(sp, cam, aim, angle);
            const offCm = h ? dist(h.point, w) * 100 : Infinity;
            const isEye = /^eye_/.test(e.regionId);
            const surfaceOk = !!h && (h.what === "skin" || (isEye && (h.what === "eyes" || h.what === "pupils")) || (e.regionId === "mouth" && h.what === "mouth"));
            return { h, offCm, pass: surfaceOk && offCm <= tol && partsOk(e.regionId, h?.part ?? null) };
          });
          const { h, offCm, pass } = tries.find((t) => t.pass) ?? tries[0]!;
          const id = `anchors:occlusion:${variant}:${position}:${e.regionId}${i ? `#${i}` : ""}`;
          results.push({ id, pass, detail: h ? `from the ${e.shot} shot the ray first meets ${h.what}${h.part ? ` (${h.part})` : ""} ${offCm.toFixed(1)} cm from the anchor (tolerance ${tol})` : "the ray meets nothing" });
          rows.push({ check: "occlusion", variant, position, regionId: e.regionId, shot: e.shot, first: h?.what ?? null, part: h?.part ?? null, offCm: +offCm.toFixed(2) });
        }
      }
    }
  }
  const classified = classify(results);
  fs.mkdirSync(path.join(process.cwd(), "qa"), { recursive: true });
  fs.writeFileSync(
    path.join(process.cwd(), "qa/anchors.json"),
    JSON.stringify({ generated: "npm run test:anchors", skinThresholdCm: ANCHOR_SKIN_CM, results: classified.results.map(({ id, status, detail }) => ({ id, status, detail })), rows }, null, 1),
  );
  const ok = report("test:anchors", classified, { prefix: "anchors:" });
  console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s; details in qa/anchors.json)`);
  process.exitCode = ok ? 0 : 1;
}

void main();
