import { useRef } from 'react';
import JSZip from 'jszip';
import {
  ArrowDownToLine,
  Camera,
  Clapperboard,
  Download,
  FilePlus2,
  FlipHorizontal2,
  FolderOpen,
  Hand,
  Image as ImageIcon,
  LayoutTemplate,
  MousePointerClick,
  MoveRight,
  Music,
  Palette,
  PanelRight,
  Plus,
  RotateCcw,
  ScanLine,
  Sparkles,
  Trash2,
  Type,
  Upload,
  Volume2,
  Wand2,
  ZoomIn,
} from 'lucide-react';
import { readFileAsDataURL } from '../engine/assets';
import { FONTS, THEMES, WEIGHTS, applyTheme, blankProject, migrateProject, newGesture, resolveStyle } from '../engine/defaults';
import { createDemoProject } from '../engine/demo';
import { clamp } from '../engine/math';
import type { Aspect, BackgroundKind, CameraMove, GestureKind, LayoutMode, LogoPosition, Project, Scene, ScreenFit, TextAnim, TextStyle, Transition } from '../engine/types';
import { useClockTime } from './clock';
import { MusicPicker } from './MusicPicker';
import { patchGesture, patchScene, sceneStart, useEditor, type InspectorTab } from './state';
import { Chips, ColorInput, Field, Section, Segmented, Select, Slider, Switch } from './ui';

const TABS: { id: InspectorTab; label: string; icon: typeof Type }[] = [
  { id: 'scene', label: 'Scene', icon: Clapperboard },
  { id: 'motion', label: 'Motion', icon: Wand2 },
  { id: 'style', label: 'Style', icon: Palette },
  { id: 'project', label: 'Project', icon: LayoutTemplate },
];

export function Inspector() {
  const editor = useEditor();
  const scene = editor.project.scenes.find((s) => s.id === editor.selectedSceneId) ?? editor.project.scenes[0];
  return (
    <aside className="inspector">
      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={editor.tab === t.id} className={editor.tab === t.id ? 'is-active' : ''} onClick={() => editor.setTab(t.id)}>
            <t.icon size={15} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      <div className="inspector-body">
        {editor.tab === 'scene' && scene && <ScenePanel scene={scene} />}
        {editor.tab === 'motion' && scene && <MotionPanel scene={scene} />}
        {editor.tab === 'style' && <StylePanel />}
        {editor.tab === 'project' && <ProjectPanel />}
      </div>
    </aside>
  );
}

// --- Scene ---

const TEXT_ANIMS: { value: TextAnim; label: string; hint: string }[] = [
  { value: 'rise', label: 'Rise', hint: 'Words slide up from behind a mask' },
  { value: 'blur', label: 'Blur', hint: 'Words sharpen into focus' },
  { value: 'pop', label: 'Pop', hint: 'Springy word-by-word scale' },
  { value: 'type', label: 'Type', hint: 'Typewriter with caret' },
  { value: 'slide', label: 'Slide', hint: 'Words sweep in from the side' },
];

const FITS: { value: ScreenFit; label: string; hint: string }[] = [
  { value: 'width', label: 'Fit width', hint: 'Tall screenshots become scrollable' },
  { value: 'cover', label: 'Fill', hint: 'Crop to fill the display' },
  { value: 'contain', label: 'Contain', hint: 'Show the whole image' },
];

