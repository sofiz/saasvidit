import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, FlipHorizontal2, Hand, MousePointerClick, MoveRight, PanelRight, ScanLine, ZoomIn } from 'lucide-react';
import { getImage } from '../engine/assets';
import type { Transition } from '../engine/types';
import { formatTime, useClockTime } from './clock';
import { patchGesture, patchScene, plainTitle, useEditor } from './state';

const TRANSITION_ICONS: Record<Transition, typeof MoveRight> = {
  glide: MoveRight,
  flip: FlipHorizontal2,
  push: PanelRight,
  zoom: ZoomIn,
  drop: ArrowDownToLine,
};

const GESTURE_ICONS = { tap: MousePointerClick, hold: Hand, scroll: ScanLine };

type Drag =
  | { kind: 'scrub' }
  | { kind: 'resize'; target: 'intro' | 'outro' | string; startX: number; startDur: number }
  | { kind: 'gesture'; sceneId: string; gestureId: string; startX: number; startAt: number; max: number };

export function Timeline() {
  const editor = useEditor();
  const { project, plan, clock } = editor;
  const time = useClockTime(clock);
  const trackRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const drag = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  useEffect(() => {
    const el = trackRef.current!;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const duration = Math.max(plan.duration, 1);
  const pps = width / duration;
  const xToTime = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(duration, (clientX - rect.left) / pps));
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (d.kind === 'scrub') {
        clock.seek(xToTime(e.clientX));
      } else if (d.kind === 'resize') {
        const next = Math.round(Math.max(1.2, Math.min(20, d.startDur + (e.clientX - d.startX) / pps)) * 10) / 10;
        if (d.target === 'intro') editor.update((p) => ({ ...p, intro: { ...p.intro, duration: next } }), 'resize-intro');
        else if (d.target === 'outro') editor.update((p) => ({ ...p, outro: { ...p.outro, duration: next } }), 'resize-outro');
        else editor.update(patchScene(d.target, { duration: next }), `resize-${d.target}`);
      } else if (d.kind === 'gesture') {
        const at = Math.round(Math.max(0.3, Math.min(d.max, d.startAt + (e.clientX - d.startX) / pps)) * 10) / 10;
        editor.update(patchGesture(d.sceneId, d.gestureId, { at }), `gesture-at-${d.gestureId}`);
      }
    };
    const up = () => {
      drag.current = null;
      setDragging(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  });

  const step = pps > 90 ? 0.5 : pps > 40 ? 1 : pps > 18 ? 2 : 5;
  const ticks: number[] = [];
  for (let t = 0; t <= duration + 1e-6; t += step) ticks.push(t);

  return (
    <div className={`timeline ${dragging ? 'is-dragging' : ''}`}>
      <div className="timeline-head">
        <span className="timeline-title">Timeline</span>
        <span className="timeline-meta">
          {formatTime(duration)} · {project.scenes.length} scenes · {project.scenes.reduce((n, s) => n + s.gestures.length, 0)} interactions
        </span>
        <span className="timeline-tip">Drag block edges to retime · drag markers to move interactions</span>
      </div>
      <div className="timeline-body">
        <div className="timeline-lanes" ref={trackRef}>
        <div
          className="timeline-ruler"
          onPointerDown={(e) => {
            drag.current = { kind: 'scrub' };
            setDragging('scrub');
            clock.setPlaying(false);
            clock.seek(xToTime(e.clientX));
          }}
        >
          {ticks.map((t) => (
            <div key={t} className={`tick ${Number.isInteger(t) ? 'is-major' : ''}`} style={{ left: t * pps }}>
              {Number.isInteger(t) && <span>{t}s</span>}
            </div>
          ))}
        </div>

        <div className="timeline-track">
          {plan.segments.map((seg) => {
            const left = seg.start * pps;
            const w = Math.max(4, (seg.end - seg.start) * pps);
            if (seg.kind !== 'scene') {
              const key = seg.kind;
              const label = seg.kind === 'intro' ? 'Intro' : 'Outro';
              const text = seg.kind === 'intro' ? project.intro.title : project.outro.title;
              return (
                <div
                  key={key}
                  className="clip clip-bookend"
                  style={{ left, width: w }}
                  onPointerDown={(e) => {
                    if ((e.target as HTMLElement).closest('.clip-handle')) return;
                    clock.setPlaying(false);
                    clock.seek(seg.start + 0.01);
                    editor.setTab('project');
                  }}
                >
                  <div className="clip-inner">
                    <span className="clip-kicker">{label}</span>
                    <span className="clip-title">{plainTitle(text)}</span>
                  </div>
                  <div
                    className="clip-handle"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      drag.current = { kind: 'resize', target: key, startX: e.clientX, startDur: seg.end - seg.start };
                      setDragging('resize');
                    }}
                  />
                </div>
              );
            }
            const scene = project.scenes[seg.index];
            if (!scene) return null;
            const selected = editor.selectedSceneId === scene.id;
            const img = getImage(scene.image);
            const TIcon = TRANSITION_ICONS[scene.transition];
            return (
              <div
                key={scene.id}
                className={`clip clip-scene ${selected ? 'is-selected' : ''}`}
                style={{ left, width: w }}
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest('.clip-handle, .marker')) return;
                  clock.setPlaying(false);
                  editor.selectScene(scene.id, false);
                  clock.seek(xToTime(e.clientX));
                }}
              >
                {seg.index > 0 && (
                  <button
                    type="button"
                    className="clip-transition"
                    title={`Transition: ${scene.transition}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      editor.selectScene(scene.id);
                      editor.setTab('motion');
                    }}
                  >
                    <TIcon size={11} />
                  </button>
                )}
                <div className="clip-inner">
                  {img && w > 70 && <img className="clip-thumb" src={img.src} alt="" draggable={false} />}
                  <div className="clip-text">
                    <span className="clip-kicker">
                      {seg.index + 1} · {scene.duration.toFixed(1)}s
                    </span>
                    <span className="clip-title">{plainTitle(scene.title) || 'Untitled'}</span>
                  </div>
                </div>
                <div className="clip-markers">
                  {scene.gestures.map((g, gi) => {
                    const GIcon = GESTURE_ICONS[g.kind];
                    const active = editor.selectedGestureId === g.id;
                    return (
                      <button
                        type="button"
                        key={g.id}
                        className={`marker ${active ? 'is-active' : ''}`}
                        style={{ left: Math.min(w - 10, Math.max(10, g.at * pps)) }}
                        title={`${g.kind} #${gi + 1} at ${g.at.toFixed(1)}s${g.label ? ` — ${g.label}` : ''}`}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          clock.setPlaying(false);
                          editor.selectScene(scene.id, false);
                          editor.selectGesture(g.id);
                          editor.setTab('motion');
                          drag.current = { kind: 'gesture', sceneId: scene.id, gestureId: g.id, startX: e.clientX, startAt: g.at, max: scene.duration - 0.2 };
                          setDragging('gesture');
                          clock.seek(seg.start + Math.max(0, g.at - 0.8));
                        }}
                      >
                        <GIcon size={10} />
                      </button>
                    );
                  })}
                </div>
                <div
                  className="clip-handle"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    drag.current = { kind: 'resize', target: scene.id, startX: e.clientX, startDur: scene.duration };
                    setDragging('resize');
                  }}
                />
              </div>
            );
          })}
        </div>

        <div className="playhead" style={{ left: time * pps }}>
          <div className="playhead-head" />
        </div>
        </div>
      </div>
    </div>
  );
}
