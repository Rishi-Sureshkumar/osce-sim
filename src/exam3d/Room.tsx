"use client";
import { BED_TOP_Y, HINGE_Y } from "./regionAnchors";

/** Bed, floor and walls. The backrest follows the patient's angle; it is never clickable. */
export function Room({ backrest, showBackrest }: { backrest: number; showBackrest: boolean }) {
  const noRay = () => null;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} raycast={noRay} receiveShadow>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#dfe6ea" />
      </mesh>
      <mesh position={[0, 1.5, -2.2]} raycast={noRay}>
        <planeGeometry args={[8, 3]} />
        <meshStandardMaterial color="#eef3f5" />
      </mesh>
      <mesh position={[-2.6, 1.5, 0]} rotation={[0, Math.PI / 2, 0]} raycast={noRay}>
        <planeGeometry args={[8, 3]} />
        <meshStandardMaterial color="#e8eff2" />
      </mesh>
      {/* bed frame + mattress under the legs */}
      <mesh position={[0, BED_TOP_Y - 0.08, 0.5]} raycast={noRay}>
        <boxGeometry args={[0.9, 0.16, 1.05]} />
        <meshStandardMaterial color="#f4f6f8" />
      </mesh>
      <mesh position={[0, (BED_TOP_Y - 0.16) / 2, 0.2]} raycast={noRay}>
        <boxGeometry args={[0.8, BED_TOP_Y - 0.16, 1.7]} />
        <meshStandardMaterial color="#8795a1" metalness={0.3} roughness={0.6} />
      </mesh>
      {/* backrest pivots at the hip hinge */}
      {showBackrest && (
        <group position={[0, HINGE_Y, 0]} rotation={[backrest, 0, 0]}>
          <mesh position={[0, -0.2, -0.45]} raycast={noRay}>
            <boxGeometry args={[0.9, 0.16, 0.95]} />
            <meshStandardMaterial color="#f4f6f8" />
          </mesh>
        </group>
      )}
    </group>
  );
}
