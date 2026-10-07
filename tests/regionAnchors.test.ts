import { describe, expect, it } from "vitest";
import { loadContentFromDisk } from "@/content/loadFromDisk";
import {
  ANCHOR_BY_REGION,
  PANEL_GROUPS,
  anchorWorldPoints,
  anchorsFor,
  hasLandmark,
  landmarkWorld,
  pickRegion,
  poseFor,
  skinLandmarkWorld,
  snapToAnchor,
} from "@/exam3d/regionAnchors";
import { TABLE } from "@/scene/rig";

const c = loadContentFromDisk();

describe("hidden exam anchors on the rigged patient", () => {
  it("every canonical region is an anchor, a panel button, or a hidden alias", () => {
    for (const r of c.regions) {
      const ok = ANCHOR_BY_REGION.has(r.id) || PANEL_GROUPS.has(r.group) || !!r.hidden;
      expect(ok, r.id).toBe(true);
    }
  });

  it("anchors use canonical ids, once each, and both body variants define the same set", () => {
    const male = anchorsFor("male").map((a) => a.regionId);
    const female = anchorsFor("female").map((a) => a.regionId);
    expect(new Set(male).size).toBe(male.length);
    expect([...female].sort()).toEqual([...male].sort());
    for (const id of male) expect(c.regionById.has(id), id).toBe(true);
  });

  it("every anchor has a tolerance in cm (tight on precordial landmarks, wide on lung zones)", () => {
    expect(ANCHOR_BY_REGION.get("cardiac_aortic")!.toleranceCm).toBe(2);
    expect(ANCHOR_BY_REGION.get("cardiac_mitral")!.toleranceCm).toBe(2.5);
    expect(ANCHOR_BY_REGION.get("lung_post_rl")!.toleranceCm).toBe(4);
    for (const a of anchorsFor("male")) expect(a.toleranceCm, a.regionId).toBeGreaterThan(0);
  });

  it("the patient's left is +X in model space and paired anchors mirror", () => {
    const a = anchorsFor("male");
    const get = (id: string) => a.find((x) => x.regionId === id)!.points[0]!;
    expect(get("eye_right")[0]).toBeLessThan(0);
    expect(get("cardiac_mitral")[0]).toBeGreaterThan(0); // the apex is on the left
    expect(Math.abs(get("knee_left")[0] + get("knee_right")[0])).toBeLessThan(0.01);
    expect(Math.abs(get("knee_left")[1] - get("knee_right")[1])).toBeLessThan(0.01);
  });

  it("precordial anchors sit where the 1B exam expects them, relative to the sternal notch", () => {
    const pose = poseFor("supine", 0);
    const notch = skinLandmarkWorld("sternal_notch", pose)!;
    const aortic = anchorWorldPoints("cardiac_aortic", pose)[0]!;
    const apex = anchorWorldPoints("cardiac_mitral", pose)[0]!;
    // lying supine with the head toward −Z: the aortic area is caudal to the notch and to the patient's right (−X)
    expect(aortic[2]).toBeGreaterThan(notch[2] + 0.03);
    expect(aortic[0]).toBeLessThan(notch[0]);
    expect(apex[0]).toBeGreaterThan(notch[0] + 0.06);
    expect(apex[2]).toBeGreaterThan(aortic[2] + 0.05);
  });

  it("every catalog sequence landmark exists for each allowed region side", () => {
    for (const m of c.maneuvers) {
      for (const step of m.steps ?? []) {
        if (!step.landmark) continue;
        for (const r of m.allowedRegions) expect(hasLandmark(step.landmark, r), `${m.id}:${step.landmark}:${r}`).toBe(true);
      }
    }
  });
});

