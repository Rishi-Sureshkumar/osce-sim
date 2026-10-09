/**
 * Per-frame bone rotations of the visible patient (pure): the posture for the position, plus
 * breathing, idle sway, blink, head turn and a reflex jerk. PatientModel owns the time-varying
 * state (blink timer, eased look) and calls this every frame.
 */
import type { Position } from "@/domain/schemas";
import { jerkDelta, type Jerk } from "./animation/reflex";
import { poseRotations, type BoneRotations, type VariantId } from "./rig";

const DEG = Math.PI / 180;

export interface LiveInput {
  position: Position;
  variant?: VariantId;
  /** animated trunk angle (degrees) */
  angle: number;
  /** seconds since start (0 when frozen) */
  t: number;
  rr: number;
  laboured: boolean;
  /** 0–1 eyelid closure */
  blink: number;
  /** eased head turn toward the speaker (radians) */
  look: { yaw: number; pitch: number };
  jerk?: (Jerk & { ageSec: number }) | null;
  /** hold the head still (eye exam): no idle sway, no turn toward the speaker */
  steady?: boolean;
}

export function liveRotations(i: LiveInput): BoneRotations {
  const rot = poseRotations(i.position, i.angle, i.variant);
  const add = (b: string, x: number, y = 0, z = 0) => {
    const r = rot[b] ?? [0, 0, 0];
    rot[b] = [r[0] + x, r[1] + y, r[2] + z];
  };
  // breathing: chest rises at the case RR (deeper and with accessory motion when laboured)
  const breath = Math.sin((i.t * i.rr * 2 * Math.PI) / 60);
  const amp = (i.laboured ? 2.2 : 1) * DEG;
  add("spine02", -breath * amp * 0.6);
  add("spine01", breath * amp);
  if (i.laboured) {
    add("clavicle_L", 0, 0, breath * 1.5 * DEG);
    add("clavicle_R", 0, 0, -breath * 1.5 * DEG);
  }
  // idle sway (not while the head is held still for the eye exam)
  if (!i.steady) add("neck02", Math.sin(i.t * 0.31) * 0.6 * DEG, Math.sin(i.t * 0.23) * 1.2 * DEG);
  // blink
  if (i.blink > 0) {
    add("orbicularis03_L", i.blink * 26 * DEG);
    add("orbicularis03_R", i.blink * 26 * DEG);
    add("orbicularis04_L", -i.blink * 6 * DEG);
    add("orbicularis04_R", -i.blink * 6 * DEG);
  }
  // head turn toward the student while the patient speaks
  if (!i.steady) {
    add("neck03", i.look.pitch * 0.5, i.look.yaw * 0.5);
    add("head", i.look.pitch * 0.5, i.look.yaw * 0.5);
  }
  if (i.jerk) add(i.jerk.bone, jerkDelta(i.jerk, i.jerk.ageSec));
  return rot;
}
