/**
 * The catalog harness plan (Phase 4 M0.3): every maneuver × allowed region × body model, with how
 * a student would do it in the 3D room (tool placement, body click + maneuver menu, panel button,
 * verbal description, prohibited region), the position and camera shot to use, and the finding the
 * server must return. Pure: shared by `npm run test:catalog` (Playwright) and `npm run test:anchors`.
 */
import { loadContentFromDisk } from "@/content/loadFromDisk";
import type { Case, ExamManeuver, Position, Region, Tool, ToolMode } from "@/domain/schemas";
import { POSITION_ANGLE } from "@/engine/patientState";
import { resolveFinding } from "@/engine/resolveFinding";
import { ANCHOR_BY_REGION, PANEL_GROUPS } from "@/exam3d/regionAnchors";
import { toolFor } from "@/exam3d/tools/toolLogic";
import { focusShotFor, type ShotId } from "@/scene/shots";
import type { VariantId } from "@/scene/rig";

/** panel-tool: a tool maneuver picked from a panel region (e.g. reflexes under Neurological) puts the tool in hand; it is recorded on the body */
export type Route = "tool" | "menu" | "panel" | "panel-tool" | "verbal" | "prohibited";

export interface CatalogEntry {
  /** stable id used by qa/xfail.json: catalog:<variant>:<maneuver>@<region> */
  id: string;
  variant: VariantId;
  caseId: string;
  maneuverId: string;
  regionId: string;
  group: Region["group"];
  route: Route;
  position: Position;
  bedAngle: number;
  shot: ShotId | null;
  tool?: Tool;
  toolMode?: ToolMode;
  /** sequence steps (Rinne): each placement's landmark */
  steps?: { id: string; landmark?: string }[];
  /** stethoscope: hold ≥ 3 s */
  hold: boolean;
  /** the finding text the server must record (catalog/case resolution), when the route records one */
  expectedFinding: string | null;
  toleranceCm: number | null;
}

/** Which case exercises each body model. */
export const CASE_FOR_VARIANT: Record<VariantId, string> = { male: "hf-decompensated-01", female: "screening-normal" };

/** Default exam position per region group when a maneuver doesn't require one. */
const GROUP_POSITION: Record<Region["group"], Position> = {
  head_neck: "seated",
  chest_front: "reclined_30",
  chest_back: "seated",
  abdomen: "supine",
  arms: "seated",
  hands: "seated",
  legs: "supine",
  feet: "supine",
  whole: "seated",
  neuro: "seated",
};

/** Positions the 3D room can show (standing/prone aren't drawn: they fall back to the group default). */
const DRAWN: ReadonlySet<Position> = new Set(["supine", "reclined_30", "reclined_45", "seated", "seated_leaning_forward", "left_lateral_decubitus", "sitting_dangling"]);

/** The back can only be reached when the patient isn't lying on it. */
const BACK_ACCESS: Position[] = ["seated_leaning_forward", "seated", "sitting_dangling", "left_lateral_decubitus"];

export function examPosition(m: Pick<ExamManeuver, "requiresPositioning">, region: Pick<Region, "group">): Position {
  const req = (m.requiresPositioning ?? []).filter((p) => DRAWN.has(p));
  if (region.group === "chest_back") return BACK_ACCESS.find((p) => req.includes(p)) ?? (req.length ? "left_lateral_decubitus" : GROUP_POSITION.chest_back);
  return req[0] ?? GROUP_POSITION[region.group];
}

export function buildCatalogPlan(opts: { variants?: VariantId[]; filter?: string } = {}): CatalogEntry[] {
  const c = loadContentFromDisk();
  const region = new Map(c.regions.map((r) => [r.id, r]));
  const cases = new Map(c.cases.map((k) => [k.id, k as Case]));
  const out: CatalogEntry[] = [];
  for (const variant of opts.variants ?? (["male", "female"] as VariantId[])) {
    const kase = cases.get(CASE_FOR_VARIANT[variant]);
    if (!kase) throw new Error(`catalog plan: case ${CASE_FOR_VARIANT[variant]} not found`);
    const prohibited = new Set((kase.doorInstructions?.prohibitedExams ?? []).flatMap((p) => p.regionIds));
    for (const m of c.maneuvers) {
      for (const regionId of m.allowedRegions) {
        const r = region.get(regionId);
        if (!r || r.hidden) continue;
        const tool = toolFor(m);
        const needsTool = !!tool && tool !== "hands";
        const route: Route = prohibited.has(regionId) ? "prohibited" : r.verbal ? "verbal" : PANEL_GROUPS.has(r.group) ? (needsTool ? "panel-tool" : "panel") : needsTool ? "tool" : "menu";
        const position = examPosition(m, r);
        const records = route === "tool" || route === "menu" || route === "panel";
        const finding = records ? resolveFinding(kase, m as ExamManeuver, regionId, { position }).findingText : null;
        const id = `catalog:${variant}:${m.id}@${regionId}`;
        if (opts.filter && !new RegExp(opts.filter).test(id)) continue;
        out.push({
          id,
          variant,
          caseId: kase.id,
          maneuverId: m.id,
          regionId,
          group: r.group,
          route,
          position,
          bedAngle: POSITION_ANGLE[position],
          shot: focusShotFor(r.group, regionId),
          ...(route === "tool" || route === "panel-tool" ? { tool: tool!, ...(m.toolMode ? { toolMode: m.toolMode } : {}) } : {}),
          ...(m.interaction === "sequence" && m.steps ? { steps: m.steps.map((s) => ({ id: s.id, ...(s.landmark ? { landmark: s.landmark } : {}) })) } : {}),
          hold: route === "tool" && tool === "stethoscope",
          expectedFinding: finding,
          toleranceCm: ANCHOR_BY_REGION.get(regionId)?.toleranceCm ?? null,
        });
      }
    }
    // the door says "do not perform": clicking these regions is refused and logged
    for (const regionId of prohibited) {
      const r = region.get(regionId);
      if (!r || !ANCHOR_BY_REGION.has(regionId)) continue;
      const id = `catalog:${variant}:prohibited@${regionId}`;
      if (opts.filter && !new RegExp(opts.filter).test(id)) continue;
      out.push({ id, variant, caseId: kase.id, maneuverId: "prohibited", regionId, group: r.group, route: "prohibited", position: GROUP_POSITION[r.group], bedAngle: POSITION_ANGLE[GROUP_POSITION[r.group]], shot: focusShotFor(r.group, regionId), hold: false, expectedFinding: null, toleranceCm: ANCHOR_BY_REGION.get(regionId)!.toleranceCm });
    }
  }
  return out;
}

/** Regions with a body anchor that some maneuver examines, and the positions they're examined in. */
export function examinedAnchors(variant: VariantId): { regionId: string; positions: Position[]; shot: ShotId | null }[] {
  const byRegion = new Map<string, { positions: Set<Position>; shot: ShotId | null }>();
  for (const e of buildCatalogPlan({ variants: [variant] })) {
    if (e.route !== "tool" && e.route !== "menu") continue;
    if (!ANCHOR_BY_REGION.has(e.regionId)) continue;
    const x = byRegion.get(e.regionId) ?? { positions: new Set<Position>(), shot: e.shot };
    x.positions.add(e.position);
    byRegion.set(e.regionId, x);
  }
  return [...byRegion].map(([regionId, x]) => ({ regionId, positions: [...x.positions], shot: x.shot }));
}
