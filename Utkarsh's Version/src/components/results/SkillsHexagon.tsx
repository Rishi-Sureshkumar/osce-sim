import type { SheetView } from "@/server/results";

/**
 * Six-axis skills profile (stat-hexagon style). Mark-sheet sections are grouped into six display
 * buckets by name, with the sheet's domain/kind as the fallback, so new sections land somewhere
 * without code changes. Display only: scoring is untouched.
 */
const AXES = ["History", "Physical exam", "Note & reasoning", "Organisation", "Professionalism", "Communication"] as const;
type Axis = (typeof AXES)[number];

function axisFor(section: string, sheet: SheetView["sheet"]): Axis {
  if (/courtesy|hygiene|consent|privacy|drap/i.test(section)) return "Professionalism";
  if (/timing|organi[sz]/i.test(section)) return "Organisation";
  if (/^pen\b|post-encounter|differential|diagnos/i.test(section)) return "Note & reasoning";
  if (/history|medication|allerg|family|social|review of systems/i.test(section)) return "History";
  if (sheet.domain === "communication") return "Communication";
  return sheet.kind === "exam" ? "Physical exam" : "History";
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function SkillsHexagon({ sheets, passMark = 0.7 }: { sheets: SheetView[]; passMark?: number }) {
  const tally = new Map<Axis, { points: number; max: number }>(AXES.map((a) => [a, { points: 0, max: 0 }]));
  for (const { sheet, scores } of sheets) {
    const section = new Map(sheet.items.map((i) => [i.id, i.section]));
    for (const s of scores) {
      if (s.status === "not_assessable" || !(s.maxPoints > 0)) continue;
      const t = tally.get(axisFor(section.get(s.itemId) ?? "", sheet))!;
      t.points += s.points;
      t.max += s.maxPoints;
    }
  }
  const axes = AXES.map((name) => {
    const t = tally.get(name)!;
    return { name, points: t.points, max: t.max, value: t.max > 0 ? Math.min(1, t.points / t.max) : null };
  });
  const scored = axes.filter((a) => a.value !== null) as { name: Axis; points: number; max: number; value: number }[];
  if (scored.length < 3) return null;
  const best = scored.reduce((a, b) => (b.value > a.value ? b : a));
  const worst = scored.reduce((a, b) => (b.value < a.value ? b : a));

  const W = 520;
  const H = 330;
  const cx = W / 2;
  const cy = H / 2 + 4;
  const R = 100;
  const at = (i: number, r: number) => {
    const a = ((-90 + i * 60) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  const ring = (f: number) => AXES.map((_, i) => at(i, R * f).join(",")).join(" ");
  const data = axes.map((a, i) => at(i, R * Math.max(0.04, a.value ?? 0)).join(",")).join(" ");

  return (
    <section aria-labelledby="skills-h" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <div className="grid items-center gap-2 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-[520px]" role="img" aria-label={axes.map((a) => `${a.name} ${a.value === null ? "not scored" : pct(a.value)}`).join(", ")}>
          {/* frame and grid */}
          <polygon points={ring(1.08)} className="fill-slate-50 stroke-slate-300" strokeWidth={5} strokeLinejoin="round" />
          {[1, 0.75, 0.5, 0.25].map((f) => (
            <polygon key={f} points={ring(f)} fill="none" className="stroke-slate-200" strokeWidth={1} />
          ))}
          {AXES.map((_, i) => {
            const [x, y] = at(i, R);
            return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="stroke-slate-200" strokeWidth={1} />;
          })}
          {/* pass mark */}
          <polygon points={ring(passMark)} fill="none" className="stroke-amber-500" strokeWidth={1.25} strokeDasharray="4 4" opacity={0.8} />
          {/* the student's profile */}
          <g className="radar-grow" style={{ transformOrigin: `${cx}px ${cy}px` }}>
            <polygon points={data} className="fill-cyan-500 stroke-cyan-600" fillOpacity={0.22} strokeWidth={2} strokeLinejoin="round" />
            {axes.map((a, i) => {
              const [x, y] = at(i, R * Math.max(0.04, a.value ?? 0));
              return <circle key={a.name} cx={x} cy={y} r={3.5} className="fill-white stroke-cyan-600" strokeWidth={2} />;
            })}
          </g>
          {/* vertex labels: name, then the value */}
          {axes.map((a, i) => {
            const [x, y] = at(i, R + 34);
            const anchor = Math.abs(x - cx) < 4 ? "middle" : x > cx ? "start" : "end";
            const dx = anchor === "start" ? -8 : anchor === "end" ? 8 : 0;
            const tone = a === best ? "fill-emerald-600" : a === worst ? "fill-amber-600" : "fill-slate-900";
            return (
              <g key={a.name}>
                <text x={x + dx} y={y - 6} textAnchor={anchor} className="fill-slate-500 text-[11px] font-semibold tracking-wide uppercase">
                  {a.name}
                </text>
                <text x={x + dx} y={y + 12} textAnchor={anchor} className={`font-mono text-[17px] font-semibold ${a.value === null ? "fill-slate-400" : tone}`}>
                  {a.value === null ? "—" : pct(a.value)}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="space-y-4 p-6 md:pl-0">
          <div>
            <h2 id="skills-h" className="text-[15px] font-semibold text-slate-900">
              Skills profile
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">Mark-sheet items grouped into six areas. Dashed line: pass mark ({pct(passMark)}).</p>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <dt className="text-[11px] font-semibold tracking-wide text-emerald-700 uppercase">Strongest</dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-900">{best.name}</dd>
              <dd className="font-mono text-xs text-slate-600">{pct(best.value)}</dd>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <dt className="text-[11px] font-semibold tracking-wide text-amber-700 uppercase">Focus next</dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-900">{worst.name}</dd>
              <dd className="font-mono text-xs text-slate-600">{pct(worst.value)}</dd>
            </div>
          </dl>
          <ul className="space-y-1.5">
            {axes.map((a) => (
              <li key={a.name} className="flex items-center gap-2 text-xs">
                <span className="w-32 shrink-0 text-slate-600">{a.name}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span className={`block h-full rounded-full ${a.value === null ? "" : a.value >= passMark ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: pct(a.value ?? 0) }} />
                </span>
                <span className="w-10 shrink-0 text-right font-mono text-slate-700">{a.value === null ? "—" : pct(a.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
