import type { Aspect, LayoutMode, Pose } from './types';

export const STAGES: Record<Aspect, { w: number; h: number; label: string }> = {
  '16:9': { w: 1920, h: 1080, label: 'Landscape' },
  '9:16': { w: 1080, h: 1920, label: 'Story' },
  '1:1': { w: 1080, h: 1080, label: 'Square' },
  '4:5': { w: 1080, h: 1350, label: 'Feed' },
};

/** Width / height of the phone model. */
export const PHONE_ASPECT = 0.487;
/** Size of the phone's display relative to the full body. */
export const SCREEN_IN_BODY = { w: 0.9173, h: 0.9655 };

export type ResolvedMode = 'right' | 'left' | 'center';

export interface TextBox {
  x: number;
  y: number;
  w: number;
  h: number;
  align: 'left' | 'center';
  vAlign: 'center' | 'top';
}

export interface TextSizes {
  eyebrow: number;
  title: number;
  sub: number;
}

export interface SceneLayout {
  mode: ResolvedMode;
  phone: Pose;
  text: TextBox;
  sizes: TextSizes;
  /** Direction the copy drifts when the camera focuses on the phone. */
  textShift: { x: number; y: number };
  /** Where a focused touch point is pulled to. */
  focus: { x: number; y: number };
}

export function resolveMode(aspect: Aspect, mode: LayoutMode, index: number): ResolvedMode {
  if (mode !== 'auto') return mode;
  if (aspect === '16:9') return index % 2 === 0 ? 'right' : 'left';
  if (aspect === '1:1') return 'center';
  return index % 2 === 0 ? 'right' : 'left';
}

export function sceneLayout(aspect: Aspect, mode: LayoutMode, index: number): SceneLayout {
  const resolved = resolveMode(aspect, mode, index);
  const { w: W, h: H } = STAGES[aspect];

  if (aspect === '16:9' || (aspect === '1:1' && resolved !== 'center')) {
    if (resolved === 'center') {
      return {
        mode: resolved,
        phone: { cx: W / 2, cy: H * 0.95, h: H * 1.04, rx: 10, ry: 0, rz: 0 },
        text: { x: W * 0.18, y: H * 0.075, w: W * 0.64, h: H * 0.32, align: 'center', vAlign: 'top' },
        sizes: { eyebrow: 19, title: 70, sub: 28 },
        textShift: { x: 0, y: -50 },
        focus: { x: W / 2, y: H * 0.56 },
      };
    }
    const square = aspect === '1:1';
    const right = resolved === 'right';
    const phoneH = square ? H * 0.8 : H * 0.84;
    const phoneCx = square ? (right ? W * 0.72 : W * 0.28) : right ? W * 0.7 : W * 0.3;
    const textW = square ? W * 0.44 : W * 0.4;
    const margin = square ? W * 0.07 : W * 0.085;
    return {
      mode: resolved,
      phone: { cx: phoneCx, cy: H * 0.52, h: phoneH, rx: 3, ry: right ? -17 : 17, rz: 0 },
      text: { x: right ? margin : W - margin - textW, y: H * 0.12, w: textW, h: H * 0.76, align: 'left', vAlign: 'center' },
      sizes: square ? { eyebrow: 16, title: 54, sub: 23 } : { eyebrow: 20, title: 82, sub: 30 },
      textShift: { x: right ? -W * 0.05 : W * 0.05, y: 0 },
      focus: { x: right ? W * 0.64 : W * 0.36, y: H * 0.5 },
    };
  }

  // Vertical and square-centered formats stack copy above the device.
  const feed = aspect === '4:5';
  const square = aspect === '1:1';
  const textTop = H * (square ? 0.065 : feed ? 0.07 : 0.085);
  const textH = H * (square ? 0.27 : feed ? 0.26 : 0.25);
  const text: TextBox = { x: W * 0.08, y: textTop, w: W * 0.84, h: textH, align: 'center', vAlign: 'top' };
  const sizes: TextSizes = square
    ? { eyebrow: 17, title: 60, sub: 25 }
    : feed
      ? { eyebrow: 18, title: 64, sub: 27 }
      : { eyebrow: 22, title: 88, sub: 36 };

  let phone: Pose;
  if (resolved === 'center' || square) {
    const h = H * (square ? 0.86 : feed ? 0.74 : 0.7);
    phone = { cx: W / 2, cy: H - h * (square ? 0.36 : 0.42), h, rx: 9, ry: 0, rz: 0 };
  } else {
    const h = H * (feed ? 0.62 : 0.6);
    const right = resolved === 'right';
    phone = { cx: W * (right ? 0.55 : 0.45), cy: H - h / 2 - H * 0.055, h, rx: 4, ry: right ? -12 : 12, rz: 0 };
  }

  return {
    mode: resolved,
    phone,
    text,
    sizes,
    textShift: { x: 0, y: -H * 0.035 },
    focus: { x: W / 2, y: H * (square ? 0.6 : 0.62) },
  };
}

export function introLayout(aspect: Aspect) {
  const { w: W, h: H } = STAGES[aspect];
  const landscape = aspect === '16:9';
  return {
    text: { x: W * 0.1, y: H * 0.1, w: W * 0.8, h: H * 0.8, align: 'center', vAlign: 'center' } as TextBox,
    sizes: landscape ? { eyebrow: 22, title: 128, sub: 38 } : aspect === '9:16' ? { eyebrow: 24, title: 120, sub: 40 } : { eyebrow: 20, title: 96, sub: 32 },
  };
}

/** Where the phone waits before its entrance (below the frame, tilted). */
export function offstagePose(aspect: Aspect, base: Pose): Pose {
  const { h: H } = STAGES[aspect];
  return { ...base, cy: H + base.h * 0.75, rx: 38, ry: base.ry - 28, rz: base.ry > 0 ? 8 : -8 };
}
