/**
 * The drape sheet over the pelvis and legs (Phase 4 M3, bug 6), shared by the renderer
 * (Drapes.tsx) and the Node intersection check (scripts/qa/intersections.ts).
 *
 * The sheet is built from the posed skin itself, so the legs can't poke through it in any position:
 *  1. each skin vertex is classified in the bind (standing) pose: the pelvis section (genital band
 *     and buttocks, never exposed), the left or right leg section (from just above the pubis, the
 *     groin crease included, down to the ankles — the feet stay bare for pulses, sensation and the
 *     plantar response), or not under the sheet;
 *  2. the classified vertices are skinned through the same forward kinematics as the rest of the app
 *     (src/scene/rig.ts) and splatted into a world-space heightfield over the table (world +Y up),
 *     lifted a little off the skin, then spread with a quadratic fall-off so the cloth slopes down
 *     to the mattress and hangs over the table edge;
 *  3. each heightfield node remembers which section's skin is under it, so a folded-back leg
 *     section simply isn't drawn there and a click on the sheet knows which section it touched.
 * Sitting with the legs hanging, only the lap is covered (the knees and shins are left free for
 * the reflexes).
 */
import { Vector3 } from "three";
import { PATIENT_VARIANTS } from "./patientRig.generated";
import { TABLE, type Pose, type VariantId } from "./rig";

/** 0 not under the sheet · 1 pelvis (never exposed) · 2 left leg · 3 right leg */
export type SheetOwner = 0 | 1 | 2 | 3;
export const OWNER_SECTION = { 1: "pelvis", 2: "leg_left", 3: "leg_right" } as const;

/** Skin data in bind space: 4 joints and weights per vertex. */
export interface SkinData {
  /** bind-pose positions, model space (metres) */
  bind: ArrayLike<number>;
  joints: ArrayLike<number>;
  weights: ArrayLike<number>;
  /** joint index → bone name */
  jointNames: readonly string[];
  count: number;
  /** bind-pose normals (optional: the folded gown edges lift off the skin along them) */
  normals?: ArrayLike<number>;
}

/** World-space normal of one skin vertex in a pose (bind normal turned by its bones' rotations). */
export function skinNormal(skin: SkinData, pose: Pose, i: number): Vector3 | null {
  if (!skin.normals) return null;
  const n = new Vector3();
  const b = new Vector3(skin.normals[i * 3]!, skin.normals[i * 3 + 1]!, skin.normals[i * 3 + 2]!);
  for (let k = 0; k < 4; k++) {
    const w = skin.weights[i * 4 + k]!;
    if (w <= 0) continue;
    const m = pose.world.get(skin.jointNames[skin.joints[i * 4 + k]!]!);
    if (m) n.addScaledVector(b.clone().transformDirection(m), w);
  }
  return n.lengthSq() > 0 ? n.normalize() : null;
}

export interface SheetCuts {
  /** bind y of the lowest midline point between the legs */
  crotchY: number;
  /** top edge of the sheet (just above the pubis) */
  topY: number;
  /** lower edge (above the ankles) */
  ankleY: number;
}

/** Sheet lift off the skin (m) and the cloth's sideways fall-off. */
export const SHEET = {
  lift: 0.018,
  /** height splat radius: the sheet clears every covered vertex within this distance */
  splat: 0.035,
  /** a section marks a node if its skin is within this distance and on top (within `topLayer` of the highest skin there) */
  mark: 0.024,
  topLayer: 0.02,
  cell: 0.015,
  falloff: 0.2,
  droop: 6.25,
  hang: 0.22,
  overhang: 0.05,
  wrinkle: 0.004,
} as const;

const cutsCache = new Map<string, SheetCuts>();

