import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { DrapeSection, Position } from "@/domain/schemas";
import { POSITION_ANGLE, patientState, sectionsForRegion } from "@/engine/patientState";
import { anchorWorldPoints, anchorsFor, poseFor } from "@/exam3d/regionAnchors";
import { zoneState } from "@/components/station/EncounterBar";
import { chestChanges } from "@/scene/Drapes";
import { gownRollLines, trunkMask } from "@/scene/drapeGeometry";
import { armMask, buildSheet, classifySheet, coverageAt, coverageField, sheetCuts, sheetPenetration, skinNormal, skinWorld, underOtherSkin, type SkinData } from "@/scene/sheetGeometry";
import { TABLE } from "@/scene/rig";
import { loadPatient } from "../scripts/qa/lib/patientMesh";
import { makeLog } from "./helpers";

const POSITIONS: Position[] = ["supine", "reclined_30", "reclined_45", "seated", "sitting_dangling", "left_lateral_decubitus", "seated_leaning_forward"];
const ALL: Record<DrapeSection, boolean> = { chest_left: true, chest_right: true, back: true, abdomen: true, pelvis: true, leg_left: true, leg_right: true };

async function skinOf(variant: "male" | "female"): Promise<SkinData> {
  const m = (await loadPatient(variant)).find((x) => x.name === "skin")!;
  return { bind: m.positions, joints: m.joints, weights: m.weights, jointNames: m.jointNames, count: m.positions.length / 3, normals: m.normals };
}

describe("M3 sheet (bug 6): built from the posed skin", () => {
  for (const variant of ["male", "female"] as const) {
    it(`${variant}: every covered vertex is under the drawn sheet in every position; the pelvis stays covered with both legs folded back`, async () => {
      const skin = await skinOf(variant);
      const owner = classifySheet(skin, sheetCuts(variant, skin));
      for (const position of POSITIONS) {
        const pose = poseFor(position, POSITION_ANGLE[position], variant);
        const world = skinWorld(skin, pose, owner);
        const lapOnly = position === "sitting_dangling";
        const sheet = buildSheet(world, owner, { lapOnly, under: skinWorld(skin, pose, armMask(skin)) });
        for (const legs of [
          { leg_left: true, leg_right: true },
          { leg_left: false, leg_right: true },
          { leg_left: false, leg_right: false },
        ]) {
          const field = coverageField(sheet, legs);
          const bad: number[] = [];
          for (let i = 0; i < skin.count; i++) {
            const o = owner[i]!;
            if (!o || (o === 2 && !legs.leg_left) || (o === 3 && !legs.leg_right)) continue;
            const p = [world[i * 3]!, world[i * 3 + 1]!, world[i * 3 + 2]!];
            if (lapOnly && p[1]! < TABLE.topY - 0.03) continue;
            const pen = sheetPenetration(sheet, p);
            if (pen === null || pen > 0.002) bad.push(i);
            // skin hidden beneath another leg needn't be under the sheet itself
            else if (coverageAt(sheet, field, p[0]!, p[2]!) < 0.5 && !underOtherSkin(sheet, p)) bad.push(i);
          }
          expect(bad, `${position} ${JSON.stringify(legs)}`).toEqual([]);
        }
      }
    });
  }

  it("the feet stay bare and the arms are never under the sheet; the groin targets are outside the towel", async () => {
    const skin = await skinOf("male");
    const cuts = sheetCuts("male", skin);
    const owner = classifySheet(skin, cuts);
    for (let i = 0; i < skin.count; i++) {
      const y = skin.bind[i * 3 + 1]!;
      const x = skin.bind[i * 3]!;
      if (y < cuts.ankleY || Math.abs(x) > 0.24) expect(owner[i]).toBe(0);
    }
    for (const variant of ["male", "female"] as const) {
      const s = await skinOf(variant);
      const c = sheetCuts(variant, s);
      for (const id of ["groin_left", "groin_right"]) {
        const p = anchorsFor(variant).find((a) => a.regionId === id)!.points[0]!;
        // under a leg section (folded back for the femoral pulse), never the always-covered towel
        expect(Math.abs(p[0])).toBeGreaterThan(0.03);
        expect(p[1]).toBeGreaterThan(c.crotchY + 0.055);
      }
    }
  });
});

