/**
 * Findings of the M2 adversarial review (Phase 4 M2 gate), each with the case that failed before:
 *  - the Achilles close-up put the camera under the foot mattress whenever the legs lie on the table
 *    (and at 45° the ear views looked at the inside of the backrest: V-EARBACK);
 *  - a clonus test with the hands (no tendon tap: grade 0) never moved the foot;
 *  - leaving an eye and coming back into it hid the swinging-light test;
 *  - bp_cuff_placement had become a hands exam: touching the upper arm logged a cuff placement.
 * And from the gate's e2e runs: on the male model the apex lies ~1 cm from the nipple, so a click just
 * off the apex was logged as a prohibited breast exam (HF case: breast exams excluded).
 */
import { describe, expect, it } from "vitest";
import type { Position } from "@/domain/schemas";
import { POSITION_ANGLE } from "@/engine/patientState";
import { loadContentFromDisk } from "@/content/loadFromDisk";
import { anchorWorldPoints, distance, landmarkWorld, poseFor, type Pose, type Vec3 } from "@/exam3d/regionAnchors";
import { decidePlacement, penlightSweeper } from "@/exam3d/tools/decide";
import { resolveHit } from "@/exam3d/hit";
import { ANCHOR_BY_REGION } from "@/exam3d/regionAnchors";
import { candidatesFor, regionsForTool, toolFor } from "@/exam3d/tools/toolLogic";
import { JERK_RISE, REFLEX_JERK, jerkDelta, jerkDuration } from "@/scene/animation/reflex";
import { shotCamera, shotHint } from "@/scene/shots";
import { insideBox, tableAngle, tableBoxes } from "@/scene/room/tableGeometry";

const { maneuvers, maneuverById } = loadContentFromDisk();
const POSITIONS: Position[] = ["supine", "reclined_30", "reclined_45", "seated", "seated_leaning_forward", "sitting_dangling", "left_lateral_decubitus"];

describe("the Achilles (and back-of-neck, top-of-head, ear) close-ups stay out of the table", () => {
  for (const variant of ["male", "female"] as const)
    it(`${variant}: in every position the camera is outside the table, and its line of sight clears it (bar a part lying on it)`, () => {
      for (const position of POSITIONS) {
        const pose = poseFor(position, POSITION_ANGLE[position], variant);
        const boxes = tableBoxes(tableAngle(position, POSITION_ANGLE[position]));
        for (const shot of ["ankle_left", "ankle_right", "neck_back", "head_top", "ear_left", "ear_right"] as const) {
          const { position: cam, target } = shotCamera(shot, pose);
          expect(boxes.some((b) => insideBox(cam, b)), `${shot} ${position}: camera inside the table`).toBe(false);
          // a part lying on the table (the back of the neck on the raised backrest, the left ear lying on the
          // left side: a hint says so) can't be seen past it from anywhere; the ankles can always be seen from
          // above, so they are held to the full check
          if (!shot.startsWith("ankle") && shotHint(shot, position)) continue;
          const len = distance(cam, target);
          for (let i = 0; i <= 40; i++) {
            const t = i / 40;
            if (t * len > len - 0.03) break;
            const p: Vec3 = [cam[0] + (target[0] - cam[0]) * t, cam[1] + (target[1] - cam[1]) * t, cam[2] + (target[2] - cam[2]) * t];
            expect(boxes.some((b) => insideBox(p, b)), `${shot} ${position}: sight line inside the table at ${(t * 100).toFixed(0)}%`).toBe(false);
          }
        }
      }
    });

  it("sitting with the legs hanging the view is unchanged (no lift needed); lying, a hint says why the tendon is hidden", () => {
    const pose = poseFor("sitting_dangling", 90, "male");
    const cam = shotCamera("ankle_left", pose);
    // the camera is level with the tendon, behind and outside it (not lifted over the table)
    expect(Math.abs(cam.position[1] - cam.target[1])).toBeLessThan(0.05);
    expect(shotHint("ankle_left", "sitting_dangling")).toBeNull();
    expect(shotHint("ankle_right", "supine")).toMatch(/rests on the table/);
  });
});

describe("a clonus test moves the foot", () => {
  it("grade 0 with clonus beats (the hands clonus test) beats after the (absent) jerk", () => {
    const j = { ...REFLEX_JERK.achilles_left!, grade: 0, clonusBeats: 6 };
    const late = Array.from({ length: 60 }, (_, i) => 2 * JERK_RISE + i * 0.02).filter((t) => t < jerkDuration(j));
    expect(Math.max(...late.map((t) => Math.abs(jerkDelta(j, t))))).toBeGreaterThan(0.05);
    // no jerk of its own: nothing before the beats start
    expect(jerkDelta(j, JERK_RISE)).toBe(0);
    // grade 0 without clonus still never moves
    expect(late.every((t) => jerkDelta({ ...j, clonusBeats: 0 }, t) === 0)).toBe(true);
  });
});