/** Where the sheet starts and ends on a body model (bind space). */
export function sheetCuts(variant: VariantId, skin: SkinData): SheetCuts {
  const key = `${variant}:${skin.count}`;
  const hit = cutsCache.get(key);
  if (hit) return hit;
  let crotchY = Infinity;
  for (let i = 0; i < skin.count; i++) {
    const x = skin.bind[i * 3]!;
    const y = skin.bind[i * 3 + 1]!;
    const z = skin.bind[i * 3 + 2]!;
    if (Math.abs(x) < 0.012 && y > -0.3 && y < 0.1 && z > -0.06 && z < 0.16) crotchY = Math.min(crotchY, y);
  }
  if (!Number.isFinite(crotchY)) crotchY = -0.1;
  const ankle = PATIENT_VARIANTS[variant].anchors.find((a) => a.regionId === "ankle_right")?.points[0];
  // the sheet's drawn edge runs ~5 cm past its last covered vertex (splat + edge blur): cut 10 cm above the
  // ankle target so the ankles stay bare for the edema and pulse exams
  const cuts = { crotchY, topY: crotchY + 0.12, ankleY: (ankle?.[1] ?? -0.8) + 0.1 };
  cutsCache.set(key, cuts);
  return cuts;
}

/** Bind-pose classification of every skin vertex (see the module comment). */
export function classifySheet(skin: SkinData, cuts: SheetCuts): Uint8Array {
  const out = new Uint8Array(skin.count);
  for (let i = 0; i < skin.count; i++) {
    const x = skin.bind[i * 3]!;
    const y = skin.bind[i * 3 + 1]!;
    const z = skin.bind[i * 3 + 2]!;
    // arms and hands (the A-pose holds them out to the sides) never count
    if (y > cuts.topY || y < cuts.ankleY || Math.abs(x) > 0.24) continue;
    // a towel over the genitals and the roots of the inner thighs, with a midline strip up over the
    // pubis to the sheet's top edge; the groin creases either side (femoral pulses) belong to the legs
    const genital = (y < cuts.crotchY + 0.055 && Math.abs(x) < 0.06) || Math.abs(x) < 0.02;
    const buttock = z < -0.02 && y > cuts.crotchY - 0.1 && Math.abs(x) < 0.17;
    out[i] = genital || buttock ? 1 : x >= 0 ? 2 : 3;
  }
  return out;
}

const tmp = new Vector3();
/** World positions of the vertices with owner ≠ 0 (others left at NaN), skinned like the GPU does. */
export function skinWorld(skin: SkinData, pose: Pose, owner: Uint8Array): Float32Array {
  const out = new Float32Array(skin.count * 3).fill(NaN);
  for (let i = 0; i < skin.count; i++) {
    if (!owner[i]) continue;
    let x = 0;
    let y = 0;
    let z = 0;
    let total = 0;
    for (let k = 0; k < 4; k++) {
      const w = skin.weights[i * 4 + k]!;
      if (w <= 0) continue;
      const bone = skin.jointNames[skin.joints[i * 4 + k]!]!;
      const m = pose.world.get(bone);
      const head = pose.heads.get(bone);
      if (!m || !head) continue;
      tmp.set(skin.bind[i * 3]! - head.x, skin.bind[i * 3 + 1]! - head.y, skin.bind[i * 3 + 2]! - head.z).applyMatrix4(m);
      x += tmp.x * w;
      y += tmp.y * w;
      z += tmp.z * w;
      total += w;
    }
    if (total > 0) {
      out[i * 3] = x / total;
      out[i * 3 + 1] = y / total;
      out[i * 3 + 2] = z / total;
    }
  }
  return out;
}

export interface Sheet {
  x0: number;
  z0: number;
  cell: number;
  nx: number;
  nz: number;
  /** node heights (world y), nx × nz, row-major by z */
  height: Float32Array;
  /** node owners (the nearest covered skin's section: what a click on the sheet folds back) */
  owner: Uint8Array;
  /** sections whose skin lies under each node (bits 1 pelvis, 2 left leg, 4 right leg): drawn if any is covered */
  mask: Uint8Array;
  /** the node lies over the patient (not just the mattress or the hanging edge) */
  onBody: Uint8Array;
  /** highest covered skin under each node, lifted (−Infinity where there is none) */
  top: Float32Array;
}

