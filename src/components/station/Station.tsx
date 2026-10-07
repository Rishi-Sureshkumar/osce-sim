"use client";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Action, CourtesyKind, DrapeZone, Position, PublicCase, Region, Session } from "@/domain/schemas";
import type { PublicCatalog } from "@/content/types";
import { findingDisplay, labelsFrom } from "@/components/common/format";
import { examineFromClick } from "@/input/adapters/click";
import { contactFromTool, examineFromTool, type ToolContact, type ToolUse } from "@/input/adapters/tool";
import { patientState } from "@/engine/patientState";
import { toolFor } from "@/exam3d/tools/toolLogic";
import { TOOL_LABELS, type ToolState } from "@/exam3d/tools/ToolTray";
import { AudioControls } from "./AudioControls";
import { ModeTimer } from "./ModeTimer";
import { PracticeHelp } from "./PracticeHelp";
import { timeIsUp } from "@/engine/practice";
import { sessionMode } from "@/domain/schemas";
import { courtesyFromToolbar } from "@/input/adapters/toolbar";
import { postAction } from "@/input/client";
import { ActionLog } from "./ActionLog";
import { DoorSign } from "./DoorSign";
import { EncounterBar } from "./EncounterBar";
import { DescribeDialog } from "./DescribeDialog";
import { SANITISE_HOLD_MS, useHold } from "./useHold";
import { FindingsPanel } from "./FindingsPanel";
import { ManeuverMenu } from "./ManeuverMenu";
import { PerformOverlay } from "./PerformOverlay";
import { ExamineMenu } from "@/exam3d/ExamineMenu";
import { variantFor } from "@/scene/rig";
import { useQuality } from "@/scene/quality";

const Exam3DView = dynamic(() => import("@/exam3d/Exam3DView"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[360px] flex-1 items-center justify-center rounded-md bg-slate-100 text-sm text-slate-600" role="status">
      Loading 3D patient…
    </div>
  ),
});


/** menu performs block the view until "Continue"; tool findings are non-blocking cards */
type Performing = { regionId: string; title: string; steps: string[]; finding: string | null; kind: "menu" | "tool" };

/** why the presentation step opened by itself (it can't be dismissed) */
export type ForceOpen = "time_up" | "left_room" | null;

export interface StationProps {
  session: Session;
  kase: PublicCase;
  catalog: PublicCatalog;
  initialActions: Action[];
  /** Slot for the chat panel. */
  chat?: (ctx: { actions: Action[]; append: (a: Action) => void; disabled: boolean; onSpeaking: (speaking: boolean) => void }) => React.ReactNode;
  /** Slot for the finish/submit control. */
  finish?: (ctx: { append: (a: Action) => void; disabled: boolean; forceOpen: ForceOpen }) => React.ReactNode;
}

