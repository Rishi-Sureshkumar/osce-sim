"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Action, AudioSpec, CourtesyKind, Position, PublicCase, Region, Session, View } from "@/domain/schemas";
import type { PublicCatalog } from "@/content/types";
import { BodyDiagram } from "@/components/body/BodyDiagram";
import { findingDisplay, labelsFrom } from "@/components/common/format";
import { examineFromClick } from "@/input/adapters/click";
import { examineFromTool, type ToolUse } from "@/input/adapters/tool";
import { patientState } from "@/engine/patientState";
import { toolFor } from "@/exam3d/tools/toolLogic";
import { TOOL_LABELS, type ToolState } from "@/exam3d/tools/ToolTray";
import { AudioControls } from "./AudioControls";
import { courtesyFromToolbar } from "@/input/adapters/toolbar";
import { postAction } from "@/input/client";
import { ActionLog } from "./ActionLog";
import { CourtesyToolbar } from "./CourtesyToolbar";
import { DoorSign } from "./DoorSign";
import { FindingsPanel } from "./FindingsPanel";
import { ManeuverMenu } from "./ManeuverMenu";
import { PerformOverlay } from "./PerformOverlay";
import { Timer } from "./Timer";
import { ViewTabs } from "./ViewTabs";

const Exam3DView = dynamic(() => import("@/exam3d/Exam3DView"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[360px] flex-1 items-center justify-center rounded-md bg-slate-100 text-sm text-slate-600" role="status">
      Loading 3D patient…
    </div>
  ),
});

type ExamView = "3d" | "2d";
const VIEW_KEY = "osce.examView";

/** menu performs block the view until "Continue"; tool findings are non-blocking cards */
type Performing = { regionId: string; title: string; steps: string[]; finding: string | null; audio?: AudioSpec; kind: "menu" | "tool" };

export interface StationProps {
  session: Session;
  kase: PublicCase;
  catalog: PublicCatalog;
  initialActions: Action[];
  /** Slot for the chat panel. */
  chat?: (ctx: { actions: Action[]; append: (a: Action) => void; disabled: boolean }) => React.ReactNode;
  /** Slot for the finish/submit control. */
  finish?: (ctx: { append: (a: Action) => void; disabled: boolean }) => React.ReactNode;
}