/** Build the heightfield sheet from skinned, classified vertices. `lapOnly`: sitting with the legs hanging. */
export function buildSheet(world: Float32Array, owner: Uint8Array, opts: { lapOnly?: boolean; seed?: number; under?: Float32Array } = {}): Sheet {
  const tableTop = TABLE.topY;
  const covers = (i: number) => owner[i] && !Number.isNaN(world[i * 3]!) && (!opts.lapOnly || world[i * 3 + 1]! >= tableTop - 0.03);
  let zmin = Infinity;
  let zmax = -Infinity;
  for (let i = 0; i < owner.length; i++) {
    if (!covers(i)) continue;
    zmin = Math.min(zmin, world[i * 3 + 2]!);
    zmax = Math.max(zmax, world[i * 3 + 2]!);
  }
  if (!Number.isFinite(zmin)) {
    zmin = 0;
    zmax = 0.01;
  }
  const cell = SHEET.cell;
  const half = TABLE.width / 2 + SHEET.overhang;
  const x0 = TABLE.x - half;
  const z0 = zmin - 0.005;
  const nx = Math.ceil((2 * half) / cell) + 1;
  const nz = Math.max(2, Math.ceil((zmax + 0.008 - z0) / cell) + 1);
  const N = nx * nz;
  const h0 = new Float32Array(N).fill(-Infinity);
  // the same, within one cell diagonal only: the lowest a node may go and still keep every covered vertex
  // of its cells under the (bilinear) sheet — the floor for tucking under the arms
  const h1 = new Float32Array(N).fill(-Infinity);
  const r1 = cell * Math.SQRT2 + 0.001;
  const near = new Float32Array(N).fill(Infinity);
  const own0 = new Uint8Array(N);
  const mask0 = new Uint8Array(N);
  const r = SHEET.splat;
  const rc = Math.ceil(r / cell);
  for (let i = 0; i < owner.length; i++) {
    if (!covers(i)) continue;
    const px = world[i * 3]!;
    const py = world[i * 3 + 1]!;
    const pz = world[i * 3 + 2]!;
    const ci = Math.round((px - x0) / cell);
    const cj = Math.round((pz - z0) / cell);
    for (let dj = -rc; dj <= rc; dj++) {
      const j = cj + dj;
      if (j < 0 || j >= nz) continue;
      for (let di = -rc; di <= rc; di++) {
        const k = ci + di;
        if (k < 0 || k >= nx) continue;
        const d = Math.hypot(x0 + k * cell - px, z0 + j * cell - pz);
        if (d > r) continue;
        const n = j * nx + k;
        if (py + SHEET.lift > h0[n]!) h0[n] = py + SHEET.lift;
        if (d <= r1 && py + SHEET.lift > h1[n]!) h1[n] = py + SHEET.lift;
      }
    }
  }
  // which sections' skin is on top under each node (skin hidden under another leg doesn't count)
  const markCells = Math.ceil(SHEET.mark / cell);
  for (let i = 0; i < owner.length; i++) {
    if (!covers(i)) continue;
    const px = world[i * 3]!;
    const py = world[i * 3 + 1]!;
    const pz = world[i * 3 + 2]!;
    const ci = Math.round((px - x0) / cell);
    const cj = Math.round((pz - z0) / cell);
    for (let dj = -markCells; dj <= markCells; dj++) {
      const j = cj + dj;
      if (j < 0 || j >= nz) continue;
      for (let di = -markCells; di <= markCells; di++) {
        const k = ci + di;
        if (k < 0 || k >= nx) continue;
        const d = Math.hypot(x0 + k * cell - px, z0 + j * cell - pz);
        const n = j * nx + k;
        if (d > SHEET.mark || py + SHEET.lift < h0[n]! - SHEET.topLayer) continue;
        mask0[n]! |= 1 << (owner[i]! - 1);
        if (d < near[n]!) {
          near[n] = d;
          own0[n] = owner[i]!;
        }
      }
    }
  }
  // cloth fall-off: every node is at least as high as any covered node nearby, minus a droop
  const height = new Float32Array(N);
  const own = new Uint8Array(N);
  const mask = new Uint8Array(N);
  const onBody = new Uint8Array(N);
  const fc = Math.ceil(SHEET.falloff / cell);
  // midline of the covered skin, for owners of nodes far from any skin
  let mx = 0;
  let mc = 0;
  for (let i = 0; i < owner.length; i++) {
    if (!covers(i) || owner[i] === 1) continue;
    mx += world[i * 3]!;
    mc++;
  }
  const midX = mc ? mx / mc : TABLE.x;
  for (let j = 0; j < nz; j++) {
    for (let k = 0; k < nx; k++) {
      const n = j * nx + k;
      let best = -Infinity;
      let bestOwn = 0;
      let bestMask = 0;
      if (h0[n]! > -Infinity) {
        best = h0[n]!;
        bestOwn = own0[n]!;
        bestMask = mask0[n]!;
        onBody[n] = 1;
      }
      for (let dj = -fc; dj <= fc; dj++) {
        const jj = j + dj;
        if (jj < 0 || jj >= nz) continue;
        for (let di = -fc; di <= fc; di++) {
          const kk = k + di;
          if (kk < 0 || kk >= nx) continue;
          const m = jj * nx + kk;
          if (h0[m] === -Infinity) continue;
          const d2 = (di * cell) ** 2 + (dj * cell) ** 2;
          if (d2 > SHEET.falloff ** 2) continue;
          const v = h0[m]! - SHEET.droop * d2;
          if (v > best) {
            best = v;
            bestOwn = own0[m]!;
            if (!onBody[n]) bestMask = mask0[m]!;
          }
        }
      }
      const x = x0 + k * cell;
      const z = z0 + j * cell;
      const onTable = Math.abs(x - TABLE.x) <= TABLE.width / 2;
      const floor = onTable ? tableTop + 0.004 : tableTop - SHEET.hang;
      // a few millimetres of soft folds, always upward (the sheet never dips toward the skin)
      const wrinkle = SHEET.wrinkle * 0.5 * (1 + Math.sin(z * 37 + (opts.seed ?? 0)) * Math.sin(x * 23 + z * 7));
      height[n] = Math.max(best, floor) + (best > floor ? wrinkle : 0);
      own[n] = bestOwn || (x >= midX ? 2 : 3);
      mask[n] = bestMask || 1 << (own[n]! - 1);
    }
  }
  if (opts.under) tuckUnder(height, h1, h0, opts.under, { x0, z0, cell, nx, nz, lapOnly: !!opts.lapOnly, floorAt: (x) => (Math.abs(x - TABLE.x) <= TABLE.width / 2 ? tableTop + 0.004 : tableTop - SHEET.hang) });
  return { x0, z0, cell, nx, nz, height, owner: own, mask, onBody, top: h0 };
}

