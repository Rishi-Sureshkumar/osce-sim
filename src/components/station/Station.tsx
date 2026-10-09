"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Action, CourtesyKind, Position, PublicCase, Region, Session } from "@/domain/schemas";
import type { DrapeChange } from "@/scene/Drapes";
import type { PublicCatalog } from "@/content/types";
import { findingDisplay, labelsFrom } from "@/components/common/format";
import { examineFromClick } from "@/input/adapters/click";
import { contactFromTool, examineFromTool, type ToolContact, type ToolUse } from "@/input/adapters/tool";
import { patientState } from "@/engine/patientState";
import { toolFor } from "@/exam3d/tools/toolLogic";
import { TOOL_LABELS, type ToolState } from "@/exam3d/tools/ToolTray";
import { SettingsMenu } from "./SettingsMenu";
import { TopBar } from "./TopBar";
import { SidePanel, usePanelOpen } from "./SidePanel";
import { alertsOn } from "@/engine/mistakes";
import { ModeTimer } from "./ModeTimer";
import { PracticeHelp } from "./PracticeHelp";
import { timeIsUp } from "@/engine/practice";
import { sessionMode } from "@/domain/schemas";
import { courtesyFromToolbar } from "@/input/adapters/toolbar";
import { postAction } from "@/input/client";
import { ActionLog } from "./ActionLog";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { DoorSign } from "./DoorSign";
import { DoorPlacard } from "./DoorPlacard";
import { EncounterClock } from "./EncounterClock";
import { Notepad } from "./Notepad";
import { PenForm } from "./PenForm";
import { encounterState } from "@/engine/encounter";
import { EncounterBar } from "./EncounterBar";
import { DescribeDialog } from "./DescribeDialog";
import { SANITISE_HOLD_MS, useHold } from "./useHold";
import { FindingsPanel } from "./FindingsPanel";
import { MistakeAlerts } from "./MistakeAlerts";
import { ManeuverMenu } from "./ManeuverMenu";
import { PerformOverlay } from "./PerformOverlay";
import { ExamineMenu } from "@/exam3d/ExamineMenu";
import { Dialog } from "@/components/ui/Overlay";
import { Toast } from "@/components/ui/Toast";
import { variantFor } from "@/scene/rig";
import { useQuality } from "@/scene/quality";

