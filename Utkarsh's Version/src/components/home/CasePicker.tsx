"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, ClipboardList, Clock, Eye, EyeOff, FileText, Loader2, MapPin, Stethoscope, Timer, User } from "lucide-react";
import type { PublicCase } from "@/domain/schemas";
import { Magnetic } from "@/components/ui/Magnetic";

const SEX: Record<string, string> = { male: "M", female: "F" };

/** "Outpatient clinic, seated in a chair" → "Outpatient clinic" */
const shortSetting = (s: string) => s.split(",")[0]!.trim();

function OptionCard({
  name,
  value,
  checked,
  onChange,
  label,
  help,
  icon: Icon,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  help: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${checked ? "border-cyan-600 bg-cyan-50/70 ring-1 ring-cyan-600" : "border-slate-200 bg-white hover:border-slate-300"}`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 size-4 shrink-0 cursor-pointer appearance-none rounded-full border border-slate-300 bg-white transition-all checked:border-[5px] checked:border-cyan-700"
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <Icon aria-hidden className={`size-4 ${checked ? "text-cyan-700" : "text-slate-400"}`} />
          {label}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">{help}</span>
      </span>
    </label>
  );
}

export function CasePicker({ cases }: { cases: PublicCase[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"practice" | "exam">("practice");
  const [findings, setFindings] = useState<"show" | "hide">("show");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (caseId: string) => {
    setBusy(caseId);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, studentLabel: name, mode, findingsDisplay: findings }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not start the session");
      router.push(`/station/${body.sessionId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  return (
    <div className="mt-10 grid items-start gap-6 lg:grid-cols-[340px_1fr]">
      <aside aria-labelledby="setup-h" className="card space-y-5 p-5 lg:sticky lg:top-16">
        <div>
          <h2 id="setup-h" className="text-base font-semibold text-slate-900">
            Session setup
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">Applies to the station you start next.</p>
        </div>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Your name or alias</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Sam P." className="input mt-1.5" />
        </label>
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Mode</legend>
          <div className="mt-1.5 grid gap-2">
            <OptionCard
              name="mode"
              value="practice"
              checked={mode === "practice"}
              onChange={() => setMode("practice")}
              icon={Timer}
              label="Practice (untimed)"
              help="Timer counts up and can pause. Hints, technique demos, nudges and progress checks are available. Scored, labelled practice."
            />
            <OptionCard
              name="mode"
              value="exam"
              checked={mode === "exam"}
              onChange={() => setMode("exam")}
              icon={Clock}
              label="Exam (timed)"
              help="Countdown from the station's time limit with a 2-minute warning; ends automatically. No help. Feedback only at the end."
            />
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Findings</legend>
          <div className="mt-1.5 grid gap-2">
            <OptionCard name="findings" value="show" checked={findings === "show"} onChange={() => setFindings("show")} icon={Eye} label="Show findings" help="Each exam tells you what you found." />
            <OptionCard
              name="findings"
              value="hide"
              checked={findings === "hide"}
              onChange={() => setFindings("hide")}
              icon={EyeOff}
              label="Hide findings (interpret)"
              help="You hear and see what the exam produces (sounds, movements, pupils) and write what you notice. Text-only findings are still shown."
            />
          </div>
        </fieldset>
      </aside>

      <section aria-labelledby="library-h">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="library-h" className="text-base font-semibold text-slate-900">
              Station library
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {cases.length} stations · synthetic patients · scored against the school mark sheet
            </p>
          </div>
          <span className={`badge ${mode === "practice" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-900 text-white"}`}>
            {mode === "practice" ? "Practice mode" : "Exam mode"}
          </span>
        </div>
        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {cases.map((c) => {
            const screening = c.mode === "screening";
            const Icon = screening ? ClipboardList : Stethoscope;
            return (
              <li key={c.id} className="card group flex flex-col p-5 transition-shadow hover:shadow-raised">
                <div className="flex items-start justify-between gap-3">
                  <span className={`flex size-10 items-center justify-center rounded-lg ${screening ? "bg-sky-50 text-sky-700" : "bg-cyan-50 text-cyan-700"}`}>
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <span className={`badge ring-1 ${screening ? "bg-sky-50 text-sky-800 ring-sky-200" : "bg-cyan-50 text-cyan-800 ring-cyan-200"}`}>
                    {screening ? "Screening exam" : "Case encounter"}
                  </span>
                </div>
                <h3 className="mt-4 text-[15px] leading-snug font-semibold text-slate-900">{c.title}</h3>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-slate-600">{c.patient.chiefComplaint}</p>
                <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <dt>
                      <Clock aria-hidden className="size-3.5 text-slate-400" />
                      <span className="sr-only">Time</span>
                    </dt>
                    <dd className="kbd-num">{c.flow ? `${Math.round(c.flow.encounterSeconds / 60)} min + ${Math.round(c.flow.penSeconds / 60)} min note` : `${c.doorSign.timeLimitMinutes} minutes`}</dd>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <dt>
                      <User aria-hidden className="size-3.5 text-slate-400" />
                      <span className="sr-only">Patient</span>
                    </dt>
                    <dd>
                      {c.patient.age} {SEX[c.patient.sex] ?? ""}
                    </dd>
                  </div>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <dt>
                      <MapPin aria-hidden className="size-3.5 text-slate-400" />
                      <span className="sr-only">Setting</span>
                    </dt>
                    <dd className="truncate">{shortSetting(c.patient.setting)}</dd>
                  </div>
                  {c.flow && (
                    <div className="flex items-center gap-1.5">
                      <dt>
                        <FileText aria-hidden className="size-3.5 text-slate-400" />
                        <span className="sr-only">Format</span>
                      </dt>
                      <dd>Post-encounter note</dd>
                    </div>
                  )}
                </dl>
                <Magnetic className="mt-4 w-full">
                <button onClick={() => start(c.id)} disabled={!!busy} data-case={c.id} className="btn btn-primary w-full">
                  {busy === c.id ? (
                    <>
                      <Loader2 aria-hidden className="size-4 animate-spin" />
                      Starting…
                    </>
                  ) : (
                    <>
                      Start station
                      <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>
                </Magnetic>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