describe("the swinging-light test survives a wobble", () => {
  const pupil = (pose: Pose, side: "L" | "R"): Vec3 => {
    const e = pose.world.get(`pupil_${side}`)!.elements;
    return [e[12]!, e[13]!, e[14]!];
  };
  const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const path = (...pts: Vec3[]): Vec3[] =>
    pts.slice(1).flatMap((b, i) => {
      const a = pts[i]!;
      const n = Math.max(1, Math.ceil(distance(a, b) / 0.002));
      return Array.from({ length: n }, (_, k) => lerp(a, b, (k + 1) / n));
    });

  it("right, left, off the left eye and back into it, then right: still a swing", () => {
    const pose = poseFor("reclined_45", 45, "male");
    const r = pupil(pose, "R");
    const l = pupil(pose, "L");
    const offLeft = lerp(r, l, 1.6);
    const sweep = penlightSweeper({ maneuvers, toolRegions: regionsForTool(maneuvers, "penlight"), pose });
    const events = path(r, l, offLeft, l, r).flatMap(sweep);
    expect(events.map((e) => e.maneuverId)).toContain("swinging_flashlight");
  });
});

describe("the BP cuff placement is not a hands exam", () => {
  it("bp_cuff_placement has no tool, and the hands never resolve to it on the arm", () => {
    expect(toolFor(maneuverById.get("bp_cuff_placement")!)).toBeUndefined();
    for (const region of ["upper_arm_right", "upper_arm_left", "arm_right", "arm_left"]) expect(candidatesFor(maneuvers, "hands", undefined, region).map((m) => m.id), region).not.toContain("bp_cuff_placement");
    const toolRegions = regionsForTool(maneuvers, "hands");
    for (const variant of ["male", "female"] as const) {
      const pose = poseFor("seated", 80, variant);
      for (const region of ["upper_arm_right", "upper_arm_left"]) {
        const at = anchorWorldPoints(region, pose)[0]!;
        const d = decidePlacement({ point: at, tool: "hands", maneuvers, toolRegions, pose });
        expect(d?.candidates ?? [], `${variant} ${region}`).not.toContain("bp_cuff_placement");
        const brachial = landmarkWorld("brachial", region, pose)!;
        const p = decidePlacement({ point: brachial, tool: "hands", maneuvers, toolRegions, pose });
        expect(p?.candidates ?? [], `${variant} ${region} brachial`).not.toContain("bp_cuff_placement");
      }
    }
  });
});

describe("a click near the male apex is not a prohibited breast exam", () => {
  const pickable = loadContentFromDisk().regions.map((r) => r.id).filter((id) => ANCHOR_BY_REGION.has(id));
  const examinable = pickable.filter((id) => id !== "breast_left" && id !== "breast_right");
  const body = (p: Vec3) => [{ kind: "body", point: p, normal: [0, 1, 0] as Vec3 }];
  for (const position of ["reclined_30", "reclined_45", "seated", "supine"] as Position[])
    it(`male, ${position}: around the apex → the apex; on the nipple → the breast`, () => {
      const pose = poseFor(position, POSITION_ANGLE[position], "male");
      const apex = anchorWorldPoints("cardiac_mitral", pose)[0]!;
      const nipple = anchorWorldPoints("breast_left", pose)[0]!;
      // 1 cm from the apex, directly away from the nipple and to either side of that line
      const away: Vec3 = [apex[0] - nipple[0], apex[1] - nipple[1], apex[2] - nipple[2]];
      const len = Math.hypot(...away) || 1;
      const offs = [away.map((x) => (x / len) * 0.01) as Vec3, [0.007, 0, 0.007] as Vec3, [-0.007, 0, -0.007] as Vec3];
      for (const o of offs) {
        const p: Vec3 = [apex[0] + o[0], apex[1] + o[1], apex[2] + o[2]];
        if (distance(p, nipple) <= distance(p, apex)) continue;
        expect(resolveHit(body(p), pickable, pose, undefined, examinable)?.regionId, `${position} ${o}`).toBe("cardiac_mitral");
      }
      expect(resolveHit(body(nipple), pickable, pose, undefined, examinable)?.regionId).toBe("breast_left");
    });
});
