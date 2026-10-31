import { hash } from './math';
import type { Plan, SfxKind } from './plan';
import type { Project } from './types';

type Stereo = [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>];

function noise(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

/** Noise through a band-pass filter whose centre sweeps from f0 to f1, shaped by an envelope. */
function sweptNoise(sr: number, dur: number, f0: number, f1: number, q: number, env: (p: number) => number, seed: number) {
  const n = Math.floor(sr * dur);
  const out = new Float32Array(n);
  const rnd = noise(seed);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  let b0 = 0;
  let b2 = 0;
  let a1 = 0;
  let a2 = 0;
  for (let i = 0; i < n; i++) {
    const p = i / n;
    if (i % 32 === 0) {
      const f = f0 * Math.pow(f1 / f0, p);
      const w = (2 * Math.PI * f) / sr;
      const alpha = Math.sin(w) / (2 * q);
      const a0 = 1 + alpha;
      b0 = alpha / a0;
      b2 = -alpha / a0;
      a1 = (-2 * Math.cos(w)) / a0;
      a2 = (1 - alpha) / a0;
    }
    const x = rnd();
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    out[i] = y * env(p);
  }
  return out;
}

function panned(mono: Float32Array<ArrayBuffer>, pan: (p: number) => number): Stereo {
  const l = new Float32Array(mono.length);
  const r = new Float32Array(mono.length);
  for (let i = 0; i < mono.length; i++) {
    const p = (pan(i / mono.length) + 1) / 2;
    l[i] = mono[i] * Math.cos((p * Math.PI) / 2);
    r[i] = mono[i] * Math.sin((p * Math.PI) / 2);
  }
  return [l, r];
}

function tone(sr: number, dur: number, fn: (t: number) => number): Float32Array<ArrayBuffer> {
  const n = Math.floor(sr * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / sr);
  return out;
}

export function synthesize(kind: SfxKind, sr: number): Stereo {
  switch (kind) {
    case 'tap': {
      let phase = 0;
      const rnd = noise(7);
      const mono = tone(sr, 0.14, (t) => {
        const f = 1100 + 900 * Math.exp(-t * 60);
        phase += (2 * Math.PI * f) / sr;
        return 0.5 * Math.sin(phase) * Math.exp(-t * 55) + 0.32 * rnd() * Math.exp(-t * 420) + 0.28 * Math.sin(2 * Math.PI * 170 * t) * Math.exp(-t * 38);
      });
      return panned(mono, () => 0);
    }
    case 'hold': {
      const rnd = noise(11);
      const mono = tone(sr, 0.3, (t) => 0.5 * Math.sin(2 * Math.PI * 120 * t) * Math.exp(-t * 16) + 0.2 * rnd() * Math.exp(-t * 300));
      return panned(mono, () => 0);
    }
    case 'swipe':
      return panned(sweptNoise(sr, 0.38, 1400, 4200, 1.4, (p) => 0.55 * Math.pow(Math.sin(Math.PI * p), 1.6), 21), (p) => -0.4 + p * 0.8);
    case 'whoosh':
      return panned(sweptNoise(sr, 0.8, 280, 2400, 1.1, (p) => 0.7 * Math.pow(Math.sin(Math.PI * Math.pow(p, 0.75)), 2), 33), (p) => -0.7 + p * 1.4);
    case 'rise': {
      const air = sweptNoise(sr, 0.95, 200, 1800, 0.9, (p) => 0.35 * Math.pow(Math.sin(Math.PI * p), 2), 45);
      let phase = 0;
      const body = tone(sr, 0.95, (t) => {
        phase += (2 * Math.PI * (180 + 420 * (t / 0.95))) / sr;
        return 0.12 * Math.sin(phase) * Math.pow(Math.sin((Math.PI * t) / 0.95), 2);
      });
      for (let i = 0; i < air.length; i++) air[i] += body[i] ?? 0;
      return panned(air, () => 0);
    }
    case 'pop': {
      const l = tone(sr, 0.9, (t) => (0.24 * Math.sin(2 * Math.PI * 660 * t) + 0.16 * Math.sin(2 * Math.PI * 990 * t) + 0.08 * Math.sin(2 * Math.PI * 2640 * t) * Math.exp(-t * 14)) * Math.exp(-t * 5.5));
      const r = tone(sr, 0.9, (t) => (0.24 * Math.sin(2 * Math.PI * 662 * t) + 0.16 * Math.sin(2 * Math.PI * 993 * t)) * Math.exp(-t * 5.5));
      return [l, r];
    }
    case 'shimmer': {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      const dur = 2.2;
      const make = (detune: number) =>
        tone(sr, dur, (t) => {
          let v = 0;
          notes.forEach((f, i) => {
            const start = i * 0.07;
            if (t < start) return;
            const tt = t - start;
            v += 0.075 * Math.sin(2 * Math.PI * f * detune * tt) * Math.exp(-tt * 2.4) * Math.min(1, tt * 60);
          });
          return v;
        });
      return [make(1), make(1.003)];
    }
  }
}

function toBuffer(ctx: BaseAudioContext, data: Stereo) {
  const buffer = ctx.createBuffer(2, data[0].length, ctx.sampleRate);
  buffer.copyToChannel(data[0], 0);
  buffer.copyToChannel(data[1], 1);
  return buffer;
}

const musicCache = new Map<string, Promise<AudioBuffer | null>>();

export function decodeMusic(src: string): Promise<AudioBuffer | null> {
  let req = musicCache.get(src);
  if (!req) {
    req = (async () => {
      try {
        const data = await (await fetch(src)).arrayBuffer();
        const ctx = new OfflineAudioContext(2, 1, 48000);
        return await ctx.decodeAudioData(data);
      } catch (err) {
        console.warn('Could not decode music track', err);
        return null;
      }
    })();
    musicCache.set(src, req);
  }
  return req;
}

function scheduleMusic(ctx: BaseAudioContext, buffer: AudioBuffer, project: Project, duration: number, startAt: number, offset: number) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const gain = ctx.createGain();
  const vol = (project.audio.musicVolume / 100) * 0.9;
  const remaining = duration - offset;
  const g = gain.gain;
  g.setValueAtTime(offset < 0.8 ? vol * (offset / 0.8) : vol, startAt);
  if (offset < 0.8) g.linearRampToValueAtTime(vol, startAt + (0.8 - offset));
  const fadeStart = Math.max(0, remaining - 1.8);
  g.setValueAtTime(vol, startAt + fadeStart);
  g.linearRampToValueAtTime(0, startAt + remaining);
  source.connect(gain).connect(ctx.destination);
  source.start(startAt, offset % buffer.duration);
  source.stop(startAt + remaining + 0.05);
  return source;
}

