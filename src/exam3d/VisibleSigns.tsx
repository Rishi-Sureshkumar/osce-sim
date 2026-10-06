"use client";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh, MeshStandardMaterial } from "three";

/**
 * Jugular venous pulsation drawn only when the case's visibleSigns.jvpCm > 3 (from case data,
 * never invented). Height scales with the column height; it pulses with the case heart rate.
 */
export function JvpStrip({ jvpCm, hr }: { jvpCm: number; hr: number }) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    // venous waveform has a prominent relaxation (descent) — a soft double bump per beat
    const t = (clock.elapsedTime * hr) / 60;
    const f = t - Math.floor(t);
    const wave = Math.max(0, Math.sin(f * Math.PI * 2)) * 0.6 + Math.max(0, Math.sin(f * Math.PI * 4 + 1)) * 0.4;
    (ref.current.material as MeshStandardMaterial).opacity = 0.35 + 0.45 * wave;
    ref.current.scale.x = 1 + 0.4 * wave;
  });
  if (jvpCm <= 3) return null;
  const length = Math.min(0.085, 0.02 + (jvpCm / 12) * 0.07);
  return (
    <mesh ref={ref} position={[-0.05, 0.035, -0.575 - length / 2]} rotation={[Math.PI / 2, 0, 0.15]} raycast={() => null}>
      <capsuleGeometry args={[0.009, length, 4, 10]} />
      <meshStandardMaterial color="#3f55a8" transparent opacity={0.7} />
    </mesh>
  );
}
