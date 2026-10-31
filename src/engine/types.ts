export type Aspect = '16:9' | '9:16' | '1:1' | '4:5';
export type LayoutMode = 'auto' | 'right' | 'left' | 'center';
export type TextAnim = 'rise' | 'blur' | 'pop' | 'type' | 'slide';
export type Transition = 'glide' | 'flip' | 'push' | 'zoom' | 'drop';
export type CameraMove = 'float' | 'orbit' | 'tilt' | 'dolly' | 'static';
export type BackgroundKind = 'aurora' | 'mesh' | 'spotlight' | 'grid' | 'gradient' | 'studio';
export type GestureKind = 'tap' | 'hold' | 'scroll';
export type ScreenFit = 'width' | 'cover' | 'contain';
export type LogoPosition = 'tl' | 'tr' | 'bl' | 'br';

export interface Gesture {
  id: string;
  kind: GestureKind;
  /** Seconds from the start of the scene. */
  at: number;
  /** Position on the phone screen, in percent (0-100). */
  x: number;
  y: number;
  /** Camera zoom while focusing this gesture (1 = no zoom). */
  zoom: number;
  /** Optional callout shown next to the touch point. */
  label: string;
  /** Scroll gestures: how far to scroll, in percent of the scrollable height. */
  scrollTo: number;
}

export interface TextStyle {
  titleFont: string;
  titleWeight: number;
  titleColor: string;
  subFont: string;
  subWeight: number;
  subColor: string;
}

export interface Scene {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Per-scene overrides of the project typography. */
  style: Partial<TextStyle>;
  textAnim: TextAnim;
  layout: LayoutMode;
  camera: CameraMove;
  transition: Transition;
  image: string | null;
  fit: ScreenFit;
  gestures: Gesture[];
  duration: number;
}

export interface Background {
  kind: BackgroundKind;
  base: string;
  colors: [string, string, string];
  grain: boolean;
  particles: boolean;
  vignette: boolean;
}

export interface Bookend {
  enabled: boolean;
  title: string;
  subtitle: string;
  duration: number;
}

export interface Project {
  version: 2;
  name: string;
  aspect: Aspect;
  theme: string;
  background: Background;
  accent: string;
  accent2: string;
  /** True when the background is dark (drives text shadows, glass tints). */
  dark: boolean;
  typography: TextStyle;
  deviceGlow: boolean;
  logo: {
    src: string | null;
    position: LogoPosition;
    size: number;
    opacity: number;
  };
  intro: Bookend;
  outro: Bookend & { cta: string };
  showProgress: boolean;
  audio: {
    sfx: boolean;
    sfxVolume: number;
    music: string | null;
    musicName: string;
    musicVolume: number;
  };
  scenes: Scene[];
}

/** Phone pose in stage pixels. h = rendered phone height, rotations in degrees (ry = 0 faces the camera). */
export interface Pose {
  cx: number;
  cy: number;
  h: number;
  rx: number;
  ry: number;
  rz: number;
}