describe("M3 the hands rest on the sheet, not under it (visual review: supine hands hidden by the sheet's fall-off)", () => {
  for (const variant of ["male", "female"] as const) {
    it(`${variant}: in every position at most 2% of the arm lies more than 3 cm under the drawn sheet`, async () => {
      const skin = await skinOf(variant);
      const owner = classifySheet(skin, sheetCuts(variant, skin));
      const arms = armMask(skin);
      let total = 0;
      for (let i = 0; i < skin.count; i++) total += arms[i]!;
      for (const position of POSITIONS) {
        const pose = poseFor(position, POSITION_ANGLE[position], variant);
        const armWorld = skinWorld(skin, pose, arms);
        const sheet = buildSheet(skinWorld(skin, pose, owner), owner, { lapOnly: position === "sitting_dangling", under: armWorld });
        const field = coverageField(sheet, { leg_left: true, leg_right: true });
        let buried = 0;
        for (let i = 0; i < skin.count; i++) {
          if (!arms[i]) continue;
          const p = [armWorld[i * 3]!, armWorld[i * 3 + 1]!, armWorld[i * 3 + 2]!];
          const pen = sheetPenetration(sheet, p);
          if (pen !== null && pen < -0.03 && coverageAt(sheet, field, p[0]!, p[2]!) >= 0.5) buried++;
        }
        expect(buried / total, `${position}: ${buried} of ${total} arm vertices buried`).toBeLessThanOrEqual(0.02);
      }
    });
  }
});

describe("M3 the ankles stay bare under a covered sheet", () => {
  for (const variant of ["male", "female"] as const) {
    it(`${variant}: the ankle targets are outside the drawn sheet in every position with the legs covered`, async () => {
      const skin = await skinOf(variant);
      const owner = classifySheet(skin, sheetCuts(variant, skin));
      for (const position of POSITIONS) {
        const pose = poseFor(position, POSITION_ANGLE[position], variant);
        const sheet = buildSheet(skinWorld(skin, pose, owner), owner, { lapOnly: position === "sitting_dangling", under: skinWorld(skin, pose, armMask(skin)) });
        const field = coverageField(sheet, { leg_left: true, leg_right: true });
        for (const id of ["ankle_left", "ankle_right"]) {
          const p = anchorWorldPoints(id, pose)[0]!;
          // covered: inside the drawn sheet with the cloth lying just over it (the lap sheet far above a
          // hanging ankle doesn't hide it)
          const gap = -(sheetPenetration(sheet, p) ?? 1);
          const covered = coverageAt(sheet, field, p[0], p[2]) >= 0.5 && gap > 0 && gap < 0.08;
          expect(covered, `${position} ${id}`).toBe(false);
        }
      }
    });
  }
});

describe("M3 folded gown edges lie on the body (V-ROD)", () => {
  for (const variant of ["male", "female"] as const) {
    it(`${variant}: every roll follows the skin 0.8–3 cm off it, across the trunk, in every lying and sitting position`, async () => {
      const skin = await skinOf(variant);
      const all = new Uint8Array(skin.count).fill(1);
      const trunk = trunkMask(skin);
      for (const position of POSITIONS) {
        const pose = poseFor(position, POSITION_ANGLE[position], variant);
        const world = skinWorld(skin, pose, all);
        const lines = gownRollLines(pose, skinWorld(skin, pose, trunk), (i) => skinNormal(skin, pose, i), skinWorld(skin, pose, trunk.map((t) => 1 - t)));
        for (const [name, pts] of Object.entries(lines)) {
          expect(pts.length, `${position} ${name}`).toBeGreaterThanOrEqual(6);
          for (const p of pts) {
            let best = Infinity;
            for (let i = 0; i < skin.count; i++) best = Math.min(best, (world[i * 3]! - p[0]) ** 2 + (world[i * 3 + 1]! - p[1]) ** 2 + (world[i * 3 + 2]! - p[2]) ** 2);
            const cm = Math.sqrt(best) * 100;
            expect(cm, `${position} ${name}`).toBeGreaterThan(0.8);
            expect(cm, `${position} ${name}`).toBeLessThan(3);
          }
        }
      }
    });
  }
});

