"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Action, AudioSpec, ContactOutcome, DrapeZone, Position, PublicCase, Region } from "@/domain/schemas";
import type { PublicCatalog } from "@/content/types";
import { patientState } from "@/engine/patientState";
import { audioEngine, type Playing } from "@/audio/engine";
import { captionFor, toneEnvelope } from "@/audio/schedule";
import type { ToolContact, ToolUse } from "@/input/adapters/tool";
import { Drapes } from "@/scene/Drapes";
import { HandWash } from "@/scene/HandWash";
import { FpsMeter, LoadingOverlay } from "@/scene/Loading";
import { ExamRoom } from "@/scene/room/ExamRoom";
import type { VariantId } from "@/scene/rig";
import { ShotCamera, type CameraGoal } from "@/scene/ShotCamera";
import { SHOTS, back, breadcrumb, focusShotFor, go, shotCamera, type ShotId, type ShotState } from "@/scene/shots";
import { ToolCursor, type CursorPoint } from "@/scene/tools/ToolCursor";
import type { TableItem } from "@/scene/room/ToolTable";
import { Patient3D, type BodyHit } from "./Patient3D";
import { ANCHOR_BY_REGION, poseFor, snapToAnchor, type Vec3 } from "./regionAnchors";
import { HINT_MS, LandmarkHints } from "./LandmarkHints";
import { TestHook } from "./TestHook";
import { Dialog } from "@/components/ui/Overlay";
import { MIN_LISTEN_MS, regionsForTool, sequenceProgress } from "./tools/toolLogic";
import { backgroundKind, contactOutcome, contactSound, recordsFinding } from "./tools/contact";
import { decidePlacement, holdCandidate, holdKey, type RememberedHold } from "./tools/decide";
import { JERK_BONE } from "@/scene/animation/reflex";
import { QA, configureQa, qaDelay, recordDecision } from "./qa";
import { ToolHud, itemInHand, pickFromTable, toolModeOf, type ToolState } from "./tools/ToolTray";

type M = PublicCatalog["maneuvers"][number];

/** How long the first-person hand rub lasts before the hygiene Action is logged. */
export const WASH_MS = 4000;
const BED_STOPS: Position[] = ["supine", "reclined_30", "reclined_45", "seated"];

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
  /** exam actions locked (outside the room, time up, ended) */
  disabled?: boolean;
  mode: "practice" | "exam";
  /** the corridor door can be opened (e.g. after "You may begin") */
  canEnter: boolean;
  onEnter: () => Promise<void>;
  onWash: () => Promise<void>;
  onSit: () => void;
  onBed: (p: Position) => void;
  onDrape: (zone: DrapeZone, covered: boolean) => void;
  /** the door from inside: the parent asks for confirmation, then ends the encounter */
  onLeaveRequest: () => void;
  /** a region was chosen in its focus shot: open the maneuver menu */
  onRegionClick: (r: Region) => void;
  /** a verbal-only region (mouth, nose) was chosen */
  onDescribe: (r: Region) => void;
  /** an exam the door instructions exclude was attempted */
  onProhibited: (r: Region) => void;
  prohibitedRegionIds: Set<string>;
  tool: ToolState;
  onToolChange: (s: ToolState) => void;
  /** log a tool use; resolves to the logged examine action */
  onToolExamine: (u: ToolUse) => Promise<Action | null>;
  /** several maneuvers fit this placement: ask the student; resolves to the chosen maneuver id */
  onToolAmbiguous: (regionId: string, maneuverIds: string[]) => Promise<string | null>;
  /** practice only: anatomical labels were shown (logged as a hint) */
  onLandmarksHint?: (shotLabel: string) => void;
  /** log every placement (hidden-anchor distance and outcome) */
  onToolContact: (c: ToolContact) => Promise<void>;
  variant: VariantId;
  speaking?: boolean;
  quality?: "high" | "low";
  /** QA hooks (server env QA_HOOKS=true): mounts the test hook; ?qa=fast|freeze */
  qa?: boolean;
}

