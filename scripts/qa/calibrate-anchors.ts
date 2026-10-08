/**
 * npm run qa:calibrate-anchors [regex] — for each region anchor with an anatomy-oracle rule
 * (qa/anatomy/oracle.ts), print how far the anchor sits from the anatomical point in the bind pose,
 * per body model, and the offset that would put it there. Paste a suggestion into the anchor's
 * `offsetCmBy` in src/exam3d/anchorDefs.ts, run `npm run assets:patient`, then `npm run test:anchors`
 * (the pose checks decide). Only anchors over half their tolerance get a suggestion.
 */
import { oracleFor } from "../../qa/anatomy/oracle";
import { anchorsFor } from "../../src/exam3d/regionAnchors";
import { ANCHOR_DEFS } from "../../src/exam3d/anchorDefs";

const filter = new RegExp(process.argv[2] ?? ".");
const r1 = (x: number) => Math.round(x * 10) / 10;

async function main() {
  for (const variant of ["male", "female"] as const) {
    const oracle = await oracleFor(variant);
    console.log(`\n${variant}`);
    for (const o of oracle) {
      if (o.landmark || !filter.test(o.id)) continue;
      const a = anchorsFor(variant).find((x) => x.regionId === o.regionId);
      const def = ANCHOR_DEFS.find((d) => d.regionId === o.regionId);
      if (!a || !def) continue;
      // the anchor's first point is on the landmark's side (mirror twins carry their own defs)
      const p = a.points[0]!;
      const q = o.sample.bind;
      const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]].map((x) => x * 100) as [number, number, number];
      const cm = Math.hypot(...d);
      const flag = cm > o.toleranceCm / 2;
      const side = def.mirror ? -1 : 1;
      const cur = def.offsetCmBy?.[variant] ?? def.offsetCm;
      const next = [r1(cur[0] + d[0] * side), r1(cur[1] + d[1]), r1(cur[2] + d[2])];
      console.log(`  ${flag ? "!" : " "} ${o.id.padEnd(24)} ${cm.toFixed(1)} cm (tolerance ${o.toleranceCm})${flag && !def.mirror ? `  → offsetCmBy.${variant}: [${next.join(", ")}]` : ""}`);
    }
  }
}

main();
