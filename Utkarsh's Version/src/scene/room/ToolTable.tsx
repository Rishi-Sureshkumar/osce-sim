"use client";
/**
 * Instrument table at the head of the bed on the examiner's side, with the 1B room's tools laid
 * out: stethoscope, reflex hammer, 128 and 512 Hz tuning forks, penlight, otoscope/ophthalmoscope,
 * cotton swabs and a BP cuff. Each tool is a small procedural model with a stable name, so the
 * navigation layer can lift it on hover and pick it up on click.
 */
import type { ThreeEvent } from "@react-three/fiber";
import type { Tool } from "@/domain/schemas";

export const TOOL_TABLE_POS: [number, number, number] = [-0.95, 0, -1.25];
export const TOOL_TABLE_TOP = 0.9;

export type TableItem = "stethoscope" | "reflex_hammer" | "fork_128" | "fork_512" | "penlight" | "otoscope" | "swabs" | "pin" | "bp_cuff";
export const TABLE_ITEMS: { id: TableItem; label: string; tool?: Tool; mode?: string; at: [number, number] }[] = [
  { id: "stethoscope", label: "Stethoscope", tool: "stethoscope", at: [-0.17, -0.12] },
  { id: "reflex_hammer", label: "Reflex hammer", tool: "reflex_hammer", at: [0.05, -0.15] },
  { id: "fork_128", label: "Tuning fork 128 Hz", tool: "tuning_fork", mode: "128", at: [0.18, -0.12] },
  { id: "fork_512", label: "Tuning fork 512 Hz", tool: "tuning_fork", mode: "512", at: [0.24, 0.0] },
  { id: "penlight", label: "Penlight", tool: "penlight", at: [0.02, 0.05] },
  { id: "otoscope", label: "Otoscope / ophthalmoscope", at: [-0.12, 0.1] },
  { id: "swabs", label: "Cotton swabs", tool: "cotton_swab", at: [0.14, 0.13] },
  { id: "pin", label: "Neurotip (pin)", tool: "pin", at: [0.06, 0.15] },
  { id: "bp_cuff", label: "BP cuff", tool: "bp_cuff", at: [-0.2, 0.12] },
];

const noRay = () => null;

export interface ToolTableProps {
  hovered?: TableItem | null;
  /** items currently in hand are hidden from the table */
  inHand?: TableItem | null;
  interactive?: boolean;
  onHover?: (id: TableItem | null) => void;
  onPick?: (id: TableItem) => void;
}

export function ToolTable({ hovered, inHand, interactive, onHover, onPick }: ToolTableProps) {
  return (
    <group position={TOOL_TABLE_POS} name="tool-table">
      {/* stainless trolley */}
      <mesh position={[0, TOOL_TABLE_TOP - 0.015, 0]} castShadow receiveShadow raycast={noRay}>
        <boxGeometry args={[0.62, 0.03, 0.42]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.3, 0]} receiveShadow raycast={noRay}>
        <boxGeometry args={[0.58, 0.02, 0.38]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.7} roughness={0.35} />
      </mesh>
      {[
        [-0.29, -0.19],
        [0.29, -0.19],
        [-0.29, 0.19],
        [0.29, 0.19],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x!, TOOL_TABLE_TOP / 2, z!]} raycast={noRay}>
          <cylinderGeometry args={[0.012, 0.012, TOOL_TABLE_TOP, 8]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      {TABLE_ITEMS.map((it) =>
        it.id === inHand ? null : (
          <group
            key={it.id}
            name={`tool:${it.id}`}
            position={[it.at[0], TOOL_TABLE_TOP + (hovered === it.id ? 0.04 : 0), it.at[1]]}
            onPointerOver={interactive ? (e: ThreeEvent<PointerEvent>) => (e.stopPropagation(), onHover?.(it.id)) : undefined}
            onPointerOut={interactive ? () => onHover?.(null) : undefined}
            onClick={interactive ? (e: ThreeEvent<MouseEvent>) => (e.stopPropagation(), onPick?.(it.id)) : undefined}
          >
            <ToolModel id={it.id} />
            {/* generous invisible hit box */}
            <mesh visible={false} position={[0, 0.02, 0]}>
              <boxGeometry args={[0.12, 0.06, 0.12]} />
              <meshBasicMaterial />
            </mesh>
          </group>
        ),
      )}
    </group>
  );
}