/**
 * How the sheet passes under the arms: a few millimetres below them, rising away at `slope` (m per m) to the
 * drape, under arm vertices within `rest` of what they lie on (the mattress or covered skin).
 */
export const TUCK = { gap: 0.004, reach: 0.1, slope: 1.2, relax: 12, rest: 0.1 } as const;

/**
 * Hands lying beside the hips rest on the sheet rather than under it: the cloth's fall-off would
 * otherwise drape it over them. A node's height is capped just below the nearest arm vertices (`under`:
 * skinned arm positions, NaN elsewhere), rising away from the arm — so the sheet tucks down between the
 * arm and the body — but never below the covered skin within one cell diagonal (`floor`), so every
 * covered vertex stays under the sheet.
 */
function tuckUnder(height: Float32Array, floor: Float32Array, skinTop: Float32Array, under: Float32Array, g: { x0: number; z0: number; cell: number; nx: number; nz: number; lapOnly: boolean; floorAt: (x: number) => number }) {
  const { x0, z0, cell, nx, nz } = g;
  const cap = new Float32Array(nx * nz).fill(Infinity);
  const rc = Math.ceil(TUCK.reach / cell);
  for (let i = 0; i * 3 < under.length; i++) {
    const px = under[i * 3]!;
    if (Number.isNaN(px)) continue;
    const py = under[i * 3 + 1]!;
    const pz = under[i * 3 + 2]!;
    const ci = Math.round((px - x0) / cell);
    const cj = Math.round((pz - z0) / cell);
    if (ci < -rc || cj < -rc || ci > nx + rc || cj > nz + rc) continue;
    // only an arm lying on something (the mattress, or covered skin such as the lap) has the sheet under
    // it; an elbow held clear beside the body leaves the cloth hanging as it was
    const cn = Math.min(nz - 1, Math.max(0, cj)) * nx + Math.min(nx - 1, Math.max(0, ci));
    // sitting on the end of the table only the forearms on the lap count (the elbows hang clear beside it)
    const rests = g.lapOnly
      ? floor[cn]! > -Infinity && py - (skinTop[cn]! - SHEET.lift) <= TUCK.rest
      : py - Math.max(g.floorAt(px), skinTop[cn]! - SHEET.lift) <= TUCK.rest;
    if (!rests) continue;
    for (let dj = -rc; dj <= rc; dj++) {
      const j = cj + dj;
      if (j < 0 || j >= nz) continue;
      for (let di = -rc; di <= rc; di++) {
        const k = ci + di;
        if (k < 0 || k >= nx) continue;
        const d = Math.hypot(x0 + k * cell - px, z0 + j * cell - pz);
        if (d > TUCK.reach) continue;
        const n = j * nx + k;
        const c = py - TUCK.gap + TUCK.slope * d;
        if (c < cap[n]!) cap[n] = c;
      }
    }
  }
  // each node's band: never below the covered skin (or the mattress), never above the arm cap or where
  // the cloth hung before; relaxing inside the band turns the tuck's steps into smooth slopes
  const lo = new Float32Array(nx * nz);
  const hi = new Float32Array(nx * nz);
  const free: number[] = [];
  for (let j = 0; j < nz; j++)
    for (let k = 0; k < nx; k++) {
      const n = j * nx + k;
      lo[n] = Math.max(g.floorAt(x0 + k * cell), floor[n]!);
      hi[n] = Math.max(lo[n]!, Math.min(height[n]!, cap[n]!));
      height[n] = hi[n]!;
      if (cap[n] !== Infinity) free.push(n);
    }
  const next = new Float32Array(height);
  for (let it = 0; it < TUCK.relax; it++) {
    for (const n of free) {
      const k = n % nx;
      const j = (n - k) / nx;
      let acc = 0;
      let w = 0;
      for (let dj = -1; dj <= 1; dj++)
        for (let dk = -1; dk <= 1; dk++) {
          const jj = j + dj;
          const kk = k + dk;
          if (jj < 0 || jj >= nz || kk < 0 || kk >= nx) continue;
          const wt = dj === 0 && dk === 0 ? 4 : dj === 0 || dk === 0 ? 2 : 1;
          acc += height[jj * nx + kk]! * wt;
          w += wt;
        }
      next[n] = Math.min(hi[n]!, Math.max(lo[n]!, acc / w));
    }
    for (const n of free) height[n] = next[n]!;
  }
}

