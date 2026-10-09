"use client";
/**
 * Manual BP cuff panel: aneroid dial, bulb, release valve and a "record reading" form. The physics
 * live in the pure model (bpCuff.ts); this component only runs its clock with requestAnimationFrame
 * and draws it. Not a popup: the parent places the panel.
 *
 * Screen readers: the visible readout is not a live region (it changes every 2 mmHg and would talk
 * over the Korotkoff sounds). A polite status speaks only on a squeeze, a valve change, every 10 mmHg
 * while deflating (at most once a second), or on demand with "Read gauge".
 */
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createCuff, gaugeReading, readingQuality, setValve, squeeze, tick, VALVE, MAX_MMHG, type CuffState, type ReadingQuality } from "./bpCuff";

export interface BpRecord {
  systolic: number;
  diastolic: number;
  quality: ReadingQuality;
  peak: number;
}

export interface BpGaugeProps {
  /** called whenever the cuff pressure changes (mmHg, unrounded) */
  onPressure?: (mmHg: number) => void;
  onRecord: (r: BpRecord) => void;
  onClose: () => void;
  /** stop the clock (paused encounter, tests) */
  frozen?: boolean;
  /** QA fast mode: run the cuff this many times faster (rates are judged in cuff time, so they stay 2–3 mmHg/s) */
  timeScale?: number;
  /** the true reading (case vitals) used to judge technique; defaults to the values the student records */
  reference?: { systolic: number; diastolic: number };
}

type ValveKey = keyof typeof VALVE;
const VALVE_BUTTONS: { key: ValveKey; label: string; testId: string }[] = [
  { key: "closed", label: "Closed", testId: "bp-valve-closed" },
  { key: "slow", label: "Slow release", testId: "bp-valve-slow" },
  { key: "open", label: "Open", testId: "bp-valve-open" },
];

/** 1° of arc per mmHg: 0 sits at about 7 o'clock, 150 at 12 o'clock, 300 at about 5 o'clock. */
const angleFor = (mmHg: number) => -150 + Math.max(0, Math.min(MAX_MMHG, mmHg));
const C = 100;
function polar(deg: number, r: number) {
  const a = (deg * Math.PI) / 180;
  return { x: C + r * Math.sin(a), y: C - r * Math.cos(a) };
}

const TICKS = Array.from({ length: MAX_MMHG / 2 + 1 }, (_, i) => i * 2);
/** while deflating, speak the pressure each time it passes a multiple of this (mmHg) … */
const ANNOUNCE_STEP_MMHG = 10;
/** … but at most this often (s) */
const ANNOUNCE_MIN_GAP_S = 1;
/** the step changes when the gauge reaches 170, 160, … on the way down */
const announceStep = (pressure: number) => Math.ceil(gaugeReading(pressure) / ANNOUNCE_STEP_MMHG);

function Dial({ pressure }: { pressure: number }) {
  return (
    <svg viewBox="0 0 200 200" className="h-44 w-44" aria-hidden="true" focusable="false">
      <circle cx={C} cy={C} r={92} className="fill-slate-100 stroke-slate-400" strokeWidth={3} />
      <circle cx={C} cy={C} r={86} className="fill-white" />
      {TICKS.map((v) => {
        const major = v % 20 === 0;
        const medium = v % 10 === 0;
        const len = major ? 11 : medium ? 8 : 4;
        const a = polar(angleFor(v), 84);
        const b = polar(angleFor(v), 84 - len);
        return <line key={v} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="stroke-slate-700" strokeWidth={major ? 1.6 : medium ? 1.1 : 0.6} />;
      })}
      {TICKS.filter((v) => v % 20 === 0).map((v) => {
        const p = polar(angleFor(v), 62);
        return (
          <text key={v} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" className="fill-slate-800" fontSize={9}>
            {v}
          </text>
        );
      })}
      <text x={C} y={C + 34} textAnchor="middle" className="fill-slate-500" fontSize={8}>
        mmHg
      </text>
      <g transform={`rotate(${angleFor(pressure)} ${C} ${C})`}>
        <line x1={C} y1={C + 14} x2={C} y2={C - 78} className="stroke-red-600" strokeWidth={2} strokeLinecap="round" />
      </g>
      <circle cx={C} cy={C} r={5} className="fill-slate-800" />
    </svg>
  );
}

