"use client";
/**
 * Practice-only "Show landmarks": anatomical labels fade in on the skin for a few seconds.
 * Labels only — no dots, rings or target markers, so the hidden anchors stay hidden.
 */
import { Html } from "@react-three/drei";
import { useEffect, useState } from "react";
import type { ShotId } from "@/scene/shots";
import { skinLandmarkWorld, type Pose } from "./regionAnchors";

export const HINT_MS = 3000;

const LABELS: Record<string, string> = {
  sternal_notch: "Suprasternal notch",
  xiphoid: "Xiphoid process",
  nipple_l: "Nipple (L)",
  nipple_r: "Nipple (R)",
  umbilicus: "Umbilicus",
  asis_l: "ASIS (L)",
  asis_r: "ASIS (R)",
  c7: "C7 spinous process",
  sacrum_pt: "Sacrum",
  jaw_angle_l: "Angle of jaw (L)",
  jaw_angle_r: "Angle of jaw (R)",
  mastoid_l: "Mastoid (L)",
  mastoid_r: "Mastoid (R)",
  ear_canal_l: "Ear canal (L)",
  ear_canal_r: "Ear canal (R)",
  antecubital_l: "Antecubital fossa (L)",
  antecubital_r: "Antecubital fossa (R)",
  radial_l: "Radial pulse site (L)",
  radial_r: "Radial pulse site (R)",
  patella_l: "Patella (L)",
  patella_r: "Patella (R)",
  ankle_l: "Ankle (L)",
  ankle_r: "Ankle (R)",
};

/** Which labels a shot shows (the overview shows the torso set). */
const BY_SHOT: Partial<Record<ShotId, string[]>> = {
  head_neck: ["sternal_notch", "jaw_angle_l", "jaw_angle_r", "mastoid_l", "mastoid_r"],
  ear_left: ["ear_canal_l", "mastoid_l", "jaw_angle_l"],
  ear_right: ["ear_canal_r", "mastoid_r", "jaw_angle_r"],
  chest_front: ["sternal_notch", "xiphoid", "nipple_l", "nipple_r"],
  chest_back: ["c7", "sacrum_pt"],
  abdomen: ["xiphoid", "umbilicus", "asis_l", "asis_r"],
  arms: ["antecubital_l", "antecubital_r", "radial_l", "radial_r"],
  hands: ["radial_l", "radial_r"],
  legs: ["patella_l", "patella_r", "ankle_l", "ankle_r"],
  feet: ["ankle_l", "ankle_r"],
};

export function landmarkLabelsFor(shot: ShotId): string[] {
  return BY_SHOT[shot] ?? ["sternal_notch", "xiphoid", "nipple_l", "nipple_r", "umbilicus"];
}

export function LandmarkHints({ shot, pose, shownAt }: { shot: ShotId; pose: Pose; shownAt: number }) {
  const [fading, setFading] = useState(false);
  useEffect(() => {
    setFading(false);
    const id = setTimeout(() => setFading(true), HINT_MS - 600);
    return () => clearTimeout(id);
  }, [shownAt]);
  return (
    <group>
      {landmarkLabelsFor(shot).map((name) => {
        const p = skinLandmarkWorld(name, pose);
        if (!p) return null;
        return (
          <Html key={name} position={p} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
            <span
              className="rounded bg-slate-900/80 px-1.5 py-0.5 text-[11px] whitespace-nowrap text-white transition-opacity duration-500"
              style={{ opacity: fading ? 0 : 1 }}
              data-testid="landmark-label"
            >
              {LABELS[name]}
            </span>
          </Html>
        );
      })}
    </group>
  );
}
