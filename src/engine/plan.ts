import { PHONE_ASPECT, SCREEN_IN_BODY, STAGES, introLayout, offstagePose, sceneLayout, type SceneLayout } from './layout';
import { Track, clamp, ease, lerp, smoothstep, tween, type SpringOpts } from './math';
import type { CameraMove, Gesture, Pose, Project } from './types';

export type SegmentKind = 'intro' | 'scene' | 'outro';

export interface Segment {
  kind: SegmentKind;
  /** Scene index for scene segments, -1 otherwise. */
  index: number;
  start: number;
  end: number;
  layout: SceneLayout;
  camera: CameraMove;
}

export interface PlannedGesture {
  gesture: Gesture;
  scene: number;
  t: number;
  hold: number;
  calloutEnd: number;
}

export type ScreenMode = 'fade' | 'push' | 'cut';

export interface ScreenWindow {
  scene: number;
  a: number;
  b: number;
  mode: ScreenMode;
}

export type SfxKind = 'tap' | 'hold' | 'swipe' | 'whoosh' | 'rise' | 'pop' | 'shimmer';

export interface SfxEvent {
  t: number;
  kind: SfxKind;
}

type PoseTracks = Record<keyof Pose, Track>;

export interface Plan {
  project: Project;
  duration: number;
  segments: Segment[];
  pose: PoseTracks;
  focus: Track;
  press: Track;
  scroll: Track[];
  gestures: PlannedGesture[];
  windows: ScreenWindow[];
  sfx: SfxEvent[];
}

const POSE_KEYS: (keyof Pose)[] = ['cx', 'cy', 'h', 'rx', 'ry', 'rz'];

function poseTracks(initial: Pose): PoseTracks {
  return Object.fromEntries(POSE_KEYS.map((k) => [k, new Track(initial[k])])) as PoseTracks;
}

function toPose(tracks: PoseTracks, t: number, pose: Pose, opts: SpringOpts) {
  for (const k of POSE_KEYS) tracks[k].to(t, pose[k], opts);
}

function setPose(tracks: PoseTracks, t: number, pose: Pose) {
  for (const k of POSE_KEYS) tracks[k].set(t, pose[k]);
}

const HOLD: Record<Gesture['kind'], number> = { tap: 0.12, hold: 0.9, scroll: 0.45 };

/** Pose that frames a touch point: the phone grows by `zoom` and slides so the point drifts toward the layout's focus spot. */
export function focusPose(base: Pose, layout: SceneLayout, g: Gesture, zoom: number): Pose {
  const h = base.h * zoom;
  const sw = h * PHONE_ASPECT * SCREEN_IN_BODY.w;
  const sh = h * SCREEN_IN_BODY.h;
  // Scrolling moves the whole page, so frame the display centre rather than the finger.
  const fx = g.kind === 'scroll' ? 50 : g.x;
  const fy = g.kind === 'scroll' ? 50 : g.y;
  const ox = (fx / 100 - 0.5) * sw;
  const oy = (fy / 100 - 0.5) * sh;
  const pull = clamp((zoom - 1) / 0.8, 0.3, 1);
  const tx = lerp(base.cx + ox, layout.focus.x, pull);
  const ty = lerp(base.cy + oy, layout.focus.y, pull);
  const turns = Math.round(base.ry / 360) * 360;
  return {
    cx: tx - ox,
    cy: ty - oy,
    h,
    rx: base.rx * 0.25 - ((fy - 50) / 50) * 4,
    ry: turns + (base.ry - turns) * 0.22 - ((fx - 50) / 50) * 5,
    rz: 0,
  };
}

