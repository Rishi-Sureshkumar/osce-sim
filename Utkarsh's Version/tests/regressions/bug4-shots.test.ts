/**
 * Bug 4 (Phase 4 M2): there was no front view of the face, and the head & neck shot looked down on
 * the scalp (seated, reclined) or from the head end (supine), so the chin hid the neck (JVP,
 * carotids, thyroid). Also, during the eye exam the patient's head swayed and turned.
 */
import { describe, expect, it } from "vitest";
import type { Position } from "@/domain/schemas";
import { dirToWorld, computePose, type Vec3 } from "@/scene/rig";
import { skinLandmark } from "@/exam3d/regionAnchors";
import { focusShotFor, shotCamera } from "@/scene/shots";
import { liveRotations } from "@/scene/livePose";
import { poseRotations } from "@/scene/rig";
import { POSITION_ANGLE } from "@/engine/patientState";

const POSITIONS: Position[] = ["supine", "reclined_30", "reclined_45", "seated", "seated_leaning_forward"];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: Vec3) => Math.hypot(...a);
const unit = (a: Vec3): Vec3 => a.map((x) => x / (len(a) || 1)) as Vec3;
const mid = (...ps: Vec3[]): Vec3 => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k]!, 0) / ps.length) as Vec3;
const deg = (c: number) => (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;

describe("bug 4: face and neck camera shots", () => {
  for (const variant of ["male", "female"] as const)
    for (const position of POSITIONS) {
      const pose = computePose(variant, position, POSITION_ANGLE[position]);
      const faceFwd = unit(dirToWorld([0, 0, 1], "head", pose));
      const bodyUp = unit(dirToWorld([0, 1, 0], "neck01", pose));
      it(`${variant} ${position}: a face shot ~40 cm in front of the eyes, looking at the face`, () => {
        const eyes = mid(skinLandmark("eye_l", pose).point, skinLandmark("eye_r", pose).point);
        const cam = shotCamera("face", pose);
        const off = sub(cam.position, eyes);
        expect(len(off)).toBeGreaterThan(0.3);
        expect(len(off)).toBeLessThan(0.5);
        expect(deg(dot(unit(off), faceFwd)), "angle from straight ahead").toBeLessThan(20);
        expect(cam.fov).toBe(35);
      });
      it(`${variant} ${position}: the head & neck shot faces the neck and doesn't look down from above the head`, () => {
        const neck = mid(skinLandmark("chin", pose).point, skinLandmark("sternal_notch", pose).point);
        const cam = shotCamera("head_neck", pose);
        const off = unit(sub(cam.position, neck));
        expect(deg(dot(off, faceFwd)), "angle between the camera and the front of the neck").toBeLessThan(45);
        // pitch: level with or slightly below the neck along the body axis (sees under the chin)
        expect(dot(off, bodyUp), "camera height along the body axis").toBeLessThanOrEqual(0.05);
      });
    }
  it("eyes, nose, mouth and face regions open the face shot", () => {
    for (const r of ["eye_left", "eye_right", "nose", "mouth", "face"]) expect(focusShotFor("head_neck", r)).toBe("face");
    expect(focusShotFor("head_neck", "neck_jvp_right")).toBe("head_neck");
  });
});

describe("bug 4: the head stays still during the eye exam", () => {
  it("no idle sway and no head turn when the head is held steady", () => {
    const base = poseRotations("seated", 80);
    const rot = liveRotations({ position: "seated", angle: 80, t: 7.3, rr: 16, laboured: false, blink: 0, look: { yaw: 0.6, pitch: 0.2 }, steady: true });
    for (const b of ["neck02", "neck03", "head"]) expect(rot[b] ?? [0, 0, 0], b).toEqual(base[b] ?? [0, 0, 0]);
  });
});
