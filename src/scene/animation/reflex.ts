/**
 * Reflex jerk animation (pure). Which bone moves when a tendon on a region is struck, and the
 * rotation it adds over time. M0 extraction of the Phase 3 behaviour (M2 corrects directions,
 * grades and clonus).
 */
const DEG = Math.PI / 180;

/** Reflexes: which limb bone jerks when a tendon on this region is tapped. */
export const JERK_BONE: Record<string, string> = {
  knee_right: "lowerleg01_R",
  knee_left: "lowerleg01_L",
  ankle_right: "foot_R",
  ankle_left: "foot_L",
  elbow_right: "lowerarm01_R",
  elbow_left: "lowerarm01_L",
  wrist_right: "lowerarm01_R",
  wrist_left: "lowerarm01_L",
  arm_right: "lowerarm01_R",
  arm_left: "lowerarm01_L",
};

export const JERK_SECONDS = 0.6;

/** X-axis rotation (radians) added to the jerking bone `ageSec` after the strike. */
export function jerkDelta(amount: number, ageSec: number): number {
  if (ageSec < 0 || ageSec >= JERK_SECONDS) return 0;
  return -Math.sin(Math.min(1, ageSec / JERK_SECONDS) * Math.PI) * amount * 5 * DEG * Math.exp(-ageSec * 3);
}
