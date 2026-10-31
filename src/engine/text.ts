import type { TextBox, TextSizes } from './layout';
import { clamp, ease, lerp, luminance, rgba, springStep, tween } from './math';
import type { TextAnim, TextStyle } from './types';

export interface TextContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  cta?: string;
  logo?: HTMLImageElement | null;
}

type Kind = 'eyebrow' | 'title' | 'sub';

interface Word {
  kind: Kind;
  text: string;
  x: number;
  baseline: number;
  w: number;
  size: number;
  font: string;
  color: string;
  highlight: boolean;
  line: number;
  /** Order of appearance within its kind. */
  order: number;
}

interface Line {
  kind: Kind;
  top: number;
  height: number;
  index: number;
}

export interface TextBlock {
  words: Word[];
  lines: Line[];
  eyebrow?: { x: number; y: number; w: number; h: number; text: string; font: string; size: number; spacing: number };
  cta?: { x: number; y: number; w: number; h: number; text: string; font: string; size: number };
  logo?: { x: number; y: number; w: number; h: number; img: HTMLImageElement };
  bounds: { x: number; y: number; w: number; h: number };
  titleChars: number;
  rtl: boolean;
}

const RTL_RE = /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}]/u;

const fontString = (weight: number, size: number, family: string) => `${weight} ${size}px "${family}", "Inter", system-ui, sans-serif`;

interface Token {
  text: string;
  highlight: boolean;
  br?: boolean;
}

/** Splits copy into words; *asterisks* mark highlighted words, newlines force breaks. */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let highlight = false;
  for (const raw of text.replace(/\r/g, '').split(/(\n)/)) {
    if (raw === '\n') {
      tokens.push({ text: '', highlight: false, br: true });
      continue;
    }
    for (const part of raw.split(/\s+/)) {
      if (!part) continue;
      let word = part;
      let hl = highlight;
      if (word.startsWith('*')) {
        hl = true;
        word = word.slice(1);
        highlight = true;
      }
      if (word.endsWith('*')) {
        word = word.slice(0, -1);
        highlight = false;
      }
      if (word) tokens.push({ text: word, highlight: hl });
    }
  }
  return tokens;
}

interface WrapResult {
  lines: { tokens: Token[]; widths: number[]; width: number }[];
}

function wrap(ctx: CanvasRenderingContext2D, tokens: Token[], maxWidth: number, space: number): WrapResult {
  const lines: WrapResult['lines'] = [];
  let current: WrapResult['lines'][number] = { tokens: [], widths: [], width: 0 };
  for (const token of tokens) {
    if (token.br) {
      lines.push(current);
      current = { tokens: [], widths: [], width: 0 };
      continue;
    }
    const w = ctx.measureText(token.text).width;
    const next = current.tokens.length ? current.width + space + w : w;
    if (next > maxWidth && current.tokens.length) {
      lines.push(current);
      current = { tokens: [token], widths: [w], width: w };
    } else {
      current.tokens.push(token);
      current.widths.push(w);
      current.width = next;
    }
  }
  if (current.tokens.length) lines.push(current);
  return { lines };
}

export function layoutText(
  ctx: CanvasRenderingContext2D,
  content: TextContent,
  style: TextStyle,
  box: TextBox,
  baseSizes: TextSizes,
): TextBlock {
  const rtl = RTL_RE.test(content.title + content.subtitle);
  let scale = 1;
  let block: TextBlock | null = null;
  for (let attempt = 0; attempt < 7; attempt++) {
    block = buildBlock(ctx, content, style, box, baseSizes, scale, rtl);
    if (block.bounds.h <= box.h) break;
    scale *= 0.9;
  }
  return block!;
}