function ScenePanel({ scene }: { scene: Scene }) {
  const editor = useEditor();
  const index = editor.project.scenes.findIndex((s) => s.id === scene.id);
  const set = (patch: Partial<Scene>, key?: string) => editor.update(patchScene(scene.id, patch), key ? `${key}-${scene.id}` : undefined);
  const style = resolveStyle(editor.project, scene);
  const setStyle = (patch: Partial<TextStyle>) => editor.update(patchScene(scene.id, (s) => ({ ...s, style: { ...s.style, ...patch } })), `style-${scene.id}`);
  const hasOverrides = Object.keys(scene.style).length > 0;

  return (
    <>
      <div className="inspector-heading">
        <span className="eyebrow">Scene {index + 1}</span>
        <h2>Content</h2>
      </div>

      <Section title="Screen" icon={<ImageIcon size={14} />}>
        <ScreenshotField scene={scene} />
        <Field label="Fit" hint={FITS.find((f) => f.value === scene.fit)?.hint}>
          <Segmented value={scene.fit} options={FITS} onChange={(fit) => set({ fit })} size="sm" />
        </Field>
      </Section>

      <Section title="Copy" icon={<Type size={14} />}>
        <Field label="Eyebrow">
          <input className="input" value={scene.eyebrow} placeholder="e.g. Step 01" onChange={(e) => set({ eyebrow: e.target.value }, 'eyebrow')} />
        </Field>
        <Field label="Headline" hint={<>Wrap words in <code>*asterisks*</code> to highlight them.</>}>
          <textarea className="input textarea" rows={2} value={scene.title} onChange={(e) => set({ title: e.target.value }, 'title')} />
        </Field>
        <Field label="Description">
          <textarea className="input textarea" rows={3} value={scene.subtitle} onChange={(e) => set({ subtitle: e.target.value }, 'subtitle')} />
        </Field>
      </Section>

      <Section title="Text animation" icon={<Sparkles size={14} />}>
        <Chips value={scene.textAnim} options={TEXT_ANIMS} onChange={(textAnim) => set({ textAnim })} columns={5} />
      </Section>

      <Section title="Timing" icon={<Clapperboard size={14} />}>
        <Field label="Duration" value={`${scene.duration.toFixed(1)}s`}>
          <Slider value={scene.duration} min={1.5} max={15} step={0.1} onChange={(duration) => set({ duration }, 'duration')} label="Scene duration" />
        </Field>
      </Section>

      <Section
        title="Typography override"
        icon={<Type size={14} />}
        collapsible
        defaultOpen={hasOverrides}
        actions={
          hasOverrides ? (
            <button type="button" className="link-btn" onClick={() => set({ style: {} })}>
              <RotateCcw size={12} /> Reset
            </button>
          ) : undefined
        }
      >
        <TypographyFields style={style} onChange={setStyle} />
      </Section>
    </>
  );
}

function ScreenshotField({ scene }: { scene: Scene }) {
  const editor = useEditor();
  const input = useRef<HTMLInputElement>(null);
  const load = async (file?: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    const image = await readFileAsDataURL(file);
    editor.update(patchScene(scene.id, { image }));
  };
  return (
    <div
      className="shot-field"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        load(e.dataTransfer.files[0]);
      }}
    >
      <button type="button" className="shot-preview" onClick={() => input.current?.click()}>
        {scene.image ? <img src={scene.image} alt="" /> : <Upload size={20} />}
      </button>
      <div className="shot-copy">
        <strong>{scene.image ? 'Screenshot' : 'Add a screenshot'}</strong>
        <p>Any phone screenshot works. Tall, full-page captures can be scrolled with a scroll gesture.</p>
        <div className="shot-actions">
          <button type="button" className="btn btn-sm" onClick={() => input.current?.click()}>
            <Upload size={13} /> {scene.image ? 'Replace' : 'Upload'}
          </button>
          {scene.image && (
            <button type="button" className="btn btn-sm btn-ghost is-danger" onClick={() => editor.update(patchScene(scene.id, { image: null }))}>
              <Trash2 size={13} /> Remove
            </button>
          )}
        </div>
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => load(e.target.files?.[0]).then(() => (e.target.value = ''))} />
    </div>
  );
}

