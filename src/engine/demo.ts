import { newGesture, newScene, blankProject } from './defaults';
import type { Project } from './types';

/**
 * Procedurally drawn screens for a fictional fintech app ("Pulse"), so a brand-new project
 * already plays as a complete, polished showcase.
 */
const W = 1179;
const H = 2556;
const BG = '#0b0d17';
const CARD = '#151829';
const LINE = '#23273d';
const MUTED = '#7f85a3';
const ACCENT_A = '#5b74ff';
const ACCENT_B = '#a35cf6';

type Ctx = CanvasRenderingContext2D;

const font = (weight: number, size: number) => `${weight} ${size}px "Inter", system-ui, sans-serif`;

function text(ctx: Ctx, s: string, x: number, y: number, size: number, weight = 400, color = '#fff', align: CanvasTextAlign = 'left') {
  ctx.font = font(weight, size);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(s, x, y);
}

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, stroke?: string) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function grad(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: string[]) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

function statusBar(ctx: Ctx) {
  text(ctx, '9:41', 150, 118, 50, 600, '#fff', 'center');
  // signal
  for (let i = 0; i < 4; i++) rr(ctx, 860 + i * 20, 106 - i * 9, 13, 14 + i * 9, 3, '#fff');
  // wifi
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(966, 118, 12 + i * 13, -Math.PI * 0.75, -Math.PI * 0.25);
    ctx.stroke();
  }
  // battery
  rr(ctx, 1010, 88, 78, 38, 11, 'rgba(0,0,0,0)', 'rgba(255,255,255,0.5)');
  rr(ctx, 1016, 94, 60, 26, 6, '#fff');
  rr(ctx, 1092, 100, 6, 14, 3, 'rgba(255,255,255,0.5)');
}

function homeIndicator(ctx: Ctx, y = H - 34) {
  rr(ctx, W / 2 - 145, y, 290, 12, 6, 'rgba(255,255,255,0.85)');
}

function base(height = H) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = height;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, height);
  const glow = ctx.createRadialGradient(W * 0.2, 0, 0, W * 0.2, 0, W * 1.1);
  glow.addColorStop(0, 'rgba(91,116,255,0.22)');
  glow.addColorStop(1, 'rgba(91,116,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, Math.min(height, 1400));
  statusBar(ctx);
  return { c, ctx };
}

function avatar(ctx: Ctx, x: number, y: number, r: number, initials: string, colors: string[]) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad(ctx, x - r, y - r, x + r, y + r, colors);
  ctx.fill();
  text(ctx, initials, x, y + r * 0.34, r * 0.82, 700, '#fff', 'center');
}