export function buildPlan(project: Project): Plan {
  const { w: W, h: H } = STAGES[project.aspect];
  const segments: Segment[] = [];
  let cursor = 0;

  if (project.intro.enabled) {
    const intro = introLayout(project.aspect);
    const first = sceneLayout(project.aspect, project.scenes[0]?.layout ?? 'auto', 0);
    segments.push({
      kind: 'intro',
      index: -1,
      start: 0,
      end: project.intro.duration,
      layout: { ...first, text: intro.text, sizes: intro.sizes },
      camera: 'static',
    });
    cursor = project.intro.duration;
  }

  project.scenes.forEach((scene, i) => {
    segments.push({
      kind: 'scene',
      index: i,
      start: cursor,
      end: cursor + scene.duration,
      layout: sceneLayout(project.aspect, scene.layout, i),
      camera: scene.camera,
    });
    cursor += scene.duration;
  });

  if (project.outro.enabled) {
    const outro = sceneLayout(project.aspect, project.aspect === '16:9' ? 'right' : 'center', 0);
    segments.push({ kind: 'outro', index: -1, start: cursor, end: cursor + project.outro.duration, layout: outro, camera: 'orbit' });
    cursor += project.outro.duration;
  }

  const duration = Math.max(cursor, 0.5);
  const firstScene = segments.find((s) => s.kind === 'scene');
  const firstPose = firstScene ? firstScene.layout.phone : sceneLayout(project.aspect, 'auto', 0).phone;
  const pose = poseTracks(offstagePose(project.aspect, firstPose));
  const focus = new Track(0);
  const press = new Track(1);
  const scroll = project.scenes.map(() => new Track(0));
  const gestures: PlannedGesture[] = [];
  const windows: ScreenWindow[] = [{ scene: 0, a: -Infinity, b: -Infinity, mode: 'cut' }];
  const sfx: SfxEvent[] = [];
  const flips: { scene: number; t0: number; from: number; to: number }[] = [];

  let turns = 0;
  let previous: Pose | null = null;

  if (project.intro.enabled) sfx.push({ t: 0.15, kind: 'shimmer' });

  for (const seg of segments) {
    if (seg.kind === 'intro') continue;
    const S = seg.start;
    const E = seg.end;
    const base = seg.layout.phone;
    const scene = seg.kind === 'scene' ? project.scenes[seg.index] : null;
    const transition = scene?.transition ?? 'glide';
    let target: Pose = { ...base, ry: base.ry + turns * 360 };

    focus.to(S - 0.3, 0, { omega: 6 });

    if (!previous) {
      const enterAt = project.intro.enabled ? S - 0.5 : 0.05;
      toPose(pose, enterAt, target, { omega: 5.2, zeta: 0.78 });
      sfx.push({ t: Math.max(0, enterAt), kind: 'rise' });
    } else if (seg.kind === 'outro') {
      toPose(pose, S - 0.15, target, { omega: 5, zeta: 0.85 });
      sfx.push({ t: S - 0.1, kind: 'whoosh' }, { t: S + 0.75, kind: 'pop' });
    } else if (scene) {
      const i = seg.index;
      const moved = Math.abs(previous.cx - target.cx) + Math.abs(previous.cy - target.cy) > 40 || Math.abs(previous.ry - target.ry) > 8;
      switch (transition) {
        case 'glide': {
          toPose(pose, S - 0.2, target, { omega: 6, zeta: 0.85 });
          windows.push({ scene: i, a: S - 0.12, b: S + 0.22, mode: 'fade' });
          if (moved) sfx.push({ t: S - 0.2, kind: 'whoosh' });
          break;
        }
        case 'flip': {
          const dir = target.cx >= previous.cx ? 1 : -1;
          turns += dir;
          target = { ...target, ry: target.ry + dir * 360 };
          toPose(pose, S - 0.3, target, { omega: 5.4, zeta: 0.8 });
          flips.push({ scene: i, t0: S - 0.3, from: previous.ry, to: target.ry });
          sfx.push({ t: S - 0.3, kind: 'whoosh' });
          break;
        }
        case 'push': {
          toPose(pose, S - 0.1, target, { omega: 6, zeta: 0.9 });
          press.to(S - 0.22, 0.965, { omega: 20 }).to(S + 0.08, 1, { omega: 9, zeta: 0.6 });
          windows.push({ scene: i, a: S - 0.15, b: S + 0.45, mode: 'push' });
          sfx.push({ t: S - 0.15, kind: 'swipe' });
          break;
        }
        case 'zoom': {
          const fill: Pose = { cx: W / 2, cy: H / 2, h: Math.max(W, H) * 1.35, rx: 0, ry: turns * 360, rz: 0 };
          toPose(pose, S - 0.55, fill, { omega: 6.5, zeta: 1 });
          toPose(pose, S + 0.02, target, { omega: 5.2, zeta: 0.86 });
          windows.push({ scene: i, a: S - 0.2, b: S + 0.08, mode: 'fade' });
          sfx.push({ t: S - 0.55, kind: 'whoosh' });
          break;
        }
        case 'drop': {
          const exit: Pose = { ...previous, cy: H + previous.h * 1.15, rx: -26, rz: previous.cx > W / 2 ? 9 : -9 };
          toPose(pose, S - 0.65, exit, { omega: 6.5, zeta: 1 });
          setPose(pose, S, offstagePose(project.aspect, target));
          toPose(pose, S + 0.02, target, { omega: 5.3, zeta: 0.78 });
          windows.push({ scene: i, a: S, b: S, mode: 'cut' });
          sfx.push({ t: S - 0.65, kind: 'whoosh' }, { t: S + 0.05, kind: 'rise' });
          break;
        }
      }
    }

    if (scene) {
      const i = seg.index;
      const sorted = [...scene.gestures].sort((a, b) => a.at - b.at);
      const dur = E - S;
      const times = sorted.map((g) => S + clamp(g.at, 0.25, Math.max(0.3, dur - 0.2)));
      sorted.forEach((g, j) => {
        const T = times[j];
        const hold = HOLD[g.kind];
        const focusIn = Math.max(S + 0.5, T - 0.7);
        const focusOut = T + hold + 0.55;
        const nextIn = j + 1 < sorted.length ? Math.max(S + 0.5, times[j + 1] - 0.7) : Infinity;
        const chained = nextIn < focusOut + 0.25;
        const endsScene = focusOut > E - 0.4;
        const zoom = clamp(g.zoom, 1, 3.5);

        if (zoom > 1.02) {
          toPose(pose, focusIn, focusPose(target, seg.layout, g, zoom), { omega: 6.2, zeta: 0.92 });
          focus.to(focusIn, clamp((zoom - 1) / 0.9, 0.15, 1), { omega: 6.2 });
          if (!chained && !endsScene) {
            toPose(pose, focusOut, target, { omega: 5, zeta: 0.9 });
            focus.to(focusOut, 0, { omega: 5 });
          }
        }

        press.to(T - 0.04, 0.978, { omega: 32 }).to(T + hold + 0.06, 1, { omega: 12, zeta: 0.55 });
        if (g.kind === 'scroll') scroll[i].to(T + 0.1, clamp(g.scrollTo / 100), { omega: 4.4 });

        gestures.push({
          gesture: g,
          scene: i,
          t: T,
          hold,
          calloutEnd: Math.min(T + hold + 1.5, j + 1 < sorted.length ? times[j + 1] - 0.2 : Infinity, E - 0.35),
        });
        sfx.push({ t: T, kind: g.kind === 'scroll' ? 'swipe' : g.kind === 'hold' ? 'hold' : 'tap' });
      });
    }

    previous = target;
  }

  for (const k of POSE_KEYS) pose[k].finalize();
  focus.finalize();
  press.finalize();
  scroll.forEach((s) => s.finalize());

  // A flip swaps the screen at the instant the phone's back faces the camera.
  for (const flip of flips) {
    const mid = (flip.from + flip.to) / 2;
    let tm = flip.t0 + 0.3;
    for (let t = flip.t0; t < flip.t0 + 2; t += 1 / 240) {
      const v = pose.ry.value(t);
      if ((flip.to > flip.from && v >= mid) || (flip.to < flip.from && v <= mid)) {
        tm = t;
        break;
      }
    }
    windows.push({ scene: flip.scene, a: tm, b: tm, mode: 'cut' });
  }
  windows.sort((a, b) => a.a - b.a);
  sfx.sort((a, b) => a.t - b.t);

  return { project, duration, segments, pose, focus, press, scroll, gestures, windows, sfx };
}

