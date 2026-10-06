"use client";
import { Canvas } from "@react-three/fiber";
import { useMemo, useState } from "react";
import type { Action, PublicCase, Region } from "@/domain/schemas";
import { patientState } from "@/engine/patientState";
import { CameraRig, PRESET_LABELS, presetGoal, regionGoal, type CameraPreset } from "./CameraRig";
import { Patient3D } from "./Patient3D";
import { ANCHOR_BY_REGION, poseFor, type Vec3 } from "./regionAnchors";
import { RegionPicker } from "./RegionPicker";
import { Room } from "./Room";
import { TestHook } from "./TestHook";

export interface Exam3DViewProps {
  regions: Region[];
  /** regions that have at least one maneuver */
  examinableRegionIds: Set<string>;
  actions: Action[];
  presentation: PublicCase["presentation"];
  selectedRegionId?: string | null;
  performingRegionId?: string | null;
  examinedRegionIds: Set<string>;
  disabled?: boolean;
  onRegionClick: (r: Region) => void;
}

export default function Exam3DView(props: Exam3DViewProps) {
  const state = useMemo(() => patientState(props.actions), [props.actions]);
  const pose = useMemo(() => poseFor(state.position, state.bedAngle), [state.position, state.bedAngle]);
  const [preset, setPreset] = useState<CameraPreset>("body");
  const [focus, setFocus] = useState<string | null>(null);
  const [goalKey, setGoalKey] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const [showMarkers, setShowMarkers] = useState(true);
  const byId = useMemo(() => new Map(props.regions.map((r) => [r.id, r])), [props.regions]);

  const goal = useMemo(() => {
    const g = (focus && regionGoal(focus, pose)) || presetGoal(preset, pose);
    return { ...g, key: goalKey };
  }, [preset, focus, pose, goalKey]);

  const enabled = useMemo(() => new Set([...props.examinableRegionIds].filter((id) => ANCHOR_BY_REGION.has(id))), [props.examinableRegionIds]);
  const edema = useMemo(() => Object.fromEntries((props.presentation.visibleSigns.edema ?? []).map((e) => [e.regionId, e.grade])), [props.presentation]);
  const panelRegions = props.regions.filter((r) => r.view === "neuro");
  const backHidden = preset === "chest_back" && state.bedAngle < 45;

  const choosePreset = (p: CameraPreset) => {
    setFocus(null);
    setPreset(p);
    setGoalKey((k) => k + 1);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div role="tablist" aria-label="Camera view" className="flex flex-wrap gap-1">
        {(Object.keys(PRESET_LABELS) as CameraPreset[]).map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={preset === p && !focus}
            onClick={() => choosePreset(p)}
            className={`rounded-md px-2.5 py-1 text-sm ${preset === p && !focus ? "bg-cyan-700 text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`}
          >
            {PRESET_LABELS[p]}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={showMarkers} onChange={(e) => setShowMarkers(e.target.checked)} />
          Show regions
        </label>
      </div>

      <div className="relative min-h-[360px] flex-1 overflow-hidden rounded-md bg-slate-100" data-testid="exam3d">
        <Canvas dpr={[1, 1.5]} camera={{ fov: 40, near: 0.02, far: 30, position: goal.position as Vec3 }} gl={{ antialias: true }}>
          <color attach="background" args={["#e9eff2"]} />
          <hemisphereLight args={["#ffffff", "#c8d2d8", 0.9]} />
          <directionalLight position={[2, 4, 2]} intensity={1.1} />
          <directionalLight position={[-2, 2, -1]} intensity={0.35} />
          <Room backrest={pose.backrest} showBackrest={state.bedAngle < 60 && state.position !== "left_lateral_decubitus"} />
          <Patient3D
            pose={pose}
            drape={state.drape}
            rr={props.presentation.rr}
            hr={props.presentation.hr}
            laboured={props.presentation.visibleSigns.breathing === "laboured"}
            jvpCm={props.presentation.visibleSigns.jvpCm ?? 0}
            edema={edema}
            showMarkers={showMarkers}
            selectedRegionId={props.selectedRegionId}
            performingRegionId={props.performingRegionId}
            examinedRegionIds={props.examinedRegionIds}
            enabledRegionIds={enabled}
            onPick={(id) => {
              const r = byId.get(id);
              if (r && !props.disabled) props.onRegionClick(r);
            }}
            onDoublePick={(id) => {
              setFocus(id);
              setGoalKey((k) => k + 1);
            }}
            onHover={setHover}
          />
          <CameraRig goal={goal} />
          <TestHook pose={pose} />
        </Canvas>
        <div className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-sm text-slate-700" aria-live="polite">
          {hover ? byId.get(hover)?.label : "Click a region to examine · drag to orbit · scroll to zoom · double-click to focus"}
        </div>
        {backHidden && (
          <p className="absolute top-2 left-2 max-w-xs rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">
            The back is against the bed. Sit the patient up (position: seated) to examine it.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1 text-xs">
        <span className="text-slate-500">Neuro:</span>
        {panelRegions.map((r) => (
          <button
            key={r.id}
            disabled={props.disabled}
            onClick={() => props.onRegionClick(r)}
            className={`rounded border px-2 py-0.5 ${props.selectedRegionId === r.id ? "border-cyan-700 bg-cyan-50" : "border-slate-300"}`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <RegionPicker regions={props.regions} onPick={props.onRegionClick} disabled={props.disabled} />
    </div>
  );
}
