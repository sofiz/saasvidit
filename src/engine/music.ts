import type { Plan } from './plan';

/**
 * Built-in music library. Every track is composed in the browser from a style definition as one
 * continuous piece fitted to the edit: a filtered build during the intro that drops on the first scene,
 * a groove that runs unbroken through every scene change (marked only by a light cymbal swell), and a
 * resolving final chord on the last frame. Nothing is downloaded, so all tracks are
 * royalty-free and render identically in preview and export.
 */

export interface MusicTrack {
  id: string;
  name: string;
  mood: string;
  bpm: number;
  colors: [string, string];
}

/** Times (seconds) the arrangement follows. */
export interface MusicTimeline {
  duration: number;
  /** End of the intro build. */
  introEnd: number;
  /** Scene changes after the first scene, and the outro start. */
  cuts: number[];
  outroStart: number | null;
}

type Pattern = string;

interface Style {
  bpm: number;
  swing: number;
  /** MIDI note of the key root. */
  key: number;
  /** Chords as semitone offsets from the key, one per bar. */
  chords: number[][];
  drums: Partial<Record<'kick' | 'snare' | 'clap' | 'hat' | 'shaker' | 'tom', Pattern>>;
  snareTone?: number;
  bass?: { pattern: Pattern; type: OscillatorType; octave: number; cutoff: number; steps: number; gain: number };
  arp?: { pattern: Pattern; type: OscillatorType; octave: number; cutoff: number; decay: number; gain: number };
  pad?: { type: OscillatorType; cutoff: number; gain: number; octave: number; attack: number };
  keys?: { pattern: Pattern; gain: number };
  bells?: { pattern: Pattern; octave: number; gain: number };
  vinyl?: boolean;
  impact: number;
  riser: number;
}

