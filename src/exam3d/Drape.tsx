"use client";
import { DoubleSide } from "three";
import type { DrapeZone } from "@/domain/schemas";

const CLOTH = "#86b8cc";
const noRay = () => null;

/** A thin curved sheet over the front of a body section (half cylinder along the long axis). */
function Sheet({ z, length, radius, depth }: { z: number; length: number; radius: number; depth: number }) {
  return (
    <mesh position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, depth]} raycast={noRay}>
      <cylinderGeometry args={[radius, radius, length, 32, 1, true, Math.PI / 2 - 0.15, Math.PI + 0.3]} />
      <meshStandardMaterial color={CLOTH} side={DoubleSide} transparent opacity={0.9} roughness={0.95} />
    </mesh>
  );
}

/** Sheet sections drawn over covered zones. Purely visual; exposure is logged by the server. */
export function UpperDrape({ drape }: { drape: Record<DrapeZone, boolean> }) {
  return (
    <group>
      {drape.chest && <Sheet z={-0.43} length={0.36} radius={0.185} depth={0.75} />}
      {drape.abdomen && <Sheet z={-0.13} length={0.24} radius={0.18} depth={0.72} />}
    </group>
  );
}

export function LowerDrape({ drape }: { drape: Record<DrapeZone, boolean> }) {
  if (!drape.legs) return null;
  return <Sheet z={0.45} length={0.8} radius={0.21} depth={0.55} />;
}
