import { describe, expect, it } from "vitest";
import { loadContentFromDisk } from "@/content/loadFromDisk";
import { ANCHOR_BY_REGION, LANDMARKS, PANEL_VIEWS, REGION_ANCHORS, pickRegion, poseFor, snapToAnchor, toWorld, HINGE_Y } from "@/exam3d/regionAnchors";

const c = loadContentFromDisk();

describe("3D region anchors", () => {
  it("every canonical region is an anchor, a panel button, or a 2D zoom shortcut", () => {
    for (const r of c.regions) {
      const ok = ANCHOR_BY_REGION.has(r.id) || PANEL_VIEWS.has(r.view) || !!r.zoomTo;
      expect(ok, r.id).toBe(true);
    }
  });

  it("anchors only use canonical region ids, each once", () => {
    const ids = REGION_ANCHORS.map((x) => x.regionId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(c.regionById.has(id), id).toBe(true);
    for (const l of LANDMARKS) expect(c.regionById.has(l.regionId), l.regionId).toBe(true);
  });

  it("the patient's right is -X and left/right anchors mirror", () => {
    expect(ANCHOR_BY_REGION.get("eye_right")!.points[0]![0]).toBeLessThan(0);
    expect(ANCHOR_BY_REGION.get("cardiac_mitral")!.points[0]![0]).toBeGreaterThan(0); // apex is on the left
    const r = ANCHOR_BY_REGION.get("knee_right")!.points[0]!;
    const l = ANCHOR_BY_REGION.get("knee_left")!.points[0]!;
    expect(l).toEqual([-r[0], r[1], r[2]]);
  });

  it("every catalog sequence landmark exists for each allowed region side", () => {
    for (const m of c.maneuvers) {
      for (const step of m.steps ?? []) {
        if (!step.landmark) continue;
        expect(LANDMARKS.some((l) => l.id === step.landmark), `${m.id}:${step.landmark}`).toBe(true);
      }
    }
  });
});

describe("pose math", () => {
  it("sitting up raises the head; lying flat keeps it at hinge height", () => {
    const head = ANCHOR_BY_REGION.get("scalp")!;
    const flat = toWorld(head.points[0]!, "upper", poseFor("supine", 0));
    const sat = toWorld(head.points[0]!, "upper", poseFor("seated", 80));
    expect(flat[1]).toBeCloseTo(HINGE_Y + 0.03, 2);
    expect(sat[1]).toBeGreaterThan(flat[1] + 0.8);
    // legs never move with the backrest
    const knee = ANCHOR_BY_REGION.get("knee_right")!;
    expect(toWorld(knee.points[0]!, "lower", poseFor("seated", 80))).toEqual(toWorld(knee.points[0]!, "lower", poseFor("supine", 0)));
  });

  it("left lateral decubitus rolls the patient's left side down", () => {
    const pose = poseFor("left_lateral_decubitus", 0);
    const leftLat = toWorld(ANCHOR_BY_REGION.get("lung_lat_l")!.points[0]!, "upper", pose);
    const rightLat = toWorld(ANCHOR_BY_REGION.get("lung_lat_r")!.points[0]!, "upper", pose);
    expect(leftLat[1]).toBeLessThan(rightLat[1]);
  });
});

describe("picking and snapping", () => {
  it("a small landmark on top of a broad zone wins", () => {
    expect(pickRegion([{ regionId: "precordium_wall", distance: 1.0 }, { regionId: "cardiac_mitral", distance: 1.012 }])).toBe("cardiac_mitral");
    expect(pickRegion([{ regionId: "precordium_wall", distance: 1.0 }, { regionId: "cardiac_mitral", distance: 1.05 }])).toBe("precordium_wall");
    expect(pickRegion([])).toBeNull();
  });

  it("snaps to the nearest allowed anchor and reports error in radii", () => {
    const pose = poseFor("supine", 0);
    const mitral = ANCHOR_BY_REGION.get("cardiac_mitral")!;
    const w = toWorld(mitral.points[0]!, "upper", pose);
    const exact = snapToAnchor(w, ["cardiac_mitral", "cardiac_tricuspid"], pose)!;
    expect(exact.regionId).toBe("cardiac_mitral");
    expect(exact.error).toBeCloseTo(0, 5);
    const off = snapToAnchor([w[0] + 0.016, w[1], w[2]], ["cardiac_mitral"], pose)!;
    expect(off.error).toBeCloseTo(1, 1);
  });
});