// --- Evaluation ---

interface IdleOffset {
  dx: number;
  dy: number;
  hs: number;
  rx: number;
  ry: number;
  rz: number;
}

const ZERO_IDLE: IdleOffset = { dx: 0, dy: 0, hs: 1, rx: 0, ry: 0, rz: 0 };

function idle(move: CameraMove, tau: number, dur: number): IdleOffset {
  const p = clamp(tau / Math.max(0.5, dur));
  const bob = Math.sin(tau * 1.15) * 9;
  switch (move) {
    case 'float':
      return { dx: Math.sin(tau * 0.45) * 4, dy: bob, hs: 1, rx: Math.sin(tau * 0.8 + 1) * 2.2, ry: Math.sin(tau * 0.55) * 4.5, rz: Math.sin(tau * 0.6) * 0.8 };
    case 'orbit':
      return { dx: 0, dy: bob * 0.6, hs: 1, rx: Math.sin(tau * 0.7) * 1.5, ry: lerp(-15, 15, ease.inOutSine(p)), rz: 0 };
    case 'tilt':
      return { dx: 0, dy: bob * 0.5, hs: 1, rx: lerp(16, -5, ease.inOutSine(p)), ry: Math.sin(tau * 0.5) * 3, rz: 0 };
    case 'dolly':
      return { dx: 0, dy: bob * 0.4, hs: 1 + 0.13 * ease.inOutSine(p), rx: Math.sin(tau * 0.6) * 1.5, ry: Math.sin(tau * 0.45) * 3, rz: 0 };
    default:
      return ZERO_IDLE;
  }
}

function idleFor(seg: Segment | undefined, t: number): IdleOffset {
  if (!seg || seg.kind === 'intro') return ZERO_IDLE;
  return idle(seg.camera, t - seg.start, seg.end - seg.start);
}

export interface TouchFx {
  kind: Gesture['kind'];
  x: number;
  y: number;
  opacity: number;
  scale: number;
  ring: number;
  ringOpacity: number;
  hold: number;
  trailFrom: number | null;
}

export interface Callout {
  planned: PlannedGesture;
  enter: number;
  exit: number;
}

