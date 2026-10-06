"use client";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import type { Tool } from "@/domain/schemas";
import type { Vec3 } from "../regionAnchors";

/** The tool head drawn where it is placed (world coordinates). */
export function ToolMarker({ tool, point, onTarget }: { tool: Tool; point: Vec3; onTarget: boolean }) {
  const color = onTarget ? "#0f766e" : "#b45309";
  return (
    <group position={point}>
      {tool === "stethoscope" ? (
        <mesh raycast={() => null}>
          <sphereGeometry args={[0.016, 20, 12]} />
          <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.3} />
        </mesh>
      ) : (
        <mesh raycast={() => null}>
          <sphereGeometry args={[0.008, 12, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
      <mesh raycast={() => null}>
        <torusGeometry args={[0.024, 0.0025, 8, 32]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

/** A short expanding ring (reflex tap). Amplitude 0–4 scales it. */
export function PulseRing({ point, amount, startedAt }: { point: Vec3; amount: number; startedAt: number }) {
  const ring = useRef<Mesh>(null);
  const group = useRef<Group>(null);
  useFrame(() => {
    const t = (performance.now() - startedAt) / 700;
    if (!ring.current || !group.current) return;
    group.current.visible = t < 1;
    const s = 1 + t * (0.6 + amount * 0.6);
    ring.current.scale.set(s, s, s);
    (ring.current.material as MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - t));
    // a small "jerk" proportional to the reflex grade
    group.current.position.set(point[0], point[1] + Math.sin(Math.min(1, t) * Math.PI) * 0.012 * amount, point[2]);
  });
  return (
    <group ref={group} position={point}>
      <mesh ref={ring} raycast={() => null}>
        <torusGeometry args={[0.03, 0.004, 8, 32]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.9} />
      </mesh>
    </group>
  );
}
