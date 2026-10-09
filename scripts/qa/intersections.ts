/**
 * npm run test:intersections — does the patient poke through the bed, the gown or the drapes?
 * (Phase 4 M0.4). CPU-skins both models (scripts/qa/lib/patientMesh.ts) in every drawn position
 * and drape state, then counts skin vertices that are
 *   bed    inside an exam-table box (src/scene/room/tableGeometry.ts)
 *   gown   outside a visible gown panel they lie under (ray along the skin normal meets the
 *          panel behind the vertex instead of in front of it)
 *   sheet  under a covered drape section of the sheet (the pelvis always; each leg when covered) but
 *          not under the drawn sheet (src/scene/sheetGeometry.ts), or poking up through it
 * A combination passes when ≤ 0.5% of skin vertices poke through. Known failures are xfail
 * (owner M3). Writes qa/intersections.json.
 */
import fs from "node:fs";
import path from "node:path";
import { DoubleSide, Plane, Ray, Vector3 } from "three";
import type { DrapeSection, Position } from "@/domain/schemas";
import { POSITION_ANGLE } from "@/engine/patientState";
import { poseFor } from "@/exam3d/regionAnchors";
import { buildSheet, classifySheet, coverageAt, coverageField, nodeShown, sheetCuts, sheetPenetration, skinWorld, underOtherSkin, type SkinData } from "@/scene/sheetGeometry";
import { TABLE } from "@/scene/rig";
import type { VariantId } from "@/scene/rig";
import { insideBox, tableAngle, tableBoxes } from "@/scene/room/tableGeometry";
import { loadPatient, skinnedPatient } from "./lib/patientMesh";
import { classify, report, type CheckResult } from "./lib/xfail";

const MAX_FRACTION = 0.005;
const POSITIONS: Position[] = ["supine", "reclined_30", "reclined_45", "seated", "sitting_dangling", "left_lateral_decubitus", "seated_leaning_forward"];
const VARIANTS: VariantId[] = ["male", "female"];
type Sections = Record<DrapeSection, boolean>;
const ALL: Sections = { chest_left: true, chest_right: true, back: true, abdomen: true, pelvis: true, leg_left: true, leg_right: true };
const off = (...secs: DrapeSection[]): Sections => ({ ...ALL, ...Object.fromEntries(secs.map((x) => [x, false])) });
/** drape states: everything covered, each section (or side) uncovered alone, everything uncovered */
const DRAPE_STATES: { id: string; sections: Sections }[] = [
  { id: "covered", sections: ALL },
  { id: "chest-left-exposed", sections: off("chest_left") },
  { id: "chest-exposed", sections: off("chest_left", "chest_right") },
  { id: "back-exposed", sections: off("back") },
  { id: "abdomen-exposed", sections: off("abdomen") },
  { id: "leg-left-exposed", sections: off("leg_left") },
  { id: "legs-exposed", sections: off("leg_left", "leg_right") },
  { id: "all-exposed", sections: off("chest_left", "chest_right", "back", "abdomen", "leg_left", "leg_right") },
];
/** is a gown panel drawn for these sections (PatientModel)? */
const GOWN_SHOWN: Record<string, (s: Sections) => boolean> = {
  gown_chest: (s) => s.chest_left || s.chest_right,
  gown_back: (s) => s.back,
  gown_abdomen: (s) => s.abdomen,
};
/** how far from a gown panel a skin vertex can be and still count as under it */
const GOWN_REACH = 0.03;

async function main() {
  const t0 = Date.now();
  const results: CheckResult[] = [];
  const rows: Record<string, unknown>[] = [];
  for (const variant of VARIANTS) {
    const skinMesh = (await loadPatient(variant)).find((m) => m.name === "skin")!;
    const skinData: SkinData = { bind: skinMesh.positions, joints: skinMesh.joints, weights: skinMesh.weights, jointNames: skinMesh.jointNames, count: skinMesh.positions.length / 3 };
    const owner = classifySheet(skinData, sheetCuts(variant, skinData));
    for (const position of POSITIONS) {
      const angle = POSITION_ANGLE[position];
      const pose = poseFor(position, angle, variant);
      const sp = await skinnedPatient(pose);
      const skin = sp.byName("skin")!;
      const n = skin.positions.length / 3;
      // the table's head section as the app sets it for the position (not the trunk angle)
      const boxes = tableBoxes(tableAngle(position, angle), variant);
      const lapOnly = position === "sitting_dangling";
      const sheet = buildSheet(skinWorld(skinData, pose, owner), owner, { lapOnly });
      // the chest panel's midline (one side uncovered: PatientModel clips the panel there)
      const spine = pose.world.get("spine01")!;
      const leftDir = new Vector3(1, 0, 0).transformDirection(spine);
      const midline = new Plane().setFromNormalAndCoplanarPoint(leftDir, new Vector3().setFromMatrixPosition(spine));
      const p = new Vector3();
      const nrm = new Vector3();

      // per vertex, once per pose: in the bed? which gown panels is it outside of? under the sheet?
      const inBed = new Uint8Array(n);
      const sheetBad = new Uint8Array(n); // 1: pokes up through the sheet
      const sheetXZ: number[] = []; // vertex index → [x, z] for the coverage test per drape state
      const hidden = new Uint8Array(n); // beneath other skin (between the thighs): needn't be under the sheet
      const leftSide = new Uint8Array(n);
      const outsideGown: Record<string, Uint8Array> = {};
      for (const g of Object.keys(GOWN_SHOWN)) outsideGown[g] = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        p.fromArray(skin.positions, i * 3);
        nrm.fromArray(skin.normals, i * 3);
        if (boxes.some((b) => insideBox([p.x, p.y, p.z], b, 0.004))) inBed[i] = 1;
        leftSide[i] = midline.distanceToPoint(p) > 0 ? 1 : 0;
        // sitting with the legs hanging only the lap is covered: the hanging shins are left free
        if (owner[i] && !(lapOnly && p.y < TABLE.topY - 0.03)) {
          const pen = sheetPenetration(sheet, [p.x, p.y, p.z]);
          if (pen === null || pen > 0.002) sheetBad[i] = 1;
          sheetXZ[i * 2] = p.x;
          sheetXZ[i * 2 + 1] = p.z;
          hidden[i] = underOtherSkin(sheet, [p.x, p.y, p.z]) ? 1 : 0;
        }
        for (const g of Object.keys(GOWN_SHOWN)) {
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
        const s = state.sections;
        const legs = { leg_left: s.leg_left, leg_right: s.leg_right };
        const field = coverageField(sheet, legs);
        for (let i = 0; i < n; i++) {
          if (inBed[i]) count.bed++;
          // a vertex of a covered section must be under the drawn (edge-clipped) sheet, not through it
          if (owner[i] && nodeShown(owner[i]!, legs) && sheetXZ[i * 2] !== undefined && (sheetBad[i] || (coverageAt(sheet, field, sheetXZ[i * 2]!, sheetXZ[i * 2 + 1]!) < 0.5 && !hidden[i]))) count.sheet++;
          const gownOut = Object.keys(GOWN_SHOWN).some((g) => {
            if (!GOWN_SHOWN[g]!(s) || !outsideGown[g]![i]) return false;
            // one side of the chest uncovered: that half of the panel isn't drawn
            if (g === "gown_chest" && s.chest_left !== s.chest_right) return leftSide[i] ? s.chest_left : s.chest_right;
            return true;
          });
          if (gownOut) count.gown++;
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
