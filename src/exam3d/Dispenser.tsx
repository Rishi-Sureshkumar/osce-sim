"use client";
import type { ThreeEvent } from "@react-three/fiber";

/** Hand-sanitiser dispenser on a stand by the head of the bed. Press and hold to use it. */
export const DISPENSER_POS: [number, number, number] = [-0.8, 1.2, -0.2];

export function Dispenser({ progress, clean, onStart, onCancel }: { progress: number; clean: boolean; onStart: () => void; onCancel: () => void }) {
  const down = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onStart();
  };
  return (
    <group position={DISPENSER_POS}>
      {/* stand */}
      <mesh position={[0, -DISPENSER_POS[1] / 2, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.015, 0.015, DISPENSER_POS[1] - 0.08, 8]} />
        <meshStandardMaterial color="#9aa5ad" metalness={0.4} />
      </mesh>
      <mesh onPointerDown={down} onPointerUp={onCancel} onPointerLeave={onCancel} name="sanitiser-dispenser">
        <boxGeometry args={[0.1, 0.16, 0.08]} />
        <meshStandardMaterial color={clean ? "#d9f99d" : "#f1f5f9"} emissive={progress > 0 ? "#38bdf8" : "#000000"} emissiveIntensity={progress * 0.6} />
      </mesh>
      <mesh position={[0, -0.05, 0.045]} raycast={() => null}>
        <boxGeometry args={[0.04, 0.03, 0.02]} />
        <meshStandardMaterial color="#0ea5e9" />
      </mesh>
      {progress > 0 && (
        <mesh position={[0, 0, 0.06]} rotation={[0, 0, Math.PI / 2]} raycast={() => null}>
          <torusGeometry args={[0.11, 0.01, 8, 48, Math.PI * 2 * progress]} />
          <meshBasicMaterial color="#0284c7" />
        </mesh>
      )}
    </group>
  );
}
