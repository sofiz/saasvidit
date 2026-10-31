import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { migrateProject } from '../engine/defaults';
import { createDemoProject } from '../engine/demo';
import type { Plan } from '../engine/plan';
import type { Gesture, Project, Scene } from '../engine/types';
import type { Clock } from './clock';
import { idbGet, idbSet } from './persist';

const PROJECT_KEY = 'project';
const LEGACY_KEY = 'programmatic_video_studio_save';

export async function loadInitialProject(): Promise<Project> {
  try {
    const saved = await idbGet<unknown>(PROJECT_KEY);
    if (saved) return migrateProject(saved);
  } catch (err) {
    console.warn('Could not read saved project', err);
  }
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const data = JSON.parse(legacy) as { logo?: string | null; scenes?: { image?: string | null; title?: string }[] };
      const untouched = ['Welcome to SaasVidit', 'Seamless Checkout', 'New Scene'];
      const hasWork = !!data.logo || (data.scenes ?? []).some((s) => s.image || !untouched.includes(s.title ?? ''));
      if (hasWork) return migrateProject(data);
    }
  } catch {
    // ignore unreadable legacy saves
  }
  return createDemoProject();
}

interface History {
  past: Project[];
  present: Project;
  future: Project[];
}

export type Recipe = (project: Project) => Project;

export function useProjectHistory(initial: Project) {
  const [history, setHistory] = useState<History>({ past: [], present: initial, future: [] });
  const lastKey = useRef<{ key: string; at: number } | null>(null);
  const [saved, setSaved] = useState<{ project: Project; error: boolean }>({ project: initial, error: false });

  const update = useCallback((recipe: Recipe, key?: string) => {
    const now = performance.now();
    const coalesce = !!key && lastKey.current?.key === key && now - lastKey.current.at < 1200;
    lastKey.current = key ? { key, at: now } : null;
    setHistory((h) => {
      const next = recipe(h.present);
      if (next === h.present) return h;
      if (coalesce) return { ...h, present: next, future: [] };
      return { past: [...h.past.slice(-100), h.present], present: next, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    lastKey.current = null;
    setHistory((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h));
  }, []);

  const redo = useCallback(() => {
    lastKey.current = null;
    setHistory((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h));
  }, []);

  const replace = useCallback((project: Project) => {
    lastKey.current = null;
    setHistory((h) => ({ past: [...h.past.slice(-100), h.present], present: project, future: [] }));
  }, []);

  useEffect(() => {
    const project = history.present;
    const timer = setTimeout(() => {
      idbSet(PROJECT_KEY, project)
        .then(() => setSaved({ project, error: false }))
        .catch((err) => {
          console.error('Autosave failed', err);
          setSaved({ project, error: true });
        });
    }, 700);
    return () => clearTimeout(timer);
  }, [history.present]);

  const saveState: 'saved' | 'saving' | 'error' = saved.project !== history.present ? 'saving' : saved.error ? 'error' : 'saved';

  return {
    project: history.present,
    update,
    undo,
    redo,
    replace,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    saveState,
  };
}

export type InspectorTab = 'scene' | 'motion' | 'style' | 'project';

export interface EditorApi {
  project: Project;
  plan: Plan;
  clock: Clock;
  update: (recipe: Recipe, key?: string) => void;
  replace: (project: Project) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveState: 'saved' | 'saving' | 'error';
  selectedSceneId: string;
  selectScene: (id: string, seek?: boolean) => void;
  selectedGestureId: string | null;
  selectGesture: (id: string | null) => void;
  tab: InspectorTab;
  setTab: (tab: InspectorTab) => void;
  openExport: () => void;
}

export const EditorContext = createContext<EditorApi | null>(null);

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be used inside the editor');
  return ctx;
}

export const patchScene = (id: string, patch: Partial<Scene> | ((s: Scene) => Scene)): Recipe => (p) => ({
  ...p,
  scenes: p.scenes.map((s) => (s.id === id ? (typeof patch === 'function' ? patch(s) : { ...s, ...patch }) : s)),
});

export const patchGesture = (sceneId: string, gestureId: string, patch: Partial<Gesture>): Recipe =>
  patchScene(sceneId, (s) => ({ ...s, gestures: s.gestures.map((g) => (g.id === gestureId ? { ...g, ...patch } : g)) }));

/** Start time of each scene on the full timeline (after the intro). */
export function sceneStart(plan: Plan, index: number) {
  return plan.segments.find((s) => s.kind === 'scene' && s.index === index)?.start ?? 0;
}

/** Copy without highlight markers, for labels in the editor UI. */
export const plainTitle = (s: string) => s.replace(/\*/g, '').replace(/\s+/g, ' ').trim();
