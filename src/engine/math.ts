export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) => (a === b ? (v >= b ? 1 : 0) : clamp((v - a) / (b - a)));
export const smoothstep = (a: number, b: number, v: number) => {
  const t = invLerp(a, b, v);
  return t * t * (3 - 2 * t);
};

export type Easing = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inCubic: (t: number) => t * t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  outQuint: (t: number) => 1 - Math.pow(1 - t, 5),
  inOutQuint: (t: number) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  outExpo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
} satisfies Record<string, Easing>;

/** Eased progress of `t` through the window [start, start + duration]. */
export const tween = (t: number, start: number, duration: number, easing: Easing = ease.linear) =>
  easing(clamp((t - start) / Math.max(1e-6, duration)));

/** Unit step response of a damped spring released at rest. */
export function springStep(tau: number, omega: number, zeta: number) {
  if (tau <= 0) return 0;
  if (zeta >= 1) {
    const x = omega * tau;
    return 1 - Math.exp(-x) * (1 + x);
  }
  const root = Math.sqrt(1 - zeta * zeta);
  const wd = omega * root;
  return 1 - Math.exp(-zeta * omega * tau) * (Math.cos(wd * tau) + (zeta / root) * Math.sin(wd * tau));
}

export interface SpringOpts {
  omega?: number;
  zeta?: number;
}

interface Key {
  t: number;
  value: number;
  set: boolean;
  omega: number;
  zeta: number;
  order: number;
}

interface Event {
  t: number;
  set: boolean;
  value: number;
  delta: number;
  omega: number;
  zeta: number;
}

/**
 * A deterministic animation channel. Targets are reached with damped springs whose step responses are
 * superimposed, so overlapping moves blend physically while any time can still be evaluated directly.
 */
export class Track {
  private keys: Key[] = [];
  private events: Event[] = [];
  private initial: number;

  constructor(initial: number) {
    this.initial = initial;
  }

  to(t: number, value: number, opts: SpringOpts = {}) {
    this.keys.push({ t, value, set: false, omega: opts.omega ?? 7, zeta: opts.zeta ?? 1, order: this.keys.length });
    return this;
  }

  /** Jump instantly to a value, cancelling any motion in flight. */
  set(t: number, value: number) {
    this.keys.push({ t, value, set: true, omega: 0, zeta: 0, order: this.keys.length });
    return this;
  }

  finalize() {
    const sorted = [...this.keys].sort((a, b) => a.t - b.t || a.order - b.order);
    let target = this.initial;
    this.events = [];
    for (const key of sorted) {
      if (key.set) {
        this.events.push({ t: key.t, set: true, value: key.value, delta: 0, omega: 0, zeta: 0 });
        target = key.value;
        continue;
      }
      const delta = key.value - target;
      if (Math.abs(delta) < 1e-9) continue;
      this.events.push({ t: key.t, set: false, value: key.value, delta, omega: key.omega, zeta: key.zeta });
      target = key.value;
    }
    return this;
  }

  value(t: number) {
    const events = this.events;
    let v = this.initial;
    let start = 0;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].set && events[i].t <= t) {
        v = events[i].value;
        start = i + 1;
        break;
      }
    }
    for (let i = start; i < events.length; i++) {
      const e = events[i];
      if (e.t > t) break;
      v += e.delta * springStep(t - e.t, e.omega, e.zeta);
    }
    return v;
  }
}

/** Deterministic pseudo-random number in [0, 1) for an integer seed. */
export function hash(n: number) {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, alpha: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha)})`;
}

export function mixHex(a: string, b: string, t: number) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const c = ca.map((v, i) => Math.round(lerp(v, cb[i], t)));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
