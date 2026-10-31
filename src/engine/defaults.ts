import { uid } from './math';
import type { Background, Gesture, Project, Scene, TextStyle } from './types';

export const FONTS = [
  'Inter',
  'Plus Jakarta Sans',
  'Manrope',
  'Poppins',
  'Montserrat',
  'Space Grotesk',
  'Sora',
  'Outfit',
  'DM Sans',
  'Bricolage Grotesque',
  'Playfair Display',
  'Instrument Serif',
  'Roboto',
  'Tajawal',
  'Cairo',
] as const;

export const WEIGHTS = [400, 500, 600, 700, 800] as const;

export interface Theme {
  id: string;
  label: string;
  background: Background;
  accent: string;
  accent2: string;
  dark: boolean;
  typography: TextStyle;
}

const darkType = (titleFont: string, subColor: string, titleColor = '#ffffff'): TextStyle => ({
  titleFont,
  titleWeight: 800,
  titleColor,
  subFont: 'Inter',
  subWeight: 400,
  subColor,
});

export const THEMES: Theme[] = [
  {
    id: 'midnight',
    label: 'Midnight',
    background: { kind: 'aurora', base: '#05060f', colors: ['#3d5afe', '#8b5cf6', '#06b6d4'], grain: true, particles: true, vignette: true },
    accent: '#8ea2ff',
    accent2: '#c084fc',
    dark: true,
    typography: darkType('Inter', '#b9c2ea'),
  },
  {
    id: 'sunset',
    label: 'Sunset',
    background: { kind: 'aurora', base: '#12060a', colors: ['#ff5f6d', '#ffb347', '#c471ed'], grain: true, particles: true, vignette: true },
    accent: '#ffb27a',
    accent2: '#ff6fa5',
    dark: true,
    typography: darkType('Plus Jakarta Sans', '#ffd8c7'),
  },
  {
    id: 'neon',
    label: 'Neon Grid',
    background: { kind: 'grid', base: '#05030d', colors: ['#ff2bd6', '#00e5ff', '#7c3aed'], grain: true, particles: false, vignette: true },
    accent: '#3ff0ff',
    accent2: '#ff4fd8',
    dark: true,
    typography: darkType('Space Grotesk', '#cbbcff'),
  },
  {
    id: 'emerald',
    label: 'Emerald',
    background: { kind: 'spotlight', base: '#03110d', colors: ['#10b981', '#34d399', '#0ea5e9'], grain: true, particles: true, vignette: true },
    accent: '#4ade80',
    accent2: '#22d3ee',
    dark: true,
    typography: darkType('Sora', '#a7e8cc', '#ecfdf5'),
  },
  {
    id: 'mono',
    label: 'Graphite',
    background: { kind: 'spotlight', base: '#09090b', colors: ['#f4f4f5', '#71717a', '#3f3f46'], grain: true, particles: false, vignette: true },
    accent: '#ffffff',
    accent2: '#a1a1aa',
    dark: true,
    typography: darkType('Manrope', '#a1a1aa'),
  },
  {
    id: 'studio',
    label: 'Studio',
    background: { kind: 'studio', base: '#e9ecf2', colors: ['#ffffff', '#d7dce6', '#b9c3d6'], grain: true, particles: false, vignette: true },
    accent: '#0a7cff',
    accent2: '#7a5cff',
    dark: false,
    typography: { titleFont: 'Inter', titleWeight: 800, titleColor: '#0b0d12', subFont: 'Inter', subWeight: 400, subColor: '#555b69' },
  },
  {
    id: 'pastel',
    label: 'Pastel',
    background: { kind: 'mesh', base: '#f7f2ff', colors: ['#ffc8e4', '#c4cdff', '#b6ecff'], grain: true, particles: true, vignette: false },
    accent: '#7c3aed',
    accent2: '#ec4899',
    dark: false,
    typography: { titleFont: 'Outfit', titleWeight: 700, titleColor: '#1d1640', subFont: 'Inter', subWeight: 400, subColor: '#545073' },
  },
  {
    id: 'ocean',
    label: 'Ocean',
    background: { kind: 'gradient', base: '#031026', colors: ['#0e4dd8', '#00b4d8', '#031026'], grain: true, particles: true, vignette: true },
    accent: '#5eead4',
    accent2: '#60a5fa',
    dark: true,
    typography: darkType('Poppins', '#bfe3ff'),
  },
];

export const findTheme = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];

export function newGesture(partial: Partial<Gesture> = {}): Gesture {
  return { id: uid(), kind: 'tap', at: 1.6, x: 50, y: 50, zoom: 1.7, label: '', scrollTo: 100, ...partial };
}

export function newScene(partial: Partial<Scene> = {}): Scene {
  return {
    id: uid(),
    eyebrow: '',
    title: 'New *feature*',
    subtitle: 'Describe what this screen helps people do.',
    style: {},
    textAnim: 'rise',
    layout: 'auto',
    camera: 'float',
    transition: 'glide',
    image: null,
    fit: 'width',
    gestures: [],
    duration: 4,
    ...partial,
  };
}

