import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, MousePointerClick, Pause, Play, Repeat, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { loadFonts, onAssetsChanged } from '../engine/assets';
import { AudioPreview } from '../engine/audio';
import { Compositor } from '../engine/compositor';
import { newGesture } from '../engine/defaults';
import { STAGES } from '../engine/layout';
import { formatTime, useClockPlaying, useClockTime } from './clock';
import { patchScene, sceneStart, useEditor } from './state';

export function Preview() {
  const editor = useEditor();
  const { project, clock, plan, tab } = editor;
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compRef = useRef<Compositor | null>(null);
  const audioRef = useRef<AudioPreview | null>(null);
  const projectRef = useRef(project);
  const dirty = useRef(true);
  const [ready, setReady] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [muted, setMuted] = useState(false);
  const [loop, setLoop] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [hoverPick, setHoverPick] = useState(false);
  const [hovering, setHovering] = useState(false);
  const playing = useClockPlaying(clock);
  const time = useClockTime(clock);
  const stage = STAGES[project.aspect];
  const pickMode = tab === 'motion';

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    const comp = new Compositor(canvasRef.current!, 'preview');
    compRef.current = comp;
    audioRef.current ??= new AudioPreview();
    comp.setProject(projectRef.current);
    comp.ready
      .then(() => {
        if (compRef.current !== comp) return;
        comp.invalidate();
        dirty.current = true;
        setReady(true);
      })
      .catch((err) => console.error('Device failed to load', err));
    const refresh = () => {
      comp.invalidate();
      dirty.current = true;
    };
    const offAssets = onAssetsChanged(refresh);
    document.fonts?.addEventListener('loadingdone', refresh);
    return () => {
      offAssets();
      document.fonts?.removeEventListener('loadingdone', refresh);
      comp.dispose();
      compRef.current = null;
    };
  }, []);

  useEffect(() => {
    const comp = compRef.current;
    if (!comp) return;
    comp.setProject(project);
    clock.setDuration(comp.plan?.duration ?? 1);
    dirty.current = true;
    loadFonts(project).then(() => {
      comp.invalidate();
      dirty.current = true;
    });
  }, [project, clock]);

  useEffect(() => {
    clock.setLoop(loop);
  }, [loop, clock]);

  // Fit the canvas into the available space and match its backing store to the screen.
  useEffect(() => {
    const host = hostRef.current!;
    const fit = () => {
      const { width, height } = host.getBoundingClientRect();
      const aspect = stage.w / stage.h;
      let w = width;
      let h = width / aspect;
      if (h > height) {
        h = height;
        w = height * aspect;
      }
      setBox({ w: Math.floor(w), h: Math.floor(h) });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      compRef.current?.setResolution(Math.min(stage.w, 1600, Math.round(w * dpr)));
      dirty.current = true;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    return () => ro.disconnect();
  }, [stage.w, stage.h, fullscreen]);

  // Render loop: advances the clock while playing and repaints only when something changed.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let seeks = clock.seeks;
    const loopFn = (now: number) => {
      raf = requestAnimationFrame(loopFn);
      // Real elapsed time keeps picture and sound in sync even after the tab was throttled.
      const dt = Math.max(0, (now - last) / 1000);
      last = now;
      const comp = compRef.current;
      if (!comp) return;
      if (clock.playing) {
        if (seeks !== clock.seeks && comp.plan) audioRef.current?.start(projectRef.current, comp.plan, clock.time);
        const { wrapped, ended } = clock.advance(dt);
        if (wrapped && comp.plan) audioRef.current?.start(projectRef.current, comp.plan, clock.time);
        if (ended) audioRef.current?.stop();
        dirty.current = true;
      }
      seeks = clock.seeks;
      if (dirty.current) {
        dirty.current = false;
        comp.render(clock.time);
      }
    };
    raf = requestAnimationFrame(loopFn);
    const unsub = clock.subscribe(() => {
      dirty.current = true;
    });
    return () => {
      cancelAnimationFrame(raf);
      unsub();
    };
  }, [clock]);

  useEffect(() => {
    const audio = audioRef.current;
    const comp = compRef.current;
    if (!audio || !comp?.plan) return;
    audio.muted = muted;
    if (playing && !muted) audio.start(projectRef.current, comp.plan, clock.time);
    else audio.stop();
  }, [playing, muted, clock]);

  useEffect(() => () => audioRef.current?.stop(), []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else stageRef.current?.requestFullscreen().catch(() => undefined);
  };

  const sceneBounds = plan.segments.filter((s) => s.kind === 'scene');
  const jump = (dir: 1 | -1) => {
    const starts = plan.segments.map((s) => s.start);
    const t = clock.time;
    const target = dir === 1 ? starts.find((s) => s > t + 0.05) ?? plan.duration : [...starts].reverse().find((s) => s < t - 0.25) ?? 0;
    clock.seek(target);
  };

  const toStage = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * stage.w, y: ((e.clientY - rect.top) / rect.height) * stage.h };
  };

  const onCanvasClick = (e: React.MouseEvent) => {
    const comp = compRef.current;
    if (!comp) return;
    if (!pickMode) {
      clock.toggle();
      return;
    }
    const state = comp.lastState;
    const p = toStage(e);
    const hit = comp.pick(p.x, p.y);
    if (!hit || !state || state.segment.kind !== 'scene') return;
    const sceneIndex = state.screen.to;
    const scene = project.scenes[sceneIndex];
    if (!scene) return;
    const at = Math.max(0.3, Math.min(scene.duration - 0.3, clock.time - sceneStart(plan, sceneIndex)));
    const gesture = newGesture({ x: Math.round(hit.x * 10) / 10, y: Math.round(hit.y * 10) / 10, at: Math.round(at * 10) / 10 });
    editor.update(patchScene(scene.id, (s) => ({ ...s, gestures: [...s.gestures, gesture] })));
    editor.selectScene(scene.id);
    editor.selectGesture(gesture.id);
    clock.setPlaying(false);
  };

  const onCanvasMove = (e: React.MouseEvent) => {
    if (!pickMode) return;
    const comp = compRef.current;
    if (!comp) return;
    const p = toStage(e);
    setHoverPick(!!comp.pick(p.x, p.y));
  };

  const activeScene = segmentLabel(plan, time);

  return (
    <div className={`stage ${fullscreen ? 'is-fullscreen' : ''}`} ref={stageRef}>
      <div className="stage-canvas-host" ref={hostRef}>
        <div className="stage-frame" style={{ width: box.w, height: box.h }} onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
          <canvas
            ref={canvasRef}
            className={`stage-canvas ${pickMode ? (hoverPick ? 'is-picking' : 'is-pickmode') : ''}`}
            onClick={onCanvasClick}
            onMouseMove={onCanvasMove}
            onMouseLeave={() => setHoverPick(false)}
          />
          {!ready && (
            <div className="stage-loading">
              <div className="spinner" />
              <span>Loading 3D device…</span>
            </div>
          )}
          {pickMode && ready && hovering && (
            <div className="stage-hint">
              <MousePointerClick size={14} />
              <span>Click the phone screen to add a tap at {formatTime(time)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="transport">
        <div className="transport-group">
          <button type="button" className="icon-btn" onClick={() => jump(-1)} title="Previous scene">
            <SkipBack size={16} />
          </button>
          <button type="button" className="play-btn" onClick={() => clock.toggle()} title="Play / pause (Space)" aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <button type="button" className="icon-btn" onClick={() => jump(1)} title="Next scene">
            <SkipForward size={16} />
          </button>
        </div>
        <div className="timecode">
          <span className="timecode-now">{formatTime(time)}</span>
          <span className="timecode-sep">/</span>
          <span>{formatTime(plan.duration)}</span>
          {activeScene && <span className="timecode-scene">{activeScene}</span>}
        </div>
        <div className="transport-group">
          <span className="transport-meta">
            {stage.w}×{stage.h} · {sceneBounds.length} scenes
          </span>
          <button type="button" className={`icon-btn ${loop ? 'is-active' : ''}`} onClick={() => setLoop(!loop)} title="Loop playback">
            <Repeat size={16} />
          </button>
          <button type="button" className={`icon-btn ${muted ? '' : 'is-active'}`} onClick={() => setMuted(!muted)} title={muted ? 'Unmute preview' : 'Mute preview'}>
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <button type="button" className="icon-btn" onClick={toggleFullscreen} title="Fullscreen preview">
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function segmentLabel(plan: ReturnType<typeof useEditor>['plan'], t: number) {
  const seg = plan.segments.find((s) => t < s.end) ?? plan.segments[plan.segments.length - 1];
  if (!seg) return '';
  if (seg.kind === 'intro') return 'Intro';
  if (seg.kind === 'outro') return 'Outro';
  return `Scene ${seg.index + 1}`;
}
