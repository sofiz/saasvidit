import { Check, CloudOff, Download, Loader2, Monitor, Redo2, RectangleVertical, Smartphone, Square, Undo2 } from 'lucide-react';
import type { Aspect } from '../engine/types';
import { useEditor } from './state';
import { Segmented } from './ui';

const ASPECTS: { value: Aspect; label: string; icon: React.ReactNode; hint: string }[] = [
  { value: '16:9', label: '16:9', icon: <Monitor size={14} />, hint: 'Landscape 1920×1080' },
  { value: '9:16', label: '9:16', icon: <Smartphone size={14} />, hint: 'Vertical 1080×1920' },
  { value: '1:1', label: '1:1', icon: <Square size={14} />, hint: 'Square 1080×1080' },
  { value: '4:5', label: '4:5', icon: <RectangleVertical size={14} />, hint: 'Feed 1080×1350' },
];

export function TopBar() {
  const editor = useEditor();
  const { project } = editor;
  const mod = navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl+';
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden>
          <svg viewBox="0 0 24 24" width="16" height="16">
            <rect x="7" y="2.5" width="10" height="19" rx="2.6" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M10.5 9.2v5.6l4.6-2.8z" fill="currentColor" />
          </svg>
        </span>
        <span className="brand-name">SaasVidit</span>
        <span className="brand-divider" />
        <input
          className="project-name"
          value={project.name}
          aria-label="Project name"
          onChange={(e) => editor.update((p) => ({ ...p, name: e.target.value }), 'name')}
        />
        <span className={`save-state is-${editor.saveState}`} title={editor.saveState === 'error' ? 'Autosave failed — save a .zip to keep your work' : 'Autosaved in this browser'}>
          {editor.saveState === 'saving' ? <Loader2 size={12} className="spin" /> : editor.saveState === 'error' ? <CloudOff size={12} /> : <Check size={12} />}
          {editor.saveState === 'saving' ? 'Saving' : editor.saveState === 'error' ? 'Not saved' : 'Saved'}
        </span>
      </div>

      <div className="topbar-center">
        <Segmented value={project.aspect} options={ASPECTS} onChange={(aspect) => editor.update((p) => ({ ...p, aspect }))} size="sm" />
      </div>

      <div className="topbar-actions">
        <button type="button" className="icon-btn" onClick={editor.undo} disabled={!editor.canUndo} title={`Undo (${mod}Z)`}>
          <Undo2 size={16} />
        </button>
        <button type="button" className="icon-btn" onClick={editor.redo} disabled={!editor.canRedo} title={`Redo (${mod}⇧Z)`}>
          <Redo2 size={16} />
        </button>
        <button type="button" className="btn btn-primary" onClick={editor.openExport}>
          <Download size={15} />
          Export video
        </button>
      </div>
    </header>
  );
}