const Exam3DView = dynamic(() => import("@/exam3d/Exam3DView"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[360px] flex-1 items-center justify-center rounded-md bg-subtle text-sm text-ink-3" role="status">
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
  chat?: (ctx: { actions: Action[]; append: (a: Action) => void; disabled: boolean; disabledReason?: string; onSpeaking: (speaking: boolean) => void }) => React.ReactNode;
  /** Slot for the finish/submit control. */
  finish?: (ctx: { append: (a: Action) => void; disabled: boolean; forceOpen: ForceOpen }) => React.ReactNode;
  /** QA hooks (server env QA_HOOKS=true): test hook in the 3D view, ?qa=fast|freeze */
  qa?: boolean;
}

export function Station({ session, kase, catalog, initialActions, chat, finish, qa }: StationProps) {
  const [actions, setActions] = useState<Action[]>(initialActions);
  const examinable = useMemo(() => new Set(catalog.maneuvers.flatMap((m) => m.allowedRegions)), [catalog]);
  const [selected, setSelected] = useState<Region | null>(null);
  const [performing, setPerforming] = useState<Performing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const labels = useMemo(() => labelsFrom(catalog), [catalog]);
  const ended = session.status !== "active" || actions.some((a) => a.type === "submit_ddx" || a.type === "submit_pen" || a.type === "session_end");
  const mode = sessionMode(session);
  // hide-findings mode (fixed at session start): exams with a sound or visual show what was done; the student interprets
  const hideFindings = session.settings?.findingsDisplay === "hide";
  const flow = kase.flow ?? null;
  // 1B flow: corridor → encounter → PEN, from the log (deadlines are applied by the server)
  const flowState = flow ? encounterState(actions, mode, flow, Date.now() - Date.parse(session.startedAt)) : null;
  const phase = flowState?.phase ?? null;
  const [penLock, setPenLock] = useState(false);
  const [begunBanner, setBegunBanner] = useState(false);
  const timeUp = flow ? phase === "pen" || phase === "submitted" : timeIsUp(actions);
  const state = useMemo(() => patientState(actions), [actions]);
  const left = actions.some((a) => a.type === "room" && a.payload.event === "exit");
  const outside = !state.inRoom;
  /** exam actions and chat stop outside the room, when the station ended or exam time ran out */
  const locked = ended || timeUp || outside || (!!flow && phase !== "encounter");
  // why the conversation is closed (V-PLACEHOLDER: it said "Station finished" before the encounter began)
  const chatClosed = ended || timeUp ? "Station finished" : left ? "You have left the room" : outside || (!!flow && phase !== "encounter") ? "Enter the room to talk to the patient" : undefined;
  const [entering, setEntering] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [quality, setQuality] = useQuality();
  const [leftOpen, setLeftOpen] = usePanelOpen("left");
  const [rightOpen, setRightOpen] = usePanelOpen("right");
  const [leaveNudge, setLeaveNudge] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [describe, setDescribe] = useState<Region | null>(null);
  const prohibited = useMemo(() => new Set((kase.doorInstructions?.prohibitedExams ?? []).flatMap((p) => p.regionIds)), [kase]);
  // the door instructions, printed on the placard in the 3D corridor too
  const placard = useMemo(() => {
    const p = kase.patient;
    const v = kase.vitals;
    const d = kase.doorInstructions;
    return [
      `${p.name}, ${p.age}`,
      `Reason for visit: ${d?.reasonForVisit ?? p.chiefComplaint}`,
      `BP ${v.bpSystolic}/${v.bpDiastolic} · HR ${v.hr} · RR ${v.rr} · T ${v.tempC.toFixed(1)} °C · SpO₂ ${v.spo2}%`,
      `Task: ${d?.task ?? kase.doorSign.task}`,
    ];
  }, [kase]);

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
  // when the encounter locks (left the room, time up, auto-end, submitted) no exam popup may stay open
  useEffect(() => {
    if (!locked) return;
    setSelected(null);
    setPerforming(null);
    setDescribe(null);
    setConfirmLeave(false);
    setChoice((c) => {
      c?.resolve(null);
      return null;
    });
  }, [locked]);
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
  const onDrape = (changes: DrapeChange[]) =>
    run(async () => {
      for (const { section, covered } of changes) await post({ type: "state_change", source: "click", payload: { drape: { section, covered }, via: "direct" } });
    });
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

  // ---- 1B flow: "You may begin", warnings, deadlines
  /** the server applies any passed deadline and returns the log (the flow may have moved on without this page) */
  const resync = async (): Promise<Action[]> => {
    const res = await fetch(`/api/sessions/${session.id}/tick`, { method: "POST" });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Could not reach the server");
    setActions(body.actions as Action[]);
    return body.actions as Action[];
  };
  const begin = () =>
    run(async () => {
      try {
        await post({ type: "timer", source: mode === "practice" ? "system" : "click", payload: { event: "begin" } });
      } catch (e) {
        // already begun: a page reloaded straight after opening reads the log before the first load's
        // "begin" lands, so the server refuses this one; pick up its log instead of waiting forever
        const log = await resync();
        if (log.some((a) => a.type === "timer" && a.payload.event === "begin")) return;
        throw e;
      }
      setBegunBanner(true);
      setTimeout(() => setBegunBanner(false), 4000);
      try {
        if (mode === "exam" && "speechSynthesis" in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance("You may begin."));
      } catch {
        /* no speech: the banner is enough */
      }
    });
  const autoBegun = useRef(false);
  useEffect(() => {
    // practice: no proctor — the encounter begins as soon as the station opens
    if (flow && mode === "practice" && phase === "corridor" && !autoBegun.current) {
      autoBegun.current = true;
      void begin();
    }
  });
  const onFlowWarning = (event: "encounter_warning" | "pen_warning") =>
    run(async () => {
      await post({ type: "timer", source: "system", payload: { event } });
      setToast(event === "encounter_warning" ? "5 minutes remaining." : "2 minutes remaining for the note.");
    });
  const onDeadline = (which: "encounter" | "pen") => {
    if (which === "pen") return setPenLock(true);
    void run(async () => {
      await resync();
      setSelected(null);
      setPerforming(null);
      setTool((t) => ({ ...t, tool: null }));
    });
  };

  const whole = catalog.regions.filter((r) => r.group === "whole");

  if (flow && (phase === "pen" || (phase === "submitted" && !ended))) {
    return (
      <div className="flex flex-col">
        <TopBar
          title={kase.title}
          subtitle={`${session.studentLabel} · Post-encounter note`}
          mode={mode}
          hideFindings={hideFindings}
          clock={<EncounterClock mode={mode} startedAt={session.startedAt} limits={flow} actions={actions} onWarning={onFlowWarning} onDeadline={onDeadline} />}
          settings={<SettingsMenu quality={quality} onQuality={setQuality} hideFindings={hideFindings} alerts={alertsOn(session.settings, mode)} />}
        />
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 p-3">
          {error && (
            <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">
              {error}
            </p>
          )}
          {toast && <Toast message={toast} onDismiss={() => setToast(null)} tone="warn" />}
          <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
            <PenForm sessionId={session.id} initial={session.penDraft} lockNow={penLock || !!flowState?.locked} endReason={flowState?.endReason ?? null} />
            <div className="space-y-3">
              <Notepad sessionId={session.id} />
              <DoorPlacard kase={kase} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // time up / left the room (no 1B flow): the presentation step replaces the room (not a dialog)
  const forcedFinish: ForceOpen = !flow && !ended ? (timeUp ? "time_up" : left ? "left_room" : null) : null;
  if (forcedFinish) {
    return (
      <div className="flex flex-col">
        <TopBar
          title={kase.title}
          subtitle={`${session.studentLabel} · Presentation`}
          mode={mode}
          hideFindings={hideFindings}
          clock={<ModeTimer mode={mode} startedAt={session.startedAt} limitSeconds={kase.timeLimitSeconds} actions={actions} stopped={ended || timeUp} onTimerEvent={onTimerEvent} />}
          settings={<SettingsMenu quality={quality} onQuality={setQuality} hideFindings={hideFindings} alerts={alertsOn(session.settings, mode)} />}
        />
        <div className="mx-auto flex w-full max-w-[900px] flex-col items-center gap-3 p-3">
          {error && (
            <p role="alert" className="w-full rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">
              {error}
            </p>
          )}
          <p role="status" className="w-full rounded-md bg-subtle px-3 py-2 text-sm text-ink-2">
            {forcedFinish === "time_up" ? "Time is up. The examination is closed." : "You have left the room."} Present your summary, differential and plan.
          </p>
          {finish?.({ append, disabled: false, forceOpen: forcedFinish })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:h-[calc(100vh-30px)]">
      <TopBar
        title={kase.title}
        subtitle={`${session.studentLabel} · ${kase.mode === "screening" ? "Screening exam" : "Case encounter"}`}
        mode={mode}
        hideFindings={hideFindings}
        clock={
          flow ? (
            <EncounterClock mode={mode} startedAt={session.startedAt} limits={flow} actions={actions} onWarning={onFlowWarning} onDeadline={onDeadline} />
          ) : (
            <ModeTimer mode={mode} startedAt={session.startedAt} limitSeconds={kase.timeLimitSeconds} actions={actions} stopped={ended || timeUp} onTimerEvent={onTimerEvent} />
          )
        }
        settings={<SettingsMenu quality={quality} onQuality={setQuality} hideFindings={hideFindings} alerts={alertsOn(session.settings, mode)} />}
        onLeave={!left && !outside ? () => setConfirmLeave(true) : undefined}
        leaveDisabled={locked}
        end={
          flow && ended ? (
            <a href={`/results/${session.id}`} className="flex h-8 items-center rounded-md bg-ink px-4 text-sm font-medium text-white">
              View results
            </a>
          ) : (
            !flow && finish?.({ append, disabled: ended, forceOpen: null })
          )
        }
      />
      <div className="mx-auto flex min-h-0 w-full max-w-[1680px] flex-1 flex-col gap-2 p-3">
        {error && (
          <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">
            {error}
          </p>
        )}

        {begunBanner && (
          <p role="status" className="rounded-md bg-ok px-3 py-2 text-center text-sm font-semibold text-white" data-testid="begin-banner">
            You may begin.
          </p>
        )}
        {confirmLeave && (
          <Dialog id="leave-confirm" kind="confirm" title="Leave the room?" onClose={() => setConfirmLeave(false)} className="w-full max-w-sm space-y-3 rounded-lg bg-surface p-5 shadow-2">
            <p className="text-sm text-ink-3">Leaving ends the encounter. No re-entry.</p>
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
                className="rounded-md bg-ink px-4 py-1.5 text-sm font-medium text-white"
              >
                Leave
              </button>
            </div>
          </Dialog>
        )}
        {describe && <DescribeDialog region={describe} onSubmit={onDescribeSubmit} onClose={() => setDescribe(null)} />}
        {!left && !outside && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <EncounterBar state={state} disabled={locked} sanitise={sanitise} onBed={onBed} onDrape={onDrape} onMenu={onCourtesy} />
            </div>
            {mode === "practice" && !locked && <PracticeHelp sessionId={session.id} append={append} disabled={locked} />}
          </div>
        )}
        {(left || outside) && mode === "practice" && !locked && <PracticeHelp sessionId={session.id} append={append} disabled={locked} />}
        {leaveNudge && !left && (
          <p className="rounded-md bg-brand-soft px-3 py-2 text-sm text-brand-strong" role="status" data-testid="leave-nudge">
            {leaveNudge}
            <button type="button" className="ml-2 underline" onClick={() => void leave()}>
              Leave anyway
            </button>
          </p>
        )}

        <div className={`grid min-h-0 flex-1 grid-cols-1 gap-3 ${leftOpen ? "lg:[--left:minmax(264px,300px)]" : "lg:[--left:2.5rem]"} ${rightOpen ? "lg:[--right:minmax(264px,300px)]" : "lg:[--right:2.5rem]"} lg:grid-cols-[var(--left)_minmax(0,1fr)_var(--right)]`}>
          <SidePanel side="left" label="conversation and door notes" open={leftOpen} onToggle={setLeftOpen}>
            {flow ? (
              <DoorPlacard kase={kase} collapsible={state.inRoom}>
                {phase === "corridor" && mode === "exam" && (
                  <button type="button" onClick={() => void begin()} className="mt-3 w-full rounded-md bg-ok px-3 py-2 text-sm font-semibold text-white" data-testid="begin">
                    You may begin
                  </button>
                )}
                {phase === "corridor" && mode === "exam" && <p className="mt-1 text-xs text-ink-3">Stands in for the proctor&apos;s announcement. The door opens once the encounter begins.</p>}
              </DoorPlacard>
            ) : (
              <DoorSign kase={kase} />
            )}
            <Notepad sessionId={session.id} />
            <ErrorBoundary label="conversation panel">{chat?.({ actions, append, disabled: locked, disabledReason: chatClosed, onSpeaking: setSpeaking })}</ErrorBoundary>
          </SidePanel>

          <div className="flex min-h-0 flex-col gap-2 rounded-lg border border-line bg-surface p-2 shadow-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ExamineMenu regions={catalog.regions} onPick={onRegionClick} disabled={locked || blocking} />
              <div className="flex gap-1">
                {whole.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => onRegionClick(r)}
                    disabled={locked}
                    className={`h-7 rounded-md border px-2 text-xs ${selected?.id === r.id ? "border-brand bg-brand-soft text-brand-strong" : "border-line-strong text-ink-2 hover:bg-subtle"}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative flex min-h-0 flex-1 flex-col">
              <ErrorBoundary label="3D exam view">
              <Exam3DView
                  sessionId={session.id}
                  bp={{ systolic: kase.vitals.bpSystolic, diastolic: kase.vitals.bpDiastolic }}
                  qa={qa}
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
                  revealCaptions={!hideFindings}
                  canEnter={!ended && !timeUp && !left && !entering && (!flow || phase === "encounter")}
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
                placard={placard}
                  selectedRegionId={selected?.id}
                  performingRegionId={blocking ? performing?.regionId : null}
                  examinedRegionIds={examined}
                  disabled={locked || blocking}
                  onRegionClick={onRegionClick}
                />
              </ErrorBoundary>
              {/* cards sit at the bottom right of the view and grow upward, never taller than it (V-PERFORMCLIP:
                  the finding was cut off at the bottom); kept clear of the abdomen and chest targets above */}
              <div className={`absolute right-2 bottom-10 z-10 max-h-[calc(100%-6rem)] w-80 max-w-[90%] overflow-y-auto ${performing?.kind === "tool" && !choice ? "pointer-events-none [&_button]:pointer-events-auto" : ""}`}>
                {toast && !selected && !choice && performing?.kind !== "menu" && <Toast message={toast} onDismiss={() => setToast(null)} className="mb-2" />}
                {choice ? (
                  <ManeuverMenu
                    dialogId="tool-chooser"
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

          <SidePanel side="right" label="findings and log" open={rightOpen} onToggle={setRightOpen}>
            <div className="grid min-h-0 flex-1 grid-rows-[1.5fr_1fr] gap-2">
              <div className="flex min-h-0 flex-col gap-2">
                <MistakeAlerts actions={actions} />
                <FindingsPanel
                  actions={actions}
                  labels={labels}
                  hide={hideFindings}
                  onInterpret={
                    locked
                      ? undefined
                      : (exam, text) => run(async () => post({ type: "interpretation", source: "text", payload: { examActionId: exam.id, regionId: exam.payload.regionId, maneuverId: exam.payload.maneuverId, text } }))
                  }
                />
              </div>
              <ActionLog actions={actions} labels={labels} />
            </div>
          </SidePanel>
        </div>
      </div>
    </div>
  );
}
