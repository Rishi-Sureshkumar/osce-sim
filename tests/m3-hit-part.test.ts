/**
 * Found by the M3 catalog run: a click on the ear (the tragus, a little in front of the canal) went to
 * the pre-auricular nodes, whose broader zone reaches over it. A click that lands on the ear itself is
 * the ear; the same point on skin still resolves by distance.
 */
import { describe, expect, it } from "vitest";
import { resolveHit } from "@/exam3d/hit";
import { anchorWorldPoints, poseFor } from "@/exam3d/regionAnchors";

describe("a click on the ear is the ear", () => {
  for (const variant of ["male", "female"] as const) {
    it(`${variant}: on the ear part → ear_left; the same point on skin → ln_pre_auricular`, () => {
      const pose = poseFor("seated", 80, variant);
      const pickable = ["ear_left", "ln_pre_auricular", "face", "ln_post_auricular"];
      // the pre-auricular target's own point (left side): nearest to the nodes by distance
      const pre = anchorWorldPoints("ln_pre_auricular", pose).reduce((a, b) => (b[0] > a[0] ? b : a));
      const on = (part: string | null) => resolveHit([{ kind: "body", point: pre, normal: [1, 0, 0], part }], pickable, pose)?.regionId;
      expect(on(null)).toBe("ln_pre_auricular");
      expect(on("face")).toBe("ln_pre_auricular");
      expect(on("ear_l")).toBe("ear_left");
    });
  }
});