function buildBlock(
  ctx: CanvasRenderingContext2D,
  content: TextContent,
  style: TextStyle,
  box: TextBox,
  base: TextSizes,
  scale: number,
  rtl: boolean,
): TextBlock {
  const words: Word[] = [];
  const lines: Line[] = [];
  const titleSize = Math.round(base.title * scale);
  const subSize = Math.round(base.sub * Math.max(0.82, scale));
  const eyebrowSize = Math.round(base.eyebrow * Math.max(0.85, scale));
  let y = 0;
  let lineIndex = 0;
  let maxW = 0;

  let logo: TextBlock['logo'];
  if (content.logo) {
    const h = Math.round(titleSize * 0.95);
    const w = (content.logo.naturalWidth / content.logo.naturalHeight) * h;
    logo = { x: 0, y, w, h, img: content.logo };
    y += h + titleSize * 0.38;
    maxW = Math.max(maxW, w);
  }

  let eyebrow: TextBlock['eyebrow'];
  const eyebrowText = content.eyebrow.trim().toUpperCase();
  if (eyebrowText) {
    const font = fontString(700, eyebrowSize, style.subFont);
    ctx.font = font;
    // Per-letter tracking would break the joining of connected scripts.
    const spacing = rtl ? 0 : eyebrowSize * 0.16;
    const textW = ctx.measureText(eyebrowText).width + spacing * (eyebrowText.length - 1);
    const h = eyebrowSize * 2.1;
    const w = textW + eyebrowSize * 2.6;
    eyebrow = { x: 0, y, w, h, text: eyebrowText, font, size: eyebrowSize, spacing };
    y += h + titleSize * 0.32;
    maxW = Math.max(maxW, w);
  }

  const addParagraph = (kind: Kind, text: string, size: number, family: string, weight: number, color: string, lineHeight: number) => {
    if (!text.trim()) return;
    const font = fontString(weight, size, family);
    ctx.font = font;
    const space = ctx.measureText(' ').width;
    const { lines: wrapped } = wrap(ctx, tokenize(text), box.w, space);
    let order = words.filter((w) => w.kind === kind).length;
    for (const line of wrapped) {
      const lh = size * lineHeight;
      lines.push({ kind, top: y, height: lh, index: lineIndex });
      let x = 0;
      const seq = rtl ? [...line.tokens.keys()].reverse() : [...line.tokens.keys()];
      for (const i of seq) {
        const token = line.tokens[i];
        words.push({
          kind,
          text: token.text,
          x,
          baseline: y + size * (lineHeight * 0.5 + 0.35),
          w: line.widths[i],
          size,
          font,
          color,
          highlight: token.highlight,
          line: lineIndex,
          order: 0,
        });
        x += line.widths[i] + space;
      }
      // reading order (right-to-left words are appended visually reversed)
      const lineWords = words.filter((w) => w.line === lineIndex);
      const reading = rtl ? [...lineWords].reverse() : lineWords;
      for (const w of reading) w.order = order++;
      maxW = Math.max(maxW, line.width);
      y += lh;
      lineIndex++;
    }
  };

  addParagraph('title', content.title, titleSize, style.titleFont, style.titleWeight, style.titleColor, 1.1);
  if (content.subtitle.trim()) y += titleSize * 0.34;
  addParagraph('sub', content.subtitle, subSize, style.subFont, style.subWeight, style.subColor, 1.45);

  let cta: TextBlock['cta'];
  if (content.cta?.trim()) {
    const size = Math.round(subSize * 1.05);
    const font = fontString(700, size, style.subFont);
    ctx.font = font;
    const w = ctx.measureText(content.cta).width + size * 2.6;
    const h = size * 2.7;
    y += subSize * 1.1;
    cta = { x: 0, y, w, h, text: content.cta, font, size };
    y += h;
    maxW = Math.max(maxW, w);
  }

  const height = y;
  const ox = box.x + (box.align === 'center' ? (box.w - maxW) / 2 : rtl ? box.w - maxW : 0);
  const oy = box.y + (box.vAlign === 'center' ? (box.h - height) / 2 : 0);

  // Horizontal alignment per line
  const lineOffsets = new Map<number, number>();
  for (const line of lines) {
    const lw = words.filter((w) => w.line === line.index);
    const width = lw.length ? Math.max(...lw.map((w) => w.x + w.w)) : 0;
    let dx = 0;
    if (box.align === 'center') dx = (maxW - width) / 2;
    else if (rtl) dx = maxW - width;
    lineOffsets.set(line.index, dx);
  }
  for (const w of words) {
    w.x += ox + (lineOffsets.get(w.line) ?? 0);
    w.baseline += oy;
  }
  for (const line of lines) line.top += oy;
  const alignX = (w: number) => ox + (box.align === 'center' ? (maxW - w) / 2 : rtl ? maxW - w : 0);
  if (eyebrow) {
    eyebrow.x = alignX(eyebrow.w);
    eyebrow.y += oy;
  }
  if (cta) {
    cta.x = alignX(cta.w);
    cta.y += oy;
  }
  if (logo) {
    logo.x = alignX(logo.w);
    logo.y += oy;
  }

  return {
    words,
    lines,
    eyebrow,
    cta,
    logo,
    bounds: { x: ox, y: oy, w: maxW, h: height },
    titleChars: words.filter((w) => w.kind === 'title').reduce((n, w) => n + w.text.length + 1, 0),
    rtl,
  };
}

export interface TextDrawOptions {
  anim: TextAnim;
  /** Seconds since the copy started animating in. */
  local: number;
  /** Exit progress 0-1. */
  exit: number;
  accent: string;
  accent2: string;
  dark: boolean;
  /** Output pixels per stage pixel; canvas shadows are not affected by the transform. */
  scale: number;
  supportsFilter: boolean;
}

const TITLE_STAGGER = 0.055;
const ENTER = 0.75;

