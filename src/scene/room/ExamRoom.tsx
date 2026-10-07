"use client";
/**
 * The exam room as one composed scene: corridor and door, sink and sanitiser on the left wall as
 * you enter, exam table with an adjustable head section, tool table, stool, chair, wall computer,
 * curtain and wastebasket. Props are simple, clean procedural models (CC0 asset sites are not
 * reachable from the build environment; see docs/ASSETS.md for the GLB replacements).
 *
 * Layout (metres): the table's long axis is Z with the head toward −Z; the door is in the wall at
 * +Z; the examiner works from the patient's right (−X).
 */
import { DoubleSide } from "three";
import { TABLE } from "../rig";
import { Dispenser } from "./Dispenser";
import { ToolTable } from "./ToolTable";

const noRay = () => null;
export const ROOM = { halfX: 2.4, backZ: -2.2, doorZ: 2.6, height: 2.7, door: { x0: -1.65, x1: -0.7 } };

function Box({ p, s, c, r = 0.6, m = 0, shadow = true }: { p: [number, number, number]; s: [number, number, number]; c: string; r?: number; m?: number; shadow?: boolean }) {
  return (
    <mesh position={p} raycast={noRay} castShadow={shadow} receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={r} metalness={m} />
    </mesh>
  );
}
function Cyl({ p, r, h, c, rot, rough = 0.5, metal = 0 }: { p: [number, number, number]; r: number; h: number; c: string; rot?: [number, number, number]; rough?: number; metal?: number }) {
  return (
    <mesh position={p} rotation={rot} raycast={noRay} castShadow receiveShadow>
      <cylinderGeometry args={[r, r, h, 20]} />
      <meshStandardMaterial color={c} roughness={rough} metalness={metal} />
    </mesh>
  );
}

export interface ExamRoomProps {
  /** head-section angle in degrees (0 = flat) */
  bedAngle: number;
  /** door swing 0 (closed) … 1 (open) */
  doorOpen: number;
  sanitiser?: { progress: number; clean: boolean; start: () => void; cancel: () => void; disabled?: boolean };
  /** door placard text lines (patient name, age, reason for visit…) */
  placard?: string[];
}

export function ExamRoom({ bedAngle, doorOpen, sanitiser, placard }: ExamRoomProps) {
  const { halfX, backZ, doorZ, height } = ROOM;
  const wall = "#eef2f4";
  return (
    <group>
      {/* floor (room + corridor) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 1.2]} raycast={noRay} receiveShadow>
        <planeGeometry args={[halfX * 2 + 0.4, 8.2]} />
        <meshStandardMaterial color="#d6dde1" roughness={0.85} />
      </mesh>
      {/* walls */}
      <mesh position={[0, height / 2, backZ]} raycast={noRay} receiveShadow>
        <planeGeometry args={[halfX * 2, height]} />
        <meshStandardMaterial color={wall} roughness={0.95} />
      </mesh>
      <mesh position={[-halfX, height / 2, (backZ + doorZ) / 2]} rotation={[0, Math.PI / 2, 0]} raycast={noRay} receiveShadow>
        <planeGeometry args={[doorZ - backZ, height]} />
        <meshStandardMaterial color="#e9eff2" roughness={0.95} />
      </mesh>
      <mesh position={[halfX, height / 2, (backZ + doorZ) / 2]} rotation={[0, -Math.PI / 2, 0]} raycast={noRay} receiveShadow>
        <planeGeometry args={[doorZ - backZ, height]} />
        <meshStandardMaterial color="#e9eff2" roughness={0.95} />
      </mesh>
      {/* ceiling with light panels */}
      <mesh position={[0, height, (backZ + doorZ) / 2]} rotation={[Math.PI / 2, 0, 0]} raycast={noRay}>
        <planeGeometry args={[halfX * 2, doorZ - backZ]} />
        <meshStandardMaterial color="#f8fafc" roughness={1} side={DoubleSide} />
      </mesh>
      {[-0.9, 0.9].map((z) => (
        <mesh key={z} position={[0, height - 0.01, z]} rotation={[Math.PI / 2, 0, 0]} raycast={noRay}>
          <planeGeometry args={[0.6, 1.2]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.9} side={DoubleSide} />
        </mesh>
      ))}
      <DoorWall doorOpen={doorOpen} placard={placard} />
      <Corridor />
      <Sink />
      {sanitiser && (
        <Dispenser progress={sanitiser.progress} clean={sanitiser.clean} onStart={() => !sanitiser.disabled && sanitiser.start()} onCancel={sanitiser.cancel} />
      )}
      <ExamTable bedAngle={bedAngle} />
      <ToolTable />
      <Stool />
      <Chair />
      <WallComputer />
      <Curtain />
      {/* wastebasket by the sink */}
      <Cyl p={[-2.1, 0.2, 2.15]} r={0.15} h={0.4} c="#64748b" rough={0.6} />
      {/* skirting */}
      <Box p={[0, 0.05, backZ + 0.01]} s={[halfX * 2, 0.1, 0.02]} c="#94a3b8" shadow={false} />
    </group>
  );
}

