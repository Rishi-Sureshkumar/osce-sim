"use client";
/**
 * The tool in hand follows the cursor across the body: its head (stethoscope chest piece, fork
 * base, hammer tip, penlight) sits at the surface point, aligned to the surface normal.
 * Animations: hammer swing on a tap, fork hum while it vibrates, penlight beam.
 */
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Group, Quaternion, Vector3 } from "three";
import type { Tool } from "@/domain/schemas";
import type { Vec3 } from "@/exam3d/regionAnchors";

export interface CursorPoint {
  point: Vec3;
  normal: Vec3;
}

const UP = new Vector3(0, 1, 0);

export function ToolCursor({ tool, at, toolMode, swingAt, vibrating }: { tool: Tool; at: CursorPoint | null; toolMode?: string; swingAt?: number | null; vibrating?: boolean }) {
  const g = useRef<Group>(null);
  const head = useRef<Group>(null);
  useFrame(() => {
    const grp = g.current;
    if (!grp) return;
    grp.visible = !!at;
    if (!at) return;
    grp.position.set(...at.point);
    grp.quaternion.copy(new Quaternion().setFromUnitVectors(UP, new Vector3(...at.normal).normalize()));
    const h = head.current;
    if (!h) return;
    h.rotation.set(0, 0, 0);
    h.position.set(0, 0, 0);
    if (tool === "reflex_hammer" && swingAt) {
      const age = (performance.now() - swingAt) / 1000;
      if (age < 0.35) h.rotation.x = -Math.sin((age / 0.35) * Math.PI) * 0.9;
    }
    if (tool === "tuning_fork" && vibrating) h.position.x = Math.sin(performance.now() * 0.9) * 0.0012;
  });
  return (
    <group ref={g} renderOrder={5}>
      <group ref={head}>
        {tool === "stethoscope" && (
          <>
            <mesh position={[0, 0.006, 0]} raycast={() => null}>
              <cylinderGeometry args={[toolMode === "bell" ? 0.013 : 0.02, toolMode === "bell" ? 0.016 : 0.022, 0.012, 24]} />
              <meshStandardMaterial color="#d1d5db" metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.03, 0]} raycast={() => null}>
              <cylinderGeometry args={[0.004, 0.004, 0.04, 8]} />
              <meshStandardMaterial color="#111827" />
            </mesh>
          </>
        )}
        {tool === "tuning_fork" && (
          <group position={[0, 0.005, 0]}>
            <mesh position={[0, 0.03, 0]} raycast={() => null}>
              <cylinderGeometry args={[0.004, 0.005, 0.06, 8]} />
              <meshStandardMaterial color="#d1d5db" metalness={0.9} roughness={0.2} />
            </mesh>
            {[-0.007, 0.007].map((x) => (
              <mesh key={x} position={[x, 0.1, 0]} raycast={() => null}>
                <boxGeometry args={[0.004, toolMode === "128" ? 0.1 : 0.075, 0.004]} />
                <meshStandardMaterial color="#d1d5db" metalness={0.9} roughness={0.2} />
              </mesh>
            ))}
          </group>
        )}
        {tool === "reflex_hammer" && (
          <group position={[0, 0.02, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]} raycast={() => null}>
              <coneGeometry args={[0.016, 0.045, 3]} />
              <meshStandardMaterial color="#dc2626" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.09, 0]} raycast={() => null}>
              <cylinderGeometry args={[0.004, 0.004, 0.17, 8]} />
              <meshStandardMaterial color="#d1d5db" metalness={0.8} roughness={0.3} />
            </mesh>
          </group>
        )}
        {tool === "penlight" && (
          <group position={[0, 0.12, 0]}>
            <mesh raycast={() => null}>
              <cylinderGeometry args={[0.006, 0.006, 0.12, 10]} />
              <meshStandardMaterial color="#1d4ed8" roughness={0.4} />
            </mesh>
            <mesh position={[0, -0.1, 0]} raycast={() => null}>
              <coneGeometry args={[0.03, 0.09, 16, 1, true]} />
              <meshBasicMaterial color="#fef9c3" transparent opacity={0.35} depthWrite={false} />
            </mesh>
            <pointLight position={[0, -0.08, 0]} intensity={0.4} distance={0.25} color="#fff7d6" />
          </group>
        )}
        {(tool === "hands" || tool === "bp_cuff") && (
          <mesh position={[0, 0.012, 0]} scale={[0.04, 0.012, 0.05]} raycast={() => null}>
            <sphereGeometry args={[1, 14, 10]} />
            <meshStandardMaterial color={tool === "bp_cuff" ? "#1e3a8a" : "#c99a82"} roughness={0.6} transparent opacity={0.85} />
          </mesh>
        )}
      </group>
    </group>
  );
}
