import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildPlan, segmentAt } from './engine/plan';
import type { Project } from './engine/types';
import { Clock } from './editor/clock';
import { ExportDialog } from './editor/ExportDialog';
import { Inspector } from './editor/Inspector';
import { Preview } from './editor/Preview';
import { SceneRail } from './editor/SceneRail';
import { EditorContext, loadInitialProject, patchScene, sceneStart, useProjectHistory, type EditorApi, type InspectorTab } from './editor/state';
import { Timeline } from './editor/Timeline';
import { TopBar } from './editor/TopBar';

export default function App() {
  const [initial, setInitial] = useState<Project | null>(null);
  useEffect(() => {
    loadInitialProject().then(setInitial);
  }, []);
  if (!initial) {
    return (
      <div className="splash">
        <div className="spinner" />
        <span>Preparing the studio…</span>
      </div>
    );
  }
  return <Editor initial={initial} />;
}

function Editor({ initial }: { initial: Project }) {
  const store = useProjectHistory(initial);
  const { project } = store;
  const clock = useMemo(() => new Clock(), []);
  const plan = useMemo(() => buildPlan(project), [project]);
  const [selectedId, setSelectedSceneId] = useState(initial.scenes[0].id);
  const [selectedGestureId, setSelectedGestureId] = useState<string | null>(null);
  const [tab, setTab] = useState<InspectorTab>('scene');
  const [exporting, setExporting] = useState(false);
  // Fall back to the first scene when the selected one was deleted (or undone away).
  const selectedSceneId = project.scenes.some((s) => s.id === selectedId) ? selectedId : project.scenes[0].id;
  const selectedRef = useRef(selectedSceneId);

  useEffect(() => {
    selectedRef.current = selectedSceneId;
  }, [selectedSceneId]);

  useEffect(() => {
    clock.setDuration(plan.duration);
  }, [plan, clock]);

  // Open on a poster frame of the first scene rather than an empty intro frame.
  const openedRef = useRef(false);
  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    clock.seek(sceneStart(plan, 0) + 1.6);
  }, [clock, plan]);

  // While playing, the inspector follows the scene under the playhead.
  useEffect(
    () =>
      clock.subscribe(() => {
        if (!clock.playing) return;
        const seg = plan.segments[segmentAt(plan, clock.time)];
        if (seg?.kind !== 'scene') return;
        const id = project.scenes[seg.index]?.id;
        if (id && id !== selectedRef.current) {
          setSelectedSceneId(id);
          setSelectedGestureId(null);
        }
      }),
    [clock, plan, project.scenes],
  );

  const selectScene = useCallback(
    (id: string, seek = false) => {
      if (id !== selectedRef.current) setSelectedGestureId(null);
      setSelectedSceneId(id);
      if (seek) {
        const index = project.scenes.findIndex((s) => s.id === id);
        if (index >= 0) clock.seek(sceneStart(plan, index) + 0.9);
      }
    },
    [clock, plan, project.scenes],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target;
      const typing = target instanceof Element && !!target.closest('input, textarea, select, [contenteditable="true"]');
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (mod && key === 'y') {
        e.preventDefault();
        store.redo();
        return;
      }
      if (typing || mod) return;
      const frame = 1 / 30;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          clock.toggle();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          clock.setPlaying(false);
          clock.seek(clock.time - (e.shiftKey ? 1 : frame));
          break;
        case 'ArrowRight':
          e.preventDefault();
          clock.setPlaying(false);
          clock.seek(clock.time + (e.shiftKey ? 1 : frame));
          break;
        case 'Home':
          clock.seek(0);
          break;
        case 'End':
          clock.seek(plan.duration);
          break;
        case 'Delete':
        case 'Backspace':
          if (selectedGestureId) {
            e.preventDefault();
            store.update(patchScene(selectedRef.current, (s) => ({ ...s, gestures: s.gestures.filter((g) => g.id !== selectedGestureId) })));
            setSelectedGestureId(null);
          }
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clock, plan.duration, selectedGestureId, store]);

  const api: EditorApi = {
    project,
    plan,
    clock,
    update: store.update,
    replace: store.replace,
    undo: store.undo,
    redo: store.redo,
    canUndo: store.canUndo,
    canRedo: store.canRedo,
    saveState: store.saveState,
    selectedSceneId,
    selectScene,
    selectedGestureId,
    selectGesture: setSelectedGestureId,
    tab,
    setTab,
    openExport: () => {
      clock.setPlaying(false);
      setExporting(true);
    },
  };

  return (
    <EditorContext.Provider value={api}>
      <div className="app">
        <TopBar />
        <SceneRail />
        <Preview />
        <Inspector />
        <Timeline />
      </div>
      {exporting && <ExportDialog project={project} duration={plan.duration} onClose={() => setExporting(false)} />}
    </EditorContext.Provider>
  );
}