/** Small procedural instrument models (also used for the tool in hand). */
export function ToolModel({ id }: { id: TableItem }) {
  switch (id) {
    case "stethoscope":
      return (
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} raycast={noRay} castShadow>
            <torusGeometry args={[0.07, 0.006, 8, 32, Math.PI * 1.6]} />
            <meshStandardMaterial color="#111827" roughness={0.5} />
          </mesh>
          <mesh position={[0.07, 0.01, 0.02]} raycast={noRay} castShadow>
            <cylinderGeometry args={[0.022, 0.022, 0.012, 24]} />
            <meshStandardMaterial color="#d1d5db" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      );
    case "reflex_hammer":
      return (
        <group rotation={[0, 0.3, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0.008, 0]} raycast={noRay} castShadow>
            <cylinderGeometry args={[0.004, 0.004, 0.2, 8]} />
            <meshStandardMaterial color="#d1d5db" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0.1, 0.012, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={noRay} castShadow>
            <coneGeometry args={[0.018, 0.05, 3]} />
            <meshStandardMaterial color="#dc2626" roughness={0.6} />
          </mesh>
        </group>
      );
    case "fork_128":
    case "fork_512": {
      const len = id === "fork_128" ? 0.16 : 0.12;
      return (
        <group rotation={[0, -0.2, Math.PI / 2]} position={[0, 0.008, 0]}>
          <mesh position={[0, -len / 2, 0]} raycast={noRay} castShadow>
            <cylinderGeometry args={[0.004, 0.004, len * 0.6, 8]} />
            <meshStandardMaterial color="#d1d5db" metalness={0.9} roughness={0.2} />
          </mesh>
          {[-0.007, 0.007].map((x) => (
            <mesh key={x} position={[0, len * 0.15, x]} raycast={noRay} castShadow>
              <boxGeometry args={[0.004, len * 0.6, 0.004]} />
              <meshStandardMaterial color="#d1d5db" metalness={0.9} roughness={0.2} />
            </mesh>
          ))}
        </group>
      );
    }
    case "penlight":
      return (
        <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0.007, 0]} raycast={noRay} castShadow>
          <cylinderGeometry args={[0.006, 0.006, 0.13, 10]} />
          <meshStandardMaterial color="#1d4ed8" roughness={0.4} />
        </mesh>
      );
    case "otoscope":
      return (
        <group>
          <mesh position={[0, 0.06, 0]} raycast={noRay} castShadow>
            <cylinderGeometry args={[0.014, 0.014, 0.12, 12]} />
            <meshStandardMaterial color="#1f2937" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.13, 0.02]} rotation={[Math.PI / 2, 0, 0]} raycast={noRay}>
            <coneGeometry args={[0.012, 0.05, 12]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.3} />
          </mesh>
        </group>
      );
    case "swabs":
      return (
        <group>
          <mesh position={[0, 0.035, 0]} raycast={noRay}>
            <cylinderGeometry args={[0.025, 0.025, 0.07, 14]} />
            <meshStandardMaterial color="#e0f2fe" roughness={0.2} transparent opacity={0.7} />
          </mesh>
          {[-0.008, 0, 0.008].map((x) => (
            <mesh key={x} position={[x, 0.08, 0]} raycast={noRay}>
              <cylinderGeometry args={[0.0015, 0.0015, 0.08, 6]} />
              <meshStandardMaterial color="#fef3c7" />
            </mesh>
          ))}
        </group>
      );
    case "pin":
      // a disposable neurotip: white shaft, sharp and blunt ends
      return (
        <group rotation={[0, 0.4, Math.PI / 2]} position={[0, 0.004, 0]}>
          <mesh raycast={noRay} castShadow>
            <cylinderGeometry args={[0.003, 0.003, 0.07, 8]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.04, 0]} raycast={noRay}>
            <coneGeometry args={[0.003, 0.012, 8]} />
            <meshStandardMaterial color="#facc15" roughness={0.4} />
          </mesh>
        </group>
      );
    case "bp_cuff":
      return (
        <group>
          <mesh position={[0, 0.015, 0]} raycast={noRay} castShadow>
            <boxGeometry args={[0.14, 0.03, 0.09]} />
            <meshStandardMaterial color="#1e3a8a" roughness={0.8} />
          </mesh>
          <mesh position={[0.06, 0.03, 0.06]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRay}>
            <cylinderGeometry args={[0.03, 0.03, 0.015, 20]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.4} />
          </mesh>
        </group>
      );
  }
}
