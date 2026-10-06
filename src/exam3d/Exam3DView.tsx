"use client";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Action, AudioSpec, PublicCase, Region } from "@/domain/schemas";
import type { PublicCatalog } from "@/content/types";
import { patientState } from "@/engine/patientState";
import { audioEngine, type Playing } from "@/audio/engine";
import { captionFor, toneEnvelope } from "@/audio/schedule";
import type { ToolUse } from "@/input/adapters/tool";
import { CameraRig, PRESET_LABELS, presetGoal, regionGoal, type CameraPreset } from "./CameraRig";
import { Patient3D } from "./Patient3D";
import { ANCHOR_BY_REGION, SNAP_TOLERANCE, poseFor, snapToAnchor, type Vec3 } from "./regionAnchors";
import { RegionPicker } from "./RegionPicker";
import { Dispenser } from "./Dispenser";
import { Room } from "./Room";
import { TestHook } from "./TestHook";
import { MIN_LISTEN_MS, candidatesFor, placementSound, regionsForTool, sequenceProgress, stepForPlacement } from "./tools/toolLogic";
import { PulseRing, ToolMarker } from "./tools/ToolMarker";
import { ToolTray, toolModeOf, type ToolState } from "./tools/ToolTray";

type M = PublicCatalog["maneuvers"][number];

export interface Exam3DViewProps {
  sessionId: string;
  regions: Region[];
  maneuvers: M[];
  /** regions that have at least one maneuver */
  examinableRegionIds: Set<string>;
  actions: Action[];
  presentation: PublicCase["presentation"];
  selectedRegionId?: string | null;
  performingRegionId?: string | null;
  examinedRegionIds: Set<string>;
  disabled?: boolean;
  onRegionClick: (r: Region) => void;
  tool: ToolState;
  onToolChange: (s: ToolState) => void;
  /** log a tool use; resolves to the logged examine action */
  onToolExamine: (u: ToolUse) => Promise<Action | null>;
  /** several maneuvers fit this placement: ask the student; resolves to the chosen maneuver id */
  onToolAmbiguous: (regionId: string, maneuverIds: string[]) => Promise<string | null>;
  /** the sanitiser dispenser in the scene (press and hold) */
  sanitiser?: { progress: number; start: () => void; cancel: () => void };
}

interface Hold {
  regionId: string;
  maneuverId: string;
  error: number;
  point: Vec3;
  startedAt: number;
  caption?: string;
}

interface Sequence {
  maneuverId: string;
  regionId: string;
  done: string[];
  tone?: Extract<AudioSpec, { generator: "tone" }>;
}