export interface ScreenFrame {
  from: number | null;
  to: number;
  mix: number;
  mode: ScreenMode;
  scroll: (scene: number) => number;
}

export interface FrameState {
  t: number;
  pose: Pose;
  focus: number;
  segIndex: number;
  segment: Segment;
  screen: ScreenFrame;
  touches: TouchFx[];
  callouts: Callout[];
  /** Seconds since the current segment's copy started animating in. */
  textLocal: number;
  /** Exit progress (0-1) of the current segment's copy. */
  textExit: number;
}

export function segmentAt(plan: Plan, t: number) {
  const { segments } = plan;
  for (let i = 0; i < segments.length; i++) {
    if (t < segments[i].end || i === segments.length - 1) return i;
  }
  return segments.length - 1;
}

export function evaluate(plan: Plan, t: number): FrameState {
  const segIndex = segmentAt(plan, t);
  const segment = plan.segments[segIndex];
  const prev = plan.segments[segIndex - 1];
  const focus = clamp(plan.focus.value(t));

  const blend = prev ? smoothstep(segment.start - 0.35, segment.start + 0.65, t) : 1;
  const a = idleFor(prev, t);
  const b = idleFor(segment, t);
  const damp = 1 - 0.85 * focus;
  const mixIdle = (k: keyof IdleOffset) => lerp(a[k], b[k], blend);

  const pose: Pose = {
    cx: plan.pose.cx.value(t) + mixIdle('dx') * damp,
    cy: plan.pose.cy.value(t) + mixIdle('dy') * damp,
    h: plan.pose.h.value(t) * plan.press.value(t) * lerp(1, mixIdle('hs'), damp),
    rx: plan.pose.rx.value(t) + mixIdle('rx') * damp,
    ry: plan.pose.ry.value(t) + mixIdle('ry') * damp,
    rz: plan.pose.rz.value(t) + mixIdle('rz') * damp,
  };

  // Screen content
  const windows = plan.windows;
  let w = 0;
  for (let i = 0; i < windows.length; i++) if (windows[i].a <= t) w = i;
  const win = windows[w];
  const inTransition = win.b > win.a && t < win.b && w > 0;
  const screen: ScreenFrame = {
    from: inTransition ? windows[w - 1].scene : null,
    to: win.scene,
    mix: inTransition ? tween(t, win.a, win.b - win.a, win.mode === 'push' ? ease.outQuint : ease.inOutCubic) : 1,
    mode: win.mode,
    scroll: (scene) => clamp(plan.scroll[scene]?.value(t) ?? 0),
  };

  // Touch indicators
  const touches: TouchFx[] = [];
  const callouts: Callout[] = [];
  for (const pg of plan.gestures) {
    const { gesture: g, t: T, hold } = pg;
    if (g.label.trim() && t > T - 0.2 && t < pg.calloutEnd + 0.35) {
      callouts.push({ planned: pg, enter: tween(t, T - 0.15, 0.5), exit: tween(t, pg.calloutEnd, 0.3, ease.inCubic) });
    }
    if (t < T - 0.5 || t > T + hold + 0.8) continue;
    if (pg.scene !== screen.to && pg.scene !== screen.from) continue;
    const appear = tween(t, T - 0.45, 0.3, ease.outCubic);
    const vanish = tween(t, T + hold + 0.18, 0.35, ease.inCubic);
    const pressed = tween(t, T - 0.06, 0.08) * (1 - tween(t, T + hold, 0.12));
    const releaseAt = g.kind === 'hold' ? T + hold : T;
    const ring = tween(t, releaseAt, 0.6, ease.outCubic);
    let y = g.y;
    let trailFrom: number | null = null;
    if (g.kind === 'scroll') {
      const swipe = tween(t, T, hold, ease.inOutCubic);
      y = g.y - swipe * 26;
      trailFrom = g.y;
    }
    touches.push({
      kind: g.kind,
      x: g.x,
      y,
      opacity: appear * (1 - vanish),
      scale: lerp(lerp(1.4, 1, appear), 0.78, pressed),
      ring: t >= releaseAt ? ring : 0,
      ringOpacity: t >= releaseAt && g.kind !== 'scroll' ? (1 - ring) * 0.85 : 0,
      hold: g.kind === 'hold' ? tween(t, T, hold) : 0,
      trailFrom,
    });
  }

  const isLast = segIndex === plan.segments.length - 1;
  const textStart = segment.start + (segment.kind === 'intro' ? 0.2 : segIndex === 0 ? 0.45 : 0.14);
  const textExit = isLast ? 0 : tween(t, segment.end - 0.38, 0.38, ease.inCubic);

  return { t, pose, focus, segIndex, segment, screen, touches, callouts, textLocal: t - textStart, textExit };
}
