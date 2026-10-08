"use client";
import type { ThreeEvent } from "@react-three/fiber";

/** Wall-mounted hand-sanitiser dispenser beside the sink, on the left wall (examiner side). */
export const DISPENSER_POS: [number, number, number] = [-2.33, 1.25, -0.2];

export function Dispenser({ progress, clean, onStart, onCancel }: { progress: number; clean: boolean; onStart: () => void; onCancel: () => void }) {
  const down = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onStart();
  };
  return (
    <group position={DISPENSER_POS} rotation={[0, Math.PI / 2, 0]}>
      {/* back plate */}
      <mesh position={[0, 0, -0.03]} raycast={() => null} castShadow>
        <boxGeometry args={[0.16, 0.26, 0.02]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.5} />
      </mesh>
      <mesh onPointerDown={down} onPointerUp={onCancel} onPointerLeave={onCancel} name="sanitiser-dispenser" castShadow>
        <boxGeometry args={[0.12, 0.2, 0.09]} />
        <meshStandardMaterial color={clean ? "#d9f99d" : "#f8fafc"} roughness={0.35} emissive={progress > 0 ? "#38bdf8" : "#000000"} emissiveIntensity={progress * 0.6} />
      </mesh>
      {/* push lever and window */}
      <mesh position={[0, -0.06, 0.05]} raycast={() => null}>
        <boxGeometry args={[0.07, 0.035, 0.02]} />
        <meshStandardMaterial color="#0ea5e9" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.04, 0.046]} raycast={() => null}>
        <planeGeometry args={[0.05, 0.06]} />
        <meshStandardMaterial color="#bae6fd" roughness={0.1} />
      </mesh>
      {progress > 0 && (
        <mesh position={[0, 0, 0.06]} rotation={[0, 0, Math.PI / 2]} raycast={() => null}>
          <torusGeometry args={[0.13, 0.01, 8, 48, Math.PI * 2 * progress]} />
          <meshBasicMaterial color="#0284c7" />
        </mesh>
      )}
    </group>
  );
}