interface Hold {
  regionId: string;
  maneuverId: string;
  error: number;
  distanceCm: number;
  toleranceCm: number;
  outcome: ContactOutcome;
  point: Vec3;
  startedAt: number;
}

interface Sequence {
  maneuverId: string;
  regionId: string;
  done: string[];
  tone?: Extract<AudioSpec, { generator: "tone" }>;
}

/** The table's head section: flat for left lateral; behind the patient (back free) when sitting up. */
export function tableAngle(position: string, bedAngle: number): number {
  if (position === "left_lateral_decubitus" || position === "prone" || position === "sitting_dangling") return 0;
  if (position === "seated" || position === "seated_leaning_forward" || position === "standing") return 50;
  return bedAngle;
}

type Anim = { current: number };
/** Animates the table head section, the patient's trunk angle and the door toward their targets (inside the Canvas). */
function Director({ table, tableTarget, trunk, trunkTarget, door, doorTarget }: { table: Anim; tableTarget: number; trunk: Anim; trunkTarget: number; door: Anim; doorTarget: number }) {
  useFrame((_, dt) => {
    const step = (a: Anim, target: number, rate: number) => {
      const d = target - a.current;
      a.current += Math.sign(d) * Math.min(Math.abs(d), dt * rate);
    };
    const fast = QA.enabled && QA.fast;
    step(table, tableTarget, fast ? 1e6 : 55); // ~55°/s, like a powered table
    step(trunk, trunkTarget, fast ? 1e6 : 55);
    step(door, doorTarget, fast ? 1e6 : 1.4);
    QA.directorSettled = Math.abs(table.current - tableTarget) < 0.05 && Math.abs(trunk.current - trunkTarget) < 0.05 && Math.abs(door.current - doorTarget) < 0.001;
  });
  return null;
}