export function blankProject(): Project {
  const theme = THEMES[0];
  return {
    version: 2,
    name: 'Untitled showcase',
    aspect: '16:9',
    theme: theme.id,
    background: { ...theme.background, colors: [...theme.background.colors] },
    accent: theme.accent,
    accent2: theme.accent2,
    dark: theme.dark,
    typography: { ...theme.typography },
    deviceGlow: true,
    logo: { src: null, position: 'tl', size: 120, opacity: 100 },
    intro: { enabled: true, title: 'Your App', subtitle: 'The tagline people remember.', duration: 2.6 },
    outro: { enabled: true, title: 'Get it today', subtitle: 'Available on iOS and Android', cta: 'Download now', duration: 3.4 },
    showProgress: false,
    audio: { sfx: true, sfxVolume: 70, music: null, musicName: '', musicVolume: 60 },
    scenes: [newScene({ title: 'Show off your *app*', subtitle: 'Drop a screenshot, add a tap, and watch the camera follow.', eyebrow: 'Getting started' })],
  };
}

export function applyTheme(project: Project, theme: Theme): Project {
  return {
    ...project,
    theme: theme.id,
    background: { ...theme.background, colors: [...theme.background.colors] },
    accent: theme.accent,
    accent2: theme.accent2,
    dark: theme.dark,
    typography: { ...theme.typography },
    scenes: project.scenes.map((s) => ({ ...s, style: {} })),
  };
}

export const resolveStyle = (project: Project, scene?: Scene): TextStyle => ({
  ...project.typography,
  ...(scene?.style ?? {}),
});

// --- Migration from the original single-file editor (v1) ---

interface LegacyScene {
  id?: string;
  title?: string;
  titleFont?: string;
  titleWeight?: string;
  titleColor?: string;
  sub?: string;
  subFont?: string;
  subWeight?: string;
  subColor?: string;
  image?: string | null;
  showTouch?: boolean;
  touchX?: number;
  touchY?: number;
  duration?: number;
}

interface LegacyProject {
  logo?: string | null;
  logoX?: number;
  logoY?: number;
  logoSize?: number;
  logoOpacity?: number;
  enableSpecialAnimation?: boolean;
  scenes?: LegacyScene[];
}

const legacyWeight = (w?: string) => (w === 'extrabold' ? 800 : w === 'bold' ? 700 : 400);

export function migrateProject(data: unknown): Project {
  const raw = data as Partial<Project> | null;
  if (raw && raw.version === 2 && Array.isArray(raw.scenes)) {
    const base = blankProject();
    return {
      ...base,
      ...raw,
      background: { ...base.background, ...raw.background },
      typography: { ...base.typography, ...raw.typography },
      logo: { ...base.logo, ...raw.logo },
      intro: { ...base.intro, ...raw.intro },
      outro: { ...base.outro, ...raw.outro },
      audio: { ...base.audio, ...raw.audio },
      scenes: raw.scenes.map((s: Scene) => ({ ...newScene(), ...s, gestures: (s.gestures ?? []).map((g) => newGesture(g)) })),
    } as Project;
  }

  const legacy = data as LegacyProject | null;
  const project = blankProject();
  project.intro.enabled = false;
  project.outro.enabled = false;
  const legacyScenes = legacy?.scenes ?? [];
  if (legacyScenes.length) {
    const first = legacyScenes[0];
    project.typography = {
      ...project.typography,
      titleFont: first.titleFont || 'Roboto',
      titleWeight: legacyWeight(first.titleWeight),
      titleColor: first.titleColor || '#ffffff',
      subFont: first.subFont || 'Roboto',
      subWeight: legacyWeight(first.subWeight),
      subColor: first.subColor || '#bfdbfe',
    };
    project.scenes = legacyScenes.map((s, i) =>
      newScene({
        id: s.id || uid(),
        title: s.title ?? '',
        subtitle: s.sub ?? '',
        image: s.image ?? null,
        duration: s.duration ?? 4,
        transition: legacy?.enableSpecialAnimation && i > 0 ? 'flip' : 'glide',
        layout: legacy?.enableSpecialAnimation ? 'auto' : 'right',
        gestures: s.showTouch ? [newGesture({ x: s.touchX ?? 50, y: s.touchY ?? 50, at: Math.max(0.8, (s.duration ?? 4) - 1.4) })] : [],
      }),
    );
  }
  if (legacy?.logo) {
    project.logo = {
      src: legacy.logo,
      position: (legacy.logoY ?? 10) > 50 ? ((legacy.logoX ?? 10) > 50 ? 'br' : 'bl') : (legacy.logoX ?? 10) > 50 ? 'tr' : 'tl',
      size: legacy.logoSize ?? 120,
      opacity: legacy.logoOpacity ?? 100,
    };
  }
  return project;
}
