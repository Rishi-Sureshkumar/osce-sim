"use client";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { DISPENSER_POS } from "@/scene/room/Dispenser";
import { anchorWorldNormals, anchorWorldPoints, skinLandmark, type Pose, type Vec3 } from "./regionAnchors";

export type CameraPreset = "body" | "sink" | "head_neck" | "left_side" | "right_side" | "chest_front" | "chest_back" | "abdomen" | "hands" | "feet";

export const PRESET_LABELS: Record<CameraPreset, string> = {
  body: "Whole body",
  sink: "Sink",
  head_neck: "Head & neck",
  left_side: "Left side",
  right_side: "Right side",
  chest_front: "Chest (front)",
  chest_back: "Chest (back)",
  abdomen: "Abdomen",
  hands: "Hands",
  feet: "Feet",
};

const add = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const mid = (a: Vec3, b: Vec3): Vec3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
const first = (regionId: string, pose: Pose): Vec3 => anchorWorldPoints(regionId, pose)[0] ?? [0, 1, 0];

/** Camera goal for a preset given the current pose (pure; presets follow the patient's position). */
export function presetGoal(preset: CameraPreset, pose: Pose): { position: Vec3; target: Vec3 } {
  const up: Vec3 = [0, 1, 0];
  const examiner: Vec3 = [-1, 0, 0]; // the examiner stands on the patient's right (−X)
  const notch = skinLandmark("sternal_notch", pose);
  const front = notch.normal;
  switch (preset) {
    case "head_neck": {
      // frame the whole head and neck, vertex to sternal notch
      const t = mid(skinLandmark("vertex", pose).point, notch.point);
      return { target: t, position: add(add(add(t, front, 0.62), examiner, 0.12), up, 0.12) };
    }
    case "left_side":
    case "right_side": {
      const ear = skinLandmark(preset === "left_side" ? "ear_canal_l" : "ear_canal_r", pose);
      return { target: ear.point, position: add(add(ear.point, ear.normal, 0.6), up, 0.06) };
    }
    case "chest_front": {
      const t = first("cardiac_erbs", pose);
      return { target: t, position: add(add(t, front, 0.75), examiner, 0.18) };
    }
    case "chest_back": {
      const t = mid(first("lung_post_rl", pose), first("lung_post_ll", pose));
      const back = anchorWorldNormals("lung_post_rl", pose)[0] ?? [0, 0, 1];
      return { target: t, position: add(add(t, back, 0.6), up, 0.45) };
    }
    case "abdomen": {
      const u = skinLandmark("umbilicus", pose);
      return { target: u.point, position: add(add(u.point, u.normal, 0.75), examiner, 0.15) };
    }
    case "sink":
      return { target: DISPENSER_POS, position: add(DISPENSER_POS, [1.3, 0.15, -0.45]) };
    case "hands": {
      const t = mid(first("hand_right", pose), first("hand_left", pose));
      return { target: t, position: add(add(t, up, 0.8), [0, 0, 1], 0.35) };
    }
    case "feet": {
      const t = mid(first("foot_right", pose), first("foot_left", pose));
      return { target: t, position: add(add(t, up, 0.45), [0, 0, 1], 0.65) };
    }
    default: {
      const t = mid(notch.point, skinLandmark("umbilicus", pose).point);
      return { target: t, position: add(t, [-1.75, 0.85, 1.25]) };
    }
  }
}

/** Focus on a single region (double-click). */
export function regionGoal(regionId: string, pose: Pose): { position: Vec3; target: Vec3 } | null {
  const t = anchorWorldPoints(regionId, pose)[0];
  const n = anchorWorldNormals(regionId, pose)[0];
  if (!t || !n) return null;
  return { target: t, position: add(t, n, 0.42) };
}

/** Orbit controls with limits, plus smooth tweening to preset/region goals. */
export function CameraRig({ goal, enabled = true }: { goal: { position: Vec3; target: Vec3; key: number }; enabled?: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, invalidate } = useThree();
  const tweening = useRef(true);
  const toPos = useRef(new Vector3(...goal.position));
  const toTarget = useRef(new Vector3(...goal.target));

  useEffect(() => {
    toPos.current.set(...goal.position);
    toTarget.current.set(...goal.target);
    tweening.current = true;
    invalidate();
  }, [goal, invalidate]);

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c || !tweening.current) return;
    const k = 1 - Math.exp(-dt * 6);
    camera.position.lerp(toPos.current, k);
    c.target.lerp(toTarget.current, k);
    c.update();
    if (camera.position.distanceTo(toPos.current) < 0.003 && c.target.distanceTo(toTarget.current) < 0.003) tweening.current = false;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={enabled}
      enableDamping
      dampingFactor={0.12}
      minDistance={0.22}
      maxDistance={4}
      maxPolarAngle={Math.PI * 0.62}
      onStart={() => {
        tweening.current = false;
      }}
    />
  );
}