function DoorWall({ doorOpen, placard }: { doorOpen: number; placard?: string[] }) {
  const { halfX, doorZ, height, door } = ROOM;
  const w = door.x1 - door.x0;
  const wallColor = "#e5ecef";
  return (
    <group>
      {/* wall segments around the door opening */}
      <Box p={[(-halfX + door.x0) / 2, height / 2, doorZ]} s={[door.x0 + halfX, height, 0.12]} c={wallColor} r={0.95} shadow={false} />
      <Box p={[(halfX + door.x1) / 2, height / 2, doorZ]} s={[halfX - door.x1, height, 0.12]} c={wallColor} r={0.95} shadow={false} />
      <Box p={[(door.x0 + door.x1) / 2, (height + 2.1) / 2, doorZ]} s={[w, height - 2.1, 0.12]} c={wallColor} r={0.95} shadow={false} />
      {/* frame */}
      <Box p={[door.x0 - 0.03, 1.05, doorZ]} s={[0.06, 2.1, 0.16]} c="#cbd5e1" shadow={false} />
      <Box p={[door.x1 + 0.03, 1.05, doorZ]} s={[0.06, 2.1, 0.16]} c="#cbd5e1" shadow={false} />
      {/* door leaf, hinged at x0, swings into the room */}
      <group position={[door.x0, 0, doorZ]} rotation={[0, (doorOpen * Math.PI) / 2.2, 0]}>
        <mesh position={[w / 2, 1.05, 0]} name="door" castShadow>
          <boxGeometry args={[w - 0.02, 2.08, 0.05]} />
          <meshStandardMaterial color="#b45309" roughness={0.55} />
        </mesh>
        <Cyl p={[w - 0.1, 1.0, 0.05]} r={0.012} h={0.14} c="#cbd5e1" rot={[0, 0, Math.PI / 2]} metal={0.8} rough={0.3} />
        <Cyl p={[w - 0.1, 1.0, -0.05]} r={0.012} h={0.14} c="#cbd5e1" rot={[0, 0, Math.PI / 2]} metal={0.8} rough={0.3} />
        {/* placard on the corridor side */}
        <mesh position={[w / 2, 1.45, 0.03]} raycast={noRay}>
          <planeGeometry args={[0.36, 0.26]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.6} />
        </mesh>
        {placard?.length ? (
          <mesh position={[w / 2, 1.45, 0.031]} raycast={noRay}>
            <planeGeometry args={[0.3, 0.02]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
        ) : null}
      </group>
    </group>
  );
}

function Corridor() {
  const { doorZ, height } = ROOM;
  return (
    <group>
      <Box p={[-0.3, height / 2, doorZ + 2.2]} s={[5, height, 0.1]} c="#dbe4ea" r={0.95} shadow={false} />
      <Box p={[-2.6, height / 2, doorZ + 1.1]} s={[0.1, height, 2.2]} c="#dbe4ea" r={0.95} shadow={false} />
      <mesh position={[-0.3, height - 0.01, doorZ + 1.1]} rotation={[Math.PI / 2, 0, 0]} raycast={noRay}>
        <planeGeometry args={[0.8, 1.6]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.7} side={DoubleSide} />
      </mesh>
    </group>
  );
}

function Sink() {
  const x = -ROOM.halfX + 0.28;
  return (
    <group position={[x, 0, 1.85]}>
      <Box p={[0, 0.42, 0]} s={[0.55, 0.84, 0.6]} c="#cbd5e1" r={0.5} />
      <Box p={[0, 0.86, 0]} s={[0.58, 0.04, 0.64]} c="#f1f5f9" r={0.2} />
      <mesh position={[0.02, 0.87, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRay}>
        <circleGeometry args={[0.2, 24]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.2} metalness={0.6} />
      </mesh>
      {/* tap */}
      <Cyl p={[-0.22, 1.0, 0]} r={0.015} h={0.26} c="#e2e8f0" metal={0.9} rough={0.2} />
      <Cyl p={[-0.13, 1.12, 0]} r={0.012} h={0.2} c="#e2e8f0" rot={[0, 0, Math.PI / 2]} metal={0.9} rough={0.2} />
      {/* mirror and paper towels */}
      <Box p={[-0.26, 1.55, 0]} s={[0.02, 0.6, 0.45]} c="#dbeafe" r={0.05} m={0.4} shadow={false} />
      <Box p={[-0.24, 1.35, 0.42]} s={[0.1, 0.32, 0.26]} c="#f8fafc" r={0.4} />
    </group>
  );
}

function ExamTable({ bedAngle }: { bedAngle: number }) {
  const top = TABLE.topY;
  const headLen = 0.85;
  const footLen = 1.0;
  const a = (bedAngle * Math.PI) / 180;
  const vinyl = "#475569";
  return (
    <group position={[TABLE.x, 0, TABLE.hingeZ]}>
      {/* base cabinet */}
      <Box p={[0, (top - 0.12) / 2, 0.15]} s={[0.56, top - 0.12, 1.4]} c="#e2e8f0" r={0.45} />
      <Box p={[0, 0.03, 0.15]} s={[0.66, 0.06, 1.55]} c="#94a3b8" r={0.5} />
      {/* foot section mattress + paper roll */}
      <Box p={[0, top - 0.06, footLen / 2]} s={[TABLE.width, 0.12, footLen]} c={vinyl} r={0.55} />
      <Box p={[0, top + 0.002, footLen / 2]} s={[TABLE.width * 0.82, 0.002, footLen]} c="#f8fafc" r={0.9} shadow={false} />
      {/* head section hinges at the patient's hips */}
      <group position={[0, top - 0.06, 0]} rotation={[a, 0, 0]}>
        <Box p={[0, 0, -headLen / 2]} s={[TABLE.width, 0.12, headLen]} c={vinyl} r={0.55} />
        <Box p={[0, 0.062, -headLen / 2]} s={[TABLE.width * 0.82, 0.002, headLen]} c="#f8fafc" r={0.9} shadow={false} />
        {/* pillow (only when lying back) */}
        <mesh visible={bedAngle < 50} position={[0, 0.095, -headLen + 0.16]} rotation={[0, 0, Math.PI / 2]} scale={[0.7, 1, 1]} raycast={noRay} castShadow>
          <capsuleGeometry args={[0.05, 0.36, 6, 12]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.95} />
        </mesh>
      </group>
      {/* head-section control lever on the patient's right side */}
      <group position={[-TABLE.width / 2 - 0.03, top - 0.12, -0.15]}>
        <Box p={[0, 0, 0]} s={[0.03, 0.05, 0.12]} c="#334155" r={0.4} />
        <mesh position={[-0.04, 0.02, 0]} name="table-head-control" castShadow>
          <cylinderGeometry args={[0.018, 0.018, 0.09, 12]} />
          <meshStandardMaterial color="#0e7490" roughness={0.4} />
        </mesh>
      </group>
      {/* step */}
      <Box p={[0, 0.16, footLen + 0.18]} s={[0.5, 0.06, 0.3]} c="#cbd5e1" r={0.5} />
    </group>
  );
}

function Stool() {
  return (
    <group position={[-0.85, 0, 0.35]} name="stool">
      <Cyl p={[0, 0.52, 0]} r={0.2} h={0.08} c="#1e293b" rough={0.6} />
      <Cyl p={[0, 0.27, 0]} r={0.025} h={0.45} c="#94a3b8" metal={0.8} rough={0.3} />
      {[0, 1, 2, 3, 4].map((k) => (
        <Box key={k} p={[Math.cos((k * 2 * Math.PI) / 5) * 0.16, 0.05, Math.sin((k * 2 * Math.PI) / 5) * 0.16]} s={[0.05, 0.03, 0.05]} c="#334155" />
      ))}
    </group>
  );
}

function Chair() {
  return (
    <group position={[1.85, 0, 1.75]} rotation={[0, -2.4, 0]}>
      <Box p={[0, 0.46, 0]} s={[0.48, 0.06, 0.46]} c="#0f766e" r={0.7} />
      <Box p={[0, 0.78, -0.21]} s={[0.48, 0.55, 0.05]} c="#0f766e" r={0.7} />
      {[
        [-0.2, -0.19],
        [0.2, -0.19],
        [-0.2, 0.19],
        [0.2, 0.19],
      ].map(([x, z]) => (
        <Cyl key={`${x}${z}`} p={[x!, 0.22, z!]} r={0.015} h={0.44} c="#64748b" metal={0.6} />
      ))}
    </group>
  );
}

function WallComputer() {
  return (
    <group position={[ROOM.halfX - 0.04, 1.35, -0.6]} rotation={[0, -Math.PI / 2, 0]}>
      <Box p={[0, 0, 0]} s={[0.56, 0.36, 0.04]} c="#0f172a" r={0.3} />
      <mesh position={[0, 0, 0.022]} raycast={noRay}>
        <planeGeometry args={[0.5, 0.3]} />
        <meshStandardMaterial color="#1d4ed8" emissive="#1e3a8a" emissiveIntensity={0.6} />
      </mesh>
      <Box p={[0, -0.32, 0.12]} s={[0.5, 0.03, 0.22]} c="#cbd5e1" r={0.5} />
    </group>
  );
}

function Curtain() {
  // gathered privacy curtain on a ceiling track along the patient's left side
  const folds = 9;
  return (
    <group position={[1.45, 0, -1.6]}>
      <Box p={[0, ROOM.height - 0.05, 0.9]} s={[0.03, 0.03, 2.2]} c="#cbd5e1" shadow={false} />
      {Array.from({ length: folds }, (_, k) => (
        <mesh key={k} position={[Math.sin(k * 1.7) * 0.03, 1.45, k * 0.07]} raycast={noRay} castShadow>
          <boxGeometry args={[0.03, 2.3, 0.075]} />
          <meshStandardMaterial color={k % 2 ? "#a5c8d6" : "#9bbfcd"} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}