/** Bind-pose arm vertices (the A-pose holds them out to the sides): what the sheet tucks under. */
export function armMask(skin: SkinData): Uint8Array {
  const out = new Uint8Array(skin.count);
  for (let i = 0; i < skin.count; i++) if (Math.abs(skin.bind[i * 3]!) > 0.24) out[i] = 1;
  return out;
}

/** Bilinear sheet height at a world (x, z), or null outside the sheet. */
export function sheetHeightAt(s: Sheet, x: number, z: number): number | null {
  const fx = (x - s.x0) / s.cell;
  const fz = (z - s.z0) / s.cell;
  if (fx < 0 || fz < 0 || fx > s.nx - 1 || fz > s.nz - 1) return null;
  const k = Math.min(s.nx - 2, Math.floor(fx));
  const j = Math.min(s.nz - 2, Math.floor(fz));
  const tx = fx - k;
  const tz = fz - j;
  const h = (jj: number, kk: number) => s.height[jj * s.nx + kk]!;
  return (h(j, k) * (1 - tx) + h(j, k + 1) * tx) * (1 - tz) + (h(j + 1, k) * (1 - tx) + h(j + 1, k + 1) * tx) * tz;
}

/** Owner of the nearest node to a world (x, z) (0 outside the sheet). */
export function sheetOwnerAt(s: Sheet, x: number, z: number): SheetOwner {
  const k = Math.round((x - s.x0) / s.cell);
  const j = Math.round((z - s.z0) / s.cell);
  if (k < 0 || j < 0 || k >= s.nx || j >= s.nz) return 0;
  return s.owner[j * s.nx + k] as SheetOwner;
}

