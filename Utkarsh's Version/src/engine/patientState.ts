import type { Action, DrapeSection, DrapeZone, Position } from "@/domain/schemas";
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
  sitting_dangling: 90,
};

export const DRAPE_SECTIONS: readonly DrapeSection[] = ["chest_left", "chest_right", "abdomen", "pelvis", "leg_left", "leg_right", "back"];

/** Legacy (Phase 2–3) drape zone → the Phase 4 sections it stands for. */
export const ZONE_SECTIONS: Record<DrapeZone, DrapeSection[]> = {
  chest: ["chest_left", "chest_right", "back"],
  abdomen: ["abdomen"],
  legs: ["leg_left", "leg_right"],
};

/** Which drape zone covers each region (regions not listed are never draped). */
export const DRAPE_ZONE_OF: Record<string, DrapeZone> = Object.fromEntries([
  ...["precordium", "precordium_wall", "precordium_lsb", "cardiac_aortic", "cardiac_pulmonic", "cardiac_erbs", "cardiac_tricuspid", "cardiac_mitral"].map((r) => [r, "chest" as const]),
  ...["lung_ant_ru", "lung_ant_lu", "lung_ant_rl", "lung_ant_ll", "lung_lat_r", "lung_lat_l", "lung_post_ru", "lung_post_lu", "lung_post_rl", "lung_post_ll"].map((r) => [r, "chest" as const]),
  ...["abd_ruq", "abd_luq", "abd_rlq", "abd_llq", "abd_epigastric", "groin_right", "groin_left"].map((r) => [r, "abdomen" as const]),
  ...["hip_right", "hip_left", "knee_right", "knee_left", "shin_right", "shin_left", "calf_right", "calf_left"].map((r) => [r, "legs" as const]),
]);

/**
 * Drape sections covering a region. Uses the regions' `drapeSections` data when given
 * (content/catalog/regions.json), else the legacy zone table. Sided regions map to their side.
 */
export function sectionsForRegion(regionId: string, regionSections?: Readonly<Record<string, readonly DrapeSection[]>>): DrapeSection[] {
  const fromData = regionSections?.[regionId];
  if (fromData) return [...fromData];
  const zone = DRAPE_ZONE_OF[regionId];
  if (!zone) return [];
  if (zone === "chest") {
    if (/_post_|^spine|^cva/.test(regionId)) return ["back"];
    if (/_(l|lu|ll)$|_left$|^cardiac_(pulmonic|erbs|mitral)|^precordium_(wall|lsb)$/.test(regionId)) return ["chest_left"];
    if (/_(r|ru|rl)$|_right$|^cardiac_(aortic|tricuspid)/.test(regionId)) return ["chest_right"];
    return ["chest_left", "chest_right"];
  }
  if (zone === "legs") return /_left$/.test(regionId) ? ["leg_left"] : /_right$/.test(regionId) ? ["leg_right"] : ["leg_left", "leg_right"];
  return ZONE_SECTIONS[zone];
}

export interface PatientState {
  position: Position;
  bedAngle: number;
  /** legacy zones (derived from sections): true = every section of the zone is covered */
  drape: Record<DrapeZone, boolean>;
  /** Phase 4: true = section covered */
  sections: Record<DrapeSection, boolean>;
  /** Phase 4: when each currently-exposed section was uncovered (ms since start) */
  exposedSince: Partial<Record<DrapeSection, number>>;
  /** hands currently clean (hygiene since the last time they were "used" on another surface — here: since entering) */
  handsClean: boolean;
  /** number of physical-contact exams done without clean hands */
  uncleanTouches: number;
  inRoom: boolean;
  knocked: boolean;
  /** the student sat down on the stool */
  seated: boolean;
}

export const INITIAL_STATE: PatientState = {
  position: "seated",
  bedAngle: POSITION_ANGLE.seated,
  drape: { chest: true, abdomen: true, legs: true },
  sections: { chest_left: true, chest_right: true, abdomen: true, pelvis: true, leg_left: true, leg_right: true, back: true },
  exposedSince: {},
  handsClean: false,
  uncleanTouches: 0,
  inRoom: false,
  knocked: false,
  seated: false,
};

/** Pure fold over the (canonically ordered) log. Shared by the 3D view, nudges, scoring and tests. */
export interface StateOptions {
  /** regions.json drapeSections, by region id */
  regionSections?: Readonly<Record<string, readonly DrapeSection[]>>;
  /** stop before this action id (state as it was when that action happened) */
  beforeActionId?: string;
}

export function patientState(log: readonly Action[], upTo = Infinity, opts: StateOptions = {}): PatientState {
  const s: PatientState = { ...INITIAL_STATE, drape: { ...INITIAL_STATE.drape }, sections: { ...INITIAL_STATE.sections }, exposedSince: {} };
  const setSection = (sec: DrapeSection, covered: boolean, t: number) => {
    if (sec === "pelvis" && !covered) return; // never exposed
    if (s.sections[sec] && !covered) s.exposedSince[sec] = t;
    if (covered) delete s.exposedSince[sec];
    s.sections[sec] = covered;
  };
  for (const a of orderLog(log)) {
    if (a.t > upTo) break;
    if (opts.beforeActionId && a.id === opts.beforeActionId) break;
    switch (a.type) {
      case "courtesy":
        if (a.payload.kind === "hand_hygiene") s.handsClean = true;
        if (a.payload.kind === "position" && a.payload.position) setPosition(s, a.payload.position);
        if (a.payload.kind === "drape") for (const sec of DRAPE_SECTIONS) setSection(sec, true, a.t);
        if ((a.payload.kind === "expose" || a.payload.kind === "cover") && a.payload.regionId) {
          for (const sec of sectionsForRegion(a.payload.regionId, opts.regionSections)) setSection(sec, a.payload.kind === "cover", a.t);
        }
        break;
      case "state_change":
        if (a.payload.position) setPosition(s, a.payload.position);
        if (a.payload.drape) {
          const secs = a.payload.drape.section ? [a.payload.drape.section] : a.payload.drape.zone ? ZONE_SECTIONS[a.payload.drape.zone] : [];
          for (const sec of secs) setSection(sec, a.payload.drape.covered, a.t);
        }
        break;
      case "room":
        if (a.payload.event === "knock") s.knocked = true;
        if (a.payload.event === "enter") s.inRoom = true;
        if (a.payload.event === "exit") {
          s.inRoom = false;
          s.handsClean = false;
        }
        break;
      case "sit_down":
        s.seated = true;
        break;
      case "examine":
        if (a.payload.touch !== false && !s.handsClean) s.uncleanTouches++;
        break;
      default:
        break;
    }
  }
  s.drape = {
    chest: s.sections.chest_left && s.sections.chest_right,
    abdomen: s.sections.abdomen,
    legs: s.sections.leg_left && s.sections.leg_right,
  };
  return s;
}

function setPosition(s: PatientState, p: Position) {
  s.position = p;
  s.bedAngle = POSITION_ANGLE[p];
}
