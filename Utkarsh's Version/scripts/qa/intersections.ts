/**
 * npm run test:intersections — does the patient poke through the bed, the gown or the drapes?
 * (Phase 4 M0.4). CPU-skins both models (scripts/qa/lib/patientMesh.ts) in every drawn position
 * and drape state, then counts skin vertices that are
 *   bed    inside an exam-table box (src/scene/room/tableGeometry.ts)
 *   gown   outside a visible gown panel they lie under (ray along the skin normal meets the
 *          panel behind the vertex instead of in front of it)
 *   sheet  outside the leg sheet's arc (src/scene/drapeGeometry.ts) while the legs are covered
 * A combination passes when ≤ 0.5% of skin vertices poke through. Known failures are xfail
 * (owner M3). Writes qa/intersections.json.
 */
import fs from "node:fs";
import path from "node:path";
import { DoubleSide, Ray, Vector3 } from "three";
import type { DrapeZone, Position } from "@/domain/schemas";
import { POSITION_ANGLE } from "@/engine/patientState";
import { poseFor } from "@/exam3d/regionAnchors";
import { PART_NAMES } from "@/scene/patientRig.generated";
import { legSheetFrame, legSheetPenetration } from "@/scene/drapeGeometry";
import type { VariantId } from "@/scene/rig";
import { insideBox, tableAngle, tableBoxes } from "@/scene/room/tableGeometry";
import { skinnedPatient } from "./lib/patientMesh";
import { classify, report, type CheckResult } from "./lib/xfail";

const MAX_FRACTION = 0.005;
const POSITIONS: Position[] = ["supine", "reclined_30", "reclined_45", "seated", "sitting_dangling", "left_lateral_decubitus", "seated_leaning_forward"];
const VARIANTS: VariantId[] = ["male", "female"];
/** gown panel → the drape zone that shows it (PatientModel) */
const GOWN_ZONE: Record<string, DrapeZone> = { gown_chest: "chest", gown_back: "chest", gown_abdomen: "abdomen" };
/** drape states: everything covered, each zone uncovered alone, everything uncovered */
const DRAPE_STATES: { id: string; drape: Record<DrapeZone, boolean> }[] = [
  { id: "covered", drape: { chest: true, abdomen: true, legs: true } },
  { id: "chest-exposed", drape: { chest: false, abdomen: true, legs: true } },
  { id: "abdomen-exposed", drape: { chest: true, abdomen: false, legs: true } },
  { id: "legs-exposed", drape: { chest: true, abdomen: true, legs: false } },
  { id: "all-exposed", drape: { chest: false, abdomen: false, legs: false } },
];
const LEG_PARTS = new Set(["thigh_l", "thigh_r", "leg_l", "leg_r", "foot_l", "foot_r"].map((p) => PART_NAMES.indexOf(p as never)));
/** how far from a gown panel a skin vertex can be and still count as under it */
const GOWN_REACH = 0.03;

async function main() {
  const t0 = Date.now();
  const results: CheckResult[] = [];
  const rows: Record<string, unknown>[] = [];
  for (const variant of VARIANTS) {
    for (const position of POSITIONS) {
      const angle = POSITION_ANGLE[position];
      const pose = poseFor(position, angle, variant);
      const sp = await skinnedPatient(pose);
      const skin = sp.byName("skin")!;
      const n = skin.positions.length / 3;
      // the table's head section as the app sets it for the position (not the trunk angle)
      const boxes = tableBoxes(tableAngle(position, angle));
      const sheet = legSheetFrame(pose);
      const lateral = position === "left_lateral_decubitus";
      const p = new Vector3();
      const nrm = new Vector3();

      // per vertex, once per pose: in the bed? which gown panels is it outside of? through the sheet?
      const inBed = new Uint8Array(n);
      const throughSheet = new Uint8Array(n);
      const outsideGown: Record<string, Uint8Array> = {};
      for (const g of Object.keys(GOWN_ZONE)) outsideGown[g] = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        p.fromArray(skin.positions, i * 3);
        nrm.fromArray(skin.normals, i * 3);
        if (boxes.some((b) => insideBox([p.x, p.y, p.z], b, 0.004))) inBed[i] = 1;
        if (!lateral && skin.mesh.parts && LEG_PARTS.has(skin.mesh.parts[i]!)) {
          const pen = legSheetPenetration([p.x, p.y, p.z], sheet);
          if (pen !== null && pen > 0.002) throughSheet[i] = 1;
        }
        for (const g of Object.keys(GOWN_ZONE)) {
          const gm = sp.byName(g);
          if (!gm) continue;
          const out = gm.bvh.raycastFirst(new Ray(p.clone().addScaledVector(nrm, 0.001), nrm.clone()), DoubleSide);
          if (out && out.distance <= GOWN_REACH) continue; // the panel is in front of the skin: covered
          const back = gm.bvh.raycastFirst(new Ray(p.clone().addScaledVector(nrm, -0.001), nrm.clone().negate()), DoubleSide);
          if (back && back.distance <= GOWN_REACH) outsideGown[g]![i] = 1; // the panel is behind the skin: poking through
        }
      }

      for (const state of DRAPE_STATES) {
        const count = { bed: 0, gown: 0, sheet: 0 };
        for (let i = 0; i < n; i++) {
          if (inBed[i]) count.bed++;
          if (state.drape.legs && throughSheet[i]) count.sheet++;
          if (Object.keys(GOWN_ZONE).some((g) => state.drape[GOWN_ZONE[g]!] && outsideGown[g]![i])) count.gown++;
        }
        for (const kind of ["bed", "gown", "sheet"] as const) {
          const frac = count[kind] / n;
          const id = `intersections:${variant}:${position}:${state.id}:${kind}`;
          results.push({ id, pass: frac <= MAX_FRACTION, detail: `${count[kind]} of ${n} skin vertices (${(frac * 100).toFixed(2)}%, max ${MAX_FRACTION * 100}%)` });
          rows.push({ variant, position, drape: state.id, kind, vertices: count[kind], percent: +(frac * 100).toFixed(3) });
        }
      }
    }
  }
  const classified = classify(results);
  fs.mkdirSync(path.join(process.cwd(), "qa"), { recursive: true });
  fs.writeFileSync(
    path.join(process.cwd(), "qa/intersections.json"),
    JSON.stringify({ generated: "npm run test:intersections", maxPercent: MAX_FRACTION * 100, results: classified.results.map(({ id, status, detail }) => ({ id, status, detail })), rows }, null, 1),
  );
  const ok = report("test:intersections", classified, { prefix: "intersections:" });
  console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s; details in qa/intersections.json)`);
  process.exitCode = ok ? 0 : 1;
}

void main();
