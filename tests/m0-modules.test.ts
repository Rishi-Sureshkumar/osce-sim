/**
 * M0.1: the pure modules extracted from the 3D view keep the Phase 3 behaviour (the catalog
 * harness and the M2 regression tests build on them).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadContentFromDisk } from "@/content/loadFromDisk";
import { POSITION_ANGLE } from "@/engine/patientState";
import { REACH_CM, resolveHit } from "@/exam3d/hit";
import { anchorWorldNormals, anchorWorldPoints, poseFor, type Vec3 } from "@/exam3d/regionAnchors";
import { decidePlacement, holdCandidate } from "@/exam3d/tools/decide";
import { regionsForTool } from "@/exam3d/tools/toolLogic";
import { JERK_SECONDS, REFLEX_JERK, jerkDelta } from "@/scene/animation/reflex";
import { liveRotations } from "@/scene/livePose";
import { poseRotations, TABLE } from "@/scene/rig";
import { HEAD_PIVOT, TABLE_PARTS, insideBox, tableBoxes } from "@/scene/room/tableGeometry";
import { FileRepo } from "@/server/db/fileRepo";
import type { Position, Session } from "@/domain/schemas";

const c = loadContentFromDisk();
const add = (p: Vec3, d: Vec3, s: number): Vec3 => [p[0] + d[0] * s, p[1] + d[1] * s, p[2] + d[2] * s];

/** a unit tangent to the skin at a region's anchor */
function tangent(regionId: string, pose = poseFor("supine", 0)): Vec3 {
  const n = anchorWorldNormals(regionId, pose)[0]!;
  const ref: Vec3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const t: Vec3 = [n[1] * ref[2] - n[2] * ref[1], n[2] * ref[0] - n[0] * ref[2], n[0] * ref[1] - n[1] * ref[0]];
  const l = Math.hypot(...t);
  return [t[0] / l, t[1] / l, t[2] / l];
}

describe("reflex jerk (src/scene/animation/reflex.ts)", () => {
  const knee = { bone: "lowerleg01_R", sign: -1 as const, grade: 2 };
  it("is zero outside its window and moves the joint the reflex's way, scaled by grade", () => {
    expect(jerkDelta(knee, -0.01)).toBe(0);
    expect(jerkDelta(knee, JERK_SECONDS)).toBe(0);
    expect(jerkDelta(knee, 0.12)).toBeLessThan(0);
    expect(jerkDelta({ ...knee, sign: 1 }, 0.12)).toBeGreaterThan(0);
    expect(jerkDelta({ ...knee, grade: 0 }, 0.12)).toBe(0);
    expect(Math.abs(jerkDelta({ ...knee, grade: 3 }, 0.12))).toBeGreaterThan(Math.abs(jerkDelta(knee, 0.12)));
    expect(jerkDelta({ ...knee, muted: true }, 0.12)).toBeCloseTo(jerkDelta(knee, 0.12) / 4, 10);
  });
  it("maps the tendon regions to their joints", () => {
    expect(REFLEX_JERK.patellar_tendon_right).toEqual({ bone: "lowerleg01_R", sign: -1 });
    expect(REFLEX_JERK.achilles_left).toEqual({ bone: "foot_L", sign: 1 });
    expect(REFLEX_JERK.triceps_tendon_right).toEqual({ bone: "lowerarm01_R", sign: 1 });
  });
});

describe("live pose (src/scene/livePose.ts)", () => {
  const frozen = (position: Position) => liveRotations({ position, angle: POSITION_ANGLE[position], t: 0, rr: 16, laboured: false, blink: 0, look: { yaw: 0, pitch: 0 } });
  it("frozen (t = 0, no blink, no look) equals the static posture for every position", () => {
    for (const position of Object.keys(POSITION_ANGLE) as Position[]) {
      const live = frozen(position);
      const base = poseRotations(position, POSITION_ANGLE[position]);
      for (const [bone, r] of Object.entries(live)) {
        const b = base[bone] ?? [0, 0, 0];
        for (let k = 0; k < 3; k++) expect(r[k], `${position} ${bone}[${k}]`).toBeCloseTo(b[k]!, 12);
      }
    }
  });
  it("breathing, blink, head turn and a jerk move the expected bones", () => {
    const base = frozen("supine");
    const live = liveRotations({ position: "supine", angle: 0, t: 0.9, rr: 20, laboured: true, blink: 1, look: { yaw: 0.4, pitch: 0 }, jerk: { bone: "lowerleg01_R", sign: -1, grade: 2, ageSec: 0.12 } });
    expect(live.spine01![0]).not.toBeCloseTo(base.spine01?.[0] ?? 0, 6);
    expect(live.orbicularis03_L![0]).toBeGreaterThan(base.orbicularis03_L?.[0] ?? 0);
    expect(live.head![1]).toBeCloseTo((base.head?.[1] ?? 0) + 0.2, 6);
    expect(live.lowerleg01_R![0]).toBeLessThan(base.lowerleg01_R?.[0] ?? 0);
  });
});

