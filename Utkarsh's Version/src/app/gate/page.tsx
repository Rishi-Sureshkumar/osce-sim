import { CheckCircle2 } from "lucide-react";
import { LogoMark } from "@/components/common/AppHeader";
import { BackgroundPaths } from "@/components/ui/BackgroundPaths";
import { GateForm } from "./GateForm";

const POINTS = ["Standardised patient with deterministic replies", "3D exam room with real instruments and sounds", "Scored against your school's OSCE mark sheet"];

export default async function GatePage({ searchParams }: { searchParams: Promise<{ next?: string; coach?: string }> }) {
  const { next, coach } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return (
    <main className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-[1200px] items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2">
      <section className="relative hidden min-h-[440px] overflow-hidden rounded-2xl bg-[#0f1623] p-10 text-white shadow-pop lg:flex lg:flex-col lg:justify-end">
        <BackgroundPaths className="text-[#5e8ef0]" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[#0f1623] via-[#0f1623]/85 to-transparent" />
        <div className="relative">
        <p className="eyebrow text-[#95b6f8]">Clinical skills training</p>
        <p className="mt-3 text-[2rem] leading-tight font-semibold tracking-tight text-balance text-white">
          Rehearse the station before the real one.
        </p>
        <ul className="mt-6 space-y-3">
          {POINTS.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-[15px] text-white/70">
              <CheckCircle2 aria-hidden className="mt-0.5 size-[18px] shrink-0 text-[#4cc98a]" />
              {p}
            </li>
          ))}
        </ul>
        </div>
      </section>
      <section className="card mx-auto w-full max-w-sm p-7">
        <LogoMark className="size-10" />
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">OSCE Simulator</h1>
        <p className="mt-1 text-sm text-slate-600">{coach ? "This page needs the coach access code." : "Enter the access code you were given."}</p>
        <GateForm next={safeNext} />
      </section>
    </main>
  );
}
