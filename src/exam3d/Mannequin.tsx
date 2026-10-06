"use client";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";

/**
 * Stylised primitive mannequin in the body frame (see regionAnchors.ts). This is the swap point
 * for a real model: replace these meshes, keep the two groups (upper rotates with the backrest).
 */
const SKIN = "#e7c2a5";
const SKIN_DARK = "#d7ad8e";

interface Props {
  /** breaths per minute and amplitude (laboured breathing is deeper) */
  rr: number;
  laboured: boolean;
  /** regionId → edema grade 1–4 (scales the limb) */
  edema: Record<string, number>;
}

export function UpperBody({ rr, laboured }: Pick<Props, "rr" | "laboured">) {
  const chest = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!chest.current) return;
    const phase = Math.sin((clock.elapsedTime * rr * 2 * Math.PI) / 60);
    const amp = laboured ? 0.035 : 0.012;
    chest.current.scale.set(1 + amp * 0.5 * phase, 1, 0.68 * (1 + amp * phase));
  });
  return (
    <group>
      {/* torso */}
      <mesh ref={chest} position={[0, 0, -0.33]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.68]} userData={{ kind: "body" }}>
        <capsuleGeometry args={[0.17, 0.3, 8, 24]} />
        <meshStandardMaterial color={SKIN} roughness={0.75} />
      </mesh>
      {/* neck */}
      <mesh position={[0, 0.01, -0.635]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: "body" }}>
        <cylinderGeometry args={[0.052, 0.058, 0.11, 20]} />
        <meshStandardMaterial color={SKIN} roughness={0.75} />
      </mesh>
      {/* head */}
      <group position={[0, 0.015, -0.78]}>
        <mesh scale={[0.92, 1, 1.1]} userData={{ kind: "body" }}>
          <sphereGeometry args={[0.105, 32, 24]} />
          <meshStandardMaterial color={SKIN} roughness={0.7} />
        </mesh>
        {/* eyes, nose, mouth hints */}
        {[-0.036, 0.036].map((x) => (
          <mesh key={x} position={[x, 0.088, -0.015]}>
            <sphereGeometry args={[0.012, 12, 8]} />
            <meshStandardMaterial color="#2b2b2b" />
          </mesh>
        ))}
        <mesh position={[0, 0.104, 0.008]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.014, 0.03, 12]} />
          <meshStandardMaterial color={SKIN_DARK} />
        </mesh>
        <mesh position={[0, 0.086, 0.052]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.006, 0.03, 4, 8]} />
          <meshStandardMaterial color="#a8706a" />
        </mesh>
        {[-0.1, 0.1].map((x) => (
          <mesh key={x} position={[x, 0, 0]} scale={[0.4, 1, 1.4]}>
            <sphereGeometry args={[0.022, 12, 8]} />
            <meshStandardMaterial color={SKIN_DARK} />
          </mesh>
        ))}
      </group>
      {/* arms */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Limb from={[s * 0.225, 0.02, -0.53]} to={[s * 0.25, 0.03, -0.25]} r={0.042} />
          <Limb from={[s * 0.25, 0.03, -0.25]} to={[s * 0.262, 0.035, -0.02]} r={0.035} />
          <mesh position={[s * 0.262, 0.03, 0.06]} scale={[0.75, 0.45, 1.3]} userData={{ kind: "body" }}>
            <sphereGeometry args={[0.045, 16, 12]} />
            <meshStandardMaterial color={SKIN} roughness={0.75} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function LowerBody({ edema }: Pick<Props, "edema">) {
  const swell = (id: string) => 1 + 0.09 * (edema[id] ?? 0);
  return (
    <group>
      {/* pelvis */}
      <mesh position={[0, 0, 0.06]} rotation={[0, 0, Math.PI / 2]} scale={[0.7, 1, 1]} userData={{ kind: "body" }}>
        <capsuleGeometry args={[0.13, 0.12, 8, 20]} />
        <meshStandardMaterial color={SKIN} roughness={0.75} />
      </mesh>
      {(["right", "left"] as const).map((side) => {
        const x = side === "right" ? -0.1 : 0.1;
        return (
          <group key={side}>
            <Limb from={[x, 0.01, 0.1]} to={[x, 0.02, 0.45]} r={0.07} />
            <Limb from={[x, 0.02, 0.47]} to={[x, 0.015, 0.83]} r={0.05 * swell(`shin_${side}`)} />
            <mesh position={[x, 0.015, 0.855]} scale={swell(`ankle_${side}`)} userData={{ kind: "body" }}>
              <sphereGeometry args={[0.04, 16, 12]} />
              <meshStandardMaterial color={SKIN} roughness={0.75} />
            </mesh>
            {/* foot, toes pointing up */}
            <mesh position={[x, 0.08, 0.9]} scale={[0.75, 1.6, 0.6]} userData={{ kind: "body" }}>
              <sphereGeometry args={[0.055, 16, 12]} />
              <meshStandardMaterial color={SKIN} roughness={0.75} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** A capsule between two body-frame points. */
function Limb({ from, to, r }: { from: [number, number, number]; to: [number, number, number]; r: number }) {
  const mid: [number, number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const len = Math.hypot(dx, dy, dz);
  // capsule axis is +Y; rotate it onto the limb direction
  const yaw = Math.atan2(dx, dz);
  const pitch = Math.acos(dy / len);
  return (
    <group position={mid} rotation={[0, yaw, 0]}>
      <mesh rotation={[pitch, 0, 0]} userData={{ kind: "body" }}>
        <capsuleGeometry args={[r, Math.max(0.001, len - 2 * r * 0.6), 6, 16]} />
        <meshStandardMaterial color={SKIN} roughness={0.75} />
      </mesh>
    </group>
  );
}
