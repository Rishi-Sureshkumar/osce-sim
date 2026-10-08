import Link from "next/link";
import { ClipboardCheck, DoorOpen, MessagesSquare, Stethoscope } from "lucide-react";
import { getContent, toPublicCase } from "@/content/load";
import { CasePicker } from "@/components/home/CasePicker";
import { BlurFade } from "@/components/ui/BlurFade";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { VitalsMonitor } from "@/components/home/VitalsMonitor";

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: DoorOpen, title: "Door instructions", body: "Read the placard: patient, vitals, task and exams to avoid." },
  { icon: MessagesSquare, title: "Focused history", body: "Interview the standardised patient by typing or speaking." },
  { icon: Stethoscope, title: "Physical exam", body: "Wash hands, position, drape and examine in the 3D room." },
  { icon: ClipboardCheck, title: "Note & feedback", body: "Write your differential and plan, then review the mark sheet." },
] as const;

export default function Home() {
  const content = getContent();
  const cases = content.cases.map(toPublicCase);
  const stats = [
    { label: "Stations", value: cases.length },
    { label: "Exam maneuvers", value: content.maneuvers.length },
    { label: "Body regions", value: content.regions.filter((r) => !r.hidden).length },
  ];
  return (
    <main className="mx-auto max-w-[1200px] px-4 pt-10 pb-16 sm:px-6">
      <BlurFade>
      <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)]">
        <div className="max-w-2xl">
          <p className="eyebrow text-cyan-700">Clinical skills · Objective structured clinical examination</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.025em] text-slate-900 sm:text-5xl sm:leading-[1.05]">OSCE Simulator</h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
            Practise a station end to end: take a history, examine the patient, present your differential, and get feedback against the mark sheet.
          </p>
          <dl className="mt-7 inline-flex divide-x divide-slate-200 rounded-lg border border-slate-200 bg-white shadow-card">
            {stats.map((s) => (
              <div key={s.label} className="px-5 py-2.5">
                <dt className="text-[11px] text-slate-500">{s.label}</dt>
                <dd className="mt-0.5 font-mono text-xl font-medium tracking-tight text-slate-900 tabular-nums">
                  <NumberTicker value={s.value} />
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            Tip: press <kbd className="rounded border border-slate-200 bg-white px-1 font-mono text-[10px] text-slate-600">⌘K</kbd> to jump to any station.
          </p>
        </div>
        <VitalsMonitor />
      </section>
      </BlurFade>

      <BlurFade delay={0.08}>
      <ol className="mt-8 grid overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card sm:grid-cols-2 lg:grid-cols-4" aria-label="How a station runs">
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative flex gap-3 border-slate-200 p-4 max-lg:[&:nth-child(-n+2)]:border-b max-sm:border-b sm:[&:nth-child(odd)]:border-r lg:border-r lg:last:border-r-0">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-700 ring-1 ring-slate-200">
              <s.icon aria-hidden className="size-[18px]" />
            </span>
            <span>
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span className="kbd-num text-xs font-medium text-slate-400">0{i + 1}</span>
                {s.title}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>
      </BlurFade>

      <BlurFade delay={0.16}>
        <CasePicker cases={cases} />
      </BlurFade>

      <p className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-500">
        Faculty or coach? Open the{" "}
        <Link href="/coach" className="font-medium text-cyan-700 underline-offset-2 hover:underline">
          coach view
        </Link>{" "}
        to review sessions and override scores (needs the coach code).
      </p>
    </main>
  );
}