/** Is a skin vertex's section covered? (the pelvis always is) */
export function nodeShown(owner: number, covered: { leg_left: boolean; leg_right: boolean }): boolean {
  return owner === 1 || (owner === 2 && covered.leg_left) || (owner === 3 && covered.leg_right);
}

/** Is a sheet node drawn: does any covered section's skin lie under it? */
export function maskShown(mask: number, covered: { leg_left: boolean; leg_right: boolean }): boolean {
  return !!(mask & 1) || (!!(mask & 2) && covered.leg_left) || (!!(mask & 4) && covered.leg_right);
}

/**
 * Coverage field over the nodes: 1 where the section underneath is covered, 0 where it's folded
 * back, blurred over a few centimetres so the sheet's edges come out as smooth curves.
 */
export function coverageField(s: Sheet, covered: { leg_left: boolean; leg_right: boolean }): Float32Array {
  const { nx, nz } = s;
  const f0 = new Float32Array(nx * nz);
  for (let n = 0; n < nx * nz; n++) f0[n] = maskShown(s.mask[n]!, covered) ? 1 : 0;
  // the towel over the pelvis gets a one-cell margin, so its blurred edge never uncovers it
  for (let j = 0; j < nz; j++)
    for (let k = 0; k < nx; k++) {
      if (!(s.mask[j * nx + k]! & 1)) continue;
      for (let dj = -1; dj <= 1; dj++)
        for (let dk = -1; dk <= 1; dk++) {
          const jj = j + dj;
          const kk = k + dk;
          if (jj >= 0 && jj < nz && kk >= 0 && kk < nx) f0[jj * nx + kk] = 1;
        }
    }
  const w = [1, 4, 6, 4, 1].map((x) => x / 16);
  const pass = (src: Float32Array, dx: number, dz: number) => {
    const out = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++)
      for (let k = 0; k < nx; k++) {
        let acc = 0;
        for (let t = -2; t <= 2; t++) {
          const kk = Math.min(nx - 1, Math.max(0, k + t * dx));
          const jj = Math.min(nz - 1, Math.max(0, j + t * dz));
          acc += src[jj * nx + kk]! * w[t + 2]!;
        }
        out[j * nx + k] = acc;
      }
    return out;
  };
  return pass(pass(pass(pass(f0, 1, 0), 0, 1), 1, 0), 0, 1);
}

