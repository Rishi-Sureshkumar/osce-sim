"use client";
import { useEffect, useRef } from "react";
import { Heart } from "lucide-react";

/**
 * Bedside-monitor hero: ECG (lead II), pleth and respiration traces drawn with a sweep-and-erase
 * cursor like a real monitor. Decorative demo values only (not a case). Static trace for reduced motion.
 */
const BG = "#0a111c";
const ECG = "#5fd99a";
const PLETH = "#5ab8e8";
const RESP = "#e2c15f";

const g = (x: number, mu: number, s: number) => Math.exp(-((x - mu) ** 2) / (2 * s * s));
const ecg = (p: number) => 0.1 * g(p, 0.16, 0.025) - 0.12 * g(p, 0.255, 0.008) + g(p, 0.28, 0.009) - 0.26 * g(p, 0.305, 0.01) + 0.28 * g(p, 0.5, 0.042);
const pleth = (p: number) => g(p, 0.42, 0.075) + 0.32 * g(p, 0.66, 0.06);

export function VitalsMonitor() {
  const grid = useRef<HTMLCanvasElement>(null);
  const trace = useRef<HTMLCanvasElement>(null);
  const heart = useRef<SVGSVGElement>(null);
  const hrEl = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const gc = grid.current!;
    const tc = trace.current!;
    const box = tc.parentElement!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0;
    let H = 0;
    let raf = 0;
    let hr = 72;
    const bands = () => [
      { y0: H * 0.06, h: H * 0.42, color: ECG, f: (t: number) => ecg((t % (60 / hr)) / (60 / hr)), width: 1.8 },
      { y0: H * 0.52, h: H * 0.26, color: PLETH, f: (t: number) => pleth(((t - 0.12 + 60) % (60 / hr)) / (60 / hr)), width: 1.6 },
      { y0: H * 0.8, h: H * 0.16, color: RESP, f: (t: number) => 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 4.2), width: 1.4 },
    ];
    const yOf = (b: ReturnType<typeof bands>[number], v: number, isEcg: boolean) => (isEcg ? b.y0 + b.h * 0.72 - v * b.h * 0.7 : b.y0 + b.h - v * b.h * 0.9);

    const size = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = box.clientWidth;
      H = box.clientHeight;
      for (const c of [gc, tc]) {
        c.width = W * dpr;
        c.height = H * dpr;
        c.style.width = `${W}px`;
        c.style.height = `${H}px`;
        c.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      const x = gc.getContext("2d")!;
      x.fillStyle = BG;
      x.fillRect(0, 0, W, H);
      x.strokeStyle = "rgba(120,150,190,0.07)";
      x.lineWidth = 1;
      x.beginPath();
      for (let i = 0; i < W; i += 16) {
        x.moveTo(i + 0.5, 0);
        x.lineTo(i + 0.5, H);
      }
      for (let j = 0; j < H; j += 16) {
        x.moveTo(0, j + 0.5);
        x.lineTo(W, j + 0.5);
      }
      x.stroke();
    };
    size();
    const ro = new ResizeObserver(() => {
      size();
      if (reduce) drawStatic();
    });
    ro.observe(box);

    const ctx = tc.getContext("2d")!;
    const speed = 95; // px per second
    const drawStatic = () => {
      ctx.clearRect(0, 0, W, H);
      bands().forEach((b, k) => {
        ctx.strokeStyle = b.color;
        ctx.lineWidth = b.width;
        ctx.beginPath();
        for (let px = 0; px <= W; px++) {
          const y = yOf(b, b.f(px / speed), k === 0);
          if (px) ctx.lineTo(px, y);
          else ctx.moveTo(px, y);
        }
        ctx.stroke();
      });
    };
    if (reduce) {
      drawStatic();
      return () => ro.disconnect();
    }

    let x = 0;
    let t = 0;
    let last = performance.now();
    let prevY: number[] = [];
    let lastBeat = -1;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const bs = bands();
      const nx = x + speed * dt;
      bs.forEach((b, k) => {
        ctx.strokeStyle = b.color;
        ctx.lineWidth = b.width;
        ctx.lineJoin = "round";
        ctx.beginPath();
        let py = prevY[k] ?? yOf(b, b.f(t), k === 0);
        ctx.moveTo(x, py);
        for (let px = Math.floor(x) + 1; px <= nx; px++) {
          py = yOf(b, b.f(t + (px - x) / speed), k === 0);
          ctx.lineTo(px, py);
        }
        ctx.stroke();
        prevY[k] = py;
      });
      ctx.clearRect(nx + 1, 0, 18, H); // the erase gap ahead of the cursor
      // beat: flash the heart on each R wave, drift the rate a little
      const beat = Math.floor((t + 0.28 * (60 / hr)) / (60 / hr));
      if (beat !== lastBeat) {
        lastBeat = beat;
        heart.current?.animate([{ opacity: 1, transform: "scale(1.18)" }, { opacity: 0.55, transform: "scale(1)" }], { duration: 260, easing: "ease-out" });
        if (beat % 6 === 0) {
          hr = 70 + Math.round(Math.random() * 6);
          if (hrEl.current) hrEl.current.textContent = String(hr);
        }
      }
      t += dt;
      x = nx;
      if (x >= W) {
        x = 0;
        prevY = [];
        ctx.clearRect(0, 0, 20, H);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <figure className="relative w-full overflow-hidden rounded-xl border border-[#1c2738] bg-[#0a111c] text-[#c9d4e3] shadow-pop" aria-label="Animated patient monitor (decorative demo values)">
      <figcaption className="flex items-center justify-between border-b border-[#1c2738] px-3.5 py-2 font-mono text-[10px] tracking-wider text-[#6b7c93] uppercase">
        <span className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-[#5fd99a]" aria-hidden />
          Live · Sim monitor · Bay 3
        </span>
        <span>II · 25 mm/s</span>
      </figcaption>
      <div className="grid grid-cols-[1fr_auto]">
        <div className="relative h-[184px] min-w-0" aria-hidden>
          <canvas ref={grid} className="absolute inset-0" />
          <canvas ref={trace} className="absolute inset-0" />
        </div>
        <dl className="grid w-[132px] grid-rows-4 border-l border-[#1c2738] font-mono">
          <div className="border-b border-[#1c2738] px-3 py-1.5" style={{ color: ECG }}>
            <dt className="flex items-center justify-between text-[9px] tracking-wider uppercase opacity-80">
              HR
              <Heart ref={heart} aria-hidden className="size-3 fill-current opacity-55" />
            </dt>
            <dd className="text-[26px] leading-none font-semibold">
              <span ref={hrEl}>72</span>
            </dd>
          </div>
          <div className="border-b border-[#1c2738] px-3 py-1.5" style={{ color: PLETH }}>
            <dt className="text-[9px] tracking-wider uppercase opacity-80">SpO₂ %</dt>
            <dd className="text-[22px] leading-none font-semibold">98</dd>
          </div>
          <div className="border-b border-[#1c2738] px-3 py-1.5 text-[#dbe4f0]">
            <dt className="text-[9px] tracking-wider uppercase opacity-70">NIBP</dt>
            <dd className="text-[17px] leading-tight font-semibold">118/76</dd>
          </div>
          <div className="px-3 py-1.5" style={{ color: RESP }}>
            <dt className="text-[9px] tracking-wider uppercase opacity-80">RR</dt>
            <dd className="text-[17px] leading-tight font-semibold">14</dd>
          </div>
        </dl>
      </div>
    </figure>
  );
}
