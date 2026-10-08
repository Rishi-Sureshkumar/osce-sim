/** Sessions per day for the last `weeks` weeks, GitHub-style (adapted from the BoloBridge contribution calendar). */
export function ActivityHeatmap({ dates, weeks = 20, now = new Date() }: { dates: string[]; weeks?: number; now?: Date }) {
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const counts = new Map<string, number>();
  for (const iso of dates) counts.set(iso.slice(0, 10), (counts.get(iso.slice(0, 10)) ?? 0) + 1);
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - end.getUTCDay() - (weeks - 1) * 7);
  const cols: { date: Date; count: number; future: boolean }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + w * 7 + i);
      col.push({ date: d, count: counts.get(day(d)) ?? 0, future: d > end });
    }
    cols.push(col);
  }
  const tone = (n: number) => (n === 0 ? "bg-slate-100" : n === 1 ? "bg-cyan-200" : n <= 3 ? "bg-cyan-400" : n <= 6 ? "bg-cyan-600" : "bg-cyan-800");
  // label a column when its week starts a new month, but never closer than 3 columns to the last label
  let last = -3;
  const months = cols.map((c, i) => {
    const m = c[0]!.date.toLocaleString("en", { month: "short", timeZone: "UTC" });
    const prev = i > 0 ? cols[i - 1]![0]!.date.toLocaleString("en", { month: "short", timeZone: "UTC" }) : null;
    if (m === prev || i - last < 3 || i > cols.length - 2) return "";
    last = i;
    return m;
  });
  const total = dates.filter((d) => new Date(d) >= start).length;
  return (
    <figure aria-label={`${total} sessions in the last ${weeks} weeks`}>
      <div className="flex gap-[3px] pl-7 text-[10px] text-slate-400" aria-hidden>
        {months.map((m, i) => (
          <span key={i} className="w-[11px] overflow-visible whitespace-nowrap">
            {m}
          </span>
        ))}
      </div>
      <div className="mt-1 flex gap-[3px]">
        <div className="mr-1 grid w-6 grid-rows-7 gap-[3px] text-[10px] leading-[11px] text-slate-400" aria-hidden>
          <span />
          <span>Mon</span>
          <span />
          <span>Wed</span>
          <span />
          <span>Fri</span>
          <span />
        </div>
        {cols.map((col, w) => (
          <div key={w} className="grid grid-rows-7 gap-[3px]">
            {col.map((c) => (
              <span
                key={c.date.toISOString()}
                className={`size-[11px] rounded-[2px] ${c.future ? "bg-transparent" : tone(c.count)}`}
                title={c.future ? undefined : `${c.date.toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" })}: ${c.count} session${c.count === 1 ? "" : "s"}`}
              />
            ))}
          </div>
        ))}
      </div>
      <figcaption className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-slate-400">
        Less
        {["bg-slate-100", "bg-cyan-200", "bg-cyan-400", "bg-cyan-600", "bg-cyan-800"].map((c) => (
          <span key={c} className={`size-[10px] rounded-[2px] ${c}`} />
        ))}
        More
      </figcaption>
    </figure>
  );
}
