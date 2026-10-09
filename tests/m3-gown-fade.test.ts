/**
 * Found by the M3 catalog run: the gown counted as faded out below 3% opacity but stayed drawn above 2%,
 * so a proxy bake landing in between baked the all-but-invisible chest panel — the bare chest then took
 * clicks as the gown (an exam "through the gown"). Settled-and-faded must mean hidden.
 */
import { describe, expect, it } from "vitest";
import { gownFadeSettled, gownShown } from "@/scene/PatientModel";

describe("gown fade", () => {
  it("a panel that has settled while fading out is no longer drawn (nor baked into the click proxies)", () => {
    for (let a = 0; a <= 1.0001; a += 0.0005) {
      if (gownFadeSettled([a]) && a < 0.5) expect(gownShown(a), `opacity ${a.toFixed(4)}`).toBe(false);
    }
    expect(gownFadeSettled([0.025])).toBe(false);
    expect(gownFadeSettled([0, 1])).toBe(true);
  });
});
