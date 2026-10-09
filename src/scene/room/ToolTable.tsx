"use client";
/**
 * Instrument table at the head of the bed on the examiner's side, with the 1B room's tools laid
 * out: stethoscope, reflex hammer, 128 and 512 Hz tuning forks, penlight, otoscope/ophthalmoscope,
 * cotton swabs and a BP cuff. Each tool is a small procedural model with a stable name, so the
 * navigation layer can lift it on hover and pick it up on click.
 */
import { RoundedBox } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { CatmullRomCurve3, DoubleSide, ExtrudeGeometry, Shape, TubeGeometry, Vector3 } from "three";
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

const STEEL = { color: "#d7dce2", metalness: 0.9, roughness: 0.22 } as const;
const tube = (pts: [number, number, number][], r: number, seg = 48) => new TubeGeometry(new CatmullRomCurve3(pts.map((p) => new Vector3(...p))), seg, r, 8, false);

/** A rounded-corner 2D outline as a Shape (corners in order, each rounded by `r`). */
function roundedShape(corners: [number, number][], r: number): Shape {
  const sh = new Shape();
  const n = corners.length;
  for (let i = 0; i < n; i++) {
    const p = corners[i]!;
    const a = corners[(i + n - 1) % n]!;
    const b = corners[(i + 1) % n]!;
    const da = Math.hypot(a[0] - p[0], a[1] - p[1]);
    const db = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const pa: [number, number] = [p[0] + ((a[0] - p[0]) / da) * r, p[1] + ((a[1] - p[1]) / da) * r];
    const pb: [number, number] = [p[0] + ((b[0] - p[0]) / db) * r, p[1] + ((b[1] - p[1]) / db) * r];
    if (i === 0) sh.moveTo(...pa);
    else sh.lineTo(...pa);
    sh.quadraticCurveTo(p[0], p[1], pb[0], pb[1]);
  }
  sh.closePath();
  return sh;
}

/** Instrument geometries, built once and shared (Phase 4 M3, V-TOOLS: the table showed crude primitives). */
let toolGeometry: ReturnType<typeof buildToolGeometry> | null = null;
function buildToolGeometry() {
  {
    // stethoscope lying in a loop: chest piece → tubing → Y → binaurals with ear tips
    const Y: [number, number, number] = [-0.075, 0.006, -0.03];
    const earL: [number, number, number] = [-0.005, 0.009, -0.105];
    const earR: [number, number, number] = [-0.115, 0.009, -0.11];
    const steth = {
      main: tube([[0.062, 0.008, 0.03], [0.045, 0.006, 0.08], [-0.01, 0.006, 0.09], [-0.065, 0.006, 0.05], Y], 0.0045),
      left: tube([Y, [-0.055, 0.006, -0.06], [-0.03, 0.008, -0.08]], 0.0038, 24),
      right: tube([Y, [-0.095, 0.006, -0.065], [-0.105, 0.008, -0.085]], 0.0038, 24),
      metalL: tube([[-0.03, 0.008, -0.08], [-0.015, 0.009, -0.095], earL], 0.002, 16),
      metalR: tube([[-0.105, 0.008, -0.085], [-0.112, 0.009, -0.1], earR], 0.002, 16),
      earL,
      earR,
    };
    // Taylor hammer head: a rounded triangle
    const hammer = new ExtrudeGeometry(roundedShape([[-0.03, -0.012], [0.03, -0.012], [0, 0.03]], 0.008), { depth: 0.012, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 2 });
    hammer.center();
    // tuning fork: a U of two tines joined by a rounded crown
    const fork = (len: number) => {
      const w = 0.016;
      const t = 0.004;
      const sh = new Shape();
      sh.moveTo(-w / 2, len);
      sh.lineTo(-w / 2, 0.01);
      sh.quadraticCurveTo(-w / 2, -0.004, 0, -0.004);
      sh.quadraticCurveTo(w / 2, -0.004, w / 2, 0.01);
      sh.lineTo(w / 2, len);
      sh.lineTo(w / 2 - t, len);
      sh.lineTo(w / 2 - t, 0.01);
      sh.quadraticCurveTo(w / 2 - t, t - 0.004, 0, t - 0.004);
      sh.quadraticCurveTo(-w / 2 + t, t - 0.004, -w / 2 + t, 0.01);
      sh.lineTo(-w / 2 + t, len);
      sh.closePath();
      return new ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: false });
    };
    const cuffTube = tube([[0.05, 0.02, 0.03], [0.07, 0.01, 0.06], [0.06, 0.01, 0.09], [0.03, 0.012, 0.1]], 0.003, 24);
    const bulbTube = tube([[0.05, 0.02, 0.03], [0.09, 0.01, 0.02], [0.12, 0.012, 0.04]], 0.003, 24);
    return { steth, hammer, fork128: fork(0.1), fork512: fork(0.075), cuffTube, bulbTube };
  }
}