function itemDelay(word: Word, anim: TextAnim, block: TextBlock) {
  const titleWords = block.words.filter((w) => w.kind === 'title').length;
  const eyebrowOffset = block.eyebrow ? 0.12 : 0;
  if (word.kind === 'title') {
    if (anim === 'type') return eyebrowOffset;
    return eyebrowOffset + word.order * TITLE_STAGGER;
  }
  const titleEnd = anim === 'type' ? eyebrowOffset + block.titleChars / 30 : eyebrowOffset + titleWords * TITLE_STAGGER;
  if (anim === 'blur' || anim === 'pop') return titleEnd + 0.12 + word.order * 0.018;
  const firstSubLine = Math.min(...block.words.filter((w) => w.kind === 'sub').map((w) => w.line));
  return titleEnd + 0.15 + (word.line - firstSubLine) * 0.08;
}

export function drawTextBlock(ctx: CanvasRenderingContext2D, block: TextBlock, opts: TextDrawOptions) {
  const { anim, local, exit, accent, accent2, dark, scale } = opts;
  if (local < -0.05 || exit >= 1) return;
  const exitAlpha = 1 - exit;
  const exitY = -exit * 28;
  const exitBlur = exit * 10;

  ctx.save();
  ctx.translate(0, exitY);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  const shadow = (on: boolean) => {
    if (on && dark) {
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 26 * scale;
      ctx.shadowOffsetY = 4 * scale;
    } else {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
  };

  // Logo
  if (block.logo) {
    const p = springStep(local, 11, 0.6);
    const s = lerp(0.6, 1, p);
    const { x, y, w, h, img } = block.logo;
    ctx.save();
    ctx.globalAlpha = clamp(local / 0.25) * exitAlpha;
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(s, s);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // Eyebrow pill
  if (block.eyebrow) {
    const e = block.eyebrow;
    const p = tween(local, 0, 0.6, ease.outCubic);
    ctx.save();
    ctx.globalAlpha = p * exitAlpha;
    ctx.translate(lerp(-14, 0, p), 0);
    const r = e.h / 2;
    ctx.beginPath();
    ctx.roundRect(e.x, e.y, e.w * lerp(0.6, 1, p), e.h, r);
    ctx.fillStyle = rgba(accent, dark ? 0.14 : 0.12);
    ctx.fill();
    ctx.strokeStyle = rgba(accent, dark ? 0.38 : 0.3);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.clip();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(e.x + e.size * 1.05, e.y + e.h / 2, e.size * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = e.font;
    if (e.spacing) {
      let cx = e.x + e.size * 1.65;
      for (const ch of e.text) {
        ctx.fillText(ch, cx, e.y + e.h / 2 + e.size * 0.36);
        cx += ctx.measureText(ch).width + e.spacing;
      }
    } else {
      ctx.fillText(e.text, e.x + e.size * 1.65, e.y + e.h / 2 + e.size * 0.36);
    }
    ctx.restore();
  }

  // Words
  const lineClip = new Map<number, Line>();
  for (const l of block.lines) lineClip.set(l.index, l);
  let typed = 0;
  const typeStart = block.eyebrow ? 0.12 : 0;
  const charsShown = anim === 'type' ? Math.floor(Math.max(0, local - typeStart) * 30) : Infinity;
  let caret: { x: number; y: number; size: number } | null = null;

  for (const word of block.words) {
    const delay = itemDelay(word, anim, block);
    const t = local - delay;
    if (t < 0 && !(anim === 'type' && word.kind === 'title')) continue;

    let alpha = 1;
    let dx = 0;
    let dy = 0;
    let s = 1;
    let blur = exitBlur;
    let text = word.text;
    let clip: Line | undefined;
    let highlightP = tween(t, 0.3, 0.55, ease.outCubic);

    const effective: TextAnim = anim === 'type' && word.kind !== 'title' ? 'rise' : anim === 'type' && block.rtl ? 'blur' : anim;
    switch (effective) {
      case 'rise': {
        const p = tween(t, 0, ENTER, ease.outQuart);
        dy = (1 - p) * word.size * 1.05;
        alpha = clamp(p * 2.2);
        clip = lineClip.get(word.line);
        break;
      }
      case 'blur': {
        const p = tween(t, 0, 0.85, ease.outCubic);
        alpha = p;
        dy = (1 - p) * word.size * 0.18;
        blur += (1 - p) * word.size * 0.16;
        break;
      }
      case 'pop': {
        const p = springStep(t, 13, 0.52);
        s = lerp(0.35, 1, p);
        alpha = clamp(t / 0.14);
        dy = (1 - Math.min(1, p)) * word.size * 0.25;
        break;
      }
      case 'slide': {
        const p = tween(t, 0, 0.85, ease.outQuint);
        dx = (1 - p) * -word.size * 1.4;
        alpha = clamp(p * 1.6);
        break;
      }
      case 'type': {
        const remaining = charsShown - typed;
        typed += word.text.length + 1;
        if (remaining <= 0) {
          alpha = 0;
          break;
        }
        text = word.text.slice(0, remaining);
        if (remaining <= word.text.length) {
          ctx.font = word.font;
          caret = { x: word.x + ctx.measureText(text).width, y: word.baseline, size: word.size };
        } else {
          caret = { x: word.x + word.w + 4, y: word.baseline, size: word.size };
        }
        highlightP = remaining > word.text.length ? tween(t, block.titleChars / 30, 0.5, ease.outCubic) : 0;
        break;
      }
    }

    if (alpha <= 0.001) continue;
    ctx.save();
    if (clip) {
      ctx.beginPath();
      ctx.rect(block.bounds.x - 40, clip.top - word.size * 0.15, block.bounds.w + 400, clip.height + word.size * 0.38);
      ctx.clip();
    }
    ctx.globalAlpha = alpha * exitAlpha;
    if (s !== 1) {
      const cx = word.x + word.w / 2;
      const cy = word.baseline - word.size * 0.35;
      ctx.translate(cx, cy);
      ctx.scale(s, s);
      ctx.translate(-cx, -cy);
    }
    ctx.translate(dx, dy);
    if (blur > 0.3 && opts.supportsFilter) ctx.filter = `blur(${(blur * scale).toFixed(2)}px)`;
    ctx.font = word.font;

    if (word.highlight) {
      if (highlightP > 0) {
        ctx.save();
        shadow(false);
        ctx.beginPath();
        const padX = word.size * 0.08;
        ctx.roundRect(word.x - padX, word.baseline - word.size * 0.14, (word.w + padX * 2) * highlightP, word.size * 0.22, word.size * 0.11);
        ctx.fillStyle = rgba(accent, dark ? 0.3 : 0.24);
        ctx.fill();
        ctx.restore();
      }
      const g = ctx.createLinearGradient(word.x, word.baseline - word.size, word.x + word.w, word.baseline);
      g.addColorStop(0, accent);
      g.addColorStop(1, accent2);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = word.color;
    }
    shadow(word.kind === 'title');
    ctx.fillText(text, word.x, word.baseline);
    ctx.restore();
  }

  if (caret && anim === 'type') {
    const doneTyping = charsShown >= block.titleChars;
    const on = !doneTyping || Math.floor(local * 2.2) % 2 === 0;
    if (on && local < block.titleChars / 30 + 1.6) {
      ctx.save();
      ctx.globalAlpha = exitAlpha;
      ctx.fillStyle = accent;
      ctx.fillRect(caret.x + 2, caret.y - caret.size * 0.78, Math.max(3, caret.size * 0.06), caret.size * 0.92);
      ctx.restore();
    }
  }

  // Call-to-action button
  if (block.cta) {
    const c = block.cta;
    const titleWords = block.words.filter((w) => w.kind !== 'eyebrow').length;
    const delay = 0.35 + titleWords * 0.035;
    const t = local - delay;
    if (t > 0) {
      const p = springStep(t, 10, 0.55);
      const pulse = 1 + Math.sin(Math.max(0, t - 1) * 3.2) * 0.018 * clamp(t - 1);
      const s = lerp(0.55, 1, p) * pulse;
      ctx.save();
      ctx.globalAlpha = clamp(t / 0.2) * exitAlpha;
      ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
      ctx.scale(s, s);
      ctx.translate(-c.w / 2, -c.h / 2);
      ctx.shadowColor = rgba(accent, 0.55);
      ctx.shadowBlur = 40 * scale;
      ctx.shadowOffsetY = 10 * scale;
      const g = ctx.createLinearGradient(0, 0, c.w, c.h);
      g.addColorStop(0, accent);
      g.addColorStop(1, accent2);
      ctx.beginPath();
      ctx.roundRect(0, 0, c.w, c.h, c.h / 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.clip();
      const sweep = ((t * 0.55) % 1.6) - 0.3;
      const shine = ctx.createLinearGradient(c.w * sweep - c.h, 0, c.w * sweep + c.h, c.h);
      shine.addColorStop(0, 'rgba(255,255,255,0)');
      shine.addColorStop(0.5, 'rgba(255,255,255,0.35)');
      shine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shine;
      ctx.fillRect(0, 0, c.w, c.h);
      ctx.font = c.font;
      ctx.fillStyle = luminance(accent) < 0.4 ? '#ffffff' : '#0b0d12';
      ctx.textAlign = 'center';
      ctx.fillText(c.text, c.w / 2, c.h / 2 + c.size * 0.36);
      ctx.restore();
    }
  }

  ctx.restore();
}

