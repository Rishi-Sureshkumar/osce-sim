"use client";
/**
 * Draws every hidden anchor (tolerance sphere, and the 2× "near" band) on the posed patient, on
 * the real exam table with the station's trunk and table angles for the chosen position, so
 * landmark offsets and tolerances can be calibrated (with `npm run qa:calibrate-anchors`). Never
 * used by the station.
 */
import { Html, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useMemo, useState } from "react";
import { Position } from "@/domain/schemas";
import { anchorWorldPoints, anchorsFor, poseFor } from "@/exam3d/regionAnchors";
import { POSITION_ANGLE } from "@/engine/patientState";
import { tableAngle } from "@/scene/room/tableGeometry";
import { NEAR_FACTOR } from "@/exam3d/tools/contact";
import { PatientModel } from "@/scene/PatientModel";
import { ExamTable } from "@/scene/room/ExamRoom";
import { TABLE, type VariantId } from "@/scene/rig";

const NO_DRAPE = { chest: false, abdomen: false, legs: false } as const;

export function AnchorDebug() {
  const [variant, setVariant] = useState<VariantId>("male");
  const [position, setPosition] = useState<Position>("reclined_30");
  const [bedAngle, setBedAngle] = useState(30);
  const [filter, setFilter] = useState("");
  const [labels, setLabels] = useState(true);
  const pose = useMemo(() => poseFor(position, bedAngle, variant), [position, bedAngle, variant]);
  const anchors = anchorsFor(variant).filter((a) => a.regionId.includes(filter));
  const angle = useMemo(() => ({ current: tableAngle(position, bedAngle) }), [position, bedAngle]);

  return (
    <main className="flex h-screen flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-2 text-sm">
        <strong>Anchor calibration (dev only)</strong>
        <select value={variant} onChange={(e) => setVariant(e.target.value as VariantId)} aria-label="Variant">
          <option value="male">male</option>
          <option value="female">female</option>
        </select>
        <select
          value={position}
          onChange={(e) => {
            // the station's trunk angle for the position (the slider then fine-tunes it)
            const p = e.target.value as Position;
            setPosition(p);
            setBedAngle(POSITION_ANGLE[p]);
          }}
          aria-label="Position"
        >
          {Position.options.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <label>
          Head {bedAngle}° <input type="range" min={0} max={90} value={bedAngle} onChange={(e) => setBedAngle(Number(e.target.value))} />
        </label>
        <input placeholder="filter region id" value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded border px-1" />
        <label>
          <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} /> labels
        </label>
        <span className="text-slate-500">green = tolerance (finding), amber = up to {NEAR_FACTOR}× (near)</span>
      </div>
      <div className="flex-1" data-testid="anchor-debug">
        <Canvas camera={{ fov: 40, position: [-1.4, 1.8, 0.4] }}>
          <color attach="background" args={["#eef2f4"]} />
          <hemisphereLight args={["#ffffff", "#9aa7b0", 1.2]} />
          <directionalLight position={[-1, 3, 1]} intensity={1.2} />
          <ExamTable angle={angle} />
          <Suspense fallback={null}>
            <PatientModel variant={variant} position={position} bedAngle={bedAngle} angle={angle} drape={NO_DRAPE} hr={70} rr={0.001} laboured={false} jvpCm={0} edema={{}} pupilScale={1} speaking={false} quality="low" />
          </Suspense>
          {anchors.map((a) =>
            anchorWorldPoints(a.regionId, pose).map((p, i) => (
              <group key={`${a.regionId}:${i}`} position={p}>
                <mesh>
                  <sphereGeometry args={[a.toleranceCm / 100, 16, 12]} />
                  <meshBasicMaterial color="#10b981" transparent opacity={0.35} depthWrite={false} />
                </mesh>
                <mesh>
                  <sphereGeometry args={[(a.toleranceCm * NEAR_FACTOR) / 100, 16, 12]} />
                  <meshBasicMaterial color="#f59e0b" transparent opacity={0.12} depthWrite={false} />
                </mesh>
                {labels && i === 0 && (
                  <Html center style={{ pointerEvents: "none" }}>
                    <span className="rounded bg-black/70 px-1 text-[10px] whitespace-nowrap text-white">
                      {a.regionId} · {a.toleranceCm} cm
                    </span>
                  </Html>
                )}
              </group>
            )),
          )}
          <OrbitControls target={[0, TABLE.topY + 0.2, 0]} makeDefault />
        </Canvas>
      </div>
    </main>
  );
}