const STYLES: Record<string, Style> = {
  pulse: {
    bpm: 120,
    swing: 0,
    key: 57,
    chords: [
      [0, 3, 7],
      [-4, 0, 3],
      [3, 7, 10],
      [-2, 2, 5],
    ],
    drums: { kick: 'x...x...x...x...', clap: '....x.......x...', hat: '..x...x...x...x.', shaker: 'o.oo.oo.o.oo.oo.' },
    bass: { pattern: '0..0..0.0..0..0.', type: 'sawtooth', octave: -2, cutoff: 520, steps: 2, gain: 0.32 },
    arp: { pattern: '0.1.2.3.2.1.0.2.', type: 'sawtooth', octave: 1, cutoff: 2600, decay: 0.16, gain: 0.07 },
    pad: { type: 'sawtooth', cutoff: 1300, gain: 0.035, octave: 0, attack: 0.25 },
    impact: 0.8,
    riser: 0.8,
  },
  bright: {
    bpm: 112,
    swing: 0,
    key: 60,
    chords: [
      [0, 4, 7],
      [-5, -1, 2],
      [-3, 0, 4],
      [-7, -3, 0],
    ],
    drums: { kick: 'x.....x.x.......', clap: '....x.......x...', hat: '..x...x...x...x.', shaker: 'oooooooooooooooo' },
    bass: { pattern: '0.0.0.0.0.0.0.0.', type: 'square', octave: -2, cutoff: 420, steps: 1.5, gain: 0.22 },
    arp: { pattern: '0.2.1.2.0.2.1.3.', type: 'triangle', octave: 0, cutoff: 5000, decay: 0.42, gain: 0.16 },
    pad: { type: 'triangle', cutoff: 2400, gain: 0.05, octave: 0, attack: 0.3 },
    bells: { pattern: '0.......2.......', octave: 2, gain: 0.03 },
    impact: 0.6,
    riser: 0.6,
  },
  lofi: {
    bpm: 82,
    swing: 0.22,
    key: 48,
    chords: [
      [2, 5, 9, 12],
      [-5, -1, 2, 5],
      [0, 4, 7, 11],
      [-3, 0, 4, 7],
    ],
    drums: { kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'o.o.o.o.o.o.o.o.' },
    snareTone: 0.4,
    bass: { pattern: '0.......0.....0.', type: 'sine', octave: -1, cutoff: 500, steps: 6, gain: 0.4 },
    keys: { pattern: 'x.........x.....', gain: 0.07 },
    vinyl: true,
    impact: 0.25,
    riser: 0.3,
  },
  ambient: {
    bpm: 72,
    swing: 0,
    key: 52,
    chords: [
      [0, 4, 7, 11],
      [-3, 0, 4, 7],
      [-7, -3, 0, 4],
      [-5, -1, 2, 4],
    ],
    drums: {},
    bass: { pattern: '0...............', type: 'sine', octave: -2, cutoff: 300, steps: 16, gain: 0.3 },
    pad: { type: 'sawtooth', cutoff: 900, gain: 0.05, octave: 0, attack: 1.2 },
    bells: { pattern: '0.....2...1...3.', octave: 2, gain: 0.05 },
    impact: 0.3,
    riser: 0.45,
  },
  synthwave: {
    bpm: 100,
    swing: 0,
    key: 52,
    chords: [
      [0, 3, 7],
      [-4, 0, 3],
      [3, 7, 10],
      [-2, 2, 5],
    ],
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'o.o.o.o.o.o.o.o.' },
    snareTone: 1,
    bass: { pattern: '0o0o0o0o0o0o0o0o', type: 'sawtooth', octave: -2, cutoff: 900, steps: 0.9, gain: 0.2 },
    arp: { pattern: '0.......2.......', type: 'square', octave: 1, cutoff: 2200, decay: 0.9, gain: 0.05 },
    pad: { type: 'sawtooth', cutoff: 1700, gain: 0.04, octave: 0, attack: 0.2 },
    impact: 0.8,
    riser: 0.7,
  },
  cinematic: {
    bpm: 88,
    swing: 0,
    key: 50,
    chords: [
      [0, 3, 7],
      [-4, 0, 3],
      [3, 7, 10],
      [-2, 2, 5],
    ],
    drums: { kick: 'x.......x.......', tom: 'x..x..x.x...x.x.' },
    bass: { pattern: '0.......0.......', type: 'sawtooth', octave: -2, cutoff: 280, steps: 8, gain: 0.35 },
    arp: { pattern: '0.0.1.0.0.0.2.0.', type: 'sawtooth', octave: 0, cutoff: 1800, decay: 0.12, gain: 0.08 },
    pad: { type: 'sawtooth', cutoff: 1400, gain: 0.05, octave: 0, attack: 0.6 },
    impact: 1,
    riser: 1,
  },
};

export const MUSIC_LIBRARY: MusicTrack[] = [
  { id: 'pulse', name: 'Pulse Pop', mood: 'Upbeat · Tech', bpm: 120, colors: ['#6f7dff', '#b46cff'] },
  { id: 'bright', name: 'Bright Side', mood: 'Corporate · Uplifting', bpm: 112, colors: ['#ffb36b', '#ff6fa5'] },
  { id: 'lofi', name: 'Late Night', mood: 'Lo-fi · Chill', bpm: 82, colors: ['#c49a6c', '#7a5c8f'] },
  { id: 'ambient', name: 'Glass Horizon', mood: 'Ambient · Calm', bpm: 72, colors: ['#5eead4', '#60a5fa'] },
  { id: 'synthwave', name: 'Neon Drive', mood: 'Retro · Synthwave', bpm: 100, colors: ['#ff2bd6', '#00e5ff'] },
  { id: 'cinematic', name: 'Rise Above', mood: 'Cinematic · Epic', bpm: 88, colors: ['#f97316', '#7c3aed'] },
];

export const isLibraryTrack = (id: string) => id in STYLES;

const freq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

interface VoiceOpts {
  gain: number;
  attack?: number;
  /** Exponential decay after the attack (plucks); otherwise the note holds for `dur` and releases. */
  decay?: number;
  release?: number;
  cutoff?: number;
  cutoffEnd?: number;
  q?: number;
  detune?: number;
  send?: number;
}

