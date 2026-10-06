import type { Action, DrapeZone, Position } from "@/domain/schemas";
import { orderLog } from "./order";

/** Bed/torso angle (degrees from flat) the 3D view shows for each position. */
export const POSITION_ANGLE: Record<Position, number> = {
  supine: 0,
  prone: 0,
  reclined_30: 30,
  reclined_45: 45,
  left_lateral_decubitus: 0,
  seated: 80,
  seated_leaning_forward: 85,
  standing: 90,
};

/** Which drape zone covers each region (regions not listed are never draped). */
export const DRAPE_ZONE_OF: Record<string, DrapeZone> = Object.fromEntries([
  ...["precordium", "precordium_wall", "precordium_lsb", "cardiac_aortic", "cardiac_pulmonic", "cardiac_erbs", "cardiac_tricuspid", "cardiac_mitral"].map((r) => [r, "chest" as const]),
  ...["lung_ant_ru", "lung_ant_lu", "lung_ant_rl", "lung_ant_ll", "lung_lat_r", "lung_lat_l", "lung_post_ru", "lung_post_lu", "lung_post_rl", "lung_post_ll"].map((r) => [r, "chest" as const]),
  ...["abd_ruq", "abd_luq", "abd_rlq", "abd_llq", "abd_epigastric", "groin_right", "groin_left"].map((r) => [r, "abdomen" as const]),
  ...["hip_right", "hip_left", "knee_right", "knee_left", "shin_right", "shin_left", "calf_right", "calf_left"].map((r) => [r, "legs" as const]),
]);

export interface PatientState {
  position: Position;
  bedAngle: number;
  /** true = covered by the drape */
  drape: Record<DrapeZone, boolean>;
  /** hands currently clean (hygiene since the last time they were "used" on another surface — here: since entering) */
  handsClean: boolean;
  /** number of physical-contact exams done without clean hands */
  uncleanTouches: number;
  inRoom: boolean;
  knocked: boolean;
}

export const INITIAL_STATE: PatientState = {
  position: "seated",
  bedAngle: POSITION_ANGLE.seated,
  drape: { chest: true, abdomen: true, legs: true },
  handsClean: false,
  uncleanTouches: 0,
  inRoom: false,
  knocked: false,
};

/** Pure fold over the (canonically ordered) log. Shared by 2D, 3D, nudges and tests. */
export function patientState(log: readonly Action[], upTo = Infinity): PatientState {
  const s: PatientState = { ...INITIAL_STATE, drape: { ...INITIAL_STATE.drape } };
  for (const a of orderLog(log)) {
    if (a.t > upTo) break;
    switch (a.type) {
      case "courtesy":
        if (a.payload.kind === "hand_hygiene") s.handsClean = true;
        if (a.payload.kind === "position" && a.payload.position) setPosition(s, a.payload.position);
        if (a.payload.kind === "drape") s.drape = { chest: true, abdomen: true, legs: true };
        if ((a.payload.kind === "expose" || a.payload.kind === "cover") && a.payload.regionId) {
          const zone = DRAPE_ZONE_OF[a.payload.regionId];
          if (zone) s.drape[zone] = a.payload.kind === "cover";
        }
        break;
      case "state_change":
        if (a.payload.position) setPosition(s, a.payload.position);
        if (a.payload.drape) s.drape[a.payload.drape.zone] = a.payload.drape.covered;
        break;
      case "room":
        if (a.payload.event === "knock") s.knocked = true;
        if (a.payload.event === "enter") s.inRoom = true;
        if (a.payload.event === "exit") {
          s.inRoom = false;
          s.handsClean = false;
        }
        break;
      case "examine":
        if (a.payload.touch !== false && !s.handsClean) s.uncleanTouches++;
        break;
      default:
        break;
    }
  }
  return s;
}

function setPosition(s: PatientState, p: Position) {
  s.position = p;
  s.bedAngle = POSITION_ANGLE[p];
}
