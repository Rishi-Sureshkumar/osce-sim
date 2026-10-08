"use client";
/**
 * Browser playback for AudioSpecs. Procedural sounds are pre-rendered from the pure schedules
 * (schedule.ts) into short loops with OfflineAudioContext, then looped. Recorded clips listed in
 * /public/audio/manifest.json can override any spec via { clipId }.
 */
import type { AudioSpec } from "@/domain/schemas";
import { breathSchedule, heartSchedule, toneEnvelope, type HeartEvent } from "./schedule";
import { demoDeflation, korotkoffSchedule, type KorotkoffTexture } from "./korotkoff";

const SR = 22050;

export interface PlayOptions {
  hr: number;
  rr: number;
  /** 0–1 loudness multiplier (placement accuracy) */
  attenuation?: number;
  /** muffle off-target placements */
  lowpassHz?: number;
  /** override stereo position (-1..1) */
  pan?: number;
}

export interface Playing {
  stop(): void;
}

type Manifest = { clips: { id: string; file: string; source: string; license: string }[] };

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private cache = new Map<string, Promise<AudioBuffer>>();
  private manifest: Promise<Manifest> | null = null;
  private volume = 0.8;
  private muted = false;
  private liveNoise: AudioBuffer | null = null;

  /** Must be called from a user gesture the first time (browser autoplay rules). */
  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyVolume();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyVolume();
  }
  setMuted(m: boolean) {
    this.muted = m;
    this.applyVolume();
  }
  private applyVolume() {
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }

  /** Loop a heart/breath spec (or clip) until stopped. */
  async loop(spec: AudioSpec, opts: PlayOptions): Promise<Playing> {
    const ctx = this.ensure();
    if (!ctx || !this.master) return { stop() {} };
    const buffer = await this.bufferFor(spec, opts);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = !("generator" in spec && spec.generator === "tone");
    const chain = this.chain(ctx, opts);
    src.connect(chain.input);
    src.start();
    return {
      stop: () => {
        const t = ctx.currentTime;
        chain.gain.gain.setTargetAtTime(0, t, 0.05);
        src.stop(t + 0.3);
      },
    };
  }

  /** Play a tuning-fork tone that was struck `elapsedSec` ago (it keeps decaying). */
  async tone(spec: Extract<AudioSpec, { generator: "tone" }>, elapsedSec: number, opts: Omit<PlayOptions, "hr" | "rr">): Promise<Playing> {
    const ctx = this.ensure();
    if (!ctx || !this.master) return { stop() {} };
    const buffer = await this.bufferFor(spec, { hr: 60, rr: 12 });
    const offset = Math.min(buffer.duration - 0.01, Math.max(0, elapsedSec));
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const chain = this.chain(ctx, { ...opts, hr: 60, rr: 12, pan: opts.pan ?? spec.params.pan });
    src.connect(chain.input);
    src.start(0, offset);
    return { stop: () => src.stop() };
  }

  /** Three knuckle knocks on a wooden door (procedural). */
  knock() {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + 0.02;
    [0, 0.22, 0.44].forEach((dt) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(190, t0 + dt);
      osc.frequency.exponentialRampToValueAtTime(70, t0 + dt + 0.09);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0 + dt);
      g.gain.exponentialRampToValueAtTime(0.9, t0 + dt + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.12);
      osc.connect(g).connect(this.master!);
      osc.start(t0 + dt);
      osc.stop(t0 + dt + 0.14);
    });
  }

  /**
   * One Korotkoff tap right now (live cuff deflation: the caller decides, from the pure model in
   * korotkoff.ts, when a beat is audible and how loud). Goes through the master volume/mute.
   * Live taps are real time: while the context is not running (suspended before a user gesture,
   * an OS audio interruption) or muted they are dropped, not queued at a frozen currentTime.
   */
  korotkoffTap(gain: number, freq: number, texture: KorotkoffTexture = "tap", opts: Omit<PlayOptions, "hr" | "rr"> = {}) {
    const ctx = this.ensure();
    if (!ctx || !this.master || ctx.state !== "running" || this.muted || gain <= 0) return;
    this.liveNoise ??= noiseBuffer(ctx, 1);
    const chain = this.chain(ctx, { ...opts, hr: 60, rr: 12 });
    const lastNode = korotkoffTapNodes(ctx, chain.input, this.liveNoise, ctx.currentTime + 0.01, gain, freq, texture);
    lastNode.onended = () => chain.input.disconnect(); // release this tap's chain at once
  }

  private chain(ctx: AudioContext, opts: PlayOptions) {
    const gain = ctx.createGain();
    gain.gain.value = opts.attenuation ?? 1;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = opts.lowpassHz ?? 8000;
    const pan = ctx.createStereoPanner();
    pan.pan.value = opts.pan ?? 0;
    lp.connect(gain).connect(pan).connect(this.master!);
    return { input: lp as AudioNode, gain };
  }

  private bufferFor(spec: AudioSpec, opts: PlayOptions): Promise<AudioBuffer> {
    const key = JSON.stringify(["clipId" in spec ? spec : spec, "generator" in spec && spec.generator !== "tone" ? [opts.hr, opts.rr] : null]);
    let p = this.cache.get(key);
    if (!p) {
      p = "clipId" in spec ? this.loadClip(spec.clipId) : render(spec, opts);
      this.cache.set(key, p);
    }
    return p;
  }

  private async loadClip(id: string): Promise<AudioBuffer> {
    this.manifest ??= fetch("/audio/manifest.json").then((r) => (r.ok ? r.json() : { clips: [] }));
    const clip = (await this.manifest).clips.find((c) => c.id === id);
    if (!clip) throw new Error(`Audio clip "${id}" is not in /audio/manifest.json`);
    const data = await (await fetch(`/audio/${clip.file}`)).arrayBuffer();
    return this.ensure()!.decodeAudioData(data);
  }
}

