import { useState } from 'react';
import { Copy, Flag, GripVertical, ImagePlus, Plus, Sparkles, Trash2 } from 'lucide-react';
import { readFileAsDataURL } from '../engine/assets';
import { newScene } from '../engine/defaults';
import { uid } from '../engine/math';
import { useClockTime } from './clock';
import { plainTitle, sceneStart, useEditor } from './state';

export function SceneRail() {
  const editor = useEditor();
  const { project, plan, clock } = editor;
  const time = useClockTime(clock);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [fileOver, setFileOver] = useState(false);

  const addScenesFromFiles = async (files: FileList | File[]) => {
    const images = [...files].filter((f) => f.type.startsWith('image/'));
    if (!images.length) return;
    const urls = await Promise.all(images.map(readFileAsDataURL));
    const transitions = ['push', 'flip', 'glide', 'zoom'] as const;
    const added = urls.map((image, i) =>
      newScene({
        image,
        title: `Feature *${project.scenes.length + i + 1}*`,
        subtitle: 'Tell viewers what this screen lets them do.',
        transition: transitions[(project.scenes.length + i) % transitions.length],
      }),
    );
    editor.update((p) => {
      // Fill an empty first scene before appending new ones.
      const scenes = [...p.scenes];
      if (scenes.length === 1 && !scenes[0].image && added.length) {
        scenes[0] = { ...scenes[0], image: added.shift()!.image };
      }
      return { ...p, scenes: [...scenes, ...added] };
    });
  };

  const addScene = () => {
    const scene = newScene({ transition: project.scenes.length % 2 ? 'flip' : 'push' });
    editor.update((p) => ({ ...p, scenes: [...p.scenes, scene] }));
    editor.selectScene(scene.id);
    editor.setTab('scene');
  };

  const duplicate = (index: number) => {
    const source = project.scenes[index];
    const copy = { ...source, id: uid(), gestures: source.gestures.map((g) => ({ ...g, id: uid() })) };
    editor.update((p) => ({ ...p, scenes: [...p.scenes.slice(0, index + 1), copy, ...p.scenes.slice(index + 1)] }));
    editor.selectScene(copy.id);
  };

  const remove = (index: number) => {
    if (project.scenes.length <= 1) return;
    const id = project.scenes[index].id;
    editor.update((p) => ({ ...p, scenes: p.scenes.filter((s) => s.id !== id) }));
    if (editor.selectedSceneId === id) editor.selectScene(project.scenes[Math.max(0, index - 1)].id);
  };

  const move = (from: number, to: number) => {
    if (from === to) return;
    editor.update((p) => {
      const scenes = [...p.scenes];
      const [item] = scenes.splice(from, 1);
      scenes.splice(to, 0, item);
      return { ...p, scenes };
    });
  };

  const bookend = (kind: 'intro' | 'outro') => {
    const seg = plan.segments.find((s) => s.kind === kind);
    const active = seg && time >= seg.start && time < seg.end;
    const data = project[kind];
    return (
      <button
        type="button"
        className={`rail-bookend ${data.enabled ? '' : 'is-off'} ${active ? 'is-live' : ''}`}
        onClick={() => {
          editor.setTab('project');
          if (seg) {
            clock.setPlaying(false);
            clock.seek(seg.start + 0.01);
          }
        }}
      >
        {kind === 'intro' ? <Sparkles size={14} /> : <Flag size={14} />}
        <span className="rail-bookend-label">{kind === 'intro' ? 'Intro' : 'Outro'}</span>
        <span className="rail-bookend-title">{data.enabled ? plainTitle(data.title) : 'Off'}</span>
      </button>
    );
  };

  return (
    <aside
      className={`rail ${fileOver ? 'is-file-over' : ''}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setFileOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFileOver(false);
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files.length) {
          e.preventDefault();
          setFileOver(false);
          addScenesFromFiles(e.dataTransfer.files);
        }
      }}
    >
      <header className="rail-head">
        <span className="panel-title">Scenes</span>
        <span className="badge">{project.scenes.length}</span>
        <button type="button" className="icon-btn icon-btn-sm rail-add" onClick={addScene} title="Add scene">
          <Plus size={15} />
        </button>
      </header>

      <div className="rail-list">
        {bookend('intro')}
        {project.scenes.map((scene, index) => {
          const selected = editor.selectedSceneId === scene.id;
          const seg = plan.segments.find((s) => s.kind === 'scene' && s.index === index);
          const live = seg && time >= seg.start && time < seg.end;
          return (
            <div
              key={scene.id}
              className={`scene-card ${selected ? 'is-selected' : ''} ${dragIndex === index ? 'is-dragging' : ''} ${overIndex === index && dragIndex !== index ? 'is-over' : ''}`}
              draggable
              onDragStart={(e) => {
                setDragIndex(index);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/scene', scene.id);
              }}
              onDragOver={(e) => {
                if (dragIndex === null) return;
                e.preventDefault();
                setOverIndex(index);
              }}
              onDrop={(e) => {
                if (dragIndex === null) return;
                e.preventDefault();
                e.stopPropagation();
                move(dragIndex, index);
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              onClick={() => {
                editor.selectScene(scene.id);
                clock.setPlaying(false);
                clock.seek(sceneStart(plan, index) + 0.9);
              }}
            >
              <GripVertical size={14} className="scene-grip" />
              <div className="scene-thumb">
                {scene.image ? <img src={scene.image} alt="" draggable={false} /> : <ImagePlus size={16} />}
                {live && <span className="scene-live" />}
              </div>
              <div className="scene-meta">
                <span className="scene-index">Scene {index + 1}</span>
                <span className="scene-title">{plainTitle(scene.title) || 'Untitled'}</span>
                <span className="scene-sub">
                  {scene.duration.toFixed(1)}s · {scene.transition}
                  {scene.gestures.length ? ` · ${scene.gestures.length} tap${scene.gestures.length > 1 ? 's' : ''}` : ''}
                </span>
              </div>
              <div className="scene-actions">
                <button
                  type="button"
                  className="icon-btn icon-btn-xs"
                  title="Duplicate"
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicate(index);
                  }}
                >
                  <Copy size={13} />
                </button>
                {project.scenes.length > 1 && (
                  <button
                    type="button"
                    className="icon-btn icon-btn-xs is-danger"
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(index);
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {bookend('outro')}
      </div>

      <label className="rail-drop">
        <ImagePlus size={18} />
        <span>
          <strong>Add screenshots</strong>
          <small>Drop images or click — one scene each</small>
        </span>
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) addScenesFromFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </label>
    </aside>
  );
}