/** Small procedural instrument models laid out on the table. */
export function ToolModel({ id }: { id: TableItem }) {
  const g = (toolGeometry ??= buildToolGeometry());
  switch (id) {
    case "stethoscope":
      return (
        <group>
          {/* chest piece: diaphragm face down, bell on top, stem toward the tubing */}
          <mesh position={[0.07, 0.007, 0.02]} raycast={noRay} castShadow>
            <cylinderGeometry args={[0.022, 0.022, 0.01, 28]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
          <mesh position={[0.07, 0.0125, 0.02]} raycast={noRay}>
            <cylinderGeometry args={[0.02, 0.02, 0.001, 28]} />
            <meshStandardMaterial color="#f1f5f9" roughness={0.35} />
          </mesh>
          <mesh position={[0.07, 0.018, 0.02]} raycast={noRay} castShadow>
            <cylinderGeometry args={[0.009, 0.013, 0.01, 20]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
          <mesh position={[0.066, 0.012, 0.027]} rotation={[Math.PI / 2.4, 0, 0.2]} raycast={noRay}>
            <cylinderGeometry args={[0.0035, 0.0035, 0.02, 8]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
          {[g.steth.main, g.steth.left, g.steth.right].map((geo, i) => (
            <mesh key={i} geometry={geo} raycast={noRay} castShadow>
              <meshStandardMaterial color="#111827" roughness={0.45} />
            </mesh>
          ))}
          {[g.steth.metalL, g.steth.metalR].map((geo, i) => (
            <mesh key={i} geometry={geo} raycast={noRay}>
              <meshStandardMaterial {...STEEL} />
            </mesh>
          ))}
          {[g.steth.earL, g.steth.earR].map((p, i) => (
            <mesh key={i} position={p} raycast={noRay}>
              <sphereGeometry args={[0.006, 12, 10]} />
              <meshStandardMaterial color="#1f2937" roughness={0.6} />
            </mesh>
          ))}
        </group>
      );
    case "reflex_hammer":
      return (
        <group rotation={[0, 0.3, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]} position={[-0.01, 0.006, 0]} raycast={noRay} castShadow>
            <cylinderGeometry args={[0.0035, 0.0035, 0.19, 10]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
          <mesh position={[-0.105, 0.006, 0]} rotation={[0, Math.PI / 2, 0]} raycast={noRay}>
            <torusGeometry args={[0.006, 0.0018, 6, 14]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
          {/* the rubber head lies flat on the table, the handle through its middle */}
          <mesh geometry={g.hammer} position={[0.09, 0.009, 0]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]} raycast={noRay} castShadow>
            <meshStandardMaterial color="#c2410c" roughness={0.65} />
          </mesh>
        </group>
      );
    case "fork_128":
    case "fork_512": {
      const geo = id === "fork_128" ? g.fork128 : g.fork512;
      const len = id === "fork_128" ? 0.1 : 0.075;
      return (
        <group rotation={[-Math.PI / 2, 0, -0.25]} position={[0, 0.004, 0]}>
          <mesh geometry={geo} position={[0, 0, -0.002]} raycast={noRay} castShadow>
            <meshStandardMaterial {...STEEL} />
          </mesh>
          <mesh position={[0, -0.028, 0]} raycast={noRay} castShadow>
            <cylinderGeometry args={[0.0035, 0.0035, 0.05, 10]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
          <mesh position={[0, -0.055, 0]} raycast={noRay}>
            <sphereGeometry args={[0.005, 12, 10]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
          {/* the 128 Hz fork carries damping weights near the tine ends */}
          {id === "fork_128" &&
            [-0.006, 0.006].map((x) => (
              <mesh key={x} position={[x, len - 0.012, 0]} raycast={noRay}>
                <boxGeometry args={[0.008, 0.012, 0.007]} />
                <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.35} />
              </mesh>
            ))}
        </group>
      );
    }
    case "penlight":
      return (
        <group rotation={[0, 0, Math.PI / 2]} position={[0, 0.007, 0]}>
          <mesh raycast={noRay} castShadow>
            <cylinderGeometry args={[0.0062, 0.0062, 0.11, 14]} />
            <meshStandardMaterial color="#1e3a8a" roughness={0.35} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0.062, 0]} raycast={noRay}>
            <cylinderGeometry args={[0.0066, 0.0062, 0.016, 14]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
          <mesh position={[0, 0.0705, 0]} raycast={noRay}>
            <cylinderGeometry args={[0.005, 0.005, 0.001, 14]} />
            <meshStandardMaterial color="#fef9c3" emissive="#fef08a" emissiveIntensity={0.25} roughness={0.1} />
          </mesh>
          <mesh position={[0.0065, -0.02, 0]} raycast={noRay}>
            <boxGeometry args={[0.0015, 0.05, 0.004]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
        </group>
      );
    case "otoscope":
      return (
        <group>
          {/* knurled battery handle standing upright, head and speculum on top */}
          <mesh position={[0, 0.055, 0]} raycast={noRay} castShadow>
            <cylinderGeometry args={[0.014, 0.015, 0.11, 18]} />
            <meshStandardMaterial color="#27272a" roughness={0.75} />
          </mesh>
          {[0.02, 0.04, 0.06, 0.08].map((y) => (
            <mesh key={y} position={[0, y, 0]} raycast={noRay}>
              <torusGeometry args={[0.0148, 0.0012, 4, 18]} />
              <meshStandardMaterial color="#3f3f46" roughness={0.6} />
            </mesh>
          ))}
          <mesh position={[0, 0.112, 0]} raycast={noRay}>
            <cylinderGeometry args={[0.012, 0.014, 0.006, 18]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
          <mesh position={[0, 0.128, 0]} raycast={noRay} castShadow>
            <boxGeometry args={[0.024, 0.026, 0.03]} />
            <meshStandardMaterial color="#18181b" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.13, 0.03]} rotation={[Math.PI / 2, 0, 0]} raycast={noRay}>
            <coneGeometry args={[0.01, 0.032, 16, 1, true]} />
            <meshStandardMaterial color="#e5e7eb" roughness={0.35} side={DoubleSide} />
          </mesh>
          <mesh position={[0, 0.13, -0.0155]} rotation={[Math.PI / 2, 0, 0]} raycast={noRay}>
            <cylinderGeometry args={[0.008, 0.008, 0.002, 16]} />
            <meshStandardMaterial color="#93c5fd" roughness={0.05} metalness={0.3} transparent opacity={0.7} />
          </mesh>
        </group>
      );
    case "swabs":
      return (
        <group>
          <mesh position={[0, 0.035, 0]} raycast={noRay}>
            <cylinderGeometry args={[0.025, 0.025, 0.07, 18, 1, true]} />
            <meshStandardMaterial color="#e0f2fe" roughness={0.15} transparent opacity={0.55} side={DoubleSide} />
          </mesh>
          <mesh position={[0, 0.001, 0]} raycast={noRay}>
            <cylinderGeometry args={[0.025, 0.025, 0.002, 18]} />
            <meshStandardMaterial color="#e0f2fe" roughness={0.15} transparent opacity={0.7} />
          </mesh>
          {[-0.009, -0.003, 0.004, 0.01].map((x, i) => (
            <group key={x} position={[x, 0.06, (i % 2 ? 1 : -1) * 0.004]} rotation={[0, 0, x * 3]}>
              <mesh raycast={noRay}>
                <cylinderGeometry args={[0.0013, 0.0013, 0.08, 6]} />
                <meshStandardMaterial color="#fafaf9" />
              </mesh>
              <mesh position={[0, 0.043, 0]} scale={[1, 1.6, 1]} raycast={noRay}>
                <sphereGeometry args={[0.0035, 10, 8]} />
                <meshStandardMaterial color="#fffbeb" roughness={1} />
              </mesh>
            </group>
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
          {/* the folded cuff with its hook-and-loop band, tubing to the gauge and the bulb */}
          <RoundedBox args={[0.14, 0.026, 0.09]} radius={0.01} smoothness={3} position={[0, 0.013, 0]} raycast={noRay} castShadow>
            <meshStandardMaterial color="#1e3a8a" roughness={0.85} />
          </RoundedBox>
          <mesh position={[0, 0.0265, 0]} raycast={noRay}>
            <boxGeometry args={[0.12, 0.001, 0.03]} />
            <meshStandardMaterial color="#334155" roughness={1} />
          </mesh>
          <mesh geometry={g.cuffTube} raycast={noRay}>
            <meshStandardMaterial color="#111827" roughness={0.5} />
          </mesh>
          <mesh geometry={g.bulbTube} raycast={noRay}>
            <meshStandardMaterial color="#111827" roughness={0.5} />
          </mesh>
          <group position={[0.02, 0.012, 0.11]}>
            <mesh raycast={noRay} castShadow>
              <cylinderGeometry args={[0.028, 0.028, 0.014, 28]} />
              <meshStandardMaterial {...STEEL} />
            </mesh>
            <mesh position={[0, 0.0075, 0]} raycast={noRay}>
              <cylinderGeometry args={[0.025, 0.025, 0.001, 28]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.4} />
            </mesh>
            <mesh position={[0.006, 0.0085, -0.004]} rotation={[0, 0.6, 0]} raycast={noRay}>
              <boxGeometry args={[0.02, 0.0008, 0.0015]} />
              <meshStandardMaterial color="#b91c1c" />
            </mesh>
          </group>
          <mesh position={[0.13, 0.015, 0.045]} scale={[1.3, 1, 1]} raycast={noRay} castShadow>
            <sphereGeometry args={[0.015, 16, 12]} />
            <meshStandardMaterial color="#111827" roughness={0.55} />
          </mesh>
        </group>
      );
  }
}
