import { rgba } from './math';
import type { TouchFx } from './plan';
import type { ScreenFit } from './types';

/** Texture size for the phone display (matches the model's 0.463 screen aspect). */
export const SCREEN_W = 1080;
export const SCREEN_H = 2334;

export interface ScreenLayer {
  image: HTMLImageElement | null;
  fit: ScreenFit;
  scroll: number;
}

export interface ScreenState {
  a: ScreenLayer;
  b: ScreenLayer | null;
  mix: number;
  mode: 'fade' | 'push' | 'cut';
  touches: TouchFx[];
  accent: string;
  accent2: string;
}

const imageIds = new WeakMap<HTMLImageElement, number>();
let nextImageId = 1;
const idOf = (img: HTMLImageElement | null) => {
  if (!img) return 0;
  let id = imageIds.get(img);
  if (!id) {
    id = nextImageId++;
    imageIds.set(img, id);
  }
  return id;
};

/** How far a layer can scroll, in percent of its own height; 0 when the image fits. */
export function scrollRange(img: HTMLImageElement | null, fit: ScreenFit) {
  if (!img || fit === 'contain') return 0;
  const s = fit === 'cover' ? Math.max(SCREEN_W / img.naturalWidth, SCREEN_H / img.naturalHeight) : SCREEN_W / img.naturalWidth;
  return Math.max(0, img.naturalHeight * s - SCREEN_H);
}

export class ScreenPainter {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private key = '';
  readonly w: number;
  readonly h: number;

  constructor(scale = 1) {
    this.w = Math.round(SCREEN_W * scale);
    this.h = Math.round(SCREEN_H * scale);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.ctx = this.canvas.getContext('2d')!;
  }

  invalidate() {
    this.key = '';
  }

  /** Repaints only when the visible state changed. Returns true when the texture needs an upload. */
  paint(state: ScreenState): boolean {
    const key = [
      idOf(state.a.image),
      state.a.fit,
      state.a.scroll.toFixed(4),
      state.b ? `${idOf(state.b.image)}${state.b.fit}${state.b.scroll.toFixed(4)}` : '-',
      state.mix.toFixed(3),
      state.mode,
      state.accent,
      state.touches.map((t) => [t.x, t.y, t.opacity, t.scale, t.ring, t.hold, t.trailFrom ?? -1].map((v) => v.toFixed(3)).join(',')).join(';'),
    ].join('|');
    if (key === this.key) return false;
    this.key = key;

    const { ctx, w } = this;
    const k = w / SCREEN_W;
    ctx.save();
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    if (!state.b) {
      this.drawLayer(state.a, state);
    } else if (state.mode === 'push') {
      const p = state.mix;
      ctx.save();
      ctx.translate(-p * SCREEN_W * 0.3, 0);
      this.drawLayer(state.a, state);
      ctx.fillStyle = `rgba(0,0,0,${0.3 * p})`;
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      ctx.restore();
      ctx.save();
      const x = (1 - p) * SCREEN_W;
      ctx.translate(x, 0);
      const shade = ctx.createLinearGradient(-60, 0, 0, 0);
      shade.addColorStop(0, 'rgba(0,0,0,0)');
      shade.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = shade;
      ctx.fillRect(-60, 0, 60, SCREEN_H);
      ctx.beginPath();
      ctx.rect(0, 0, SCREEN_W, SCREEN_H);
      ctx.clip();
      this.drawLayer(state.b, state);
      ctx.restore();
    } else {
      this.drawLayer(state.a, state);
      ctx.save();
      ctx.globalAlpha = state.mix;
      this.drawLayer(state.b, state);
      ctx.restore();
    }

    for (const touch of state.touches) this.drawTouch(touch, state.accent);
    ctx.restore();
    return true;
  }

  private drawLayer(layer: ScreenLayer, state: ScreenState) {
    const { ctx } = this;
    const img = layer.image;
    if (!img) {
      this.drawPlaceholder(state);
      return;
    }
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    let s: number;
    if (layer.fit === 'cover') s = Math.max(SCREEN_W / iw, SCREEN_H / ih);
    else if (layer.fit === 'contain') s = Math.min(SCREEN_W / iw, SCREEN_H / ih);
    else s = SCREEN_W / iw;
    const dw = iw * s;
    const dh = ih * s;
    const dx = (SCREEN_W - dw) / 2;
    let dy: number;
    if (layer.fit === 'contain' || dh <= SCREEN_H) dy = (SCREEN_H - dh) / 2;
    else dy = -layer.scroll * (dh - SCREEN_H);
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  private drawPlaceholder(state: ScreenState) {
    const { ctx } = this;
    const g = ctx.createLinearGradient(0, 0, SCREEN_W, SCREEN_H);
    g.addColorStop(0, '#0d1020');
    g.addColorStop(1, '#151a33');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    const glow = ctx.createRadialGradient(SCREEN_W * 0.3, SCREEN_H * 0.2, 0, SCREEN_W * 0.3, SCREEN_H * 0.2, SCREEN_W);
    glow.addColorStop(0, rgba(state.accent, 0.35));
    glow.addColorStop(1, rgba(state.accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    const bar = (x: number, y: number, w: number, h: number, r = h / 2) => {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
    };
    bar(80, 230, 420, 54);
    bar(80, 310, 640, 34);
    bar(80, 420, SCREEN_W - 160, 420, 48);
    for (let i = 0; i < 5; i++) {
      bar(80, 910 + i * 170, 110, 110, 32);
      bar(220, 935 + i * 170, 420, 30);
      bar(220, 985 + i * 170, 260, 24);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '600 52px "Inter", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Drop a screenshot', SCREEN_W / 2, SCREEN_H * 0.86);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '400 38px "Inter", system-ui, sans-serif';
    ctx.fillText('PNG or JPG · any height', SCREEN_W / 2, SCREEN_H * 0.86 + 66);
    ctx.textAlign = 'left';
  }

  private drawTouch(t: ScreenState['touches'][number], accent: string) {
    if (t.opacity <= 0.001) return;
    const { ctx } = this;
    const x = (t.x / 100) * SCREEN_W;
    const y = (t.y / 100) * SCREEN_H;
    const r = SCREEN_W * 0.068;
    ctx.save();
    ctx.globalAlpha = t.opacity;

    if (t.trailFrom !== null) {
      const y0 = (t.trailFrom / 100) * SCREEN_H;
      const g = ctx.createLinearGradient(0, y0, 0, y);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(255,255,255,0.4)');
      ctx.strokeStyle = g;
      ctx.lineWidth = r * 1.15;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    if (t.ringOpacity > 0) {
      ctx.save();
      ctx.globalAlpha = t.opacity * t.ringOpacity;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = r * 0.14 * (1 - t.ring) + 2;
      ctx.beginPath();
      ctx.arc(x, y, r * (1 + t.ring * 2.3), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = r * 0.5;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(x, y, r * t.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = r * 0.085;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.3 * t.scale, 0, Math.PI * 2);
    ctx.fill();

    if (t.hold > 0) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = r * 0.14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(x, y, r * 1.32, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t.hold);
      ctx.stroke();
    }
    ctx.restore();
  }
}