/** Synth voices, drums and effects wired into a shared mix bus with reverb and glue compression. */
class Studio {
  readonly ctx: OfflineAudioContext;
  readonly bus: GainNode;
  readonly filter: BiquadFilterNode;
  private reverb: ConvolverNode;
  private noise: AudioBuffer;

  constructor(ctx: OfflineAudioContext) {
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    comp.attack.value = 0.006;
    comp.release.value = 0.22;
    const master = ctx.createGain();
    master.gain.value = 0.9;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 20000;
    this.filter.Q.value = 0.8;
    this.bus = ctx.createGain();
    this.bus.connect(this.filter).connect(comp).connect(master).connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.8);
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    this.reverb.connect(wet).connect(this.filter);

    const rnd = seeded(99);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = rnd() * 2 - 1;
  }

  private impulse(seconds: number) {
    const { ctx } = this;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const rnd = seeded(7 + c);
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return buf;
  }

  private output(node: AudioNode, send = 0) {
    node.connect(this.bus);
    if (send > 0) {
      const s = this.ctx.createGain();
      s.gain.value = send;
      node.connect(s).connect(this.reverb);
    }
  }

  private envelope(param: AudioParam, t: number, dur: number, o: VoiceOpts) {
    const attack = o.attack ?? 0.005;
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(o.gain, t + attack);
    if (o.decay !== undefined) {
      param.exponentialRampToValueAtTime(0.0001, t + attack + o.decay);
      return t + attack + o.decay;
    }
    const release = o.release ?? 0.2;
    const end = Math.max(t + attack, t + dur);
    param.setValueAtTime(o.gain, end);
    param.linearRampToValueAtTime(0, end + release);
    return end + release;
  }

  voice(type: OscillatorType, hz: number, t: number, dur: number, o: VoiceOpts) {
    const { ctx } = this;
    const amp = ctx.createGain();
    let head: AudioNode = amp;
    if (o.cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = o.q ?? 0.9;
      f.frequency.setValueAtTime(o.cutoff, t);
      if (o.cutoffEnd) f.frequency.exponentialRampToValueAtTime(o.cutoffEnd, t + (o.decay ?? dur));
      f.connect(amp);
      head = f;
    }
    const end = this.envelope(amp.gain, t, dur, o);
    const detunes = o.detune ? [-o.detune, o.detune] : [0];
    for (const d of detunes) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = hz;
      osc.detune.value = d;
      osc.connect(head);
      osc.start(t);
      osc.stop(end + 0.05);
    }
    this.output(amp, o.send);
  }

  noiseHit(t: number, o: { type: BiquadFilterType; freq: number; freqEnd?: number; q?: number; dur: number; gain: number; send?: number; attack?: number }) {
    const { ctx } = this;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.type;
    f.frequency.setValueAtTime(o.freq, t);
    if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, t + o.dur);
    f.Q.value = o.q ?? 0.8;
    const amp = ctx.createGain();
    const attack = o.attack ?? 0.002;
    amp.gain.setValueAtTime(0, t);
    if (attack > 0.05) {
      amp.gain.linearRampToValueAtTime(o.gain, t + attack);
      amp.gain.linearRampToValueAtTime(0, t + o.dur + 0.02);
    } else {
      amp.gain.linearRampToValueAtTime(o.gain, t + attack);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    }
    src.connect(f).connect(amp);
    src.start(t, (t * 7.31) % 1.5);
    src.stop(t + o.dur + 0.1);
    this.output(amp, o.send);
  }

  kick(t: number, v: number, pitch = 1) {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(155 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(48 * pitch, t + 0.11);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.9 * v, t + 0.003);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    osc.connect(amp);
    osc.start(t);
    osc.stop(t + 0.45);
    this.output(amp);
    this.noiseHit(t, { type: 'highpass', freq: 2500, dur: 0.012, gain: 0.18 * v });
  }

  tom(t: number, v: number) {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(62, t + 0.3);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.55 * v, t + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(amp);
    osc.start(t);
    osc.stop(t + 0.65);
    this.output(amp, 0.25);
  }

  snare(t: number, v: number, tone = 0.7) {
    this.noiseHit(t, { type: 'bandpass', freq: 1500 + tone * 800, q: 0.7, dur: 0.16 + tone * 0.12, gain: 0.32 * v, send: 0.15 + tone * 0.3 });
    this.voice('triangle', 185, t, 0, { gain: 0.18 * v, decay: 0.09 });
  }

  clap(t: number, v: number) {
    for (const [dt, g] of [
      [0, 0.6],
      [0.011, 0.7],
      [0.023, 1],
    ]) {
      this.noiseHit(t + dt, { type: 'bandpass', freq: 1300, q: 1.2, dur: dt === 0.023 ? 0.2 : 0.02, gain: 0.3 * v * g, send: 0.2 });
    }
  }

  hat(t: number, v: number, open = false) {
    this.noiseHit(t, { type: 'highpass', freq: 7600, dur: open ? 0.22 : 0.045, gain: 0.11 * v });
  }

  impact(t: number, v: number) {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(70, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.9);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.75 * v, t + 0.005);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    osc.connect(amp);
    osc.start(t);
    osc.stop(t + 1.35);
    this.output(amp);
    this.noiseHit(t, { type: 'highpass', freq: 3800, dur: 1.8, gain: 0.16 * v, send: 0.5 });
  }

  riser(t0: number, t1: number, v: number) {
    this.noiseHit(t0, { type: 'bandpass', freq: 350, freqEnd: 7000, q: 1.6, dur: t1 - t0, gain: 0.22 * v, send: 0.4, attack: t1 - t0 });
  }

  vinyl(duration: number) {
    const rnd = seeded(31);
    this.noiseHit(0, { type: 'bandpass', freq: 3200, q: 0.5, dur: duration, gain: 0.012, attack: 0.5 });
    for (let t = 0.1; t < duration; t += 0.05 + rnd() * 0.35) {
      this.noiseHit(t, { type: 'highpass', freq: 2000 + rnd() * 4000, dur: 0.004, gain: 0.05 + rnd() * 0.06 });
    }
  }
}

