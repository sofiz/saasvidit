import { getImage } from './assets';
import { drawBackground, drawFinish } from './background';
import { resolveStyle } from './defaults';
import { DeviceRenderer } from './device';
import { PHONE_ASPECT, STAGES } from './layout';
import { clamp, ease, lerp, rgba, springStep } from './math';
import { buildPlan, evaluate, type FrameState, type Plan } from './plan';
import { ScreenPainter, type ScreenLayer } from './screen';
import { drawTextBlock, layoutText, type TextBlock, type TextContent } from './text';
import type { Project, TextAnim, TextStyle } from './types';

export type Quality = 'preview' | 'export';

/** Renders a project at any point in time onto a 2D canvas: background, copy, the 3D device and overlays. */
export class Compositor {
  readonly canvas: HTMLCanvasElement;
  readonly device: DeviceRenderer;
  plan: Plan | null = null;
  lastState: FrameState | null = null;
  private ctx: CanvasRenderingContext2D;
  private screen: ScreenPainter;
  private project: Project | null = null;
  private textCache = new Map<string, TextBlock>();
  private stage = STAGES['16:9'];
  private scale = 1;
  private supportsFilter: boolean;

  constructor(canvas: HTMLCanvasElement, quality: Quality = 'preview') {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.screen = new ScreenPainter(quality === 'export' ? 1 : 0.72);
    this.device = new DeviceRenderer(this.screen.canvas, quality);
    this.supportsFilter = typeof (this.ctx as { filter?: unknown }).filter === 'string';
  }

  get ready() {
    return this.device.ready;
  }

  get stageSize() {
    return this.stage;
  }

  setProject(project: Project) {
    if (project === this.project) return;
    const aspectChanged = this.project?.aspect !== project.aspect;
    this.project = project;
    this.plan = buildPlan(project);
    this.stage = STAGES[project.aspect];
    this.screen.invalidate();
    if (aspectChanged) this.setResolution(this.canvas.width || this.stage.w);
  }

  invalidate() {
    this.textCache.clear();
    this.screen.invalidate();
  }

  setResolution(pixelW: number) {
    const w = Math.max(2, Math.round(pixelW / 2) * 2);
    const h = Math.max(2, Math.round((w * this.stage.h) / this.stage.w / 2) * 2);
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    this.scale = w / this.stage.w;
    this.device.setSize(w, h, this.stage.w, this.stage.h);
  }

  render(t: number, frame = Math.round(t * 30)) {
    const { plan, project, ctx } = this;
    if (!plan || !project) return;
    const { w: W, h: H } = this.stage;
    const state = evaluate(plan, clamp(t, 0, plan.duration));
    this.lastState = state;

    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (this.supportsFilter) ctx.filter = 'none';

    const bg = { ctx, W, H, t, anchor: { x: state.pose.cx, y: state.pose.cy }, dark: project.dark, accent: project.accent, frame };
    drawBackground(bg, project.background);
    this.drawAura(state);
    this.drawCopy(state);

    this.paintScreen(state);
    this.device.setPose(state.pose);
    if (this.device.isReady) ctx.drawImage(this.device.render(), 0, 0, W, H);

    this.drawCallouts(state);
    this.drawOverlays(state);
    drawFinish(bg, project.background);
  }

  /** Display point (percent) under a stage-pixel position, using the last rendered pose. */
  pick(stageX: number, stageY: number) {
    return this.device.pick(stageX, stageY);
  }

  dispose() {
    this.device.dispose();
  }

  private paintScreen(state: FrameState) {
    const project = this.project!;
    const s = state.screen;
    const layer = (i: number): ScreenLayer => {
      const scene = project.scenes[i];
      return { image: getImage(scene?.image), fit: scene?.fit ?? 'width', scroll: s.scroll(i) };
    };
    const inTransition = s.from !== null;
    const changed = this.screen.paint({
      a: layer(inTransition ? s.from! : s.to),
      b: inTransition ? layer(s.to) : null,
      mix: s.mix,
      mode: s.mode,
      touches: state.touches,
      accent: project.accent,
      accent2: project.accent2,
    });
    if (changed) this.device.texture.needsUpdate = true;
  }