describe("hit resolution (src/exam3d/hit.ts)", () => {
  const pose = poseFor("reclined_30", 30);
  const pickable = c.regions.map((r) => r.id);
  const apex = anchorWorldPoints("cardiac_mitral", pose)[0]!;
  const n = anchorWorldNormals("cardiac_mitral", pose)[0]!;
  it("ignores rays that never touch the patient", () => {
    expect(resolveHit([{ kind: undefined, point: apex, normal: n }], pickable, pose)).toBeNull();
  });
  it("a gown hit measures from the skin underneath and keeps the gown kind", () => {
    const gownPoint = add(apex, n, 0.02);
    const hit = resolveHit(
      [
        { kind: "gown:chest", point: gownPoint, normal: n },
        { kind: "body", point: apex, normal: n },
      ],
      pickable,
      pose,
    )!;
    expect(hit.kind).toBe("gown:chest");
    expect(hit.point).toEqual(apex);
    expect(hit.regionId).toBe("cardiac_mitral");
  });
  it("assigns no region beyond reach of every tolerance boundary", () => {
    const far: Vec3 = [apex[0], apex[1] + 2, apex[2]];
    expect(resolveHit([{ kind: "body", point: far, normal: n }], pickable, pose)!.regionId).toBeNull();
    expect(REACH_CM).toBe(9);
  });
});

describe("tool placement decision (src/exam3d/tools/decide.ts)", () => {
  const pose = poseFor("left_lateral_decubitus", 0);
  const toolRegions = regionsForTool(c.maneuvers, "stethoscope");
  const apex = anchorWorldPoints("cardiac_mitral", pose)[0]!;
  it("on the apex with the bell: S3 maneuver, on target", () => {
    const d = decidePlacement({ point: apex, tool: "stethoscope", mode: "bell", maneuvers: c.maneuvers, toolRegions, pose })!;
    expect(d.regionId).toBe("cardiac_mitral");
    expect(d.maneuverId).toBe("auscultate_heart_bell");
    expect(d.outcome).toBe("finding");
    expect(d.distanceCm).toBeLessThan(0.5);
  });
  it("3.5 cm off the apex never records the apex finding", () => {
    const t = tangent("cardiac_mitral", pose);
    for (const s of [1, -1]) {
      const d = decidePlacement({ point: add(apex, t, 0.035 * s), tool: "stethoscope", mode: "bell", maneuvers: c.maneuvers, toolRegions, pose })!;
      expect(d.regionId === "cardiac_mitral" && d.outcome === "finding").toBe(false);
      if (d.regionId === "cardiac_mitral") expect(d.outcome).toBe("near");
    }
  });
  it("a stethoscope hold with one fitting exam records it (several: see tests/regressions/bug10)", () => {
    expect(holdCandidate(c.maneuvers, "stethoscope", "diaphragm", "cardiac_aortic")).toEqual({ maneuverId: "auscultate_heart_diaphragm" });
  });
});

describe("table geometry (src/scene/room/tableGeometry.ts)", () => {
  it("flat: both mattress sections lie at the table top; the head section rises with the angle", () => {
    const flat = tableBoxes(0);
    const head0 = flat.find((b) => b.name === "head-mattress")!;
    expect(head0.center[1]).toBeCloseTo(TABLE.topY - TABLE_PARTS.mattress / 2, 6);
    // raised to 90° about its pivot (HEAD_PIVOT): the box stands upright behind the pivot
    for (const v of ["male", "female"] as const) {
      const up = tableBoxes(90, v).find((b) => b.name === "head-mattress")!;
      const { dy, dz } = HEAD_PIVOT[v];
      expect(up.center[1]).toBeCloseTo(TABLE.topY - 0.06 + dy + TABLE_PARTS.headLen / 2 + dz, 6);
      expect(up.center[2]).toBeCloseTo(TABLE.hingeZ + dz - dy, 6);
    }
  });
  it("insideBox respects rotation and slack", () => {
    const up = tableBoxes(90).find((b) => b.name === "head-mattress")!;
    expect(insideBox(up.center, up)).toBe(true);
    // 30 cm above the box's foot end is inside the raised back rest, not 30 cm toward the head
    const foot = up.center[1] - TABLE_PARTS.headLen / 2;
    expect(insideBox([TABLE.x, foot + 0.3, up.center[2]], up)).toBe(true);
    expect(insideBox([TABLE.x, foot + 0.3, up.center[2] - 0.3], up)).toBe(false);
    expect(insideBox(up.center, up, 1)).toBe(false);
  });
});

describe("FileRepo read cache", () => {
  const session = (id: string): Session =>
    ({ id, caseId: "hf-decompensated-01", studentLabel: "T", mode: "practice", status: "active", startedAt: new Date(2026, 0, 1).toISOString(), endedAt: null, patientTurns: 0, gradingRuns: 0 }) as Session;
  it("hands out copies and picks up changes written by someone else", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "osce-repo-"));
    const file = path.join(dir, "store.json");
    const repo = new FileRepo(file);
    await repo.createSession(session("s1"));
    const got = (await repo.getSession("s1"))!;
    got.studentLabel = "mutated";
    expect((await repo.getSession("s1"))!.studentLabel).toBe("T");
    // another writer replaces the file (different size → cache invalidated)
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    raw.sessions.push(session("s2-written-elsewhere"));
    fs.writeFileSync(file, JSON.stringify(raw));
    expect(await repo.getSession("s2-written-elsewhere")).not.toBeNull();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("console fixes", () => {
  it("@react-three/fiber is patched (no deprecated THREE.Clock; patch-package runs on postinstall)", () => {
    const dist = path.join(process.cwd(), "node_modules/@react-three/fiber/dist");
    const events = fs.readdirSync(dist).filter((f) => /^events-.*\.js$/.test(f));
    expect(events.length).toBeGreaterThan(0);
    for (const f of events) {
      const src = fs.readFileSync(path.join(dist, f), "utf8");
      expect(src, f).not.toMatch(/new THREE\.Clock\(\)/);
      expect(src, f).toMatch(/R3FClock/);
    }
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
    expect(pkg.scripts.postinstall).toMatch(/patch-package/);
    expect(fs.existsSync(path.join(process.cwd(), "patches/@react-three+fiber+9.8.1.patch"))).toBe(true);
  });
});