export function BpGauge({ onPressure, onRecord, onClose, frozen = false, reference, timeScale = 1 }: BpGaugeProps) {
  const cuff = useRef<CuffState>(createCuff());
  const [snap, setSnap] = useState<CuffState>(cuff.current);
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [error, setError] = useState<{ message: string; sys: boolean; dia: boolean } | null>(null);
  const [status, setStatus] = useState("");
  const onPressureRef = useRef(onPressure);
  const lastSpoken = useRef({ t: Number.NEGATIVE_INFINITY, step: 0 });
  const ids = useId();
  const errorId = `${ids}-error`;

  /** polite status; the same text twice gets a trailing no-break space so it is announced again */
  const announce = useCallback((text: string, c: CuffState) => {
    lastSpoken.current = { t: c.t, step: announceStep(c.pressure) };
    setStatus((prev) => (prev === text ? `${text}\u00a0` : text));
  }, []);

  useEffect(() => {
    onPressureRef.current = onPressure;
  });

  const commit = (next: CuffState) => {
    const changed = Math.abs(next.pressure - cuff.current.pressure) > 1e-6;
    cuff.current = next;
    setSnap(next);
    if (changed) onPressureRef.current?.(next.pressure);
  };

  useEffect(() => {
    if (frozen) return;
    let raf = 0;
    let last: number | null = null;
    const step = (now: number) => {
      const dt = last === null ? 0 : Math.min(0.1, (now - last) / 1000); // a hidden tab must not dump the cuff
      last = now;
      const next = tick(cuff.current, dt * timeScale);
      const moved = Math.abs(next.pressure - cuff.current.pressure) > 1e-6;
      cuff.current = next;
      if (moved) {
        setSnap(next);
        onPressureRef.current?.(next.pressure);
        const spoken = lastSpoken.current;
        if (announceStep(next.pressure) < spoken.step && next.t - spoken.t >= ANNOUNCE_MIN_GAP_S) announce(`${gaugeReading(next.pressure)} mmHg`, next);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [frozen, announce, timeScale]);

  const valveKey: ValveKey | null = VALVE_BUTTONS.find((b) => VALVE[b.key] === snap.valve)?.key ?? null;
  const reading = gaugeReading(snap.pressure);

  const doSqueeze = () => {
    const next = squeeze(cuff.current);
    commit(next);
    announce(`${gaugeReading(next.pressure)} mmHg`, next);
  };
  const doValve = (b: (typeof VALVE_BUTTONS)[number]) => {
    const next = setValve(cuff.current, VALVE[b.key]);
    commit(next);
    announce(`Valve ${b.label.toLowerCase()}, ${gaugeReading(next.pressure)} mmHg`, next);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const s = Number(systolic);
    const d = Number(diastolic);
    const badSys = systolic.trim() === "" || !Number.isInteger(s) || s < 40 || s > 300;
    const badDia = diastolic.trim() === "" || !Number.isInteger(d) || d < 20 || d > 200;
    if (badSys || badDia) {
      setError({ message: "Enter whole numbers: systolic 40–300 and diastolic 20–200.", sys: badSys, dia: badDia });
      return;
    }
    if (d >= s) {
      setError({ message: "The diastolic value must be lower than the systolic value.", sys: false, dia: true });
      return;
    }
    setError(null);
    const c = cuff.current;
    const quality = readingQuality({ peak: c.peak, deflation: c.deflation, systolic: reference?.systolic ?? s, diastolic: reference?.diastolic ?? d });
    onRecord({ systolic: s, diastolic: d, quality, peak: c.peak });
  };

  return (
    <section aria-label="Blood pressure cuff" data-testid="bp-gauge" className="w-72 rounded-lg border border-line-strong bg-white/95 p-3 text-sm text-ink-2 shadow-lg">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-semibold">BP cuff</h2>
        <button type="button" aria-label="Close" onClick={onClose} className="rounded px-2 py-0.5 text-ink-3 hover:bg-subtle">
          ✕
        </button>
      </div>
      <p className="mb-2 text-xs text-ink-3">
        Pump until the pulse can no longer be felt, then about 30 mmHg more. Open the valve a little and let the needle drop 2–3 mmHg each second while you listen.
      </p>
      <div className="flex flex-col items-center">
        <Dial pressure={snap.pressure} />
        <p className="mt-1 font-mono text-base" data-testid="bp-pressure">
          {reading} mmHg
        </p>
        <p role="status" className="sr-only" data-testid="bp-status">
          {status}
        </p>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button type="button" data-testid="bp-squeeze" onClick={doSqueeze} className="rounded-md border border-slate-400 bg-subtle px-3 py-1.5 hover:bg-subtle active:bg-slate-200">
          Squeeze bulb
        </button>
        <button type="button" data-testid="bp-read" onClick={() => announce(`${gaugeReading(cuff.current.pressure)} mmHg`, cuff.current)} className="rounded-md border border-line-strong bg-white px-2 py-1.5 text-xs text-ink-2 hover:bg-subtle">
          Read gauge
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-3">Each squeeze pumps once.</p>

      <div className="mt-2 flex items-center gap-1" role="group" aria-label="Release valve">
        <span className="mr-1 text-xs text-ink-3">Valve</span>
        {VALVE_BUTTONS.map((b) => (
          <button
            key={b.key}
            type="button"
            data-testid={b.testId}
            aria-pressed={valveKey === b.key}
            onClick={() => doValve(b)}
            className={`rounded border px-2 py-0.5 text-xs ${valveKey === b.key ? "border-sky-400 bg-sky-100 text-sky-900" : "border-line-strong bg-white text-ink-3"}`}
          >
            {b.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} noValidate className="mt-3 border-t border-line pt-2" aria-label="Record reading">
        <h3 className="mb-1 text-xs font-semibold text-ink-2">Record reading</h3>
        <div className="flex items-end gap-2">
          <label htmlFor={`${ids}-sys`} className="flex flex-col text-xs">
            Systolic (mmHg)
            <input
              id={`${ids}-sys`}
              type="number"
              inputMode="numeric"
              min={40}
              max={300}
              step={1}
              value={systolic}
              onChange={(e) => setSystolic(e.target.value)}
              aria-invalid={error?.sys ? true : undefined}
              aria-describedby={error?.sys ? errorId : undefined}
              className="mt-0.5 w-20 rounded border border-line-strong px-1 py-0.5 text-sm"
            />
          </label>
          <label htmlFor={`${ids}-dia`} className="flex flex-col text-xs">
            Diastolic (mmHg)
            <input
              id={`${ids}-dia`}
              type="number"
              inputMode="numeric"
              min={20}
              max={200}
              step={1}
              value={diastolic}
              onChange={(e) => setDiastolic(e.target.value)}
              aria-invalid={error?.dia ? true : undefined}
              aria-describedby={error?.dia ? errorId : undefined}
              className="mt-0.5 w-20 rounded border border-line-strong px-1 py-0.5 text-sm"
            />
          </label>
          <button type="submit" data-testid="bp-record" className="rounded-md bg-brand px-3 py-1 text-white hover:bg-brand-strong">
            Record
          </button>
        </div>
        <p id={errorId} className="mt-1 min-h-4 text-xs text-red-700" aria-live="polite" data-testid="bp-error">
          {error?.message}
        </p>
      </form>
    </section>
  );
}
