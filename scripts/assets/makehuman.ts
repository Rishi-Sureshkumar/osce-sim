/**
 * MakeHuman (CC0) source assets: download once into .cache/makehuman, then parse.
 * Base mesh hm08 (`base.obj`), the default skeleton (`default.mhskel`) and its weights
 * (`default_weights.mhw`). All three are released under CC0 1.0 by the MakeHuman project.
 */
import fs from "node:fs";
import path from "node:path";

const BASE = "https://raw.githubusercontent.com/makehumancommunity/makehuman/master";
export const SOURCES = {
  "base.obj": `${BASE}/makehuman/data/3dobjs/base.obj`,
  "default.mhskel": `${BASE}/makehuman/data/rigs/default.mhskel`,
  "default_weights.mhw": `${BASE}/makehuman/data/rigs/default_weights.mhw`,
  "LICENSE.ASSETS.md": `${BASE}/LICENSE.ASSETS.md`,
} as const;
export const CACHE = path.join(process.cwd(), ".cache", "makehuman");

/** Shape targets (CC0): MakeHuman blends ethnicity × sex × age targets to shape the base mesh. */
export const TARGET_URL = (name: string) => `${BASE}/makehuman/data/targets/macrodetails/${name}.target`;

export async function ensureSources(targets: string[] = []): Promise<void> {
  fs.mkdirSync(CACHE, { recursive: true });
  const all: Record<string, string> = { ...SOURCES, ...Object.fromEntries(targets.map((t) => [`${t}.target`, TARGET_URL(t)])) };
  for (const [name, url] of Object.entries(all)) {
    const file = path.join(CACHE, name);
    if (fs.existsSync(file) && fs.statSync(file).size > 0) continue;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download failed ${res.status}: ${url}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log("downloaded", name);
  }
}

export interface ObjFace {
  v: number[];
  vt: number[];
  group: string;
}
export interface Obj {
  v: [number, number, number][];
  vt: [number, number][];
  faces: ObjFace[];
}

export function parseObj(text: string): Obj {
  const v: Obj["v"] = [];
  const vt: Obj["vt"] = [];
  const faces: ObjFace[] = [];
  let group = "";
  for (const line of text.split("\n")) {
    if (line.startsWith("v ")) {
      const [, x, y, z] = line.trim().split(/\s+/);
      v.push([Number(x), Number(y), Number(z)]);
    } else if (line.startsWith("vt ")) {
      const [, a, b] = line.trim().split(/\s+/);
      vt.push([Number(a), Number(b)]);
    } else if (line.startsWith("g ")) {
      group = line.slice(2).trim();
    } else if (line.startsWith("f ")) {
      const parts = line.trim().split(/\s+/).slice(1);
      faces.push({
        v: parts.map((p) => Number(p.split("/")[0]) - 1),
        vt: parts.map((p) => Number(p.split("/")[1] ?? 0) - 1),
        group,
      });
    }
  }
  return { v, vt, faces };
}

export interface MhBone {
  head: string;
  tail: string;
  parent: string | null;
}
export interface MhSkeleton {
  bones: Record<string, MhBone>;
  joints: Record<string, number[]>;
}

/** Applies weighted MakeHuman targets ("index dx dy dz" lines, decimetres) to the vertex list. */
export function applyTargets(v: Obj["v"], targets: { name: string; weight: number }[]): Obj["v"] {
  const out = v.map((p) => [...p] as [number, number, number]);
  for (const t of targets) {
    for (const line of fs.readFileSync(path.join(CACHE, `${t.name}.target`), "utf8").split("\n")) {
      if (!line || line.startsWith("#")) continue;
      const [i, dx, dy, dz] = line.trim().split(/\s+/).map(Number);
      const p = out[i!];
      if (!p) continue;
      p[0] += dx! * t.weight;
      p[1] += dy! * t.weight;
      p[2] += dz! * t.weight;
    }
  }
  return out;
}

export function readSources() {
  const obj = parseObj(fs.readFileSync(path.join(CACHE, "base.obj"), "utf8"));
  const skel = JSON.parse(fs.readFileSync(path.join(CACHE, "default.mhskel"), "utf8")) as MhSkeleton;
  const weights = (JSON.parse(fs.readFileSync(path.join(CACHE, "default_weights.mhw"), "utf8")) as { weights: Record<string, [number, number][]> }).weights;
  return { obj, skel, weights };
}
