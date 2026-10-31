import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, Film, Loader2, RotateCcw, X } from 'lucide-react';
import { exportVideo, outputSize, type ExportOptions, type ExportProgress, type ExportResult } from '../engine/exporter';
import type { Project } from '../engine/types';
import { formatTime } from './clock';
import { Field, Segmented, Switch } from './ui';

type Phase = 'setup' | 'running' | 'done' | 'error';

const RESOLUTIONS: { value: string; label: string }[] = [
  { value: '720', label: '720p' },
  { value: '1080', label: '1080p' },
  { value: '1440', label: '1440p' },
  { value: '2160', label: '4K' },
];

export function ExportDialog({ project, duration, onClose }: { project: Project; duration: number; onClose: () => void }) {
  const [options, setOptions] = useState<ExportOptions>({ resolution: 1080, fps: 30, motionBlur: true, audio: true });
  const [phase, setPhase] = useState<Phase>('setup');
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<(ExportResult & { url: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const size = outputSize(project, options.resolution);
  const frames = Math.ceil(duration * options.fps);
  const webcodecs = typeof VideoEncoder !== 'undefined';

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.url);
  }, [result]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase !== 'running') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, onClose]);

  const start = async () => {
    const controller = new AbortController();
    abort.current = controller;
    setPhase('running');
    setError(null);
    setProgress(null);
    try {
      const out = await exportVideo(project, options, setProgress, controller.signal, (canvas) => {
        const c = preview.current;
        if (!c) return;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(canvas, 0, 0, c.width, c.height);
      });
      setResult({ ...out, url: URL.createObjectURL(out.blob) });
      setPhase('done');
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setPhase('setup');
        return;
      }
      console.error(err);
      setError((err as Error).message || String(err));
      setPhase('error');
    }
  };

  const fileName = `${project.name.replace(/[^\w-]+/g, '_') || 'showcase'}_${size.width}x${size.height}.mp4`;
  const pct = progress && progress.total ? Math.round((progress.frame / progress.total) * 100) : 0;
  const previewW = 480;
  const previewH = Math.round((previewW * size.height) / size.width);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && phase !== 'running' && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <header className="modal-head">
          <span className="modal-icon">
            <Film size={18} />
          </span>
          <div>
            <h2 id="export-title">Export video</h2>
            <p>
              {formatTime(duration)} · {size.width}×{size.height} · H.264 MP4
            </p>
          </div>
          {phase !== 'running' && (
            <button type="button" className="icon-btn modal-close" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          )}
        </header>

        {phase === 'setup' && (
          <div className="modal-body">
            <Field label="Resolution" value={`${size.width}×${size.height}`}>
              <Segmented value={String(options.resolution)} options={RESOLUTIONS} onChange={(v) => setOptions({ ...options, resolution: Number(v) as ExportOptions['resolution'] })} />
            </Field>
            <Field label="Frame rate">
              <Segmented value={String(options.fps)} options={[{ value: '30', label: '30 fps' }, { value: '60', label: '60 fps' }]} onChange={(v) => setOptions({ ...options, fps: Number(v) as 30 | 60 })} />
            </Field>
            <Switch checked={options.motionBlur} onChange={(motionBlur) => setOptions({ ...options, motionBlur })} label="Cinematic motion blur (renders 3–5 sub-frames per frame)" />
            <Switch checked={options.audio} onChange={(audio) => setOptions({ ...options, audio })} label="Include sound design & music" />
            <div className="export-summary">
              <span>{frames.toLocaleString()} frames</span>
              <span>{webcodecs ? 'Hardware encoder (WebCodecs)' : 'FFmpeg fallback — slower'}</span>
            </div>
          </div>
        )}

        {phase === 'running' && (
          <div className="modal-body">
            <div className="export-preview" style={{ aspectRatio: `${size.width} / ${size.height}` }}>
              <canvas ref={preview} width={previewW} height={previewH} />
              {(!progress || progress.phase === 'prepare') && (
                <div className="export-preview-wait">
                  <Loader2 size={20} className="spin" />
                </div>
              )}
            </div>
            <div className="progress">
              <div className="progress-bar" style={{ width: `${pct}%` }} />
            </div>
            <div className="progress-meta">
              <span>{progress?.message ?? 'Preparing…'}</span>
              <span>{progress?.eta != null ? `~${Math.ceil(progress.eta)}s left` : `${pct}%`}</span>
            </div>
          </div>
        )}

        {phase === 'done' && result && (
          <div className="modal-body">
            <video className="export-video" src={result.url} controls autoPlay muted loop playsInline style={{ aspectRatio: `${result.width} / ${result.height}` }} />
            <div className="export-done">
              <CheckCircle2 size={16} />
              <span>
                Ready · {(result.blob.size / 1024 / 1024).toFixed(1)} MB · {result.encoder === 'webcodecs' ? 'WebCodecs' : 'FFmpeg'}
              </span>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="modal-body">
            <div className="export-error">
              <strong>Export failed</strong>
              <span>{error}</span>
            </div>
          </div>
        )}

        <footer className="modal-foot">
          {phase === 'setup' && (
            <>
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={start}>
                <Film size={15} /> Render MP4
              </button>
            </>
          )}
          {phase === 'running' && (
            <button type="button" className="btn btn-ghost is-danger" onClick={() => abort.current?.abort()}>
              Cancel render
            </button>
          )}
          {phase === 'done' && result && (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setPhase('setup')}>
                <RotateCcw size={14} /> Export again
              </button>
              <a className="btn btn-primary" href={result.url} download={fileName}>
                <Download size={15} /> Download MP4
              </a>
            </>
          )}
          {phase === 'error' && (
            <>
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Close
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setPhase('setup')}>
                Try again
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