  private drawAura(state: FrameState) {
    const { ctx } = this;
    const project = this.project!;
    const { pose } = state;
    const { h: H } = this.stage;
    if (project.deviceGlow) {
      ctx.save();
      ctx.globalCompositeOperation = project.dark ? 'screen' : 'source-over';
      const r = pose.h * 0.78;
      const g = ctx.createRadialGradient(pose.cx, pose.cy, 0, pose.cx, pose.cy, r);
      g.addColorStop(0, rgba(project.accent, project.dark ? 0.3 : 0.22));
      g.addColorStop(0.5, rgba(project.accent2, project.dark ? 0.1 : 0.08));
      g.addColorStop(1, rgba(project.accent2, 0));
      ctx.fillStyle = g;
      ctx.fillRect(pose.cx - r, pose.cy - r, r * 2, r * 2);
      ctx.restore();
    }
    const bottom = pose.cy + pose.h * 0.56;
    if (bottom < H * 1.02) {
      const rx = pose.h * 0.22;
      const ry = pose.h * 0.04;
      ctx.save();
      ctx.translate(pose.cx, bottom);
      ctx.scale(1, ry / rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, project.dark ? 'rgba(0,0,0,0.55)' : 'rgba(20,25,45,0.28)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
      ctx.restore();
    }
  }

  private copyFor(state: FrameState): { content: TextContent; style: TextStyle; anim: TextAnim } | null {
    const project = this.project!;
    const seg = state.segment;
    const logo = getImage(project.logo.src);
    if (seg.kind === 'intro') {
      return { content: { eyebrow: '', title: project.intro.title, subtitle: project.intro.subtitle, logo }, style: project.typography, anim: 'blur' };
    }
    if (seg.kind === 'outro') {
      return {
        content: { eyebrow: '', title: project.outro.title, subtitle: project.outro.subtitle, cta: project.outro.cta, logo },
        style: project.typography,
        anim: 'rise',
      };
    }
    const scene = project.scenes[seg.index];
    if (!scene) return null;
    return { content: { eyebrow: scene.eyebrow, title: scene.title, subtitle: scene.subtitle }, style: resolveStyle(project, scene), anim: scene.textAnim };
  }

  private drawCopy(state: FrameState) {
    const project = this.project!;
    const copy = this.copyFor(state);
    if (!copy) return;
    const seg = state.segment;
    const { text, sizes, textShift } = seg.layout;
    const key = JSON.stringify([
      copy.content.eyebrow,
      copy.content.title,
      copy.content.subtitle,
      copy.content.cta,
      copy.content.logo?.src.length ?? 0,
      copy.style,
      text,
      sizes,
    ]);
    let block = this.textCache.get(key);
    if (!block) {
      block = layoutText(this.ctx, copy.content, copy.style, text, sizes);
      if (this.textCache.size > 64) this.textCache.clear();
      this.textCache.set(key, block);
    }

    const { ctx } = this;
    ctx.save();
    const f = state.focus;
    const cx = block.bounds.x + block.bounds.w / 2;
    const cy = block.bounds.y + block.bounds.h / 2;
    if (f > 0.001) {
      ctx.translate(textShift.x * f, textShift.y * f);
      ctx.translate(cx, cy);
      ctx.scale(1 - 0.05 * f, 1 - 0.05 * f);
      ctx.translate(-cx, -cy);
      ctx.globalAlpha = 1 - 0.72 * f;
    }
    if (seg.kind === 'intro' && state.textExit > 0) {
      const s = 1 + 0.08 * ease.inCubic(state.textExit);
      ctx.translate(cx, cy);
      ctx.scale(s, s);
      ctx.translate(-cx, -cy);
    }
    drawTextBlock(ctx, block, {
      anim: copy.anim,
      local: state.textLocal,
      exit: state.textExit,
      accent: project.accent,
      accent2: project.accent2,
      dark: project.dark,
      scale: this.scale,
      supportsFilter: this.supportsFilter,
    });
    ctx.restore();
  }

  private drawCallouts(state: FrameState) {
    if (!state.callouts.length || !this.device.isReady) return;
    const project = this.project!;
    const { ctx } = this;
    const { w: W, h: H } = this.stage;
    const unit = Math.min(W, H) / 1080;
    for (const c of state.callouts) {
      const g = c.planned.gesture;
      const pt = this.device.project(g.x, g.y);
      if (!pt) continue;
      const alpha = clamp(c.enter * 3) * (1 - c.exit);
      if (alpha <= 0.001) continue;
      const grow = springStep(c.enter * 0.5, 14, 0.6);
      const fontSize = 33 * unit;
      ctx.font = `600 ${fontSize}px "${project.typography.subFont}", "Inter", system-ui, sans-serif`;
      const label = g.label.trim();
      const textW = ctx.measureText(label).width;
      const pillW = textW + fontSize * 2.3;
      const pillH = fontSize * 2.1;
      // Lead the label out past the device edge when there is room for it.
      const halfBody = (state.pose.h * PHONE_ASPECT) / 2;
      const reachFor = (d: number) => Math.max(130 * unit, Math.abs(state.pose.cx + d * (halfBody + 46 * unit) - pt.x));
      let dir = pt.x >= state.pose.cx ? 1 : -1;
      if (dir === 1 && pt.x + reachFor(1) + pillW > W - 30) dir = -1;
      else if (dir === -1 && pt.x - reachFor(-1) - pillW < 30) dir = 1;
      let reach = reachFor(dir);
      if ((dir === 1 && pt.x + reach + pillW > W - 30) || (dir === -1 && pt.x - reach - pillW < 30)) reach = 130 * unit;
      const elbowX = pt.x + dir * Math.min(reach * 0.35, 90 * unit);
      const elbowY = pt.y - 64 * unit;
      const endX = pt.x + dir * reach;
      const pillX = clamp(dir === 1 ? endX : endX - pillW, 24, W - pillW - 24);
      const pillY = clamp(elbowY - pillH / 2, 24, H - pillH - 24);

      ctx.save();
      ctx.globalAlpha = alpha;
      // Anchor dot with a slow pulse
      const pulse = (state.t * 1.4) % 1;
      ctx.strokeStyle = rgba(project.accent, (1 - pulse) * 0.7);
      ctx.lineWidth = 3 * unit;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, (10 + pulse * 26) * unit, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = project.accent;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3 * unit;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 9 * unit, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Leader line drawn progressively
      const lineP = clamp(c.enter * 1.6);
      const seg1 = Math.hypot(elbowX - pt.x, elbowY - pt.y);
      const seg2 = Math.abs(endX - elbowX);
      const total = (seg1 + seg2) * lineP;
      ctx.strokeStyle = project.dark ? 'rgba(255,255,255,0.85)' : rgba(project.accent, 0.9);
      ctx.lineWidth = 2.5 * unit;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      if (total <= seg1) {
        ctx.lineTo(lerp(pt.x, elbowX, total / seg1), lerp(pt.y, elbowY, total / seg1));
      } else {
        ctx.lineTo(elbowX, elbowY);
        ctx.lineTo(elbowX + dir * (total - seg1), elbowY);
      }
      ctx.stroke();

      // Glass pill
      const ox = dir === 1 ? pillX : pillX + pillW;
      ctx.translate(ox, pillY + pillH / 2);
      ctx.scale(lerp(0.5, 1, grow), lerp(0.5, 1, grow));
      ctx.translate(-ox, -(pillY + pillH / 2));
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 30 * this.scale * unit;
      ctx.shadowOffsetY = 8 * this.scale * unit;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
      ctx.fillStyle = project.dark ? 'rgba(18,20,32,0.82)' : 'rgba(255,255,255,0.92)';
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = project.dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 1.5 * unit;
      ctx.stroke();
      ctx.fillStyle = project.accent;
      ctx.beginPath();
      ctx.arc(pillX + fontSize * 0.95, pillY + pillH / 2, fontSize * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = project.dark ? '#ffffff' : '#0b0d12';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, pillX + fontSize * 1.45, pillY + pillH / 2 + fontSize * 0.04);
      ctx.restore();
    }
  }

  private drawOverlays(state: FrameState) {
    const project = this.project!;
    const plan = this.plan!;
    const { ctx } = this;
    const { w: W, h: H } = this.stage;
    const unit = Math.min(W, H) / 1080;
    const seg = state.segment;
    const sceneSegs = plan.segments.filter((s) => s.kind === 'scene');
    const firstScene = sceneSegs[0];
    const lastScene = sceneSegs[sceneSegs.length - 1];
    const hasOutro = plan.segments.some((s) => s.kind === 'outro');
    const fadeIn = firstScene ? clamp((state.t - firstScene.start) / 0.4) : 0;
    const fadeOut = hasOutro && lastScene ? 1 - clamp((state.t - lastScene.end + 0.3) / 0.3) : 1;
    const visibility = seg.kind === 'intro' ? 0 : fadeIn * fadeOut;

    const logo = getImage(project.logo.src);
    if (logo && visibility > 0.001) {
      const w = project.logo.size * unit;
      const h = (logo.naturalHeight / logo.naturalWidth) * w;
      const m = 54 * unit;
      const pos = project.logo.position;
      const x = pos.endsWith('l') ? m : W - m - w;
      const y = pos.startsWith('t') ? m : H - m - h;
      ctx.save();
      ctx.globalAlpha = (project.logo.opacity / 100) * visibility;
      ctx.drawImage(logo, x, y, w, h);
      ctx.restore();
    }

    if (project.showProgress && sceneSegs.length > 1 && visibility > 0.001) {
      const m = 48 * unit;
      const gap = 8 * unit;
      const bh = 6 * unit;
      const total = W - m * 2;
      const bw = (total - gap * (sceneSegs.length - 1)) / sceneSegs.length;
      const y = project.logo.src && project.logo.position.startsWith('t') ? H - m - bh : m;
      ctx.save();
      ctx.globalAlpha = visibility;
      sceneSegs.forEach((s, i) => {
        const x = m + i * (bw + gap);
        ctx.fillStyle = project.dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.1)';
        ctx.beginPath();
        ctx.roundRect(x, y, bw, bh, bh / 2);
        ctx.fill();
        const p = clamp((state.t - s.start) / (s.end - s.start));
        if (p > 0) {
          ctx.fillStyle = project.accent;
          ctx.beginPath();
          ctx.roundRect(x, y, Math.max(bh, bw * p), bh, bh / 2);
          ctx.fill();
        }
      });
      ctx.restore();
    }
  }
}