/** Render a procedural spec into a loopable buffer (an integer number of cycles, ~6 s). */
async function render(spec: Exclude<AudioSpec, { clipId: string }>, opts: PlayOptions): Promise<AudioBuffer> {
  if (spec.generator === "tone") {
    const env = toneEnvelope(spec.params);
    const len = Math.ceil(env.decaySec * SR);
    const ctx = new OfflineAudioContext(1, len, SR);
    const buf = ctx.createBuffer(1, len, SR);
    const d = buf.getChannelData(0);
    // amplitude falls to ~threshold at decaySec: exp(-5 t / decay)
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      d[i] = 0.5 * Math.exp((-5 * t) / env.decaySec) * Math.sin(2 * Math.PI * env.freq * t);
    }
    return buf;
  }
  if (spec.generator === "korotkoff") {
    // a looped spec plays one standard teaching deflation (live cuff use calls audioEngine.korotkoffTap)
    const p = { ...spec.params, systolic: spec.params.systolic ?? 120, diastolic: spec.params.diastolic ?? 80 };
    const sweep = demoDeflation(p);
    const seconds = sweep.seconds + 1;
    const ctx = new OfflineAudioContext(1, Math.ceil(seconds * SR), SR);
    const noise = noiseBuffer(ctx, 1);
    for (const e of korotkoffSchedule(p, opts.hr, sweep.pressureAt, sweep.seconds)) korotkoffTapNodes(ctx, ctx.destination, noise, e.t, e.gain, e.freq, e.texture);
    return ctx.startRendering();
  }
  if (spec.generator === "percussion" || spec.generator === "voice") {
    // Phase 4 generators are rendered by their own schedules (added with the hide-findings stimuli)
    return new OfflineAudioContext(1, SR / 10, SR).startRendering();
  }
  const period = spec.generator === "heart" ? 60 / opts.hr : 60 / opts.rr;
  const cycles = Math.max(1, Math.round(6 / period));
  const seconds = cycles * period;
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * SR), SR);
  const noise = noiseBuffer(ctx, seconds);
  if (spec.generator === "heart") {
    for (const e of heartSchedule(spec.params, opts.hr, seconds)) heartEvent(ctx, noise, e);
  } else {
    const s = breathSchedule(spec.params, opts.rr, seconds);
    for (const ph of s.phases) {
      if (ph.gain <= 0) continue;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = ph.freq;
      bp.Q.value = 0.7;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ph.t);
      g.gain.linearRampToValueAtTime(ph.gain * 0.6, ph.t + ph.dur * 0.3);
      g.gain.linearRampToValueAtTime(0, ph.t + ph.dur);
      src.connect(bp).connect(g).connect(ctx.destination);
      src.start(ph.t, ph.t % 1, ph.dur);
    }
    for (const c of s.crackles) burst(ctx, noise, c.t, c.coarse ? 0.016 : 0.007, c.gain, c.coarse ? 600 : 1500, "highpass");
    for (const w of s.wheezes) {
      const osc = ctx.createOscillator();
      osc.frequency.value = w.freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, w.t);
      g.gain.linearRampToValueAtTime(w.gain * 0.4, w.t + 0.1);
      g.gain.linearRampToValueAtTime(0, w.t + w.dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(w.t);
      osc.stop(w.t + w.dur);
    }
  }
  return ctx.startRendering();
}

function noiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const len = Math.ceil(Math.max(1, seconds) * SR);
  const b = ctx.createBuffer(1, len, SR);
  const d = b.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < len; i++) {
    s = (s * 1103515245 + 12345) >>> 0;
    d[i] = (s / 2 ** 32) * 2 - 1;
  }
  return b;
}

function heartEvent(ctx: OfflineAudioContext, noise: AudioBuffer, e: HeartEvent) {
  if (e.kind === "murmur") {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = e.freq;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    const peak = e.gain * 0.5;
    g.gain.setValueAtTime(0, e.t);
    if (e.shape === "crescendo_decrescendo") {
      g.gain.linearRampToValueAtTime(peak, e.t + e.dur / 2);
      g.gain.linearRampToValueAtTime(0, e.t + e.dur);
    } else if (e.shape === "decrescendo") {
      g.gain.linearRampToValueAtTime(peak, e.t + 0.02);
      g.gain.linearRampToValueAtTime(0, e.t + e.dur);
    } else {
      g.gain.linearRampToValueAtTime(peak, e.t + 0.02);
      g.gain.setValueAtTime(peak, e.t + e.dur - 0.02);
      g.gain.linearRampToValueAtTime(0, e.t + e.dur);
    }
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(e.t, e.t % 1, e.dur);
    return;
  }
  // valve sounds: a low sine thump plus a little filtered noise
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(e.freq * 1.4, e.t);
  osc.frequency.exponentialRampToValueAtTime(e.freq, e.t + e.dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, e.t);
  g.gain.linearRampToValueAtTime(e.gain, e.t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, e.t + e.dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(e.t);
  osc.stop(e.t + e.dur + 0.02);
  burst(ctx, noise, e.t, e.dur * 0.6, e.gain * 0.25, e.freq * 3, "lowpass");
}

/**
 * A Korotkoff tap: a short low sine thump (~50 ms) plus a little filtered noise. Phase II taps get a
 * longer band-passed swish; phase IV is low-passed and softer (muffled). Returns whichever source
 * stops last.
 */
function korotkoffTapNodes(ctx: BaseAudioContext, dest: AudioNode, noise: AudioBuffer, t: number, gain: number, freq: number, texture: KorotkoffTexture): AudioScheduledSourceNode {
  const dur = texture === "muffled" ? 0.06 : 0.045;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq * 1.5, t);
  osc.frequency.exponentialRampToValueAtTime(freq, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = texture === "muffled" ? 180 : 900;
  osc.connect(g).connect(lp).connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.02);
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = texture === "swish" ? "bandpass" : "lowpass";
  f.frequency.value = texture === "swish" ? 300 : texture === "muffled" ? 150 : freq * 4;
  const ng = ctx.createGain();
  const noiseDur = texture === "swish" ? 0.12 : dur * 0.6;
  ng.gain.setValueAtTime(gain * (texture === "swish" ? 0.35 : 0.2), t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + noiseDur);
  src.connect(f).connect(ng).connect(dest);
  src.start(t, t % 0.5, noiseDur + 0.01);
  return noiseDur + 0.01 > dur + 0.02 ? src : osc;
}

function burst(ctx: OfflineAudioContext, noise: AudioBuffer, t: number, dur: number, gain: number, freq: number, type: BiquadFilterType) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t, t % 1, dur + 0.01);
}

/** One engine per page. */
export const audioEngine = new AudioEngine();
