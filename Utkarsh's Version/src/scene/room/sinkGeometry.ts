/**
 * The clinic sink as data (Phase 4 M2 bug 3): a real basin you can wash in, a gooseneck faucet, and
 * soap and towel dispensers. World metres (room frame of src/scene/room/ExamRoom.tsx: the sink is
 * on the left wall, −X). Pure, so tests and the hand-wash animation share it.
 */
export const SINK = {
  /** centre of the vanity, against the left wall */
  x: -2.12,
  z: 0.3,
  counter: { top: 0.9, thickness: 0.04, width: 0.58, depth: 0.64 },
  /** the bowl: rim radius at the counter top, bottom radius and depth below the rim */
  basin: { offsetX: 0.03, rimRadius: 0.2, bottomRadius: 0.11, depth: 0.13 },
  /** cabinet below the bowl (stops short of the basin bottom) */
  cabinetTop: 0.74,
} as const;

/** World position of the basin's rim centre. */
export function basinCenter(): [number, number, number] {
  return [SINK.x + SINK.basin.offsetX, SINK.counter.top, SINK.z];
}

/** Bowl profile for a LatheGeometry (x = radius, y = height relative to the rim), rim → drain. */
export function basinProfile(steps = 10): [number, number][] {
  const { rimRadius, bottomRadius, depth } = SINK.basin;
  const pts: [number, number][] = [[rimRadius + 0.015, 0]];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // a rounded bowl: steep near the rim, flattening toward the drain
    const r = bottomRadius + (rimRadius - bottomRadius) * Math.cos((t * Math.PI) / 2);
    pts.push([r, -depth * Math.sin((t * Math.PI) / 2)]);
  }
  pts.push([0.02, -depth]);
  return pts;
}

/** Where the hands rub while washing at the sink: over the bowl, a hand's height above the drain. */
export function washHandsPosition(): [number, number, number] {
  const [x, y, z] = basinCenter();
  return [x, y - SINK.basin.depth + 0.1, z];
}

/** Faucet: column at the back of the counter (toward the wall), spout over the basin centre. */
export const FAUCET = {
  base: [SINK.x - 0.22, SINK.counter.top, SINK.z] as [number, number, number],
  height: 0.3,
  /** spout tip, over the bowl */
  tip: [SINK.x + SINK.basin.offsetX - 0.02, SINK.counter.top + 0.24, SINK.z] as [number, number, number],
};
