import { hash, rgba } from './math';
import type { Background } from './types';

interface BgContext {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  t: number;
  /** Phone position, used for spotlights and parallax. */
  anchor: { x: number; y: number };
  dark: boolean;
  accent: string;
  frame: number;
}

let grainTile: HTMLCanvasElement | null = null;

function getGrain() {
  if (grainTile) return grainTile;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const data = g.createImageData(256, 256);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(hash(i * 7 + 13) * 255);
    data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  g.putImageData(data, 0, 0);
  grainTile = c;
  return c;
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.45, rgba(color, alpha * 0.42));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function drawAurora(b: BgContext, bg: Background, light: boolean) {
  const { ctx, W, H, t, anchor } = b;
  const M = Math.max(W, H);
  const px = (anchor.x - W / 2) * -0.04;
  const py = (anchor.y - H / 2) * -0.03;
  ctx.fillStyle = bg.base;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalCompositeOperation = light ? 'source-over' : 'screen';
  const [c0, c1, c2] = bg.colors;
  const a = light ? 0.9 : 0.5;
  blob(ctx, W * (0.22 + 0.1 * Math.sin(t * 0.13)) + px, H * (0.28 + 0.1 * Math.cos(t * 0.11)) + py, M * 0.62, c0, a);
  blob(ctx, W * (0.78 + 0.09 * Math.cos(t * 0.09 + 1)) + px * 1.4, H * (0.7 + 0.1 * Math.sin(t * 0.12 + 2)) + py, M * 0.58, c1, a);
  blob(ctx, W * (0.55 + 0.14 * Math.sin(t * 0.07 + 4)) + px * 0.7, H * (0.12 + 0.08 * Math.cos(t * 0.1 + 3)) + py, M * 0.45, c2, a * 0.85);
  blob(ctx, W * (0.08 + 0.06 * Math.sin(t * 0.15 + 2)) + px, H * (0.92 + 0.05 * Math.cos(t * 0.13)) + py, M * 0.4, c2, a * 0.6);
  ctx.restore();
}

function drawSpotlight(b: BgContext, bg: Background) {
  const { ctx, W, H, t, anchor } = b;
  const M = Math.max(W, H);
  ctx.fillStyle = bg.base;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const sx = W / 2 + (anchor.x - W / 2) * 0.55;
  const sy = H * 0.42 + (anchor.y - H / 2) * 0.2;
  blob(ctx, sx, sy, M * 0.55, bg.colors[0], 0.22 + 0.03 * Math.sin(t * 0.8));
  blob(ctx, sx, sy, M * 0.22, bg.colors[1], 0.16);
  blob(ctx, W * 0.15 + Math.sin(t * 0.1) * W * 0.05, H * 1.05, M * 0.5, bg.colors[2], 0.28);
  blob(ctx, W * 0.9, H * -0.1 + Math.cos(t * 0.09) * H * 0.05, M * 0.42, bg.colors[2], 0.18);
  ctx.restore();
  const floor = ctx.createLinearGradient(0, H * 0.7, 0, H);
  floor.addColorStop(0, 'rgba(0,0,0,0)');
  floor.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = floor;
  ctx.fillRect(0, H * 0.7, W, H * 0.3);
}

function drawGrid(b: BgContext, bg: Background) {
  const { ctx, W, H, t, anchor } = b;
  const M = Math.max(W, H);
  ctx.fillStyle = bg.base;
  ctx.fillRect(0, 0, W, H);
  const horizon = H * 0.6;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  blob(ctx, W / 2 + (anchor.x - W / 2) * 0.2, horizon, M * 0.6, bg.colors[2], 0.42);
  blob(ctx, W * 0.5, horizon, M * 0.3, bg.colors[0], 0.38);
  blob(ctx, W * 0.15, H * 0.15, M * 0.35, bg.colors[1], 0.18);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, horizon, W, H - horizon);
  ctx.clip();
  const fade = ctx.createLinearGradient(0, horizon, 0, H);
  fade.addColorStop(0, rgba(bg.colors[1], 0));
  fade.addColorStop(1, rgba(bg.colors[1], 0.55));
  ctx.strokeStyle = fade;
  ctx.lineWidth = 1.6;
  const vx = W / 2 + (anchor.x - W / 2) * -0.08;
  const n = 18;
  for (let i = -n; i <= n; i++) {
    ctx.beginPath();
    ctx.moveTo(vx + i * W * 0.012, horizon);
    ctx.lineTo(vx + i * W * 0.16, H);
    ctx.stroke();
  }
  const speed = 0.35;
  for (let k = 0; k < 14; k++) {
    const z = (k + ((t * speed) % 1)) / 14;
    const y = horizon + (H - horizon) * Math.pow(z, 2.4);
    ctx.globalAlpha = Math.min(1, z * 1.5);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore();
  const haze = ctx.createLinearGradient(0, horizon - H * 0.08, 0, horizon + H * 0.06);
  haze.addColorStop(0, rgba(bg.colors[0], 0));
  haze.addColorStop(0.5, rgba(bg.colors[0], 0.22));
  haze.addColorStop(1, rgba(bg.colors[0], 0));
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - H * 0.08, W, H * 0.14);
}

