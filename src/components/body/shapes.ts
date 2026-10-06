/**
 * Clickable shapes for each diagram view, keyed by the region's `svgPathId` (content/catalog/regions.json).
 * The silhouette (non-clickable outline) is drawn separately in BodyDiagram.
 *
 * Coordinates: body views use viewBox 0 0 300 600; sub-diagrams use 0 0 300 340.
 * Anterior view: the patient's RIGHT is on the viewer's LEFT. Posterior view: the patient's
 * right is on the viewer's right.
 *
 * A test (tests/bodyShapes.test.ts) checks that every region on a drawn view has exactly one shape.
 */
import type { View } from "@/domain/schemas";

export type Shape =
  | { svgPathId: string; el: "circle"; cx: number; cy: number; r: number }
  | { svgPathId: string; el: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { svgPathId: string; el: "rect"; x: number; y: number; width: number; height: number; rx?: number }
  | { svgPathId: string; el: "path"; d: string };

const W = 300;
const mx = (x: number) => W - x;
const circles = (pts: [number, number][], r: number) =>
  pts.map(([x, y]) => `M ${x - r} ${y} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`).join(" ");
const pair = (x: number, y: number): [number, number][] => [
  [x, y],
  [mx(x), y],
];

// Limb shapes for one side of the anterior view (viewer-left = patient's right).
function anteriorLimbs(side: "right" | "left"): Shape[] {
  const X = (x: number) => (side === "right" ? x : mx(x));
  const rect = (id: string, x: number, y: number, w: number, h: number, rx = 6): Shape => ({
    svgPathId: id,
    el: "rect",
    x: side === "right" ? x : mx(x + w),
    y,
    width: w,
    height: h,
    rx,
  });
  return [
    { svgPathId: `r-shoulder_${side}`, el: "circle", cx: X(80), cy: 128, r: 13 },
    rect(`r-arm_${side}`, 52, 145, 22, 60),
    { svgPathId: `r-elbow_${side}`, el: "circle", cx: X(60), cy: 214, r: 10 },
    rect(`r-wrist_${side}`, 40, 276, 22, 14, 4),
    { svgPathId: `r-hand_${side}`, el: "ellipse", cx: X(49), cy: 308, rx: 13, ry: 17 },
    { svgPathId: `r-groin_${side}`, el: "ellipse", cx: X(126), cy: 346, rx: 14, ry: 7 },
    { svgPathId: `r-hip_${side}`, el: "circle", cx: X(100), cy: 340, r: 10 },
    { svgPathId: `r-knee_${side}`, el: "circle", cx: X(123), cy: 462, r: 14 },
    rect(`r-shin_${side}`, 112, 480, 24, 72),
    { svgPathId: `r-ankle_${side}`, el: "ellipse", cx: X(124), cy: 562, rx: 13, ry: 7 },
    { svgPathId: `r-foot_${side}`, el: "ellipse", cx: X(118), cy: 582, rx: 19, ry: 9 },
    { svgPathId: `r-toe_great_${side}`, el: "circle", cx: X(134), cy: 590, r: 5 },
  ];
}

const anterior: Shape[] = [
  { svgPathId: "r-head", el: "path", d: "M 150 14 C 172 14 186 32 186 56 C 186 80 172 96 162 98 L 164 116 L 136 116 L 138 98 C 128 96 114 80 114 56 C 114 32 128 14 150 14 Z" },
  { svgPathId: "r-lung_lat_r", el: "rect", x: 87, y: 150, width: 12, height: 86, rx: 4 },
  { svgPathId: "r-lung_lat_l", el: "rect", x: 201, y: 150, width: 12, height: 86, rx: 4 },
  { svgPathId: "r-lung_ant_ru", el: "rect", x: 101, y: 122, width: 47, height: 48, rx: 6 },
  { svgPathId: "r-lung_ant_lu", el: "rect", x: 152, y: 122, width: 47, height: 40, rx: 6 },
  { svgPathId: "r-lung_ant_rl", el: "rect", x: 101, y: 174, width: 47, height: 62, rx: 6 },
  { svgPathId: "r-precordium", el: "path", d: "M 151 166 L 186 166 L 186 214 C 178 226 160 230 151 226 Z" },
  { svgPathId: "r-lung_ant_ll", el: "rect", x: 188, y: 166, width: 11, height: 70, rx: 4 },
  { svgPathId: "r-abd_ruq", el: "rect", x: 105, y: 242, width: 44, height: 40, rx: 6 },
  { svgPathId: "r-abd_luq", el: "rect", x: 151, y: 242, width: 44, height: 40, rx: 6 },
  { svgPathId: "r-abd_rlq", el: "rect", x: 105, y: 284, width: 44, height: 40, rx: 6 },
  { svgPathId: "r-abd_llq", el: "rect", x: 151, y: 284, width: 44, height: 40, rx: 6 },
  { svgPathId: "r-abd_epigastric", el: "ellipse", cx: 150, cy: 262, rx: 12, ry: 12 },
  ...anteriorLimbs("right"),
  ...anteriorLimbs("left"),
];

const posterior: Shape[] = [
  { svgPathId: "r-spine_cervical", el: "rect", x: 142, y: 96, width: 16, height: 22, rx: 4 },
  // patient's left is on the viewer's left from behind
  { svgPathId: "r-lung_post_lu", el: "rect", x: 98, y: 124, width: 42, height: 54, rx: 6 },
  { svgPathId: "r-lung_post_ru", el: "rect", x: 160, y: 124, width: 42, height: 54, rx: 6 },
  { svgPathId: "r-lung_post_ll", el: "rect", x: 98, y: 182, width: 42, height: 52, rx: 6 },
  { svgPathId: "r-lung_post_rl", el: "rect", x: 160, y: 182, width: 42, height: 52, rx: 6 },
  { svgPathId: "r-spine_thoracic", el: "rect", x: 143, y: 122, width: 14, height: 114, rx: 4 },
  { svgPathId: "r-cva_left", el: "ellipse", cx: 120, cy: 250, rx: 14, ry: 11 },
  { svgPathId: "r-cva_right", el: "ellipse", cx: 180, cy: 250, rx: 14, ry: 11 },
  { svgPathId: "r-spine_lumbar", el: "rect", x: 136, y: 242, width: 28, height: 58, rx: 6 },
  { svgPathId: "r-sacrum", el: "path", d: "M 132 306 L 168 306 L 150 340 Z" },
  { svgPathId: "r-calf_left", el: "rect", x: 112, y: 482, width: 24, height: 64, rx: 8 },
  { svgPathId: "r-calf_right", el: "rect", x: 164, y: 482, width: 24, height: 64, rx: 8 },
];

const headNeck: Shape[] = [
  { svgPathId: "r-scalp", el: "path", d: "M 82 92 C 86 46 116 26 150 26 C 184 26 214 46 218 92 C 196 70 176 62 150 62 C 124 62 104 70 82 92 Z" },
  { svgPathId: "r-face", el: "path", d: `${circles([[108, 150]], 14)} ${circles([[192, 150]], 14)} M 120 78 L 180 78 L 180 92 L 120 92 Z` },
  { svgPathId: "r-eye_right", el: "ellipse", cx: 122, cy: 112, rx: 16, ry: 9 },
  { svgPathId: "r-eye_left", el: "ellipse", cx: 178, cy: 112, rx: 16, ry: 9 },
  { svgPathId: "r-nose", el: "path", d: "M 150 118 L 160 150 C 156 156 144 156 140 150 Z" },
  { svgPathId: "r-mouth", el: "ellipse", cx: 150, cy: 176, rx: 22, ry: 9 },
  { svgPathId: "r-ear_right", el: "ellipse", cx: 74, cy: 124, rx: 9, ry: 20 },
  { svgPathId: "r-ear_left", el: "ellipse", cx: 226, cy: 124, rx: 9, ry: 20 },
  { svgPathId: "r-ln_pre_auricular", el: "path", d: circles(pair(90, 108), 6) },
  { svgPathId: "r-ln_post_auricular", el: "path", d: circles(pair(64, 152), 6) },
  { svgPathId: "r-ln_occipital", el: "path", d: circles(pair(78, 184), 6) },
  { svgPathId: "r-ln_submandibular", el: "path", d: circles(pair(112, 204), 6) },
  { svgPathId: "r-ln_submental", el: "circle", cx: 150, cy: 214, r: 6 },
  { svgPathId: "r-ln_post_cervical", el: "path", d: circles(pair(96, 246), 6) },
  { svgPathId: "r-ln_ant_cervical", el: "path", d: circles(pair(112, 270), 6) },
  { svgPathId: "r-ln_supraclavicular", el: "path", d: circles(pair(112, 312), 7) },
  { svgPathId: "r-carotid_right", el: "ellipse", cx: 130, cy: 236, rx: 6, ry: 13 },
  { svgPathId: "r-carotid_left", el: "ellipse", cx: 170, cy: 236, rx: 6, ry: 13 },
  { svgPathId: "r-neck_jvp_right", el: "path", d: "M 120 256 L 128 256 L 132 304 L 124 304 Z" },
  { svgPathId: "r-neck_thyroid", el: "ellipse", cx: 150, cy: 272, rx: 20, ry: 9 },
  { svgPathId: "r-neck_trachea", el: "rect", x: 144, y: 226, width: 12, height: 38, rx: 3 },
];

const precordium: Shape[] = [
  { svgPathId: "r-precordium_wall", el: "path", d: "M 40 30 L 260 30 L 270 300 L 30 300 Z" },
  { svgPathId: "r-precordium_lsb", el: "rect", x: 161, y: 52, width: 9, height: 150, rx: 3 },
  { svgPathId: "r-cardiac_aortic", el: "circle", cx: 128, cy: 74, r: 16 },
  { svgPathId: "r-cardiac_pulmonic", el: "circle", cx: 186, cy: 74, r: 16 },
  { svgPathId: "r-cardiac_erbs", el: "circle", cx: 188, cy: 116, r: 14 },
  { svgPathId: "r-cardiac_tricuspid", el: "circle", cx: 184, cy: 172, r: 15 },
  { svgPathId: "r-cardiac_mitral", el: "circle", cx: 222, cy: 206, r: 17 },
];

const neuroTiles: [string, string][] = [
  ["r-neuro_mental_status", "Orientation"],
  ["r-neuro_cranial_nerves", "Cranial nerves"],
  ["r-neuro_meningeal", "Meningeal"],
  ["r-neuro_motor_upper", "Motor – arms"],
  ["r-neuro_motor_lower", "Motor – legs"],
  ["r-neuro_sensory", "Sensation"],
  ["r-neuro_reflexes", "Reflexes"],
  ["r-neuro_cerebellar", "Coordination"],
  ["r-neuro_gait", "Gait & Romberg"],
];

export const NEURO_TILE_LABELS: Record<string, string> = Object.fromEntries(neuroTiles);

const neuro: Shape[] = neuroTiles.map(([id], i) => ({
  svgPathId: id,
  el: "rect",
  x: 12 + (i % 3) * 96,
  y: 20 + Math.floor(i / 3) * 104,
  width: 88,
  height: 92,
  rx: 10,
}));

export const SHAPES: Partial<Record<View, Shape[]>> = {
  anterior,
  posterior,
  head_neck: headNeck,
  precordium,
  neuro,
};

export const VIEWBOX: Partial<Record<View, string>> = {
  anterior: "0 0 300 600",
  posterior: "0 0 300 600",
  head_neck: "0 0 300 340",
  precordium: "0 0 300 330",
  neuro: "0 0 300 340",
};