function chordTone(chord: number[], index: number) {
  const n = chord.length;
  return chord[index % n] + 12 * Math.floor(index / n);
}

function compose(studio: Studio, style: Style, tl: MusicTimeline) {
  const beat = 60 / style.bpm;
  const step = beat / 4;
  const bar = beat * 4;
  const end = tl.duration;
  // Phase the grid so a downbeat lands exactly where the intro hands over to the first scene.
  const origin = tl.introEnd - Math.ceil(tl.introEnd / bar) * bar;
  // The groove plays through to a beat just before the end, then the final chord rings out.
  const tailStart = Math.max(tl.introEnd + bar, origin + Math.floor((end - 1.6 - origin) / beat) * beat);
  const filter = studio.filter.frequency;

  // One continuous piece: a muffled build during the intro, then the full groove plays straight
  // through every scene change. Cuts only get light accents on top (below), never a dropout.
  filter.setValueAtTime(1100, 0);
  filter.exponentialRampToValueAtTime(2600, Math.max(0.05, tl.introEnd - 0.05));
  filter.setValueAtTime(20000, tl.introEnd);

  const phase = (t: number) => (t < tl.introEnd - 1e-3 ? 'intro' : 'full');

  const bars = Math.ceil((end - origin) / bar);
  const introBars = Math.round((tl.introEnd - origin) / bar);
  for (let b = 0; b < bars; b++) {
    const tb = origin + b * bar;
    // Start the progression on the drop so the first scene opens on the tonic.
    const chord = style.chords[(((b - introBars) % style.chords.length) + style.chords.length) % style.chords.length];
    const root = style.key + chord[0];

    if (style.pad && tb < tailStart) {
      const p = style.pad;
      const gain = phase(tb) === 'intro' ? p.gain * 1.1 : p.gain;
      const start = Math.max(0, tb);
      for (const n of chord) {
        studio.voice(p.type, freq(style.key + n + 12 * p.octave), start, Math.min(tb + bar, tailStart) - start - 0.05, {
          gain,
          attack: p.attack,
          release: 0.5,
          cutoff: p.cutoff,
          detune: 9,
          send: 0.5,
        });
      }
    }

    for (let s = 0; s < 16; s++) {
      const t = tb + s * step + (s % 2 ? style.swing * step : 0);
      if (t < 0) continue;
      if (t >= tailStart) break;
      const ph = phase(t);
      const drums = ph === 'full';
      const at = (p?: Pattern) => (p ? p[s] : '.');
      const vel = (c: string) => (c === 'x' ? 1 : c === 'o' ? 0.5 : 0);

      if (drums) {
        if (vel(at(style.drums.kick))) studio.kick(t, vel(at(style.drums.kick)));
        if (vel(at(style.drums.tom))) studio.tom(t, vel(at(style.drums.tom)));
        if (vel(at(style.drums.snare))) studio.snare(t, vel(at(style.drums.snare)), style.snareTone);
        if (vel(at(style.drums.clap))) studio.clap(t, vel(at(style.drums.clap)));
        if (vel(at(style.drums.hat))) studio.hat(t, vel(at(style.drums.hat)), at(style.drums.hat) === 'x');
        if (vel(at(style.drums.shaker))) studio.hat(t, vel(at(style.drums.shaker)) * 0.45);
      } else if (ph === 'intro' && vel(at(style.drums.hat)) && b % 2 === 1) {
        studio.hat(t, 0.35);
      }

      if (style.bass && ph !== 'intro') {
        const c = at(style.bass.pattern);
        if (c !== '.') {
          const n = c === 'o' ? root + 12 : style.key + chordTone(chord, Number(c));
          studio.voice(style.bass.type, freq(n + 12 * style.bass.octave), t, step * style.bass.steps, {
            gain: style.bass.gain,
            attack: 0.006,
            release: 0.06,
            cutoff: style.bass.cutoff,
            q: 2,
          });
        }
      }

      if (style.arp) {
        const c = at(style.arp.pattern);
        if (c !== '.') {
          const a = style.arp;
          const n = style.key + chordTone(chord, Number(c)) + 12 * a.octave;
          studio.voice(a.type, freq(n), t, 0, {
            gain: ph === 'intro' ? a.gain * 0.8 : a.gain,
            decay: a.decay,
            cutoff: a.cutoff,
            cutoffEnd: a.cutoff * 0.25,
            q: 3,
            send: 0.35,
          });
        }
      }

      if (style.keys && at(style.keys.pattern) === 'x') {
        const len = (style.keys.pattern.indexOf('x', s + 1) === -1 ? 16 - s : style.keys.pattern.indexOf('x', s + 1) - s) * step;
        for (const n of chord) {
          // Electric piano: sine body plus a soft octave partial with tremolo-like detune.
          studio.voice('sine', freq(style.key + n), t + n * 0.004, Math.min(len, tailStart - t), { gain: style.keys.gain, attack: 0.01, release: 0.4, send: 0.3 });
          studio.voice('triangle', freq(style.key + n + 12), t + n * 0.004, 0, { gain: style.keys.gain * 0.25, decay: 0.6, detune: 6 });
        }
      }

      if (style.bells) {
        const c = at(style.bells.pattern);
        if (c !== '.') {
          const n = style.key + chordTone(chord, Number(c)) + 12 * style.bells.octave;
          studio.voice('sine', freq(n), t, 0, { gain: style.bells.gain, decay: 1.6, send: 0.6 });
          studio.voice('sine', freq(n) * 2.76, t, 0, { gain: style.bells.gain * 0.25, decay: 0.5, send: 0.6 });
        }
      }
    }
  }

  // Scene changes get a short cymbal swell and a light crash layered over the groove.
  for (const cut of tl.cuts) {
    if (cut <= tl.introEnd + 0.3 || cut >= tailStart - 0.2) continue;
    studio.riser(cut - 0.6, cut, style.riser * 0.35);
    studio.noiseHit(cut, { type: 'highpass', freq: 5200, dur: 1.4, gain: 0.07 * style.impact + 0.02, send: 0.5 });
  }
  // The intro is the one big moment: a full riser into the drop.
  if (tl.introEnd > 0.6) {
    studio.riser(Math.max(0, tl.introEnd - 1.1), tl.introEnd, style.riser * 0.8);
    studio.impact(tl.introEnd, style.impact);
  }

  // Resolve on the tonic and let it ring out.
  const tonic = style.chords[0];
  const tailLen = end - tailStart;
  for (const n of tonic) {
    studio.voice(style.pad?.type ?? 'triangle', freq(style.key + n), tailStart, tailLen - 0.4, { gain: 0.06, attack: 0.05, release: 0.35, cutoff: 1800, detune: 7, send: 0.6 });
    studio.voice('sine', freq(style.key + n + 12), tailStart, 0, { gain: 0.05, decay: tailLen, send: 0.5 });
  }
  studio.voice('sine', freq(style.key - 24), tailStart, tailLen - 0.4, { gain: 0.22, attack: 0.02, release: 0.35 });
  if (style.drums.kick || style.drums.tom) studio.impact(tailStart, style.impact * 0.5);

  if (style.vinyl) studio.vinyl(end);
}