/** Triangle mesh of the shown part of the sheet (world space), smooth normals, edges cut along the coverage field. */
export function sheetMesh(s: Sheet, covered: { leg_left: boolean; leg_right: boolean }): { positions: Float32Array; normals: Float32Array; indices: Uint32Array } {
  const { nx, nz, cell } = s;
  const field = coverageField(s, covered);
  const P: number[] = [];
  const N: number[] = [];
  const nodeNormal = (k: number, j: number) => {
    const hl = s.height[j * nx + Math.max(0, k - 1)]!;
    const hr = s.height[j * nx + Math.min(nx - 1, k + 1)]!;
    const hd = s.height[Math.max(0, j - 1) * nx + k]!;
    const hu = s.height[Math.min(nz - 1, j + 1) * nx + k]!;
    return new Vector3(-(hr - hl) / (2 * cell), 1, -(hu - hd) / (2 * cell)).normalize();
  };
  interface V {
    p: Vector3;
    n: Vector3;
    f: number;
  }
  const node = (k: number, j: number): V => ({ p: new Vector3(s.x0 + k * cell, s.height[j * nx + k]!, s.z0 + j * cell), n: nodeNormal(k, j), f: field[j * nx + k]! - 0.5 });
  const lerp = (a: V, b: V): V => {
    const t = a.f / (a.f - b.f);
    return { p: a.p.clone().lerp(b.p, t), n: a.n.clone().lerp(b.n, t).normalize(), f: 0 };
  };
  const emit = (...vs: V[]) => {
    for (const v of vs) {
      P.push(v.p.x, v.p.y, v.p.z);
      N.push(v.n.x, v.n.y, v.n.z);
    }
  };
  // keep the part of a triangle where the field is ≥ 0.5
  const tri = (a: V, b: V, c: V) => {
    const inside = [a, b, c].filter((v) => v.f >= 0);
    if (inside.length === 0) return;
    if (inside.length === 3) return emit(a, b, c);
    const vs = [a, b, c];
    const out: V[] = [];
    for (let i = 0; i < 3; i++) {
      const u = vs[i]!;
      const v = vs[(i + 1) % 3]!;
      if (u.f >= 0) out.push(u);
      if (u.f >= 0 !== v.f >= 0) out.push(lerp(u, v));
    }
    for (let i = 1; i + 1 < out.length; i++) emit(out[0]!, out[i]!, out[i + 1]!);
  };
  for (let j = 0; j < nz - 1; j++) {
    for (let k = 0; k < nx - 1; k++) {
      const a = node(k, j);
      const b = node(k + 1, j);
      const c = node(k, j + 1);
      const d = node(k + 1, j + 1);
      tri(a, c, b);
      tri(b, c, d);
    }
  }
  const count = P.length / 3;
  return { positions: Float32Array.from(P), normals: Float32Array.from(N), indices: Uint32Array.from({ length: count }, (_, i) => i) };
}

/** Bilinear coverage at a world (x, z): ≥ 0.5 means the drawn sheet is there. */
export function coverageAt(s: Sheet, field: Float32Array, x: number, z: number): number {
  const fx = (x - s.x0) / s.cell;
  const fz = (z - s.z0) / s.cell;
  if (fx < 0 || fz < 0 || fx > s.nx - 1 || fz > s.nz - 1) return 0;
  const k = Math.min(s.nx - 2, Math.floor(fx));
  const j = Math.min(s.nz - 2, Math.floor(fz));
  const tx = fx - k;
  const tz = fz - j;
  const f = (jj: number, kk: number) => field[jj * s.nx + kk]!;
  return (f(j, k) * (1 - tx) + f(j, k + 1) * tx) * (1 - tz) + (f(j + 1, k) * (1 - tx) + f(j + 1, k + 1) * tx) * tz;
}

/** Is a skin point hidden beneath other skin (more than `topLayer` below the top surface there)? */
export function underOtherSkin(s: Sheet, p: readonly number[]): boolean {
  const k = Math.round((p[0]! - s.x0) / s.cell);
  const j = Math.round((p[2]! - s.z0) / s.cell);
  if (k < 0 || j < 0 || k >= s.nx || j >= s.nz) return false;
  return p[1]! + SHEET.lift < s.top[j * s.nx + k]! - SHEET.topLayer;
}

/**
 * How far a skin vertex pokes up through the sheet (m; > 0 = through), or null when the vertex is
 * not under the drawn sheet. Used by the intersection check.
 */
export function sheetPenetration(s: Sheet, p: readonly number[]): number | null {
  const h = sheetHeightAt(s, p[0]!, p[2]!);
  if (h === null) return null;
  return p[1]! - h;
}

