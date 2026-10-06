"use client";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { ANCHOR_BY_REGION, dirToWorld, toWorld, type Pose, type Vec3 } from "./regionAnchors";

export type CameraPreset = "body" | "head_neck" | "left_side" | "right_side" | "chest_front" | "chest_back" | "abdomen" | "hands" | "feet";

export const PRESET_LABELS: Record<CameraPreset, string> = {
  body: "Whole body",
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

/** Camera goal for a preset given the current pose (pure, so presets follow the bed angle). */
export function presetGoal(preset: CameraPreset, pose: Pose): { position: Vec3; target: Vec3 } {
  const front = dirToWorld([0, 1, 0], "upper", pose);
  const lowerFront = dirToWorld([0, 1, 0], "lower", pose);
  const up: Vec3 = [0, 1, 0];
  const side: Vec3 = [1, 0, 0];
  switch (preset) {
    case "head_neck": {
      const t = toWorld([0, 0.03, -0.72], "upper", pose);
      return { target: t, position: add(add(t, front, 0.55), side, 0.12) };
    }
    case "left_side":
    case "right_side": {
      // the patient's own side (+X is the patient's left), framed on the head, neck and upper chest
      const t = toWorld([0, 0.0, -0.66], "upper", pose);
      const out = dirToWorld([preset === "left_side" ? 1 : -1, 0, 0], "upper", pose);
      return { target: t, position: add(add(t, out, 0.7), up, 0.08) };
    }
    case "chest_front": {
      const t = toWorld([0.02, 0.12, -0.4], "upper", pose);
      return { target: t, position: add(add(t, front, 0.8), side, 0.15) };
    }
    case "chest_back": {
      const t = toWorld([0, -0.12, -0.38], "upper", pose);
      return { target: t, position: add(t, front, -0.85) };
    }
    case "abdomen": {
      const t = toWorld([0, 0.1, -0.13], "upper", pose);
      return { target: t, position: add(add(t, front, 0.75), side, 0.1) };
    }
    case "hands": {
      const t = toWorld([0, 0.03, 0.04], "upper", pose);
      return { target: t, position: add(add(t, front, 0.9), [0, 0, 1], 0.35) };
    }
    case "feet": {
      const t = toWorld([0, 0.06, 0.85], "lower", pose);
      return { target: t, position: add(add(t, lowerFront, 0.45), [0, 0, 1], 0.6) };
    }
    default: {
      const t = toWorld([0, 0.05, -0.15], "upper", pose);
      return { target: [0, t[1] + 0.05, 0.05], position: add([2.1, 0, 1.55], up, t[1] + 0.75) };
    }
  }
}

/** Focus on a single region (double-click). */
export function regionGoal(regionId: string, pose: Pose): { position: Vec3; target: Vec3 } | null {
  const a = ANCHOR_BY_REGION.get(regionId);
  if (!a) return null;
  const t = toWorld(a.points[0]!, a.segment, pose);
  const n = dirToWorld(a.normal, a.segment, pose);
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