describe("anchors follow the pose", () => {
  it("lying supine puts the patient on the table, head toward −Z", () => {
    const pose = poseFor("supine", 0);
    const vertex = skinLandmarkWorld("vertex", pose)!;
    const toe = anchorWorldPoints("toe_great_left", pose)[0]!;
    expect(vertex[2]).toBeLessThan(-0.6);
    expect(toe[2]).toBeGreaterThan(0.7);
    const chest = anchorWorldPoints("cardiac_erbs", pose)[0]!;
    expect(chest[1]).toBeGreaterThan(TABLE.topY + 0.1);
    expect(chest[1]).toBeLessThan(TABLE.topY + 0.35);
  });

  it("sitting up raises the head; the legs stay on the table", () => {
    const flat = poseFor("supine", 0);
    const sat = poseFor("seated", 80);
    expect(skinLandmarkWorld("vertex", sat)![1]).toBeGreaterThan(skinLandmarkWorld("vertex", flat)![1] + 0.5);
    const kf = anchorWorldPoints("knee_right", flat)[0]!;
    const ks = anchorWorldPoints("knee_right", sat)[0]!;
    expect(Math.hypot(kf[0] - ks[0], kf[1] - ks[1], kf[2] - ks[2])).toBeLessThan(0.02);
    // reclined 30° is in between
    const r30 = skinLandmarkWorld("vertex", poseFor("reclined_30", 30))![1];
    expect(r30).toBeGreaterThan(skinLandmarkWorld("vertex", flat)![1] + 0.15);
    expect(r30).toBeLessThan(skinLandmarkWorld("vertex", sat)![1]);
  });

  it("left lateral decubitus rolls the patient's left side down", () => {
    const pose = poseFor("left_lateral_decubitus", 0);
    const l = anchorWorldPoints("lung_lat_l", pose)[0]!;
    const r = anchorWorldPoints("lung_lat_r", pose)[0]!;
    expect(l[1]).toBeLessThan(r[1] - 0.15);
  });

  it("sequence landmarks move with the body", () => {
    const a = landmarkWorld("mastoid", "ear_left", poseFor("supine", 0))!;
    const b = landmarkWorld("mastoid", "ear_left", poseFor("seated", 80))!;
    expect(b[1]).toBeGreaterThan(a[1] + 0.4);
  });
});

describe("picking and snapping", () => {
  it("a tighter landmark on top of a broad zone wins", () => {
    expect(pickRegion([{ regionId: "precordium_wall", distance: 1.0 }, { regionId: "cardiac_mitral", distance: 1.012 }])).toBe("cardiac_mitral");
    expect(pickRegion([{ regionId: "precordium_wall", distance: 1.0 }, { regionId: "cardiac_mitral", distance: 1.05 }])).toBe("precordium_wall");
    expect(pickRegion([])).toBeNull();
  });

  it("snaps to the nearest allowed anchor and reports the distance in cm and in tolerances", () => {
    const pose = poseFor("left_lateral_decubitus", 0);
    const w = anchorWorldPoints("cardiac_mitral", pose)[0]!;
    const exact = snapToAnchor(w, ["cardiac_mitral", "cardiac_tricuspid"], pose)!;
    expect(exact.regionId).toBe("cardiac_mitral");
    expect(exact.distanceCm).toBeCloseTo(0, 5);
    const off = snapToAnchor([w[0], w[1], w[2] + 0.04], ["cardiac_mitral"], pose)!;
    expect(off.distanceCm).toBeCloseTo(4, 3);
    expect(off.error).toBeCloseTo(4 / 2.5, 3); // 4 cm off the apex = 1.6 tolerances: outside
  });
});

describe("tight landmarks beside wide zones", () => {
  it("a fork on the mastoid snaps to the ear, not the (wider) scalp anchor", () => {
    const pose = poseFor("seated", 80, "female");
    const mastoid = landmarkWorld("mastoid", "ear_left", pose)!;
    expect(snapToAnchor(mastoid, ["scalp", "ear_left", "ear_right"], pose)!.regionId).toBe("ear_left");
  });
});
