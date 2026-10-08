/**
 * Bug 1 (Phase 4 M2): the penlight's hit area was far too large. The eye target sat on the lids,
 * 1.4–1.9 cm from the pupil, with a 1.5 cm tolerance, so light shone near (not into) an eye still
 * recorded the pupil reflex, and only one eye could be lit per click. Now:
 *  - each eye target is the rendered pupil itself, in every position, for both body models;
 *  - the light reflex is recorded only within 0.6 cm (the iris) of the pupil;
 *  - a click on the eyeball is measured there (it used to be measured on the socket skin behind it,
 *    ~3 cm away, so clicks on an eye resolved to the face);
 *  - dragging the light across both eyes records both, and swinging it from one eye to the other
 *    and back records the swinging-light test.
 */
import { describe, expect, it } from "vitest";
import { POSITION_ANGLE } from "@/engine/patientState";
import { loadContentFromDisk } from "@/content/loadFromDisk";
import { anchorWorldPoints, distance, poseFor, type Pose, type Vec3 } from "@/exam3d/regionAnchors";
import { decidePlacement, penlightSweeper } from "@/exam3d/tools/decide";
import { resolveHit } from "@/exam3d/hit";
import { regionsForTool } from "@/exam3d/tools/toolLogic";
import type { Position } from "@/domain/schemas";

const maneuvers = loadContentFromDisk().maneuvers;
const toolRegions = regionsForTool(maneuvers, "penlight");
const POSITIONS: Position[] = ["supine", "reclined_30", "reclined_45", "seated"];

const pupil = (pose: Pose, side: "L" | "R"): Vec3 => {
  const e = pose.world.get(`pupil_${side}`)!.elements;
  return [e[12]!, e[13]!, e[14]!];
};
const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** a beam path through the given points, 2 mm steps */
const path = (...pts: Vec3[]): Vec3[] =>
  pts.slice(1).flatMap((b, i) => {
    const a = pts[i]!;
    const n = Math.max(1, Math.ceil(distance(a, b) / 0.002));
    return Array.from({ length: n }, (_, k) => lerp(a, b, (k + 1) / n));
  });

describe("bug 1: the penlight lands on the pupil", () => {
  for (const variant of ["male", "female"] as const)
    it(`${variant}: each eye target is the pupil, in every position`, () => {
      for (const position of POSITIONS) {
        const pose = poseFor(position, POSITION_ANGLE[position], variant);
        expect(distance(anchorWorldPoints("eye_left", pose)[0]!, pupil(pose, "L")) * 100, `${position} left`).toBeLessThan(0.3);
        expect(distance(anchorWorldPoints("eye_right", pose)[0]!, pupil(pose, "R")) * 100, `${position} right`).toBeLessThan(0.3);
      }
    });

  it("records the light reflex on the pupil, and nothing 1.2 cm away from it", () => {
    const pose = poseFor("reclined_45", 45, "male");
    const on = decidePlacement({ point: pupil(pose, "R"), tool: "penlight", maneuvers, toolRegions, pose })!;
    expect(on.regionId).toBe("eye_right");
    expect(on.maneuverId).toBe("pupils_light_reflex");
    expect(on.outcome).toBe("finding");
    // 1.2 cm toward the outer corner of the right eye (patient's right = −x before posing; use the pupils' axis)
    const p = pupil(pose, "R");
    const away = lerp(p, pupil(pose, "L"), -0.012 / distance(p, pupil(pose, "L")));
    const off = decidePlacement({ point: away, tool: "penlight", maneuvers, toolRegions, pose });
    expect(off?.outcome ?? "nothing").not.toBe("finding");
  });

  it("a click on the eyeball resolves to that eye, measured at the eye (not the socket behind it)", () => {
    const pose = poseFor("seated", 80, "female");
    const p = pupil(pose, "R");
    const socket: Vec3 = [p[0], p[1], p[2] - 0.03];
    const h = resolveHit([{ kind: "eye", point: p, normal: [0, 0, 1] }, { kind: "body", point: socket, normal: [0, 0, 1] }], ["eye_right", "eye_left", "face", "nose"], pose)!;
    expect(h.regionId).toBe("eye_right");
    expect(distance(h.point, p)).toBeLessThan(0.001);
  });

  it("sweeping the light across both eyes records both", () => {
    const pose = poseFor("reclined_45", 45, "female");
    const r = pupil(pose, "R");
    const l = pupil(pose, "L");
    const sweep = penlightSweeper({ maneuvers, toolRegions, pose });
    const events = path(lerp(r, l, -0.5), lerp(r, l, 1.5)).flatMap(sweep);
    expect(events.map((e) => `${e.maneuverId}@${e.regionId}`)).toEqual(["pupils_light_reflex@eye_right", "pupils_light_reflex@eye_left"]);
  });

  it("swinging the light from one eye to the other and back records the swinging-light test", () => {
    const pose = poseFor("reclined_45", 45, "male");
    const r = pupil(pose, "R");
    const l = pupil(pose, "L");
    const sweep = penlightSweeper({ maneuvers, toolRegions, pose });
    const events = path(r, l, r).flatMap(sweep);
    expect(events.map((e) => `${e.maneuverId}@${e.regionId}`)).toEqual(["pupils_light_reflex@eye_right", "pupils_light_reflex@eye_left", "swinging_flashlight@eye_right"]);
  });

  it("a single click never records the swinging-light test (it is a sweep)", () => {
    const pose = poseFor("reclined_45", 45, "male");
    const d = decidePlacement({ point: pupil(pose, "L"), tool: "penlight", maneuvers, toolRegions, pose })!;
    expect(d.candidates).toEqual(["pupils_light_reflex"]);
  });
});