function icon(ctx: Ctx, kind: 'send' | 'request' | 'plus' | 'grid' | 'home' | 'chart' | 'card' | 'user' | 'back' | 'del', x: number, y: number, s: number, color = '#fff') {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = s * 0.12;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const line = (pts: number[][]) => {
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px * s, py * s) : ctx.moveTo(px * s, py * s)));
    ctx.stroke();
  };
  switch (kind) {
    case 'send':
      line([[-0.35, 0.35], [0.35, -0.35]]);
      line([[-0.1, -0.35], [0.35, -0.35], [0.35, 0.1]]);
      break;
    case 'request':
      line([[0.35, -0.35], [-0.35, 0.35]]);
      line([[0.1, 0.35], [-0.35, 0.35], [-0.35, -0.1]]);
      break;
    case 'plus':
      line([[-0.38, 0], [0.38, 0]]);
      line([[0, -0.38], [0, 0.38]]);
      break;
    case 'grid':
      for (const gx of [-0.22, 0.22]) for (const gy of [-0.22, 0.22]) {
        ctx.beginPath();
        ctx.arc(gx * s, gy * s, s * 0.11, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'home':
      line([[-0.4, -0.02], [0, -0.38], [0.4, -0.02]]);
      line([[-0.28, -0.1], [-0.28, 0.38], [0.28, 0.38], [0.28, -0.1]]);
      break;
    case 'chart':
      line([[-0.36, 0.36], [-0.36, 0.02]]);
      line([[0, 0.36], [0, -0.36]]);
      line([[0.36, 0.36], [0.36, -0.12]]);
      break;
    case 'card':
      ctx.strokeRect(-0.42 * s, -0.28 * s, 0.84 * s, 0.56 * s);
      line([[-0.42, -0.08], [0.42, -0.08]]);
      break;
    case 'user':
      ctx.beginPath();
      ctx.arc(0, -0.14 * s, 0.17 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0.42 * s, 0.34 * s, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      break;
    case 'back':
      line([[0.15, -0.35], [-0.2, 0], [0.15, 0.35]]);
      break;
    case 'del':
      line([[-0.45, 0], [-0.2, -0.28], [0.42, -0.28], [0.42, 0.28], [-0.2, 0.28], [-0.45, 0]]);
      line([[0, -0.1], [0.2, 0.1]]);
      line([[0.2, -0.1], [0, 0.1]]);
      break;
  }
  ctx.restore();
}

function tabBar(ctx: Ctx, active: number, top = H - 250) {
  ctx.fillStyle = 'rgba(16,18,32,0.96)';
  ctx.fillRect(0, top, W, 250);
  ctx.fillStyle = LINE;
  ctx.fillRect(0, top, W, 3);
  const items: [Parameters<typeof icon>[1], string][] = [
    ['home', 'Home'],
    ['chart', 'Insights'],
    ['card', 'Cards'],
    ['user', 'Profile'],
  ];
  items.forEach(([k, label], i) => {
    const x = (W / 4) * (i + 0.5);
    const color = i === active ? '#8ea2ff' : '#5f6584';
    icon(ctx, k, x, top + 80, 64, color);
    text(ctx, label, x, top + 160, 32, 600, color, 'center');
  });
  homeIndicator(ctx, top + 216);
}

function homeScreen() {
  const { c, ctx } = base();
  text(ctx, 'Good morning,', 72, 268, 44, 400, MUTED);
  text(ctx, 'Alex Morgan', 72, 344, 66, 700);
  avatar(ctx, W - 132, 296, 62, 'AM', ['#ff8a5b', '#ff4f8b']);

  const cardG = grad(ctx, 60, 420, W - 60, 980, ['#4b63ff', '#7c4dff', '#c06cff']);
  rr(ctx, 60, 420, W - 120, 560, 60, cardG);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(60, 420, W - 120, 560, 60);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.arc(W - 120, 470, 260, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W - 330, 1010, 200, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  text(ctx, 'Total balance', 124, 526, 40, 500, 'rgba(255,255,255,0.8)');
  text(ctx, '$12,480.52', 120, 668, 116, 800);
  rr(ctx, 124, 712, 470, 76, 38, 'rgba(255,255,255,0.18)');
  text(ctx, '▲ $1,204.10 this month', 154, 763, 34, 600);
  text(ctx, '•••• 4291', 124, 912, 40, 600, 'rgba(255,255,255,0.85)');
  text(ctx, 'PULSE', W - 124, 912, 46, 800, '#fff', 'right');

  const actions: [Parameters<typeof icon>[1], string][] = [
    ['send', 'Send'],
    ['request', 'Request'],
    ['plus', 'Top up'],
    ['grid', 'More'],
  ];
  actions.forEach(([k, label], i) => {
    const x = 60 + ((W - 120) / 4) * (i + 0.5);
    ctx.beginPath();
    ctx.arc(x, 1140, 78, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? grad(ctx, x - 78, 1062, x + 78, 1218, [ACCENT_A, ACCENT_B]) : CARD;
    ctx.fill();
    if (i !== 0) {
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    icon(ctx, k, x, 1140, 64);
    text(ctx, label, x, 1278, 36, 600, '#c9cde0', 'center');
  });

  text(ctx, 'Recent activity', 72, 1418, 50, 700);
  text(ctx, 'See all', W - 72, 1418, 38, 600, '#8ea2ff', 'right');
  const rows: [string, string, string, string, string[]][] = [
    ['Maya Chen', 'Today · 9:12', '+$250.00', '#4ade80', ['#ff8a5b', '#ff4f8b']],
    ['Blue Bottle Coffee', 'Today · 8:03', '−$6.40', '#fff', ['#38bdf8', '#2563eb']],
    ['Streamflix', 'Yesterday', '−$15.99', '#fff', ['#f43f5e', '#9f1239']],
    ['Whole Market', 'Oct 29', '−$84.21', '#fff', ['#22c55e', '#15803d']],
    ['Acme Inc · Salary', 'Oct 28', '+$4,200.00', '#4ade80', ['#a78bfa', '#6d28d9']],
  ];
  rows.forEach(([name, sub, amt, color, colors], i) => {
    const y = 1480 + i * 168;
    rr(ctx, 72, y, 116, 116, 34, grad(ctx, 72, y, 188, y + 116, colors));
    text(ctx, name.slice(0, 1), 130, y + 76, 52, 700, '#fff', 'center');
    text(ctx, name, 220, y + 52, 42, 600);
    text(ctx, sub, 220, y + 102, 34, 400, MUTED);
    text(ctx, amt, W - 72, y + 74, 44, 700, color, 'right');
  });
  tabBar(ctx, 0);
  return c;
}

function sendScreen() {
  const { c, ctx } = base();
  icon(ctx, 'back', 100, 262, 64);
  text(ctx, 'Send money', W / 2, 282, 54, 700, '#fff', 'center');
  avatar(ctx, W / 2, 480, 100, 'MC', ['#ff8a5b', '#ff4f8b']);
  text(ctx, 'Maya Chen', W / 2, 660, 56, 700, '#fff', 'center');
  text(ctx, '@mayachen', W / 2, 722, 38, 400, MUTED, 'center');
  text(ctx, '$250.00', W / 2, 980, 176, 800, '#fff', 'center');
  text(ctx, 'Balance  $12,480.52', W / 2, 1060, 38, 500, MUTED, 'center');
  rr(ctx, W / 2 - 230, 1110, 460, 86, 43, CARD, LINE);
  text(ctx, 'For: Pizza night', W / 2, 1166, 36, 600, '#c9cde0', 'center');

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];
  keys.forEach((k, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 60 + ((W - 120) / 3) * (col + 0.5);
    const y = 1340 + row * 196;
    if (k === 'del') icon(ctx, 'del', x, y, 70);
    else text(ctx, k, x, y + 26, 76, 500, '#fff', 'center');
  });
  rr(ctx, 60, 2186, W - 120, 176, 88, grad(ctx, 60, 2186, W - 60, 2362, [ACCENT_A, ACCENT_B]));
  text(ctx, 'Send $250.00', W / 2, 2292, 56, 700, '#fff', 'center');
  homeIndicator(ctx);
  return c;
}

function successScreen() {
  const { c, ctx } = base();
  const glow = ctx.createRadialGradient(W / 2, 880, 0, W / 2, 880, 700);
  glow.addColorStop(0, 'rgba(34,197,94,0.35)');
  glow.addColorStop(1, 'rgba(34,197,94,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 200, W, 1400);
  for (let i = 3; i >= 1; i--) {
    ctx.beginPath();
    ctx.arc(W / 2, 880, 210 + i * 70, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(34,197,94,${0.06 * (4 - i)})`;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(W / 2, 880, 210, 0, Math.PI * 2);
  ctx.fillStyle = grad(ctx, W / 2 - 210, 670, W / 2 + 210, 1090, ['#4ade80', '#10b981']);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 34;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(W / 2 - 95, 885);
  ctx.lineTo(W / 2 - 25, 955);
  ctx.lineTo(W / 2 + 105, 815);
  ctx.stroke();
  text(ctx, 'Payment sent!', W / 2, 1290, 84, 800, '#fff', 'center');
  text(ctx, '$250.00 to Maya Chen', W / 2, 1372, 46, 500, MUTED, 'center');
  rr(ctx, 60, 1480, W - 120, 520, 52, CARD, LINE);
  const details = [
    ['Reference', '#PX-48291'],
    ['Date', 'Oct 31, 2026'],
    ['Fee', 'Free'],
    ['Arrives', 'Instantly'],
  ];
  details.forEach(([k, v], i) => {
    const y = 1600 + i * 118;
    text(ctx, k, 124, y, 40, 500, MUTED);
    text(ctx, v, W - 124, y, 40, 600, i === 3 ? '#4ade80' : '#fff', 'right');
    if (i < 3) {
      ctx.fillStyle = LINE;
      ctx.fillRect(124, y + 44, W - 248, 3);
    }
  });
  rr(ctx, 60, 2186, W - 120, 176, 88, grad(ctx, 60, 2186, W - 60, 2362, [ACCENT_A, ACCENT_B]));
  text(ctx, 'Done', W / 2, 2292, 56, 700, '#fff', 'center');
  homeIndicator(ctx);
  return c;
}

function insightsScreen() {
  const height = 4300;
  const { c, ctx } = base(height);
  text(ctx, 'Insights', 72, 310, 84, 800);
  rr(ctx, 72, 370, W - 144, 104, 52, CARD, LINE);
  ['Week', 'Month', 'Year'].forEach((label, i) => {
    const w = (W - 144) / 3;
    if (i === 1) rr(ctx, 80 + w * i, 378, w - 16, 88, 44, grad(ctx, 0, 0, W, 0, [ACCENT_A, ACCENT_B]));
    text(ctx, label, 72 + w * (i + 0.5), 436, 38, 600, i === 1 ? '#fff' : MUTED, 'center');
  });

  rr(ctx, 60, 540, W - 120, 820, 56, CARD, LINE);
  text(ctx, 'Spending', 120, 640, 40, 500, MUTED);
  text(ctx, '$3,284.20', 120, 750, 96, 800);
  rr(ctx, 120, 790, 330, 70, 35, 'rgba(74,222,128,0.16)');
  text(ctx, '▼ 12% vs Sept', 148, 838, 34, 600, '#4ade80');
  const pts = [0.62, 0.48, 0.55, 0.32, 0.4, 0.22, 0.3, 0.12, 0.2, 0.08];
  const cx0 = 120;
  const cx1 = W - 120;
  const cy0 = 920;
  const cy1 = 1290;
  const P = pts.map((p, i) => [cx0 + ((cx1 - cx0) * i) / (pts.length - 1), cy0 + (cy1 - cy0) * (0.15 + p)] as const);
  ctx.beginPath();
  P.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x, y);
    else {
      const [px, py] = P[i - 1];
      ctx.bezierCurveTo((px + x) / 2, py, (px + x) / 2, y, x, y);
    }
  });
  ctx.lineTo(cx1, cy1 + 40);
  ctx.lineTo(cx0, cy1 + 40);
  ctx.closePath();
  const area = ctx.createLinearGradient(0, cy0, 0, cy1 + 40);
  area.addColorStop(0, 'rgba(124,99,255,0.5)');
  area.addColorStop(1, 'rgba(124,99,255,0)');
  ctx.fillStyle = area;
  ctx.fill();
  ctx.beginPath();
  P.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x, y);
    else {
      const [px, py] = P[i - 1];
      ctx.bezierCurveTo((px + x) / 2, py, (px + x) / 2, y, x, y);
    }
  });
  ctx.strokeStyle = grad(ctx, cx0, 0, cx1, 0, [ACCENT_A, ACCENT_B, '#ff6fb5']);
  ctx.lineWidth = 10;
  ctx.stroke();
  const [hx, hy] = P[6];
  ctx.beginPath();
  ctx.arc(hx, hy, 20, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  rr(ctx, hx - 120, hy - 140, 240, 92, 30, '#fff');
  text(ctx, '$412', hx, hy - 78, 44, 800, '#111', 'center');

  rr(ctx, 60, 1430, W - 120, 940, 56, CARD, LINE);
  text(ctx, 'Top categories', 120, 1530, 48, 700);
  const cats: [string, number, string, string[]][] = [
    ['Food & dining', 0.32, '$1,050', ['#fb923c', '#f43f5e']],
    ['Shopping', 0.24, '$788', ['#a78bfa', '#6366f1']],
    ['Bills', 0.17, '$558', ['#38bdf8', '#2563eb']],
    ['Transport', 0.15, '$492', ['#4ade80', '#059669']],
    ['Entertainment', 0.12, '$394', ['#f472b6', '#c026d3']],
  ];
  cats.forEach(([name, share, amount, colors], i) => {
    const y = 1600 + i * 150;
    rr(ctx, 120, y, 96, 96, 28, grad(ctx, 120, y, 216, y + 96, colors));
    text(ctx, name, 248, y + 42, 40, 600);
    text(ctx, amount, W - 120, y + 42, 40, 700, '#fff', 'right');
    rr(ctx, 248, y + 70, W - 368, 18, 9, LINE);
    rr(ctx, 248, y + 70, (W - 368) * share * 2.4, 18, 9, grad(ctx, 248, 0, W - 120, 0, colors));
  });

  rr(ctx, 60, 2440, W - 120, 720, 56, CARD, LINE);
  text(ctx, 'Savings goals', 120, 2540, 48, 700);
  const goals: [string, number, string][] = [
    ['New laptop', 0.68, '$1,632 of $2,400'],
    ['Japan trip', 0.42, '$2,100 of $5,000'],
  ];
  goals.forEach(([name, p, sub], i) => {
    const x = 120 + i * ((W - 240) / 2);
    const cx = x + 210;
    const cy = 2800;
    ctx.lineWidth = 34;
    ctx.lineCap = 'round';
    ctx.strokeStyle = LINE;
    ctx.beginPath();
    ctx.arc(cx, cy, 150, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = grad(ctx, cx - 150, cy - 150, cx + 150, cy + 150, i ? ['#38bdf8', '#4ade80'] : [ACCENT_A, ACCENT_B]);
    ctx.beginPath();
    ctx.arc(cx, cy, 150, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
    ctx.stroke();
    text(ctx, `${Math.round(p * 100)}%`, cx, cy + 22, 64, 800, '#fff', 'center');
    text(ctx, name, cx, cy + 250, 42, 700, '#fff', 'center');
    text(ctx, sub, cx, cy + 306, 32, 500, MUTED, 'center');
  });

  rr(ctx, 60, 3230, W - 120, 760, 56, CARD, LINE);
  text(ctx, 'Upcoming bills', 120, 3330, 48, 700);
  const bills: [string, string, string][] = [
    ['Rent', 'Due Nov 1', '$1,850.00'],
    ['Electricity', 'Due Nov 4', '$96.20'],
    ['Gym membership', 'Due Nov 9', '$45.00'],
    ['Phone plan', 'Due Nov 12', '$39.99'],
  ];
  bills.forEach(([name, due, amt], i) => {
    const y = 3400 + i * 140;
    text(ctx, name, 120, y + 50, 42, 600);
    text(ctx, due, 120, y + 98, 34, 400, MUTED);
    text(ctx, amt, W - 120, y + 74, 42, 700, '#fff', 'right');
  });
  tabBar(ctx, 1, height - 250);
  return c;
}

export async function createDemoProject(): Promise<Project> {
  if (document.fonts) {
    await Promise.all([400, 500, 600, 700, 800].map((w) => document.fonts.load(`${w} 40px "Inter"`).catch(() => undefined)));
  }
  const url = (c: HTMLCanvasElement) => c.toDataURL('image/jpeg', 0.9);
  const project = blankProject();
  project.name = 'Pulse — launch video';
  project.intro = { enabled: true, title: 'Pulse', subtitle: 'Money, *beautifully* simple.', duration: 2.6 };
  project.outro = { enabled: true, title: 'Get *Pulse* today', subtitle: 'Free on iOS and Android.', cta: 'Download now', duration: 3.6 };
  project.scenes = [
    newScene({
      eyebrow: 'Overview',
      title: 'Your money, *at a glance*',
      subtitle: 'Every account, card and payment in one calm, beautiful dashboard.',
      image: url(homeScreen()),
      textAnim: 'rise',
      camera: 'float',
      transition: 'glide',
      duration: 4.6,
      gestures: [newGesture({ at: 2.3, x: 16.3, y: 44.6, zoom: 1.9, label: 'Tap Send' })],
    }),
    newScene({
      eyebrow: 'Payments',
      title: 'Send in *seconds*',
      subtitle: 'Pick a friend, type an amount, done. No fees between friends.',
      image: url(sendScreen()),
      textAnim: 'blur',
      camera: 'dolly',
      transition: 'push',
      duration: 4.4,
      gestures: [newGesture({ at: 2.5, x: 50, y: 89, zoom: 1.6, label: 'Confirm instantly' })],
    }),
    newScene({
      eyebrow: 'Confidence',
      title: 'Instant *confirmation*',
      subtitle: 'Real-time receipts, so you always know where your money went.',
      image: url(successScreen()),
      textAnim: 'pop',
      camera: 'orbit',
      transition: 'zoom',
      duration: 3.8,
      gestures: [],
    }),
    newScene({
      eyebrow: 'Insights',
      title: 'See where it *all goes*',
      subtitle: 'Smart charts surface your spending patterns automatically.',
      image: url(insightsScreen()),
      textAnim: 'type',
      camera: 'tilt',
      transition: 'flip',
      duration: 5,
      gestures: [newGesture({ kind: 'scroll', at: 1.7, x: 50, y: 72, zoom: 1.15, scrollTo: 100, label: '' })],
    }),
  ];
  return project;
}