function drawGradient(b: BgContext, bg: Background) {
  const { ctx, W, H, t, anchor } = b;
  const angle = 0.6 + Math.sin(t * 0.08) * 0.25;
  const r = Math.hypot(W, H) / 2;
  const cx = W / 2;
  const cy = H / 2;
  const g = ctx.createLinearGradient(cx - Math.cos(angle) * r, cy - Math.sin(angle) * r, cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
  g.addColorStop(0, bg.colors[0]);
  g.addColorStop(0.55, bg.colors[1]);
  g.addColorStop(1, bg.colors[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  blob(ctx, anchor.x, anchor.y, Math.max(W, H) * 0.5, '#ffffff', 0.5);
  ctx.restore();
  ctx.fillStyle = rgba(bg.base, 0.25);
  ctx.fillRect(0, 0, W, H);
}

function drawStudio(b: BgContext, bg: Background) {
  const { ctx, W, H, anchor } = b;
  const M = Math.max(W, H);
  ctx.fillStyle = bg.base;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2 + (anchor.x - W / 2) * 0.3, H * 0.4, 0, W / 2, H * 0.45, M * 0.75);
  g.addColorStop(0, bg.colors[0]);
  g.addColorStop(0.5, bg.base);
  g.addColorStop(1, bg.colors[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const floor = ctx.createLinearGradient(0, H * 0.65, 0, H);
  floor.addColorStop(0, rgba(bg.colors[1], 0));
  floor.addColorStop(1, rgba(bg.colors[2], 0.55));
  ctx.fillStyle = floor;
  ctx.fillRect(0, H * 0.65, W, H * 0.35);
}

function drawParticles(b: BgContext, bg: Background) {
  const { ctx, W, H, t, dark } = b;
  ctx.save();
  ctx.globalCompositeOperation = dark ? 'screen' : 'source-over';
  const count = 46;
  for (let i = 0; i < count; i++) {
    const speed = 8 + hash(i + 300) * 26;
    const x = hash(i) * W + Math.sin(t * 0.3 + i) * 14;
    const y = (((hash(i + 100) * H - t * speed) % (H + 40)) + H + 40) % (H + 40) - 20;
    const size = 1.2 + hash(i + 200) * 3.2;
    const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (0.6 + hash(i + 400)) + i * 2.1));
    ctx.globalAlpha = (dark ? 0.55 : 0.4) * tw;
    ctx.fillStyle = dark ? (i % 3 === 0 ? bg.colors[1] : '#ffffff') : bg.colors[i % 3];
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 6; i++) {
    const x = (hash(i + 900) * W + t * (6 + i * 3)) % (W + 300) - 150;
    const y = hash(i + 950) * H + Math.sin(t * 0.2 + i) * 30;
    const r = 40 + hash(i + 990) * 90;
    ctx.globalAlpha = dark ? 0.12 : 0.18;
    blob(ctx, x, y, r, bg.colors[i % 3], 0.7);
  }
  ctx.restore();
}

export function drawBackground(b: BgContext, bg: Background) {
  switch (bg.kind) {
    case 'mesh':
      drawAurora(b, bg, true);
      break;
    case 'spotlight':
      drawSpotlight(b, bg);
      break;
    case 'grid':
      drawGrid(b, bg);
      break;
    case 'gradient':
      drawGradient(b, bg);
      break;
    case 'studio':
      drawStudio(b, bg);
      break;
    default:
      drawAurora(b, bg, false);
  }
  if (bg.particles) drawParticles(b, bg);
}

export function drawFinish(b: BgContext, bg: Background) {
  const { ctx, W, H, frame, dark } = b;
  if (bg.vignette) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, dark ? 'rgba(0,0,0,0.5)' : 'rgba(30,35,50,0.14)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  if (bg.grain) {
    const tile = getGrain();
    const pattern = ctx.createPattern(tile, 'repeat');
    if (pattern) {
      ctx.save();
      ctx.globalAlpha = dark ? 0.055 : 0.04;
      ctx.globalCompositeOperation = 'overlay';
      const ox = Math.floor(hash(frame) * 256);
      const oy = Math.floor(hash(frame + 7777) * 256);
      ctx.translate(-ox, -oy);
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, W + 256, H + 256);
      ctx.restore();
    }
  }
}
