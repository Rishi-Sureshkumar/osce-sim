"use client";
import type { PublicCase } from "@/domain/schemas";
import { DoorSign } from "./DoorSign";

/** Outside the room: read the door sign, then knock and enter (both logged as `room` actions). */
export function RoomDoor({ kase, busy, onEnter }: { kase: PublicCase; busy: boolean; onEnter: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 py-10" data-testid="room-door">
      <div className="w-full rounded-xl border-4 border-slate-400 bg-slate-50 p-4 shadow-inner">
        <p className="mb-2 text-center text-xs tracking-widest text-slate-500 uppercase">Exam room</p>
        <DoorSign kase={kase} />
      </div>
      <p className="text-sm text-slate-600">Read the door sign. When you are ready, knock and go in.</p>
      <button type="button" disabled={busy} onClick={onEnter} className="rounded-md bg-cyan-700 px-5 py-2.5 font-medium text-white hover:bg-cyan-800 disabled:opacity-50">
        Knock and enter
      </button>
    </div>
  );
}