export function Station({ session, kase, catalog, initialActions, chat, finish }: StationProps) {
  const [actions, setActions] = useState<Action[]>(initialActions);
  const examinable = useMemo(() => new Set(catalog.maneuvers.flatMap((m) => m.allowedRegions)), [catalog]);
  const [selected, setSelected] = useState<Region | null>(null);
  const [performing, setPerforming] = useState<Performing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const labels = useMemo(() => labelsFrom(catalog), [catalog]);
  const ended = session.status !== "active" || actions.some((a) => a.type === "submit_ddx" || a.type === "session_end");
  const mode = sessionMode(session);
  const timeUp = timeIsUp(actions);
  const state = useMemo(() => patientState(actions), [actions]);
  const left = actions.some((a) => a.type === "room" && a.payload.event === "exit");
  const outside = !state.inRoom;
  /** exam actions and chat stop outside the room, when the station ended or exam time ran out */
  const locked = ended || timeUp || outside;
  const [entering, setEntering] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [quality, setQuality] = useQuality();
  const [leaveNudge, setLeaveNudge] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [describe, setDescribe] = useState<Region | null>(null);
  const prohibited = useMemo(() => new Set((kase.doorInstructions?.prohibitedExams ?? []).flatMap((p) => p.regionIds)), [kase]);

  const append = (a: Action) => setActions((xs) => [...xs, a]);
  const appendAll = (list: Action[]) => {
    setActions((xs) => [...xs, ...list]);
    const nudge = list.find((a) => a.type === "hint" && a.payload.kind === "nudge");
    if (nudge?.type === "hint") setToast(nudge.payload.text);
  };
  const onTimerEvent = (event: "pause" | "resume" | "warning" | "auto_end") =>
    run(async () => {
      appendAll((await postAction(session.id, { type: "timer", source: event === "pause" || event === "resume" ? "click" : "system", payload: { event } })).appended);
      if (event === "warning") setToast("Two minutes left.");
      if (event === "auto_end") {
        setToast(null);
        setSelected(null);
        setPerforming(null);
      }
    });
  const onShowMe = (m: PublicCatalog["maneuvers"][number]) =>
    run(async () => {
      appendAll((await postAction(session.id, { type: "hint", source: "click", payload: { kind: "show_me", text: `Show me how: ${m.label}`, maneuverId: m.id } })).appended);
      setPerforming({ regionId: selected?.id ?? "", title: `How to: ${m.label}`, steps: m.demo.steps, finding: "Demonstration only. Nothing was examined; choose the exam to perform it.", kind: "menu" });
      setSelected(null);
    });
  const examined = useMemo(
    () => new Set(actions.flatMap((a) => (a.type === "examine" ? [a.payload.regionId] : []))),
    [actions],
  );
  const [tool, setTool] = useState<ToolState>({ tool: null, stethMode: "diaphragm", forkFreq: "512", struckAt: null });
  const [choice, setChoice] = useState<{ region: Region; ids: string[]; resolve: (id: string | null) => void } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const maneuverById = useMemo(() => new Map(catalog.maneuvers.map((m) => [m.id, m])), [catalog]);
  const regionById = useMemo(() => new Map(catalog.regions.map((r) => [r.id, r])), [catalog]);

  /** Log a tool use from the 3D view and show its finding. */
  const onToolExamine = async (u: ToolUse): Promise<Action | null> => {
    setError(null);
    try {
      const { action, appended } = await postAction(session.id, examineFromTool(u));
      appendAll(appended);
      if (action.type === "examine") {
        const m = maneuverById.get(u.maneuverId);
        setPerforming({ regionId: u.regionId, title: `${m?.label ?? u.maneuverId} — ${regionById.get(u.regionId)?.label ?? u.regionId}`, steps: [], finding: findingDisplay(action, labels), kind: "tool" });
      }
      return action;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  };

  // logged silently: the student's log never shows contacts (or their distances) during the encounter
  const onToolContact = async (c: ToolContact) => {
    try {
      await postAction(session.id, contactFromTool(c));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onToolAmbiguous = (regionId: string, ids: string[]) =>
    new Promise<string | null>((resolve) => {
      const region = regionById.get(regionId);
      if (!region) return resolve(null);
      setChoice({ region, ids, resolve });
    });

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const blocking = performing?.kind === "menu";
  const onRegionClick = (r: Region) => {
    if (blocking) return;
    if (performing) setPerforming(null);
    setSelected(r);
  };

  const onChoose = (m: PublicCatalog["maneuvers"][number]) =>
    run(async () => {
      if (!selected) return;
      // In 3D, maneuvers that need an instrument are done with it: pick up the tool instead.
      const needs = toolFor(m);
      if (needs && needs !== "hands") {
        setTool((t) => ({
          ...t,
          tool: needs,
          ...(m.toolMode === "bell" || m.toolMode === "diaphragm" ? { stethMode: m.toolMode } : {}),
          ...(m.toolMode === "128" || m.toolMode === "512" ? { forkFreq: m.toolMode } : {}),
        }));
        setToast(`${TOOL_LABELS[needs]}${m.toolMode ? ` (${m.toolMode})` : ""} ready — use it on the patient.`);
        setSelected(null);
        return;
      }
      const regionId = selected.id;
      setPerforming({ regionId, title: `${m.label} — ${selected.label}`, steps: m.demo.steps, finding: null, kind: "menu" });
      setSelected(null);
      try {
        const { action, appended } = await postAction(session.id, examineFromClick(regionId, m.id));
        appendAll(appended);
        if (action.type === "examine") setPerforming((p) => (p ? { ...p, finding: findingDisplay(action, labels) } : p));
      } catch (e) {
        setPerforming(null);
        throw e;
      }
    });

  const onCourtesy = (kind: CourtesyKind, position?: Position) =>
    run(async () => appendAll((await postAction(session.id, courtesyFromToolbar(kind, position))).appended));

  // ---- room entry, hand hygiene, bed and drape (direct manipulation), leaving
  const post = async (a: Parameters<typeof postAction>[1]) => appendAll((await postAction(session.id, a)).appended);
  const onEnter = () =>
    run(async () => {
      setEntering(true);
      try {
        await post({ type: "room", source: "click", payload: { event: "knock" } });
        await post({ type: "room", source: "click", payload: { event: "enter" } });
      } finally {
        setEntering(false);
      }
    });
  const onWash = () =>
    run(async () => {
      await post({ type: "courtesy", source: "click", payload: { kind: "hand_hygiene" } });
      setToast("Hands cleaned.");
    });
  const onSit = () => void run(() => post({ type: "sit_down", source: "click", payload: {} }));
  const onProhibited = (r: Region) =>
    void run(async () => {
      await post({ type: "prohibited_attempt", source: "click", payload: { regionId: r.id } });
      setToast(`${r.label}: not performed in this encounter (see the door instructions).`);
    });
  const onDescribeSubmit = async (text: string, source: "text" | "voice") => {
    if (!describe) return;
    await run(() => post({ type: "describe_exam", source, payload: { regionId: describe.id, text } }));
    setToast(`${describe.label}: description noted.`);
    setDescribe(null);
  };
  const sanitise = useHold(SANITISE_HOLD_MS, () =>
    void run(async () => {
      await post({ type: "courtesy", source: "click", payload: { kind: "hand_hygiene" } });
      setToast("Hands cleaned.");
    }),
  );
  const onBed = (position: Position) => run(() => post({ type: "state_change", source: "click", payload: { position, via: "direct" } }));
  const onDrape = (zone: DrapeZone, covered: boolean) => run(() => post({ type: "state_change", source: "click", payload: { drape: { zone, covered }, via: "direct" } }));
  const leave = () =>
    run(async () => {
      setLeaveNudge(null);
      await post({ type: "room", source: "click", payload: { event: "exit" } });
      setSelected(null);
      setPerforming(null);
      setTool((t) => ({ ...t, tool: null }));
    });
  const onLeave = () => {
    if (mode !== "practice") return leave();
    // practice: one reminder (logged) before leaving without a goodbye or exit hand hygiene
    const lastTouch = actions.findLastIndex((a) => a.type === "examine" && a.payload.touch !== false);
    const lastClean = actions.findLastIndex((a) => a.type === "courtesy" && a.payload.kind === "hand_hygiene");
    const saidBye = actions.some((a) => a.type === "say" && a.payload.tags?.some((t) => t.tag === "closing"));
    const tips = [!saidBye && "say goodbye to the patient", lastTouch > lastClean && "clean your hands on the way out"].filter(Boolean);
    if (!tips.length || leaveNudge) return leave();
    const text = `Before you leave: ${tips.join(" and ")}.`;
    setLeaveNudge(text);
    return run(async () => {
      const { appended } = await postAction(session.id, { type: "hint", source: "system", payload: { kind: "nudge", text } });
      setActions((xs) => [...xs, ...appended]);
    });
  };

  const whole = catalog.regions.filter((r) => r.group === "whole");

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-3 p-3 lg:h-[calc(100vh-30px)]">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{kase.title}</h1>
          <p className="text-xs text-slate-500">
            {session.studentLabel} · {kase.mode === "screening" ? "Screening exam" : "Case encounter"} ·{" "}
            <span className={`rounded px-1.5 py-0.5 font-semibold ${mode === "practice" ? "bg-emerald-100 text-emerald-900" : "bg-slate-800 text-white"}`} data-testid="mode-badge">
              {mode === "practice" ? "Practice" : "Exam"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AudioControls />
          <label className="flex items-center gap-1 text-xs text-slate-600">
            Graphics
            <select aria-label="Graphics quality" value={quality} onChange={(e) => setQuality(e.target.value as "high" | "low")} className="rounded border border-slate-300 bg-white px-1 py-0.5">
              <option value="high">High</option>
              <option value="low">Low</option>
            </select>
          </label>
          <ModeTimer mode={mode} startedAt={session.startedAt} limitSeconds={kase.timeLimitSeconds} actions={actions} stopped={ended || timeUp} onTimerEvent={onTimerEvent} />
          {finish?.({ append, disabled: ended, forceOpen: ended ? null : timeUp ? "time_up" : left ? "left_room" : null })}
        </div>
      </header>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {timeUp && !ended && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          Time is up. The examination is closed. Present your summary, differential and plan.
        </p>
      )}
      {confirmLeave && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 p-4" role="dialog" aria-modal="true" aria-labelledby="leave-h">
          <div className="w-full max-w-sm space-y-3 rounded-lg bg-white p-5 shadow-xl">
            <h2 id="leave-h" className="font-semibold">
              Leave the room?
            </h2>
            <p className="text-sm text-slate-600">Leaving ends the encounter. No re-entry.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmLeave(false)} className="rounded-md px-3 py-1.5 text-sm">
                Stay
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmLeave(false);
                  void onLeave();
                }}
                className="rounded-md bg-slate-800 px-4 py-1.5 text-sm font-medium text-white"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
      {describe && <DescribeDialog region={describe} onSubmit={onDescribeSubmit} onClose={() => setDescribe(null)} />}
      {left && !ended && (
        <p role="status" className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-800">
          You have left the room. Present your summary, differential and plan.
        </p>
      )}
      {mode === "practice" && !locked && <PracticeHelp sessionId={session.id} append={append} disabled={locked} />}
      {!left && !outside && <EncounterBar state={state} disabled={locked} sanitise={sanitise} onBed={onBed} onDrape={onDrape} onMenu={onCourtesy} onLeave={() => setConfirmLeave(true)} />}
      {leaveNudge && !left && (
        <p className="rounded-md bg-cyan-50 px-3 py-2 text-sm text-cyan-900" role="status" data-testid="leave-nudge">
          {leaveNudge}
          <button type="button" className="ml-2 underline" onClick={() => void leave()}>
            Leave anyway
          </button>
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(250px,0.8fr)_minmax(460px,2fr)_minmax(250px,0.8fr)]">
        <div className="flex min-h-0 flex-col gap-3">
          <DoorSign kase={kase} />
          {chat?.({ actions, append, disabled: locked, onSpeaking: setSpeaking })}
        </div>

        <div className="flex min-h-0 flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ExamineMenu regions={catalog.regions} onPick={onRegionClick} disabled={locked || blocking} />
            <div className="flex gap-1">
              {whole.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onRegionClick(r)}
                  disabled={locked}
                  className={`rounded-md border px-2 py-1 text-xs ${selected?.id === r.id ? "border-cyan-700 bg-cyan-50" : "border-slate-300"}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col">
            <Exam3DView
                sessionId={session.id}
                maneuvers={catalog.maneuvers}
                tool={tool}
                onToolChange={(t) => {
                  setTool(t);
                  setToast(null);
                }}
                onToolExamine={onToolExamine}
                onToolAmbiguous={onToolAmbiguous}
                onToolContact={onToolContact}
                onLandmarksHint={mode === "practice" ? (where) => void run(async () => appendAll((await postAction(session.id, { type: "hint", source: "click", payload: { kind: "hint", text: `Showed landmarks: ${where}` } })).appended)) : undefined}
                mode={mode}
                canEnter={!ended && !timeUp && !left && !entering}
                onEnter={onEnter}
                onWash={onWash}
                onSit={onSit}
                onBed={onBed}
                onDrape={onDrape}
                onLeaveRequest={() => setConfirmLeave(true)}
                onDescribe={(r) => setDescribe(r)}
                onProhibited={onProhibited}
                prohibitedRegionIds={prohibited}
                variant={variantFor(kase.patient.sex)}
                speaking={speaking}
                quality={quality}
                regions={catalog.regions}
                examinableRegionIds={examinable}
                actions={actions}
                presentation={kase.presentation}
                selectedRegionId={selected?.id}
                performingRegionId={blocking ? performing?.regionId : null}
                examinedRegionIds={examined}
                disabled={locked || blocking}
                onRegionClick={onRegionClick}
              />
            <div className={`absolute right-2 z-10 w-72 max-w-[90%] bottom-28 max-h-[45%] overflow-y-auto ${performing?.kind === "tool" && !choice ? "pointer-events-none [&_button]:pointer-events-auto" : ""}`}>
              {toast && !selected && !choice && performing?.kind !== "menu" && (
                <p className="mb-2 rounded-md bg-cyan-50 px-3 py-2 text-sm text-cyan-900 shadow" role="status">
                  {toast}
                </p>
              )}
              {choice ? (
                <ManeuverMenu
                  region={choice.region}
                  maneuvers={catalog.maneuvers.filter((m) => choice.ids.includes(m.id))}
                  busy={false}
                  onChoose={(m) => {
                    choice.resolve(m.id);
                    setChoice(null);
                  }}
                  onClose={() => {
                    choice.resolve(null);
                    setChoice(null);
                  }}
                />
              ) : performing ? (
                <PerformOverlay
                  title={performing.title}
                  steps={performing.steps}
                  finding={performing.finding}
                  onDone={() => setPerforming(null)}
                />
              ) : selected ? (
                <ManeuverMenu region={selected} maneuvers={catalog.maneuvers} busy={!!performing} onChoose={onChoose} onShowMe={mode === "practice" ? onShowMe : undefined} onClose={() => setSelected(null)} />
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid min-h-0 grid-rows-[1.4fr_1fr] gap-3">
          <FindingsPanel actions={actions} labels={labels} />
          <ActionLog actions={actions} labels={labels} />
        </div>
      </div>
    </div>
  );
}