const fontOptions = FONTS.map((f) => ({ value: f as string, label: f }));
const weightOptions = WEIGHTS.map((w) => ({ value: w as number, label: { 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold', 800: 'Extra bold' }[w] }));

function TypographyFields({ style, onChange }: { style: TextStyle; onChange: (patch: Partial<TextStyle>) => void }) {
  return (
    <>
      <Field label="Headline">
        <div className="row">
          <Select value={style.titleFont} options={fontOptions} onChange={(titleFont) => onChange({ titleFont })} label="Headline font" />
          <Select value={style.titleWeight} options={weightOptions} onChange={(titleWeight) => onChange({ titleWeight })} label="Headline weight" />
          <ColorInput value={style.titleColor} onChange={(titleColor) => onChange({ titleColor })} label="Headline color" />
        </div>
      </Field>
      <Field label="Body">
        <div className="row">
          <Select value={style.subFont} options={fontOptions} onChange={(subFont) => onChange({ subFont })} label="Body font" />
          <Select value={style.subWeight} options={weightOptions} onChange={(subWeight) => onChange({ subWeight })} label="Body weight" />
          <ColorInput value={style.subColor} onChange={(subColor) => onChange({ subColor })} label="Body color" />
        </div>
      </Field>
    </>
  );
}

// --- Motion ---

const LayoutIcon = ({ mode }: { mode: LayoutMode }) => (
  <svg width="26" height="18" viewBox="0 0 26 18" aria-hidden>
    <rect x="0.5" y="0.5" width="25" height="17" rx="3" fill="none" stroke="currentColor" strokeOpacity="0.35" />
    {mode === 'center' ? (
      <>
        <rect x="8" y="3" width="10" height="1.6" rx="0.8" fill="currentColor" />
        <rect x="10.5" y="7" width="5" height="11" rx="1.2" fill="currentColor" fillOpacity="0.8" />
      </>
    ) : mode === 'auto' ? (
      <>
        <rect x="3" y="7" width="7" height="1.6" rx="0.8" fill="currentColor" />
        <rect x="16" y="4" width="5" height="10" rx="1.2" fill="currentColor" fillOpacity="0.8" />
        <path d="M11 13.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </>
    ) : (
      <>
        <rect x={mode === 'right' ? 3 : 14} y="7" width="9" height="1.6" rx="0.8" fill="currentColor" />
        <rect x={mode === 'right' ? 3 : 14} y="10" width="6" height="1.2" rx="0.6" fill="currentColor" fillOpacity="0.5" />
        <rect x={mode === 'right' ? 16 : 5} y="3.5" width="5" height="11" rx="1.2" fill="currentColor" fillOpacity="0.8" />
      </>
    )}
  </svg>
);

const LAYOUTS: { value: LayoutMode; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'right', label: 'Right' },
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Hero' },
];

const CAMERAS: { value: CameraMove; label: string; hint: string }[] = [
  { value: 'float', label: 'Float', hint: 'Gentle hover and sway' },
  { value: 'orbit', label: 'Orbit', hint: 'Slow turn across the scene' },
  { value: 'tilt', label: 'Tilt', hint: 'Rises from a low angle' },
  { value: 'dolly', label: 'Dolly', hint: 'Slow push-in' },
  { value: 'static', label: 'Static', hint: 'No idle motion' },
];

const TRANSITIONS: { value: Transition; label: string; hint: string; icon: React.ReactNode }[] = [
  { value: 'glide', label: 'Glide', hint: 'Device glides to the new layout', icon: <MoveRight size={14} /> },
  { value: 'flip', label: 'Flip', hint: '360° spin, screen swaps on the back side', icon: <FlipHorizontal2 size={14} /> },
  { value: 'push', label: 'Push', hint: 'In-app navigation push', icon: <PanelRight size={14} /> },
  { value: 'zoom', label: 'Dive', hint: 'Zooms through the screen', icon: <ZoomIn size={14} /> },
  { value: 'drop', label: 'Drop', hint: 'Falls away, next one rises', icon: <ArrowDownToLine size={14} /> },
];

const GESTURE_KINDS: { value: GestureKind; label: string; icon: React.ReactNode }[] = [
  { value: 'tap', label: 'Tap', icon: <MousePointerClick size={13} /> },
  { value: 'hold', label: 'Hold', icon: <Hand size={13} /> },
  { value: 'scroll', label: 'Scroll', icon: <ScanLine size={13} /> },
];

function MotionPanel({ scene }: { scene: Scene }) {
  const editor = useEditor();
  const index = editor.project.scenes.findIndex((s) => s.id === scene.id);
  const set = (patch: Partial<Scene>) => editor.update(patchScene(scene.id, patch));
  const time = useClockTime(editor.clock);
  const start = sceneStart(editor.plan, index);
  const sorted = [...scene.gestures].sort((a, b) => a.at - b.at);

  const addGesture = (x = 50, y = 50) => {
    const local = time - start;
    const inside = local > 0.3 && local < scene.duration - 0.3;
    const last = sorted[sorted.length - 1];
    const at = inside ? local : clamp(last ? last.at + 1.4 : 1.6, 0.3, scene.duration - 0.3);
    const g = newGesture({ x, y, at: Math.round(at * 10) / 10 });
    editor.update(patchScene(scene.id, (s) => ({ ...s, gestures: [...s.gestures, g] })));
    editor.selectGesture(g.id);
  };

  return (
    <>
      <div className="inspector-heading">
        <span className="eyebrow">Scene {index + 1}</span>
        <h2>Camera &amp; interactions</h2>
      </div>

      <Section title="Interactions" icon={<MousePointerClick size={14} />} actions={<button type="button" className="link-btn" onClick={() => addGesture()}><Plus size={12} /> Add</button>}>
        <p className="section-note">Each tap pulls the camera onto that spot, dims the copy and can show a callout. Click the screen below — or the phone in the preview.</p>
        <div className="interactions">
          <ScreenEditor scene={scene} onAdd={addGesture} />
          <div className="gesture-list">
            {sorted.length === 0 && <div className="empty">No interactions yet. Click the screen to add a tap.</div>}
            {sorted.map((g, i) => {
              const active = editor.selectedGestureId === g.id;
              const kind = GESTURE_KINDS.find((k) => k.value === g.kind)!;
              const setG = (patch: Partial<typeof g>, key?: string) => editor.update(patchGesture(scene.id, g.id, patch), key ? `${key}-${g.id}` : undefined);
              return (
                <div key={g.id} className={`gesture ${active ? 'is-active' : ''}`}>
                  <button
                    type="button"
                    className="gesture-head"
                    onClick={() => {
                      editor.selectGesture(active ? null : g.id);
                      editor.clock.setPlaying(false);
                      editor.clock.seek(start + Math.max(0, g.at - 0.9));
                    }}
                  >
                    <span className="gesture-num">{i + 1}</span>
                    {kind.icon}
                    <span className="gesture-name">{g.label.trim() || kind.label}</span>
                    <span className="gesture-meta">
                      {g.at.toFixed(1)}s · {g.zoom.toFixed(1)}×
                    </span>
                  </button>
                  {active && (
                    <div className="gesture-body">
                      <Segmented value={g.kind} options={GESTURE_KINDS} onChange={(k) => setG({ kind: k })} size="sm" />
                      <Field label="Time in scene" value={`${g.at.toFixed(1)}s`}>
                        <Slider value={g.at} min={0.3} max={Math.max(0.4, scene.duration - 0.2)} step={0.05} onChange={(at) => setG({ at }, 'at')} label="Gesture time" />
                      </Field>
                      <Field label="Camera zoom" value={`${g.zoom.toFixed(2)}×`} hint={g.zoom <= 1.02 ? 'The camera stays put; only the touch is shown.' : undefined}>
                        <Slider value={g.zoom} min={1} max={3} step={0.05} onChange={(zoom) => setG({ zoom }, 'zoom')} label="Camera zoom" />
                      </Field>
                      {g.kind === 'scroll' && (
                        <Field label="Scroll to" value={`${Math.round(g.scrollTo)}%`}>
                          <Slider value={g.scrollTo} min={0} max={100} step={1} onChange={(scrollTo) => setG({ scrollTo }, 'scroll')} label="Scroll target" />
                        </Field>
                      )}
                      <Field label="Callout">
                        <input className="input" value={g.label} placeholder="e.g. Tap to pay" onChange={(e) => setG({ label: e.target.value }, 'label')} />
                      </Field>
                      <div className="gesture-foot">
                        <span className="muted">
                          x {g.x.toFixed(0)}% · y {g.y.toFixed(0)}%
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost is-danger"
                          onClick={() => {
                            editor.update(patchScene(scene.id, (s) => ({ ...s, gestures: s.gestures.filter((x) => x.id !== g.id) })));
                            editor.selectGesture(null);
                          }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Section>

      <Section title="Layout" icon={<LayoutTemplate size={14} />}>
        <Chips value={scene.layout} options={LAYOUTS.map((l) => ({ ...l, icon: <LayoutIcon mode={l.value} /> }))} onChange={(layout) => set({ layout })} columns={4} />
      </Section>

      <Section title="Camera move" icon={<Camera size={14} />}>
        <Chips value={scene.camera} options={CAMERAS} onChange={(camera) => set({ camera })} columns={5} />
        <p className="section-note">{CAMERAS.find((c) => c.value === scene.camera)?.hint}</p>
      </Section>

      <Section title="Transition in" icon={<Sparkles size={14} />}>
        {index === 0 ? (
          <p className="section-note">The first scene always rises into frame{editor.project.intro.enabled ? ' after the intro' : ''}.</p>
        ) : (
          <>
            <Chips value={scene.transition} options={TRANSITIONS} onChange={(transition) => set({ transition })} columns={5} />
            <p className="section-note">{TRANSITIONS.find((t) => t.value === scene.transition)?.hint}</p>
          </>
        )}
      </Section>
    </>
  );
}

function ScreenEditor({ scene, onAdd }: { scene: Scene; onAdd: (x: number, y: number) => void }) {
  const editor = useEditor();
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef<string | null>(null);
  const sorted = [...scene.gestures].sort((a, b) => a.at - b.at);

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return {
      x: Math.round(clamp(((e.clientX - r.left) / r.width) * 100, 0, 100) * 10) / 10,
      y: Math.round(clamp(((e.clientY - r.top) / r.height) * 100, 0, 100) * 10) / 10,
    };
  };

  return (
    <div
      ref={ref}
      className={`screen-editor fit-${scene.fit}`}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('.screen-marker')) return;
        const p = pos(e);
        onAdd(p.x, p.y);
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        editor.update(patchGesture(scene.id, dragging.current, pos(e)), `drag-${dragging.current}`);
      }}
      onPointerUp={() => (dragging.current = null)}
    >
      {scene.image ? <img src={scene.image} alt="" draggable={false} /> : <div className="screen-empty">No screenshot</div>}
      {sorted.map((g, i) => (
        <button
          key={g.id}
          type="button"
          className={`screen-marker kind-${g.kind} ${editor.selectedGestureId === g.id ? 'is-active' : ''}`}
          style={{ left: `${g.x}%`, top: `${g.y}%` }}
          onPointerDown={(e) => {
            e.stopPropagation();
            (e.currentTarget.parentElement as HTMLElement).setPointerCapture(e.pointerId);
            dragging.current = g.id;
            editor.selectGesture(g.id);
          }}
          title="Drag to move"
        >
          {i + 1}
        </button>
      ))}
    </div>
  );
}

// --- Style ---

const BACKGROUNDS: { value: BackgroundKind; label: string }[] = [
  { value: 'aurora', label: 'Aurora' },
  { value: 'mesh', label: 'Mesh' },
  { value: 'spotlight', label: 'Spotlight' },
  { value: 'grid', label: 'Grid' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'studio', label: 'Studio' },
];

function StylePanel() {
  const editor = useEditor();
  const { project } = editor;
  const bg = project.background;
  const setBg = (patch: Partial<Project['background']>, key?: string) => editor.update((p) => ({ ...p, theme: 'custom', background: { ...p.background, ...patch } }), key);
  const setColor = (i: number, c: string) => {
    const colors = [...bg.colors] as Project['background']['colors'];
    colors[i] = c;
    setBg({ colors }, `bg-color-${i}`);
  };

  return (
    <>
      <div className="inspector-heading">
        <span className="eyebrow">Whole video</span>
        <h2>Look &amp; feel</h2>
      </div>

      <Section title="Theme" icon={<Palette size={14} />}>
        <div className="themes">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`theme ${project.theme === t.id ? 'is-active' : ''}`}
              onClick={() => editor.update((p) => applyTheme(p, t))}
              title={t.label}
            >
              <span
                className="theme-swatch"
                style={{
                  background: `radial-gradient(circle at 25% 30%, ${t.background.colors[0]}cc, transparent 55%), radial-gradient(circle at 80% 75%, ${t.background.colors[1]}cc, transparent 55%), radial-gradient(circle at 70% 10%, ${t.background.colors[2]}99, transparent 50%), ${t.background.base}`,
                }}
              >
                <span className="theme-phone" style={{ boxShadow: `0 0 18px ${t.accent}66` }} />
                <span className="theme-text" style={{ background: t.typography.titleColor }} />
              </span>
              <span className="theme-label">{t.label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Background" icon={<ImageIcon size={14} />}>
        <Chips value={bg.kind} options={BACKGROUNDS} onChange={(kind) => setBg({ kind })} columns={3} />
        <Field label="Colors">
          <div className="row row-wrap">
            <ColorInput value={bg.base} onChange={(base) => setBg({ base }, 'bg-base')} label="Base" />
            {bg.colors.map((c, i) => (
              <ColorInput key={i} value={c} onChange={(v) => setColor(i, v)} label={`Color ${i + 1}`} />
            ))}
          </div>
        </Field>
        <Switch checked={bg.particles} onChange={(particles) => setBg({ particles })} label="Floating particles" />
        <Switch checked={bg.grain} onChange={(grain) => setBg({ grain })} label="Film grain" />
        <Switch checked={bg.vignette} onChange={(vignette) => setBg({ vignette })} label="Vignette" />
        <Switch checked={project.dark} onChange={(dark) => editor.update((p) => ({ ...p, dark }))} label="Dark backdrop (text shadows, glass)" />
      </Section>

      <Section title="Accent" icon={<Sparkles size={14} />}>
        <Field label="Highlight gradient" hint="Used for *highlighted* words, callouts, the CTA and the device glow.">
          <div className="row">
            <ColorInput value={project.accent} onChange={(accent) => editor.update((p) => ({ ...p, accent }), 'accent')} label="Accent" />
            <ColorInput value={project.accent2} onChange={(accent2) => editor.update((p) => ({ ...p, accent2 }), 'accent2')} label="Accent 2" />
          </div>
        </Field>
        <Switch checked={project.deviceGlow} onChange={(deviceGlow) => editor.update((p) => ({ ...p, deviceGlow }))} label="Glow behind the device" />
      </Section>

      <Section title="Typography" icon={<Type size={14} />}>
        <TypographyFields style={project.typography} onChange={(patch) => editor.update((p) => ({ ...p, typography: { ...p.typography, ...patch } }), 'typography')} />
      </Section>
    </>
  );
}

// --- Project ---

const ASPECTS: { value: Aspect; label: string; hint: string }[] = [
  { value: '16:9', label: '16:9', hint: 'YouTube, websites, decks' },
  { value: '9:16', label: '9:16', hint: 'Reels, TikTok, Shorts, App Store' },
  { value: '1:1', label: '1:1', hint: 'Social feeds' },
  { value: '4:5', label: '4:5', hint: 'Instagram feed' },
];

const LOGO_POSITIONS: { value: LogoPosition; label: string }[] = [
  { value: 'tl', label: 'Top left' },
  { value: 'tr', label: 'Top right' },
  { value: 'bl', label: 'Bottom left' },
  { value: 'br', label: 'Bottom right' },
];

function ProjectPanel() {
  const editor = useEditor();
  const { project } = editor;
  const set = (recipe: (p: Project) => Project, key?: string) => editor.update(recipe, key);
  const logoInput = useRef<HTMLInputElement>(null);
  const openInput = useRef<HTMLInputElement>(null);

  const saveZip = async () => {
    const zip = new JSZip();
    zip.file('project.json', JSON.stringify(project));
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${project.name.replace(/[^\w-]+/g, '_') || 'project'}.saasvidit.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const openZip = async (file?: File) => {
    if (!file) return;
    try {
      const zip = await JSZip.loadAsync(file);
      const json = zip.file('project.json');
      if (!json) throw new Error('project.json missing');
      const project = migrateProject(JSON.parse(await json.async('string')));
      editor.replace(project);
      editor.selectScene(project.scenes[0].id);
    } catch (err) {
      console.error(err);
      alert('That file is not a SaasVidit project (.zip).');
    }
  };

  return (
    <>
      <div className="inspector-heading">
        <span className="eyebrow">Project</span>
        <h2>Format, branding &amp; sound</h2>
      </div>

      <Section title="Format" icon={<LayoutTemplate size={14} />}>
        <Chips value={project.aspect} options={ASPECTS} onChange={(aspect) => set((p) => ({ ...p, aspect }))} columns={4} />
        <p className="section-note">{ASPECTS.find((a) => a.value === project.aspect)?.hint}. Layouts adapt automatically.</p>
      </Section>

      <Section title="Intro" icon={<Sparkles size={14} />}>
        <Switch checked={project.intro.enabled} onChange={(enabled) => set((p) => ({ ...p, intro: { ...p.intro, enabled } }))} label="Title card before the first scene" />
        {project.intro.enabled && (
          <>
            <Field label="Title">
              <input className="input" value={project.intro.title} onChange={(e) => set((p) => ({ ...p, intro: { ...p.intro, title: e.target.value } }), 'intro-title')} />
            </Field>
            <Field label="Tagline">
              <input className="input" value={project.intro.subtitle} onChange={(e) => set((p) => ({ ...p, intro: { ...p.intro, subtitle: e.target.value } }), 'intro-sub')} />
            </Field>
            <Field label="Duration" value={`${project.intro.duration.toFixed(1)}s`}>
              <Slider value={project.intro.duration} min={1.2} max={6} step={0.1} onChange={(duration) => set((p) => ({ ...p, intro: { ...p.intro, duration } }), 'intro-dur')} label="Intro duration" />
            </Field>
          </>
        )}
      </Section>

      <Section title="Outro" icon={<ArrowDownToLine size={14} />}>
        <Switch checked={project.outro.enabled} onChange={(enabled) => set((p) => ({ ...p, outro: { ...p.outro, enabled } }))} label="Call to action at the end" />
        {project.outro.enabled && (
          <>
            <Field label="Headline">
              <input className="input" value={project.outro.title} onChange={(e) => set((p) => ({ ...p, outro: { ...p.outro, title: e.target.value } }), 'outro-title')} />
            </Field>
            <Field label="Subline">
              <input className="input" value={project.outro.subtitle} onChange={(e) => set((p) => ({ ...p, outro: { ...p.outro, subtitle: e.target.value } }), 'outro-sub')} />
            </Field>
            <Field label="Button">
              <input className="input" value={project.outro.cta} placeholder="Leave empty to hide" onChange={(e) => set((p) => ({ ...p, outro: { ...p.outro, cta: e.target.value } }), 'outro-cta')} />
            </Field>
            <Field label="Duration" value={`${project.outro.duration.toFixed(1)}s`}>
              <Slider value={project.outro.duration} min={1.5} max={8} step={0.1} onChange={(duration) => set((p) => ({ ...p, outro: { ...p.outro, duration } }), 'outro-dur')} label="Outro duration" />
            </Field>
          </>
        )}
      </Section>

      <Section title="Logo & watermark" icon={<ImageIcon size={14} />}>
        <div className="logo-row">
          <button type="button" className="logo-tile" onClick={() => logoInput.current?.click()}>
            {project.logo.src ? <img src={project.logo.src} alt="" /> : <Upload size={18} />}
          </button>
          <div className="logo-copy">
            <p>Shown in the intro and outro, and as a corner watermark during scenes.</p>
            {project.logo.src && (
              <button type="button" className="btn btn-sm btn-ghost is-danger" onClick={() => set((p) => ({ ...p, logo: { ...p.logo, src: null } }))}>
                <Trash2 size={13} /> Remove
              </button>
            )}
          </div>
          <input
            ref={logoInput}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                const src = await readFileAsDataURL(file);
                set((p) => ({ ...p, logo: { ...p.logo, src } }));
              }
              e.target.value = '';
            }}
          />
        </div>
        {project.logo.src && (
          <>
            <Field label="Watermark position">
              <Segmented value={project.logo.position} options={LOGO_POSITIONS} onChange={(position) => set((p) => ({ ...p, logo: { ...p.logo, position } }))} size="sm" />
            </Field>
            <Field label="Size" value={`${project.logo.size}px`}>
              <Slider value={project.logo.size} min={40} max={360} onChange={(size) => set((p) => ({ ...p, logo: { ...p.logo, size } }), 'logo-size')} label="Logo size" />
            </Field>
            <Field label="Opacity" value={`${project.logo.opacity}%`}>
              <Slider value={project.logo.opacity} min={10} max={100} onChange={(opacity) => set((p) => ({ ...p, logo: { ...p.logo, opacity } }), 'logo-opacity')} label="Logo opacity" />
            </Field>
          </>
        )}
        <Switch checked={project.showProgress} onChange={(showProgress) => set((p) => ({ ...p, showProgress }))} label="Story-style progress bar" />
      </Section>

      <Section title="Music" icon={<Music size={14} />}>
        <MusicPicker />
      </Section>

      <Section title="Sound effects" icon={<Volume2 size={14} />}>
        <Switch checked={project.audio.sfx} onChange={(sfx) => set((p) => ({ ...p, audio: { ...p.audio, sfx } }))} label="Taps, whooshes and chimes" />
        {project.audio.sfx && (
          <Field label="Effects volume" value={`${project.audio.sfxVolume}%`}>
            <Slider value={project.audio.sfxVolume} min={0} max={100} onChange={(sfxVolume) => set((p) => ({ ...p, audio: { ...p.audio, sfxVolume } }), 'sfx-vol')} label="Effects volume" />
          </Field>
        )}
      </Section>

      <Section title="Project file" icon={<FolderOpen size={14} />}>
        <div className="file-grid">
          <button type="button" className="file-btn" onClick={saveZip}>
            <Download size={16} />
            <span>Save .zip</span>
          </button>
          <button type="button" className="file-btn" onClick={() => openInput.current?.click()}>
            <FolderOpen size={16} />
            <span>Open .zip</span>
          </button>
          <button
            type="button"
            className="file-btn"
            onClick={async () => {
              if (!confirm('Replace the current project with the Pulse demo? You can undo this.')) return;
              const demo = await createDemoProject();
              editor.replace(demo);
              editor.selectScene(demo.scenes[0].id);
            }}
          >
            <Sparkles size={16} />
            <span>Load demo</span>
          </button>
          <button
            type="button"
            className="file-btn"
            onClick={() => {
              if (!confirm('Start a new blank project? You can undo this.')) return;
              const blank = blankProject();
              editor.replace(blank);
              editor.selectScene(blank.scenes[0].id);
            }}
          >
            <FilePlus2 size={16} />
            <span>New blank</span>
          </button>
        </div>
        <input ref={openInput} type="file" accept=".zip" hidden onChange={(e) => openZip(e.target.files?.[0]).then(() => (e.target.value = ''))} />
      </Section>
    </>
  );
}