/** Scales the mix so its loudest sample sits just under full scale, leaving headroom for the effects. */
function normalize(buffer: AudioBuffer) {
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  }
  if (peak > 0) {
    const k = 0.8 / peak;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const d = buffer.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] *= k;
    }
  }
  return buffer;
}

const cache = new Map<string, Promise<AudioBuffer>>();

export function renderTrack(id: string, timeline: MusicTimeline, sampleRate = 48000): Promise<AudioBuffer> {
  const style = STYLES[id] ?? STYLES.pulse;
  const key = JSON.stringify([id, sampleRate, timeline.duration.toFixed(2), timeline.introEnd.toFixed(2), timeline.cuts.map((c) => c.toFixed(2)), timeline.outroStart?.toFixed(2)]);
  let req = cache.get(key);
  if (!req) {
    const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(timeline.duration * sampleRate)), sampleRate);
    compose(new Studio(ctx), style, timeline);
    req = ctx.startRendering().then(normalize);
    if (cache.size > 12) cache.delete(cache.keys().next().value!);
    cache.set(key, req);
  }
  return req;
}

/** Arrangement points taken from the video plan. */
export function timelineFromPlan(plan: Plan): MusicTimeline {
  const intro = plan.segments.find((s) => s.kind === 'intro');
  const scenes = plan.segments.filter((s) => s.kind === 'scene');
  const outro = plan.segments.find((s) => s.kind === 'outro');
  return {
    duration: plan.duration,
    introEnd: intro ? intro.end : Math.min(1.2, plan.duration / 4),
    cuts: [...scenes.slice(1).map((s) => s.start), ...(outro ? [outro.start] : [])],
    outroStart: outro ? outro.start : null,
  };
}

const PREVIEW_TIMELINE: MusicTimeline = { duration: 14, introEnd: 2.4, cuts: [8.4], outroStart: null };

let previewCtx: AudioContext | null = null;
let previewSource: AudioBufferSourceNode | null = null;

/** Plays a short demo of a library track; resolves when it ends or is stopped. */
export async function auditionTrack(id: string, onEnded: () => void) {
  stopAudition();
  previewCtx ??= new AudioContext();
  if (previewCtx.state === 'suspended') await previewCtx.resume().catch(() => undefined);
  const buffer = await renderTrack(id, PREVIEW_TIMELINE, previewCtx.sampleRate);
  stopAudition();
  const src = previewCtx.createBufferSource();
  src.buffer = buffer;
  const gain = previewCtx.createGain();
  gain.gain.value = 0.8;
  src.connect(gain).connect(previewCtx.destination);
  src.onended = () => {
    if (previewSource === src) previewSource = null;
    onEnded();
  };
  src.start();
  previewSource = src;
}

export function stopAudition() {
  if (!previewSource) return;
  const src = previewSource;
  previewSource = null;
  try {
    src.stop();
  } catch {
    // already stopped
  }
}
