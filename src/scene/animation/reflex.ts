/**
 * Reflex jerk animation (pure). Which joint moves when a tendon is struck, which way, how far for
 * the reflex grade, and clonus (Phase 4 M2 bug 7: Phase 3 always flexed, the same small amount,
 * from the elbow/knee/ankle regions, so the triceps and Achilles moved the wrong way).
 *
 * Signs are bone-local X rotations: for a limb hanging from its joint −X flexes the elbow and +X
 * extends it; +X flexes the knee (so −X extends it); +X plantarflexes the ankle.
 */
const DEG = Math.PI / 180;

export interface Jerk {
  /** the bone that moves */
  bone: string;
  /** +1 or −1: the direction of the joint's movement for this reflex (bone-local X) */
  sign: 1 | -1;
  /** reflex grade 0–4 (0 absent, 2 normal, 4 very brisk) */
  grade: number;
  /** beats of clonus after the jerk (~6 Hz, decaying); grade 4 implies a few */
  clonusBeats?: number;
  /** the limb is not positioned for this reflex: a quarter of the movement */
  muted?: boolean;
}

/** Tendon regions → the joint that moves and its direction. */
export const REFLEX_JERK: Record<string, Pick<Jerk, "bone" | "sign">> = {
  patellar_tendon_right: { bone: "lowerleg01_R", sign: -1 }, // knee extends
  patellar_tendon_left: { bone: "lowerleg01_L", sign: -1 },
  achilles_right: { bone: "foot_R", sign: 1 }, // ankle plantarflexes
  achilles_left: { bone: "foot_L", sign: 1 },
  biceps_tendon_right: { bone: "lowerarm01_R", sign: -1 }, // elbow flexes
  biceps_tendon_left: { bone: "lowerarm01_L", sign: -1 },
  brachioradialis_right: { bone: "lowerarm01_R", sign: -1 }, // elbow flexes
  brachioradialis_left: { bone: "lowerarm01_L", sign: -1 },
  triceps_tendon_right: { bone: "lowerarm01_R", sign: 1 }, // elbow extends
  triceps_tendon_left: { bone: "lowerarm01_L", sign: 1 },
};

/** Peak joint movement (degrees) for a reflex grade. */
export function reflexAmplitudeDeg(grade: number): number {
  const g = Math.max(0, Math.min(4, grade));
  return [0, 4, 9, 14, 18][Math.round(g)]!;
}

/** The jerk itself: up and back within this time (seconds). */
export const JERK_RISE = 0.12;
export const JERK_SECONDS = 0.6;
export const CLONUS_HZ = 6;

/** Beats of clonus for a jerk (explicit, or a few for grade 4). */
export function clonusBeats(j: Pick<Jerk, "grade" | "clonusBeats">): number {
  return j.clonusBeats ?? (j.grade >= 4 ? 3 : 0);
}

/** How long a jerk (and its clonus) animates (seconds). */
export function jerkDuration(j: Pick<Jerk, "grade" | "clonusBeats">): number {
  const beats = clonusBeats(j);
  return beats > 0 ? JERK_SECONDS + beats / CLONUS_HZ : JERK_SECONDS;
}

/** X-axis rotation (radians) added to the jerking bone `ageSec` after the strike. */
export function jerkDelta(j: Jerk, ageSec: number): number {
  if (ageSec < 0 || ageSec >= jerkDuration(j)) return 0;
  const amp = reflexAmplitudeDeg(j.grade) * DEG * (j.muted ? 0.25 : 1);
  if (amp === 0) return 0;
  // a quick movement (peak at JERK_RISE) that settles back
  const jerk = ageSec < JERK_SECONDS ? Math.sin(Math.min(1, ageSec / (2 * JERK_RISE)) * Math.PI) * Math.exp(-Math.max(0, ageSec - 2 * JERK_RISE) * 6) : 0;
  // clonus: rhythmic beats after the jerk, decaying
  const beats = clonusBeats(j);
  const tc = ageSec - 2 * JERK_RISE;
  const clonus = beats > 0 && tc > 0 && tc < beats / CLONUS_HZ ? 0.55 * Math.max(0, Math.sin(2 * Math.PI * CLONUS_HZ * tc)) * Math.exp((-tc * CLONUS_HZ) / (beats + 1)) : 0;
  return j.sign * amp * Math.max(jerk, clonus);
}
