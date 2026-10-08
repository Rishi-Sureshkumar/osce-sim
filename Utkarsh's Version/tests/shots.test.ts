import { describe, expect, it } from "vitest";
import { SHOTS, back, breadcrumb, canGo, ease, focusShotFor, go, shotCamera, shotHint, tweenSeconds, type ShotId, type ShotState } from "@/scene/shots";
import { poseFor } from "@/exam3d/regionAnchors";
import { loadContentFromDisk } from "@/content/loadFromDisk";

describe("camera shot state machine", () => {
  const start: ShotState = { current: "corridor", previous: null };

  it("the corridor leads only into the room; inside, every room shot is reachable", () => {
    expect(canGo("corridor", "overview")).toBe(true);
    expect(canGo("corridor", "chest_front")).toBe(false);
    expect(go(start, "chest_front")).toEqual(start);
    const room = go(start, "overview");
    expect(room.current).toBe("overview");
    for (const id of ["sink", "tool_table", "seated", "chest_front", "feet"] as ShotId[]) expect(canGo("overview", id), id).toBe(true);
    // no walking back out through the door by pressing Back
    expect(canGo("overview", "corridor")).toBe(false);
  });

  it("Back returns to the parent shot; the room overview is the root inside", () => {
    let s: ShotState = { current: "overview", previous: null };
    s = go(s, "tool_table");
    expect(s).toEqual({ current: "tool_table", previous: "overview" });
    s = go(s, "chest_front");
    expect(s.previous).toBe("tool_table");
    expect(back(s).current).toBe("overview");
    expect(back({ current: "overview", previous: null }).current).toBe("overview");
    expect(back({ current: "corridor", previous: null }).current).toBe("corridor");
  });

  it("breadcrumbs, focus shots and tween timing", () => {
    expect(breadcrumb("chest_back")).toEqual(["Room", "Chest (back)"]);
    expect(breadcrumb("overview")).toEqual(["Room"]);
    expect(focusShotFor("chest_front")).toBe("chest_front");
    expect(focusShotFor("neuro")).toBeNull();
    expect(tweenSeconds([0, 0, 0], [0, 0, 0.01])).toBe(0.6);
    expect(tweenSeconds([0, 0, 0], [5, 0, 0])).toBe(1.2);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5, 5);
  });

  it("every region group except panels has a focus shot, and every shot's transitions exist", () => {
    const { regions } = loadContentFromDisk();
    for (const r of regions) {
      const f = focusShotFor(r.group, r.id);
      if (f) expect(SHOTS[f], r.id).toBeDefined();
    }
    for (const s of Object.values(SHOTS)) for (const t of s.transitions) expect(SHOTS[t], `${s.id}→${t}`).toBeDefined();
  });

  it("patient shots follow the pose and look at the patient", () => {
    const flat = shotCamera("chest_front", poseFor("supine", 0));
    const sat = shotCamera("chest_front", poseFor("seated", 80));
    expect(sat.target[1]).toBeGreaterThan(flat.target[1] + 0.2);
    // camera is in front of the chest: above it when lying, in front of it (toward the feet) when sitting
    expect(flat.position[1]).toBeGreaterThan(flat.target[1] + 0.5);
    expect(sat.position[2]).toBeGreaterThan(sat.target[2] + 0.5);
    for (const id of Object.keys(SHOTS) as ShotId[]) {
      const c = shotCamera(id, poseFor("reclined_30", 30));
      const d = Math.hypot(c.position[0] - c.target[0], c.position[1] - c.target[1], c.position[2] - c.target[2]);
      expect(d, id).toBeGreaterThan(0.3);
      expect(d, id).toBeLessThan(3);
    }
  });
});

describe("hints for parts the patient lies on", () => {
  it("the back is out of reach lying back (up to 45°) or sitting back; not leaning forward, at the table's end or on the side", () => {
    for (const p of ["supine", "reclined_30", "reclined_45"] as const) {
      expect(shotHint("chest_back", p), p).toMatch(/back is against the table/);
      expect(shotHint("neck_back", p), p).toMatch(/back is against the table/);
    }
    for (const p of ["seated_leaning_forward", "sitting_dangling", "left_lateral_decubitus", "standing"] as const) expect(shotHint("chest_back", p), p).toBeNull();
    // sitting back against the raised head of the table: lean forward
    expect(shotHint("chest_back", "seated")).toMatch(/lean forward/);
  });
  it("lying on the left side, the left ear is against the table", () => {
    expect(shotHint("ear_left", "left_lateral_decubitus")).toMatch(/left ear is against the table/);
    expect(shotHint("ear_right", "left_lateral_decubitus")).toBeNull();
    expect(shotHint("ear_left", "seated")).toBeNull();
  });
});
