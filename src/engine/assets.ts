import type { Project } from './types';

const images = new Map<string, HTMLImageElement>();
const listeners = new Set<() => void>();

export function onAssetsChanged(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const notify = () => listeners.forEach((fn) => fn());

/** Returns a decoded image, or null while it is still loading (a change notification fires once it is ready). */
export function getImage(src: string | null | undefined): HTMLImageElement | null {
  if (!src) return null;
  let img = images.get(src);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.onload = notify;
    img.src = src;
    images.set(src, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

export async function preloadImage(src: string) {
  getImage(src);
  const img = images.get(src)!;
  if (img.complete && img.naturalWidth > 0) return;
  try {
    await img.decode();
  } catch {
    // A broken image renders as an empty screen.
  }
}

const fontRequests = new Map<string, Promise<unknown>>();

export function fontSpecs(project: Project) {
  const specs = new Set<string>();
  const add = (family: string, weight: number) => specs.add(`${weight} 48px "${family}"`);
  const t = project.typography;
  add(t.titleFont, t.titleWeight);
  add(t.subFont, t.subWeight);
  add(t.subFont, 700);
  add(t.titleFont, 700);
  for (const s of project.scenes) {
    add(s.style.titleFont ?? t.titleFont, s.style.titleWeight ?? t.titleWeight);
    add(s.style.subFont ?? t.subFont, s.style.subWeight ?? t.subWeight);
  }
  add('Inter', 600);
  add('Inter', 700);
  return [...specs];
}

export async function loadFonts(project: Project) {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all(
    fontSpecs(project).map((spec) => {
      let req = fontRequests.get(spec);
      if (!req) {
        req = document.fonts.load(spec).catch(() => undefined);
        fontRequests.set(spec, req);
      }
      return req;
    }),
  );
}

export async function preloadProject(project: Project) {
  const srcs = [project.logo.src, ...project.scenes.map((s) => s.image)].filter(Boolean) as string[];
  await Promise.all([loadFonts(project), ...srcs.map(preloadImage)]);
}

export function readFileAsDataURL(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