describe("M3 drape sections", () => {
  it("regions map to their sections: groin with its leg, feet never draped", () => {
    expect(sectionsForRegion("groin_left")).toEqual(["leg_left"]);
    expect(sectionsForRegion("groin_right")).toEqual(["leg_right"]);
    expect(sectionsForRegion("patellar_tendon_left")).toEqual(["leg_left"]);
    expect(sectionsForRegion("leg_medial_right")).toEqual(["leg_right"]);
    expect(sectionsForRegion("foot_lateral_left")).toEqual([]);
    expect(sectionsForRegion("ankle_right")).toEqual([]);
    expect(sectionsForRegion("cardiac_aortic")).toEqual(["chest_right"]);
  });

  it("the pelvis is never uncovered, even when asked", () => {
    const log = makeLog([{ type: "state_change", source: "click", payload: { drape: { section: "pelvis", covered: false }, via: "direct" } }]);
    expect(patientState(log).sections.pelvis).toBe(true);
  });

  it("drape controls: zone labels and the chest tab", () => {
    expect(zoneState(ALL, ["chest_left", "chest_right"])).toBe("covered");
    expect(zoneState({ ...ALL, chest_left: false }, ["chest_left", "chest_right"])).toBe("left uncovered");
    expect(zoneState({ ...ALL, leg_right: false }, ["leg_left", "leg_right"])).toBe("right uncovered");
    expect(zoneState({ ...ALL, leg_left: false, leg_right: false }, ["leg_left", "leg_right"])).toBe("uncovered");
    expect(chestChanges(ALL)).toEqual([
      { section: "chest_left", covered: false },
      { section: "chest_right", covered: false },
    ]);
    expect(chestChanges({ ...ALL, chest_left: false })).toEqual([{ section: "chest_left", covered: true }]);
  });
});

describe("M3 auto-expose is per section (server)", () => {
  beforeAll(() => {
    process.env.FILE_STORE_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "osce-m3-")), "store.json");
    delete process.env.DATABASE_URL;
  });

  it("with the left leg already uncovered, examining the right shin still uncovers the right leg; the apex uncovers only the left chest", async () => {
    const s = await import("@/server/session");
    const { getRepo } = await import("@/server/db");
    const ses = await s.createSession("hf-decompensated-01", "T", "practice");
    await s.appendStudentAction(ses.id, { type: "timer", source: "click", payload: { event: "begin" } });
    await s.appendStudentAction(ses.id, { type: "room", source: "click", payload: { event: "enter" } });
    await s.appendStudentAction(ses.id, { type: "state_change", source: "click", payload: { drape: { section: "leg_left", covered: false }, via: "direct" } });
    await s.appendStudentAction(ses.id, { type: "examine", source: "click", payload: { maneuverId: "edema_assessment", regionId: "shin_right" } });
    await s.appendStudentAction(ses.id, { type: "examine", source: "click", payload: { maneuverId: "pmi_palpation", regionId: "cardiac_mitral" } });
    const st = patientState(await (await getRepo()).listActions(ses.id));
    expect(st.sections).toMatchObject({ leg_left: false, leg_right: false, chest_left: false, chest_right: true, pelvis: true, abdomen: true });
  });
});
