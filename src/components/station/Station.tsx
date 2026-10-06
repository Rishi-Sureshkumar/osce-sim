"use client";
import { useMemo, useState } from "react";
import type { Action, CourtesyKind, Position, PublicCase, Region, Session, View } from "@/domain/schemas";
import type { PublicCatalog } from "@/content/types";
import { BodyDiagram } from "@/components/body/BodyDiagram";
import { findingDisplay, labelsFrom } from "@/components/common/format";
import { examineFromClick } from "@/input/adapters/click";
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

type Performing = { regionId: string; title: string; steps: string[]; finding: string | null };

export interface StationProps {
  session: Session;
  kase: PublicCase;
  catalog: PublicCatalog;
  initialActions: Action[];
  /** Slot for the chat panel (M2). */
  chat?: (ctx: { append: (a: Action) => void; disabled: boolean }) => React.ReactNode;
  /** Slot for the finish/submit control (M2). */
  finish?: (ctx: { append: (a: Action) => void; disabled: boolean }) => React.ReactNode;
}

export function Station({ session, kase, catalog, initialActions, chat, finish }: StationProps) {
  const [actions, setActions] = useState<Action[]>(initialActions);
  const [view, setView] = useState<View>("anterior");
  const [selected, setSelected] = useState<Region | null>(null);
  const [performing, setPerforming] = useState<Performing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const labels = useMemo(() => labelsFrom(catalog), [catalog]);
  const ended = session.status !== "active" || actions.some((a) => a.type === "submit_ddx" || a.type === "session_end");

  const append = (a: Action) => setActions((xs) => [...xs, a]);
  const examined = useMemo(
    () => new Set(actions.flatMap((a) => (a.type === "examine" ? [a.payload.regionId] : []))),
    [actions],
  );
  const currentPosition = useMemo(() => {
    let p: Position | undefined;
    for (const a of actions) if (a.type === "courtesy" && a.payload.kind === "position") p = a.payload.position;
    return p;
  }, [actions]);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onRegionClick = (r: Region) => {
    if (performing) return;
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
      const regionId = selected.id;
      setPerforming({ regionId, title: `${m.label} — ${selected.label}`, steps: m.demo.steps, finding: null });
      setSelected(null);
      try {
        const action = await postAction(session.id, examineFromClick(regionId, m.id));
        append(action);
        if (action.type === "examine") setPerforming((p) => (p ? { ...p, finding: findingDisplay(action) } : p));
      } catch (e) {
        setPerforming(null);
        throw e;
      }
    });

  const onCourtesy = (kind: CourtesyKind, position?: Position) =>
    run(async () => append(await postAction(session.id, courtesyFromToolbar(kind, position))));

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
          {chat?.({ append, disabled: ended })}
        </div>

        <div className="flex min-h-0 flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ViewTabs view={view} onChange={(v) => (setView(v), setSelected(null))} />
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
          <div className="relative min-h-0 flex-1">
            <BodyDiagram
              view={view}
              regions={catalog.regions}
              selectedRegionId={selected?.id}
              performingRegionId={performing?.regionId}
              examinedRegionIds={examined}
              onRegionClick={ended ? () => undefined : onRegionClick}
            />
            <div className="absolute top-2 right-2 w-72 max-w-[90%]">
              {performing ? (
                <PerformOverlay title={performing.title} steps={performing.steps} finding={performing.finding} onDone={() => setPerforming(null)} />
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
