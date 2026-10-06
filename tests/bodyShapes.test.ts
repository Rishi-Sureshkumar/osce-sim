import { describe, expect, it } from "vitest";
import { SHAPES } from "@/components/body/shapes";
import { loadContentFromDisk } from "@/content/loadFromDisk";

describe("body diagram shapes", () => {
  const { regions } = loadContentFromDisk();

  it("every region on a drawn view has exactly one shape with its svgPathId", () => {
    for (const r of regions.filter((r) => r.view !== "whole")) {
      const matches = (SHAPES[r.view] ?? []).filter((s) => s.svgPathId === r.svgPathId);
      expect(matches.length, `${r.id} on ${r.view}`).toBe(1);
    }
  });

  it("every shape belongs to a region on that view", () => {
    for (const [view, shapes] of Object.entries(SHAPES)) {
      for (const s of shapes ?? []) {
        expect(regions.some((r) => r.view === view && r.svgPathId === s.svgPathId), `${s.svgPathId} on ${view}`).toBe(true);
      }
    }
  });
});