function scheduleSfx(ctx: BaseAudioContext, plan: Plan, project: Project, cache: Map<SfxKind, AudioBuffer>, from: number, startAt: number) {
  const out: AudioBufferSourceNode[] = [];
  const master = ctx.createGain();
  master.gain.value = project.audio.sfxVolume / 100;
  master.connect(ctx.destination);
  for (const ev of plan.sfx) {
    if (ev.t < from - 0.02) continue;
    let buffer = cache.get(ev.kind);
    if (!buffer) {
      buffer = toBuffer(ctx, synthesize(ev.kind, ctx.sampleRate));
      cache.set(ev.kind, buffer);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.85 + hash(Math.round(ev.t * 1000)) * 0.15;
    src.connect(gain).connect(master);
    src.start(startAt + Math.max(0, ev.t - from));
    out.push(src);
  }
  return out;
}

/** Renders music and sound effects for the whole timeline. */
export async function renderSoundtrack(project: Project, plan: Plan, sampleRate = 48000): Promise<AudioBuffer | null> {
  const music = project.audio.music ? await decodeMusic(project.audio.music) : null;
  if (!project.audio.sfx && !music) return null;
  const ctx = new OfflineAudioContext(2, Math.ceil(plan.duration * sampleRate), sampleRate);
  if (music) scheduleMusic(ctx, music, project, plan.duration, 0, 0);
  if (project.audio.sfx) scheduleSfx(ctx, plan, project, new Map(), 0, 0);
  return ctx.startRendering();
}

/** Real-time playback of the soundtrack in sync with the preview. */
export class AudioPreview {
  private ctx: AudioContext | null = null;
  private nodes: AudioScheduledSourceNode[] = [];
  private sfxCache = new Map<SfxKind, AudioBuffer>();
  private token = 0;
  muted = false;

  async start(project: Project, plan: Plan, from: number) {
    this.stop();
    if (this.muted) return;
    const token = ++this.token;
    this.ctx ??= new AudioContext({ latencyHint: 'interactive' });
    const ctx = this.ctx;
    if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
    const music = project.audio.music ? await decodeMusic(project.audio.music) : null;
    if (token !== this.token) return;
    const startAt = ctx.currentTime + 0.02;
    if (music && from < plan.duration) this.nodes.push(scheduleMusic(ctx, music, project, plan.duration, startAt, from));
    if (project.audio.sfx) this.nodes.push(...scheduleSfx(ctx, plan, project, this.sfxCache, from, startAt));
  }

  stop() {
    this.token++;
    for (const node of this.nodes) {
      try {
        node.stop();
      } catch {
        // already stopped
      }
    }
    this.nodes = [];
  }
}

export function encodeWav(buffer: AudioBuffer) {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const out = new DataView(new ArrayBuffer(44 + length * channels * 2));
  const write = (o: number, s: string) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  write(0, 'RIFF');
  out.setUint32(4, 36 + length * channels * 2, true);
  write(8, 'WAVEfmt ');
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, channels, true);
  out.setUint32(24, buffer.sampleRate, true);
  out.setUint32(28, buffer.sampleRate * channels * 2, true);
  out.setUint16(32, channels * 2, true);
  out.setUint16(34, 16, true);
  write(36, 'data');
  out.setUint32(40, length * channels * 2, true);
  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < channels; c++) {
      const v = Math.max(-1, Math.min(1, data[c][i]));
      out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
  }
  return new Uint8Array(out.buffer);
}