export function Station({ session, kase, catalog, initialActions, chat, finish }: StationProps) {
  const [actions, setActions] = useState<Action[]>(initialActions);
  const [view, setView] = useState<View>("anterior");
  const [examView, setExamView] = useState<ExamView>("3d");
  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "2d" || v === "3d") setExamView(v);
    } catch {
      /* storage unavailable: keep the default */
    }
  }, []);
  const switchView = (v: ExamView) => {
    setExamView(v);
    setSelected(null);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  };
  const examinable = useMemo(() => new Set(catalog.maneuvers.flatMap((m) => m.allowedRegions)), [catalog]);
  const [selected, setSelected] = useState<Region | null>(null);
  const [performing, setPerforming] = useState<Performing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const labels = useMemo(() => labelsFrom(catalog), [catalog]);
  const ended = session.status !== "active" || actions.some((a) => a.type === "submit_ddx" || a.type === "session_end");

  const append = (a: Action) => setActions((xs) => [...xs, a]);
  const appendAll = (list: Action[]) => setActions((xs) => [...xs, ...list]);
  const examined = useMemo(
    () => new Set(actions.flatMap((a) => (a.type === "examine" ? [a.payload.regionId] : []))),
    [actions],
  );
  const currentPosition = useMemo(() => patientState(actions).position, [actions]);
  const [tool, setTool] = useState<ToolState>({ tool: null, stethMode: "diaphragm", forkFreq: "512", struckAt: null });
  const [choice, setChoice] = useState<{ region: Region; ids: string[]; resolve: (id: string | null) => void } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const maneuverById = useMemo(() => new Map(catalog.maneuvers.map((m) => [m.id, m])), [catalog]);
  const regionById = useMemo(() => new Map(catalog.regions.map((r) => [r.id, r])), [catalog]);

  /** Log a tool use from the 3D view and show its finding. */
  const onToolExamine = async (u: ToolUse): Promise<Action | null> => {
    setError(null);
    try {
      const appended = await postAction(session.id, examineFromTool(u));
      appendAll(appended);
      const action = appended.at(-1)!;
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
    if (r.zoomTo) {
      setView(r.zoomTo);
      setSelected(null);
      return;
    }
    setSelected(r);
  };

  const onChoose = (m: PublicCatalog["maneuvers"][number]) =>
    run(async () => {
      if (!selected) return;
      // In 3D, maneuvers that need an instrument are done with it: pick up the tool instead.
      const needs = toolFor(m);
      if (examView === "3d" && needs && needs !== "hands") {
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
        const appended = await postAction(session.id, examineFromClick(regionId, m.id));
        appendAll(appended);
        const action = appended.at(-1)!;
        if (action.type === "examine") setPerforming((p) => (p ? { ...p, finding: findingDisplay(action, labels), audio: action.result?.audio } : p));
      } catch (e) {
        setPerforming(null);
        throw e;
      }
    });

  const onCourtesy = (kind: CourtesyKind, position?: Position) =>
    run(async () => appendAll(await postAction(session.id, courtesyFromToolbar(kind, position))));

  const whole = catalog.regions.filter((r) => r.view === "whole");

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-3 p-3 lg:h-[calc(100vh-30px)]">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{kase.title}</h1>
          <p className="text-xs text-slate-500">
            {session.studentLabel} · {kase.mode === "screening" ? "Screening exam" : "Case encounter"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AudioControls />
          <Timer startedAt={session.startedAt} limitMinutes={kase.doorSign.timeLimitMinutes} stopped={ended} />
          {finish?.({ append, disabled: ended })}
        </div>
      </header>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <CourtesyToolbar currentPosition={currentPosition} disabled={ended} onCourtesy={onCourtesy} />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(280px,1fr)_minmax(360px,1.3fr)_minmax(280px,1fr)]">
        <div className="flex min-h-0 flex-col gap-3">
          <DoorSign kase={kase} />
          {chat?.({ actions, append, disabled: ended })}
        </div>

        <div className="flex min-h-0 flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="radiogroup" aria-label="Exam view" className="flex overflow-hidden rounded-md border border-slate-300 text-xs">
              {(["3d", "2d"] as const).map((v) => (
                <button key={v} role="radio" aria-checked={examView === v} onClick={() => switchView(v)} className={`px-2.5 py-1 ${examView === v ? "bg-slate-800 text-white" : "bg-white"}`}>
                  {v === "3d" ? "3D patient" : "2D diagram"}
                </button>
              ))}
            </div>
            {examView === "2d" && <ViewTabs view={view} onChange={(v) => (setView(v), setSelected(null))} />}
            <div className="flex gap-1">
              {whole.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onRegionClick(r)}
                  disabled={ended}
                  className={`rounded-md border px-2 py-1 text-xs ${selected?.id === r.id ? "border-cyan-700 bg-cyan-50" : "border-slate-300"}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col">
            {examView === "3d" ? (
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
                regions={catalog.regions}
                examinableRegionIds={examinable}
                actions={actions}
                presentation={kase.presentation}
                selectedRegionId={selected?.id}
                performingRegionId={blocking ? performing?.regionId : null}
                examinedRegionIds={examined}
                disabled={ended || blocking}
                onRegionClick={onRegionClick}
              />
            ) : (
              <BodyDiagram
                view={view}
                regions={catalog.regions}
                selectedRegionId={selected?.id}
                performingRegionId={performing?.regionId}
                examinedRegionIds={examined}
                onRegionClick={ended ? () => undefined : onRegionClick}
              />
            )}
            <div className={`absolute right-2 z-10 w-72 max-w-[90%] ${examView === "3d" ? "bottom-28" : "top-2"} ${performing?.kind === "tool" && !choice ? "pointer-events-none [&_button]:pointer-events-auto" : ""}`}>
              {toast && !performing && !selected && !choice && (
                <p className="rounded-md bg-cyan-50 px-3 py-2 text-sm text-cyan-900 shadow" role="status">
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
                  audio={examView === "2d" ? performing.audio : undefined}
                  hr={kase.presentation.hr}
                  rr={kase.presentation.rr}
                  onDone={() => setPerforming(null)}
                />
              ) : selected ? (
                <ManeuverMenu region={selected} maneuvers={catalog.maneuvers} busy={!!performing} onChoose={onChoose} onClose={() => setSelected(null)} />
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