export default function Exam3DView(props: Exam3DViewProps) {
  // configure before children render so the patient and camera read the QA flags
  useMemo(() => configureQa(!!props.qa), [props.qa]);
  const state = useMemo(() => patientState(props.actions), [props.actions]);
  const pose = useMemo(() => poseFor(state.position, state.bedAngle, props.variant), [state.position, state.bedAngle, props.variant]);
  const quality = props.quality ?? "high";
  const inside = state.inRoom;
  const [shot, setShot] = useState<ShotState>({ current: inside ? "overview" : "corridor", previous: null });
  const [goalKey, setGoalKey] = useState(0);
  const [hover, setHover] = useState<BodyHit | null>(null);
  const [hold, setHold] = useState<Hold | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const [pupilScale, setPupilScale] = useState(1);
  const [jerk, setJerk] = useState<{ bone: string; amount: number; at: number } | null>(null);
  const [swingAt, setSwingAt] = useState<number | null>(null);
  const [sequence, setSequence] = useState<Sequence | null>(null);
  const [now, setNow] = useState(() => performance.now());
  const [washing, setWashing] = useState<number | null>(null);
  const [bedHud, setBedHud] = useState(false);
  const [tableHover, setTableHover] = useState<TableItem | null>(null);
  const [opening, setOpening] = useState(false);
  const angle = useRef({ current: tableAngle(state.position, state.bedAngle) });
  const trunk = useRef({ current: state.bedAngle });
  const door = useRef({ current: 0 });
  const [doorTarget, setDoorTarget] = useState(0);
  const playing = useRef<Playing | null>(null);
  const pending = useRef<{ hit: BodyHit } | null>(null);
  const holdRef = useRef<Hold | null>(null);
  const recorded = useRef<number | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [landmarksAt, setLandmarksAt] = useState<number | null>(null);
  useEffect(() => {
    if (landmarksAt === null) return;
    const id = setTimeout(() => setLandmarksAt(null), HINT_MS);
    return () => clearTimeout(id);
  }, [landmarksAt]);
  holdRef.current = hold;
  const byId = useMemo(() => new Map(props.regions.map((r) => [r.id, r])), [props.regions]);
  const maneuverById = useMemo(() => new Map(props.maneuvers.map((m) => [m.id, m])), [props.maneuvers]);
  const { tool } = props.tool;
  const mode = toolModeOf(props.tool);
  const hr = props.presentation.hr;
  const rr = props.presentation.rr;

  const goTo = useCallback((to: ShotId) => {
    setShot((s) => go(s, to));
    setGoalKey((k) => k + 1);
  }, []);
  const goBack = useCallback(() => {
    setShot((s) => back(s));
    setGoalKey((k) => k + 1);
    setBedHud(false);
  }, []);

  // entering (or loading a session already inside) moves the camera into the room
  useEffect(() => {
    if (inside && shot.current === "corridor") goTo("overview");
  }, [inside, shot, goTo]);
  // Esc = Back (unless typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "Escape" || (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA"))) return;
      if (document.querySelector("[data-dialog]")) return; // the open dialog handles Esc
      goBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goBack]);

  // ticking clock for the hold progress, the fork's decay and the hand wash
  useEffect(() => {
    if (!hold && !props.tool.struckAt && washing === null) return;
    const id = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(id);
  }, [hold, props.tool.struckAt, washing]);
  useEffect(() => () => playing.current?.stop(), []);
  useEffect(() => {
    playing.current?.stop();
    setHold(null);
    setCaption(null);
    if (tool !== "tuning_fork") setSequence(null);
  }, [tool]);

  const goal: CameraGoal = useMemo(() => ({ ...shotCamera(shot.current, pose), key: `${shot.current}:${goalKey}:${pose.position}:${pose.bedAngle}` }), [shot, pose, goalKey]);

  const toolRegions = useMemo(() => (tool ? regionsForTool(props.maneuvers, tool).filter((id) => ANCHOR_BY_REGION.has(id)) : []), [tool, props.maneuvers]);
  const pickable = useMemo(
    () => (tool ? toolRegions : [...new Set([...props.examinableRegionIds, ...props.prohibitedRegionIds])].filter((id) => ANCHOR_BY_REGION.has(id))),
    [tool, toolRegions, props.examinableRegionIds, props.prohibitedRegionIds],
  );
  const edema = useMemo(() => Object.fromEntries((props.presentation.visibleSigns.edema ?? []).map((e) => [e.regionId, e.grade])), [props.presentation]);
  const panelRegions = props.regions.filter((r) => r.group === "neuro");
  const backHidden = shot.current === "chest_back" && state.bedAngle < 45;
  const busy = washing !== null || opening;
  QA.busy = busy;
  const washMs = QA.enabled && QA.fast ? 250 : WASH_MS;

  // ------------------------------------------------------------------ room interactions
  const enter = async () => {
    if (inside || opening || !props.canEnter) return;
    setOpening(true);
    audioEngine.knock();
    await new Promise((r) => setTimeout(r, qaDelay(700)));
    setDoorTarget(1);
    try {
      await props.onEnter();
    } finally {
      setTimeout(
        () => {
          setDoorTarget(0);
          setOpening(false);
        },
        qaDelay(1600),
      );
    }
  };
  const onDoor = () => {
    if (!inside) void enter();
    else if (!busy) props.onLeaveRequest();
  };
  const wash = () => {
    if (!inside || busy || props.disabled) return;
    goTo("sink");
    setWashing(performance.now());
  };
  // the wash completes after WASH_MS (or Skip, practice only)
  const finishWash = useCallback(async () => {
    setWashing(null);
    await props.onWash();
  }, [props]);
  useEffect(() => {
    if (washing === null) return;
    const id = setTimeout(() => void finishWash(), washMs);
    return () => clearTimeout(id);
  }, [washing, finishWash, washMs]);
  const pickTool = (item: TableItem) => {
    const next = pickFromTable(props.tool, item);
    if (next === props.tool) {
      setCaption(item === "otoscope" ? "Otoscope / ophthalmoscope: use the Examine… menu for the ear and eye exams." : "Cotton swabs: use the Examine… menu for light-touch sensation.");
      return;
    }
    props.onToolChange(next);
    setTableHover(null);
    // back to where the student was working
    const prev = shot.previous && shot.previous !== "tool_table" && shot.previous !== "sink" ? shot.previous : "overview";
    goTo(prev);
  };
  const stepBed = (dir: 1 | -1) => {
    const i = BED_STOPS.indexOf(state.position);
    const cur = i < 0 ? 0 : i;
    const next = BED_STOPS[Math.max(0, Math.min(BED_STOPS.length - 1, cur + dir))]!;
    if (next !== state.position) props.onBed(next);
  };

  // ------------------------------------------------------------------ body clicks (no tool)
  const onBodyClick = (h: BodyHit) => {
    if (props.disabled || busy) return;
    const region = h.regionId ? byId.get(h.regionId) : undefined;
    if (region && props.prohibitedRegionIds.has(region.id)) return props.onProhibited(region);
    const focus = region ? focusShotFor(region.group, region.id) : null;
    if (focus && shot.current !== focus) return goTo(focus);
    if (!region) return setCaption("Nothing to examine there.");
    if (region.verbal) return props.onDescribe(region);
    props.onRegionClick(region);
  };

  // ------------------------------------------------------------------ tools
  const snap = (point: Vec3) => snapToAnchor(point, toolRegions, pose);

  /** Where a placement lands relative to the hidden anchors (nothing about them is shown). */
  const contact = (point: Vec3) => {
    const s = snap(point);
    if (!s) return null;
    return { ...s, outcome: contactOutcome(s.distanceCm, s.toleranceCm, s.regionId) };
  };

  const logContact = (h: Hold, durationMs: number) => {
    if (!tool) return;
    void props.onToolContact({ tool, toolMode: mode, maneuverId: h.maneuverId, nearestRegionId: h.regionId, distanceCm: h.distanceCm, toleranceCm: h.toleranceCm, durationMs, outcome: h.outcome });
  };

  const startListening = async (h: Hold) => {
    setHold(h);
    const sound = contactSound(h.outcome, h.distanceCm, h.toleranceCm);
    if (!sound) {
      setCaption("No sound here");
      return;
    }
    // inside or near the anchor: the case's own sound; elsewhere on the chest/back: generic normal sounds
    const body = h.outcome === "background" ? { background: backgroundKind(h.regionId) } : { maneuverId: h.maneuverId, regionId: h.regionId };
    const res = await fetch(`/api/sessions/${props.sessionId}/listen`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const { audio } = res?.ok ? ((await res.json()) as { audio: AudioSpec | null }) : { audio: null };
    if (holdRef.current?.startedAt !== h.startedAt) return; // released already
    setCaption(audio ? (h.outcome === "finding" ? captionFor(audio) : "Faint, distant sounds") : "No sound here");
    if (audio) {
      playing.current = await audioEngine.loop(audio, { hr, rr, attenuation: sound.attenuation, lowpassHz: sound.lowpassHz });
      if (holdRef.current?.startedAt !== h.startedAt) playing.current.stop();
    }
  };

  // a stethoscope held inside the tolerance records its finding after MIN_LISTEN_MS
  const recordRef = useRef<(h: Hold) => void>(() => undefined);
  recordRef.current = (h) => {
    if (!tool || holdRef.current?.startedAt !== h.startedAt) return;
    recorded.current = h.startedAt;
    // the picked exam is used on other regions; here, the next hold asks again
    const pick = rememberedHold.current.get(holdKey(props.maneuvers, tool, mode, h.regionId));
    if (pick?.maneuverId === h.maneuverId) pick.done.push(h.regionId);
    void props.onToolExamine({ regionId: h.regionId, maneuverId: h.maneuverId, tool, toolMode: mode, placementError: h.error, distanceCm: h.distanceCm, toleranceCm: h.toleranceCm, durationMs: MIN_LISTEN_MS });
  };
  useEffect(() => {
    if (!hold || hold.outcome !== "finding") return;
    const h = hold;
    const id = setTimeout(() => recordRef.current(h), MIN_LISTEN_MS);
    return () => clearTimeout(id);
  }, [hold]);

  const endListening = () => {
    const h = holdRef.current;
    playing.current?.stop();
    playing.current = null;
    setHold(null);
    if (!h) return;
    const durationMs = performance.now() - h.startedAt;
    logContact(h, durationMs);
    if (h.outcome === "finding" && recorded.current !== h.startedAt && !recordsFinding(h.outcome, durationMs, "stethoscope")) setCaption("Listen a little longer to be sure.");
  };

  // several stethoscope exams on one spot (bowel sounds / bruits): ask once, then remember the pick
  const rememberedHold = useRef(new Map<string, RememberedHold>());
  const pendingAsk = useRef<{ regionId: string; ids: string[]; key: string } | null>(null);
  const [listeningFor, setListeningFor] = useState<string | null>(null);
  const askWhichHold = (a: { regionId: string; ids: string[]; key: string }) =>
    void props.onToolAmbiguous(a.regionId, a.ids).then((picked) => {
      if (!picked) return;
      rememberedHold.current.set(a.key, { maneuverId: picked, done: [] });
      setListeningFor(maneuverById.get(picked)?.label ?? picked);
      setCaption(`Now hold the stethoscope in place to listen (${maneuverById.get(picked)?.label ?? picked}).`);
    });
  const holdAt = (hit: BodyHit, c: NonNullable<ReturnType<typeof contact>>): Hold | null => {
    if (!tool) return null;
    const key = holdKey(props.maneuvers, tool, mode, c.regionId);
    const choice = holdCandidate(props.maneuvers, tool, mode, c.regionId, rememberedHold.current.get(key));
    const maneuverId = choice && "maneuverId" in choice ? choice.maneuverId : null;
    recordDecision({ regionId: c.regionId, maneuverId, distanceCm: c.distanceCm, toleranceCm: c.toleranceCm, outcome: c.outcome, hold: true, ...(choice && "ask" in choice ? { ask: choice.ask } : {}) });
    if (choice && "ask" in choice) {
      // asked on release (a dialog opened mid-press would take the same press as an outside click)
      pendingAsk.current = { regionId: c.regionId, ids: choice.ask, key };
      return null;
    }
    if (!maneuverId) return null;
    return { regionId: c.regionId, maneuverId, error: c.error, distanceCm: c.distanceCm, toleranceCm: c.toleranceCm, outcome: c.outcome, point: hit.point, startedAt: performance.now() };
  };

  const onToolDown = (hit: BodyHit) => {
    if (!tool || props.disabled || busy) return;
    const c = contact(hit.point);
    if (!c) return;
    if (tool === "stethoscope") {
      const h = holdAt(hit, c);
      if (h) void startListening(h);
    } else {
      pending.current = { hit };
    }
  };

  const onToolMove = (hit: BodyHit) => {
    const h = holdRef.current;
    if (!h || !tool) return;
    const c = contact(hit.point);
    if (!c) return;
    // slid to another anchor or across a tolerance band: log the last spot and listen afresh
    if (c.regionId !== h.regionId || c.outcome !== h.outcome) {
      endListening();
      const next = holdAt(hit, c);
      if (next) void startListening(next);
    }
  };

  const onToolUp = () => {
    const ask = pendingAsk.current;
    pendingAsk.current = null;
    if (holdRef.current) {
      endListening();
      return;
    }
    if (ask) {
      askWhichHold(ask);
      return;
    }
    const p = pending.current;
    pending.current = null;
    if (p) void instantTool(p.hit.point);
  };

  const instantTool = async (point: Vec3) => {
    if (!tool) return;
    const d = decidePlacement({ point, tool, mode, maneuvers: props.maneuvers, toolRegions, pose });
    recordDecision(d ? { ...d } : { none: true });
    if (!d) return;
    const s = { regionId: d.regionId, toleranceCm: d.toleranceCm };
    const { distanceCm, outcome } = d;
    if (tool === "reflex_hammer") setSwingAt(performance.now());
    if (outcome !== "finding") {
      void props.onToolContact({ tool, toolMode: mode, maneuverId: d.maneuverId, nearestRegionId: s.regionId, distanceCm, toleranceCm: s.toleranceCm, durationMs: 0, outcome });
      setCaption("Nothing notable here.");
      return;
    }
    let maneuverId: string | null = d.maneuverId;
    if (d.candidates.length > 1) maneuverId = await props.onToolAmbiguous(s.regionId, d.candidates);
    if (!maneuverId) return;
    const m = maneuverById.get(maneuverId)!;
    const error = d.error;
    const step = m.interaction === "sequence" ? d.stepId : undefined;
    void props.onToolContact({ tool, toolMode: mode, maneuverId, nearestRegionId: s.regionId, distanceCm, toleranceCm: s.toleranceCm, durationMs: 0, outcome });
    const action = await props.onToolExamine({ regionId: s.regionId, maneuverId, tool, toolMode: mode, placementError: error, distanceCm, toleranceCm: s.toleranceCm, ...(step ? { step } : {}) });
    if (!action || action.type !== "examine") return;
    const result = action.result;
    if (tool === "tuning_fork" && result?.audio && "generator" in result.audio && result.audio.generator === "tone") {
      const toneSpec = result.audio;
      if (m.interaction === "sequence") {
        setSequence((q) => (q && q.maneuverId === m.id && q.regionId === s.regionId ? { ...q, done: [...q.done, step ?? ""], tone: toneSpec } : { maneuverId: m.id, regionId: s.regionId, done: [step ?? ""], tone: toneSpec }));
      }
      playTone(toneSpec, m.interaction !== "sequence");
    }
    if (tool === "reflex_hammer" && JERK_BONE[s.regionId]) setJerk({ bone: JERK_BONE[s.regionId]!, amount: result?.visual?.reflex ?? 2, at: performance.now() / 1000 });
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
  const holdMs = hold ? Math.max(0, now - hold.startedAt) : 0;
  const cursor: CursorPoint | null = tool && hover ? { point: hover.point, normal: hover.normal } : null;
  const crumbs = breadcrumb(shot.current);
  const showLandmarks = () => {
    setLandmarksAt(performance.now());
    props.onLandmarksHint?.(SHOTS[shot.current].label);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="relative min-h-[380px] flex-1 overflow-hidden rounded-md bg-slate-100" data-testid="exam3d" data-camera={shot.current}>
        <Canvas
          dpr={quality === "high" ? [1, 1.5] : 1}
          shadows={quality === "high" ? "percentage" : false}
          camera={{ fov: 45, near: 0.02, far: 30, position: goal.position as Vec3 }}
          gl={{ antialias: quality === "high" }}
          onCreated={({ gl }) => {
            // a lost GPU context (driver reset, memory pressure) would otherwise leave a blank canvas
            gl.domElement.addEventListener("webglcontextlost", (e) => {
              e.preventDefault();
              setContextLost(true);
            });
            gl.domElement.addEventListener("webglcontextrestored", () => setContextLost(false));
          }}
        >
          <color attach="background" args={["#e9eff2"]} />
          <hemisphereLight args={["#ffffff", "#b8c4cc", 1.05]} />
          <directionalLight
            position={[-1.6, 2.6, 1.4]}
            intensity={1.5}
            castShadow={quality === "high"}
            shadow-mapSize={quality === "high" ? [2048, 2048] : [512, 512]}
            shadow-camera-left={-2.5}
            shadow-camera-right={2.5}
            shadow-camera-top={2.5}
            shadow-camera-bottom={-2.5}
            shadow-bias={-0.0004}
          />
          <directionalLight position={[2, 2, -1]} intensity={0.35} />
          <Director table={angle.current} tableTarget={tableAngle(state.position, state.bedAngle)} trunk={trunk.current} trunkTarget={state.bedAngle} door={door.current} doorTarget={doorTarget} />
          <ExamRoom
            angle={angle.current}
            door={door.current}
            onDoor={onDoor}
            onSink={inside ? wash : undefined}
            onToolTable={inside && !busy ? () => goTo("tool_table") : undefined}
            onStool={
              inside && !busy
                ? () => {
                    if (!state.seated) props.onSit();
                    goTo("seated");
                  }
                : undefined
            }
            onHeadControl={inside && !busy && !props.disabled ? () => setBedHud(true) : undefined}
            sanitiser={inside ? { progress: 0, clean: state.handsClean, start: wash, cancel: () => undefined, disabled: props.disabled } : undefined}
            toolTable={{ hovered: tableHover, inHand: itemInHand(props.tool), interactive: shot.current === "tool_table" && !busy, onHover: setTableHover, onPick: pickTool }}
          />
          <Suspense fallback={null}>
            <Patient3D
              pose={pose}
              variant={props.variant}
              speaking={!!props.speaking}
              quality={quality}
              drape={state.drape}
              rr={rr}
              hr={hr}
              laboured={props.presentation.visibleSigns.breathing === "laboured"}
              jvpCm={props.presentation.visibleSigns.jvpCm ?? 0}
              edema={edema}
              pupilScale={pupilScale}
              angle={trunk.current}
              jerk={jerk}
              pickableRegionIds={pickable}
              toolActive={!!tool && inside}
              onBodyClick={onBodyClick}
              onToolDown={onToolDown}
              onToolMove={onToolMove}
              onToolUp={onToolUp}
              onHover={setHover}
            />
            <Drapes pose={pose} drape={state.drape} onDrape={inside && !props.disabled ? props.onDrape : undefined} />
          </Suspense>
          {tool && <ToolCursor tool={tool} at={cursor} toolMode={mode} swingAt={swingAt} vibrating={!!props.tool.struckAt && forkElapsed < 12} />}
          {washing !== null && <HandWash startedAt={washing} durationMs={washMs} />}
          <FpsMeter />
          <ShotCamera goal={goal} freeLook={SHOTS[shot.current].freeLook} enabled={!hold} />
          {props.qa && <TestHook pose={pose} shot={shot.current} />}
          {landmarksAt !== null && <LandmarkHints shot={shot.current} pose={pose} shownAt={landmarksAt} />}
        </Canvas>

        <LoadingOverlay />
        {contextLost && (
          <div role="alert" className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-slate-100/95 p-4 text-center text-sm">
            <p className="font-medium">The 3D view lost its graphics context.</p>
            <p className="text-xs text-slate-600">Try the Low graphics setting, or reload the page. Your session is saved.</p>
          </div>
        )}
        {/* breadcrumb, Back, and a keyboard route to every shot */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 text-xs" data-testid="breadcrumb">
          {SHOTS[shot.current].parent && (
            <button type="button" onClick={goBack} className="rounded-md bg-white/95 px-2 py-1 shadow hover:bg-white" aria-label="Back (Esc)">
              ← Back
            </button>
          )}
          <span className="rounded-md bg-white/90 px-2 py-1 text-slate-700 shadow">{crumbs.join(" › ")}</span>
          {inside && (
            <label className="rounded-md bg-white/90 px-1.5 py-0.5 shadow">
              <span className="sr-only">Camera shot</span>
              <select aria-label="Camera shot" value={shot.current} onChange={(e) => goTo(e.target.value as ShotId)} className="bg-transparent text-xs">
                {(Object.keys(SHOTS) as ShotId[])
                  .filter((id) => id !== "corridor")
                  .map((id) => (
                    <option key={id} value={id}>
                      {SHOTS[id].label}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {inside && props.mode === "practice" && props.onLandmarksHint && (
            <button type="button" onClick={showLandmarks} className="rounded-md bg-white/95 px-2 py-1 shadow hover:bg-white" data-testid="show-landmarks">
              Show landmarks
            </button>
          )}
        </div>
        {!inside && (
          <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center">
            <div className="rounded-lg bg-white/95 px-4 py-2 text-center text-sm shadow" data-testid="corridor">
              <p className="text-slate-700">{props.canEnter ? "Read the door instructions, then knock on the door to enter." : "Wait for the announcement before you begin."}</p>
              <button type="button" disabled={!props.canEnter || opening} onClick={() => void enter()} className="mt-1.5 rounded-md bg-cyan-700 px-4 py-1.5 font-medium text-white disabled:opacity-50">
                Knock and enter
              </button>
            </div>
          </div>
        )}
        {washing !== null && (
          <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center" data-testid="washing">
            <div className="flex items-center gap-3 rounded-lg bg-white/95 px-4 py-2 text-sm shadow">
              <span>Cleaning hands… {Math.max(0, Math.ceil((washMs - (now - washing)) / 1000))} s</span>
              {props.mode === "practice" && (
                <button type="button" onClick={() => void finishWash()} className="text-xs text-cyan-700 underline">
                  Skip
                </button>
              )}
            </div>
          </div>
        )}
        {bedHud && (
          <Dialog id="bed-hud" kind="popover" title="Head of the table" onClose={() => setBedHud(false)} className="absolute top-12 left-2 z-10 rounded-lg bg-white/95 p-2 text-xs shadow" panelProps={{ "data-testid": "bed-hud" }}>
            <div className="flex gap-1">
              <button type="button" onClick={() => stepBed(1)} className="rounded border border-slate-300 px-2 py-1">
                ▲ Raise
              </button>
              <button type="button" onClick={() => stepBed(-1)} className="rounded border border-slate-300 px-2 py-1">
                ▼ Lower
              </button>
              <button type="button" onClick={() => setBedHud(false)} className="px-2 py-1 text-slate-500">
                Done
              </button>
            </div>
          </Dialog>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-sm text-slate-700" aria-live="polite">
          {inside && !washing && (hover?.regionId && !tool ? byId.get(hover.regionId)?.label : !tool ? "Click the patient to move closer · click again to examine · drag to look around" : "")}
        </div>
        {(hold || caption) && (
          <div className="pointer-events-none absolute top-12 left-1/2 w-[min(92%,26rem)] -translate-x-1/2 rounded-md bg-white/95 px-3 py-2 text-sm shadow" data-testid="sound-caption" aria-live="polite">
            {hold && (
              <>
                <p className="text-xs text-slate-500">Listening · {(holdMs / 1000).toFixed(1)} s</p>
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
            The back is against the table. Ask the patient to sit up (or raise the head of the table) to examine it.
          </p>
        )}
      </div>

      {inside && (
        <ToolHud
          state={props.tool}
          onChange={props.onToolChange}
          disabled={props.disabled}
          onOpenTable={() => goTo("tool_table")}
          listeningFor={
            listeningFor
              ? {
                  label: listeningFor,
                  onChange: () => {
                    rememberedHold.current.clear();
                    setListeningFor(null);
                    setCaption("Hold the stethoscope where several exams fit to choose again.");
                  },
                }
              : null
          }
        />
      )}

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

      {inside && (
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
      )}
    </div>
  );
}