export default function Exam3DView(props: Exam3DViewProps) {
  const state = useMemo(() => patientState(props.actions), [props.actions]);
  const pose = useMemo(() => poseFor(state.position, state.bedAngle), [state.position, state.bedAngle]);
  const [preset, setPreset] = useState<CameraPreset>("body");
  const [focus, setFocus] = useState<string | null>(null);
  const [goalKey, setGoalKey] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const [showMarkers, setShowMarkers] = useState(true);
  const [hold, setHold] = useState<Hold | null>(null);
  const [marker, setMarker] = useState<{ point: Vec3; onTarget: boolean } | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const [pulse, setPulse] = useState<{ point: Vec3; amount: number; startedAt: number } | null>(null);
  const [pupilScale, setPupilScale] = useState(1);
  const [sequence, setSequence] = useState<Sequence | null>(null);
  const [now, setNow] = useState(() => performance.now());
  const playing = useRef<Playing | null>(null);
  const pending = useRef<{ point: Vec3 } | null>(null);
  const holdRef = useRef<Hold | null>(null);
  holdRef.current = hold;
  const byId = useMemo(() => new Map(props.regions.map((r) => [r.id, r])), [props.regions]);
  const maneuverById = useMemo(() => new Map(props.maneuvers.map((m) => [m.id, m])), [props.maneuvers]);
  const { tool } = props.tool;
  const mode = toolModeOf(props.tool);
  const hr = props.presentation.hr;
  const rr = props.presentation.rr;

  // ticking clock for the hold progress and the fork's decay
  useEffect(() => {
    if (!hold && !props.tool.struckAt) return;
    const id = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(id);
  }, [hold, props.tool.struckAt]);
  useEffect(() => () => playing.current?.stop(), []);
  useEffect(() => {
    playing.current?.stop();
    setHold(null);
    setMarker(null);
    setCaption(null);
    if (tool !== "tuning_fork") setSequence(null);
  }, [tool]);

  const goal = useMemo(() => {
    const g = (focus && regionGoal(focus, pose)) || presetGoal(preset, pose);
    return { ...g, key: goalKey };
  }, [preset, focus, pose, goalKey]);

  const toolRegions = useMemo(() => (tool ? regionsForTool(props.maneuvers, tool).filter((id) => ANCHOR_BY_REGION.has(id)) : []), [tool, props.maneuvers]);
  const enabled = useMemo(() => {
    const base = tool ? toolRegions : [...props.examinableRegionIds].filter((id) => ANCHOR_BY_REGION.has(id));
    return new Set(base);
  }, [tool, toolRegions, props.examinableRegionIds]);
  const edema = useMemo(() => Object.fromEntries((props.presentation.visibleSigns.edema ?? []).map((e) => [e.regionId, e.grade])), [props.presentation]);
  const panelRegions = props.regions.filter((r) => r.view === "neuro");
  const backHidden = preset === "chest_back" && state.bedAngle < 45;

  const choosePreset = (p: CameraPreset) => {
    setFocus(null);
    setPreset(p);
    setGoalKey((k) => k + 1);
  };

  // ------------------------------------------------------------------ tools
  const snap = (point: Vec3) => snapToAnchor(point, toolRegions, pose);

  const startListening = async (h: Hold) => {
    setHold(h);
    setMarker({ point: h.point, onTarget: h.error <= SNAP_TOLERANCE });
    const res = await fetch(`/api/sessions/${props.sessionId}/listen`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ maneuverId: h.maneuverId, regionId: h.regionId }),
    }).catch(() => null);
    const { audio } = res?.ok ? ((await res.json()) as { audio: AudioSpec | null }) : { audio: null };
    if (holdRef.current?.startedAt !== h.startedAt) return; // released already
    const off = h.error > SNAP_TOLERANCE ? " (off target — muffled)" : "";
    setCaption(audio ? captionFor(audio) + off : `No sound here${off}`);
    if (audio) {
      playing.current = await audioEngine.loop(audio, { hr, rr, ...placementSound(h.error) });
      if (holdRef.current?.startedAt !== h.startedAt) playing.current.stop();
    }
  };

  const endListening = async () => {
    const h = holdRef.current;
    playing.current?.stop();
    playing.current = null;
    setHold(null);
    if (!h || !tool) return;
    await props.onToolExamine({
      regionId: h.regionId,
      maneuverId: h.maneuverId,
      tool,
      toolMode: mode,
      placementError: h.error,
      durationMs: performance.now() - h.startedAt,
    });
  };

  const onToolDown = (point: Vec3) => {
    if (!tool || props.disabled) return;
    const s = snap(point);
    if (!s) return;
    if (tool === "stethoscope") {
      const m = candidatesFor(props.maneuvers, tool, mode, s.regionId)[0];
      if (m) void startListening({ regionId: s.regionId, maneuverId: m.id, error: s.error, point: s.error <= SNAP_TOLERANCE ? s.point : point, startedAt: performance.now() });
    } else {
      pending.current = { point };
    }
  };

  const onToolMove = (point: Vec3) => {
    const h = holdRef.current;
    if (!h || !tool) return;
    const s = snap(point);
    if (!s) return;
    if (s.regionId !== h.regionId) {
      // slid onto another region: log the last spot and start listening at the new one
      void endListening().then(() => {
        const m = candidatesFor(props.maneuvers, tool, mode, s.regionId)[0];
        if (m) void startListening({ regionId: s.regionId, maneuverId: m.id, error: s.error, point: s.point, startedAt: performance.now() });
      });
    } else {
      setMarker({ point: s.error <= SNAP_TOLERANCE ? s.point : point, onTarget: s.error <= SNAP_TOLERANCE });
    }
  };

  const onToolUp = () => {
    if (holdRef.current) {
      void endListening();
      return;
    }
    const p = pending.current;
    pending.current = null;
    if (p) void instantTool(p.point);
  };

  const instantTool = async (point: Vec3) => {
    if (!tool) return;
    const s = snap(point);
    if (!s) return;
    const cands = candidatesFor(props.maneuvers, tool, mode, s.regionId);
    if (!cands.length) return;
    let maneuverId: string | null = cands[0]!.id;
    if (cands.length > 1) maneuverId = await props.onToolAmbiguous(s.regionId, cands.map((c) => c.id));
    if (!maneuverId) return;
    const m = maneuverById.get(maneuverId)!;
    // sequences measure placement against the step's landmark (e.g. mastoid vs ear canal)
    const seqStep = m.interaction === "sequence" && m.steps ? stepForPlacement(m.steps, s.regionId, point, pose, ANCHOR_BY_REGION.get(s.regionId)?.radius) : undefined;
    const error = seqStep?.error ?? s.error;
    const target = seqStep?.point ?? s.point;
    const step = seqStep?.id;
    setMarker({ point: error <= SNAP_TOLERANCE ? target : point, onTarget: error <= SNAP_TOLERANCE });
    const action = await props.onToolExamine({ regionId: s.regionId, maneuverId, tool, toolMode: mode, placementError: error, ...(step ? { step } : {}) });
    if (!action || action.type !== "examine") return;
    const result = action.result;
    if (tool === "tuning_fork" && result?.audio && "generator" in result.audio && result.audio.generator === "tone") {
      const toneSpec = result.audio;
      if (m.interaction === "sequence") {
        setSequence((q) => (q && q.maneuverId === m.id && q.regionId === s.regionId ? { ...q, done: [...q.done, step ?? ""], tone: toneSpec } : { maneuverId: m.id, regionId: s.regionId, done: [step ?? ""], tone: toneSpec }));
      }
      playTone(toneSpec, m.interaction !== "sequence");
    }
    if (tool === "reflex_hammer") setPulse({ point: target, amount: result?.visual?.reflex ?? 2, startedAt: performance.now() });
    if (tool === "penlight") {
      setPupilScale(1 - 0.6 * (result?.visual?.pupilConstriction ?? 0.6));
      setTimeout(() => setPupilScale(1), 1500);
    }
  };

  const playTone = (spec: Extract<AudioSpec, { generator: "tone" }>, usePan: boolean) => {
    playing.current?.stop();
    const struck = props.tool.struckAt;
    if (!struck) {
      setCaption("The fork isn't vibrating. Strike it first.");
      return;
    }
    const elapsed = (performance.now() - struck) / 1000;
    if (elapsed >= toneEnvelope(spec.params).decaySec) {
      setCaption("The fork has stopped vibrating. Strike it again.");
      return;
    }
    void audioEngine.tone(spec, elapsed, { pan: usePan ? spec.params.pan : 0 }).then((p) => (playing.current = p));
    setCaption(usePan ? captionFor(spec) : `Tuning fork ${spec.params.freq} Hz`);
  };

  const rinne = sequence ? maneuverById.get(sequence.maneuverId) : undefined;
  const progress = rinne?.steps && sequence ? sequenceProgress(rinne.steps, sequence.done) : null;
  const boneSec = sequence?.tone ? toneEnvelope(sequence.tone.params).boneSec : 3;
  const forkElapsed = props.tool.struckAt ? (now - props.tool.struckAt) / 1000 : 0;
  const signalReady = !!props.tool.struckAt && forkElapsed >= boneSec;
  const holdMs = hold ? now - hold.startedAt : 0;

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
      <ToolTray state={props.tool} onChange={props.onToolChange} disabled={props.disabled} />

      <div className="relative min-h-[360px] flex-1 overflow-hidden rounded-md bg-slate-100" data-testid="exam3d" data-camera={focus ? `focus:${focus}` : preset}>
        <Canvas dpr={[1, 1.5]} camera={{ fov: 40, near: 0.02, far: 30, position: goal.position as Vec3 }} gl={{ antialias: true }}>
          <color attach="background" args={["#e9eff2"]} />
          <hemisphereLight args={["#ffffff", "#c8d2d8", 0.9]} />
          <directionalLight position={[2, 4, 2]} intensity={1.1} />
          <directionalLight position={[-2, 2, -1]} intensity={0.35} />
          <Room backrest={pose.backrest} showBackrest={state.bedAngle < 60 && state.position !== "left_lateral_decubitus"} />
          {props.sanitiser && (
            <Dispenser progress={props.sanitiser.progress} clean={state.handsClean} onStart={() => !props.disabled && props.sanitiser!.start()} onCancel={props.sanitiser.cancel} />
          )}
          <Patient3D
            pose={pose}
            drape={state.drape}
            rr={rr}
            hr={hr}
            laboured={props.presentation.visibleSigns.breathing === "laboured"}
            jvpCm={props.presentation.visibleSigns.jvpCm ?? 0}
            edema={edema}
            showMarkers={showMarkers}
            selectedRegionId={props.selectedRegionId}
            performingRegionId={props.performingRegionId ?? hold?.regionId}
            examinedRegionIds={props.examinedRegionIds}
            enabledRegionIds={enabled}
            toolActive={!!tool}
            onToolDown={onToolDown}
            onToolMove={onToolMove}
            onToolUp={onToolUp}
            pupilScale={pupilScale}
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
          {tool && marker && <ToolMarker tool={tool} point={marker.point} onTarget={marker.onTarget} />}
          {pulse && <PulseRing key={pulse.startedAt} point={pulse.point} amount={pulse.amount} startedAt={pulse.startedAt} />}
          <CameraRig goal={goal} enabled={!hold} />
          <TestHook pose={pose} />
        </Canvas>

        <div className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-sm text-slate-700" aria-live="polite">
          {hover ? byId.get(hover)?.label : tool ? "" : "Click a region to examine · drag to orbit · scroll to zoom · double-click to focus"}
        </div>
        {(hold || caption) && (
          <div className="pointer-events-none absolute top-2 left-1/2 w-[min(92%,26rem)] -translate-x-1/2 rounded-md bg-white/95 px-3 py-2 text-sm shadow" data-testid="sound-caption" aria-live="polite">
            {hold && (
              <>
                <p className="text-xs text-slate-500">
                  Listening at {byId.get(hold.regionId)?.label} · {(holdMs / 1000).toFixed(1)} s
                </p>
                <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={MIN_LISTEN_MS} aria-valuenow={Math.min(holdMs, MIN_LISTEN_MS)} aria-label="Listening time">
                  <div className={`h-full ${holdMs >= MIN_LISTEN_MS ? "bg-emerald-500" : "bg-cyan-600"}`} style={{ width: `${Math.min(100, (holdMs / MIN_LISTEN_MS) * 100)}%` }} />
                </div>
              </>
            )}
            {caption && <p className="mt-1">{caption}</p>}
          </div>
        )}
        {tool === "tuning_fork" && props.tool.struckAt && (
          <p className="pointer-events-none absolute top-2 right-2 rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-900">Fork struck {forkElapsed.toFixed(0)} s ago</p>
        )}
        {backHidden && (
          <p className="pointer-events-none absolute bottom-8 left-2 max-w-xs rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">
            The back is against the bed. Ask the patient to sit up (or raise the bed) to examine it.
          </p>
        )}
      </div>

      {progress && rinne && sequence && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs" data-testid="sequence">
          <p className="font-semibold">
            {rinne.label} — {byId.get(sequence.regionId)?.label}
            {progress.outOfOrder && <span className="ml-2 text-red-700">steps out of order</span>}
          </p>
          <ol className="mt-1 list-decimal pl-5">
            {rinne.steps!.map((st) => (
              <li key={st.id} className={sequence.done.includes(st.id) ? "text-emerald-800 line-through" : progress.next?.id === st.id ? "font-medium" : "text-slate-500"}>
                {st.label}
              </li>
            ))}
          </ol>
          {progress.next?.kind === "signal" && (
            <button
              type="button"
              disabled={!signalReady}
              onClick={async () => {
                playing.current?.stop();
                await props.onToolExamine({ regionId: sequence.regionId, maneuverId: sequence.maneuverId, tool: "tuning_fork", toolMode: mode, step: progress.next!.id });
                setSequence((q) => (q ? { ...q, done: [...q.done, progress.next!.id] } : q));
                setCaption("Patient: “I can't hear it any more.” Now move the fork beside the ear canal.");
              }}
              className="mt-1 rounded bg-amber-600 px-2 py-1 text-white disabled:opacity-50"
            >
              {signalReady ? "Patient signals: “It's stopped”" : "Waiting for the patient to stop hearing it…"}
            </button>
          )}
          {progress.complete && <p className="mt-1 text-emerald-800">Sequence complete.</p>}
        </div>
      )}

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
