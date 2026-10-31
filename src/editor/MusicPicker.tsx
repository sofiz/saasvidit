import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Pause, Play, Upload, VolumeX } from 'lucide-react';
import { readFileAsDataURL } from '../engine/assets';
import { MUSIC_LIBRARY, auditionTrack, stopAudition } from '../engine/music';
import { useEditor } from './state';
import { Field, Slider } from './ui';

export function MusicPicker() {
  const editor = useEditor();
  const { audio } = editor.project;
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => stopAudition(), []);

  const choose = (track: string) => editor.update((p) => ({ ...p, audio: { ...p.audio, track } }));

  const audition = async (id: string) => {
    if (playing === id) {
      stopAudition();
      setPlaying(null);
      return;
    }
    editor.clock.setPlaying(false);
    setLoading(id);
    try {
      await auditionTrack(id, () => setPlaying((cur) => (cur === id ? null : cur)));
      setPlaying(id);
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <div className="tracks" role="radiogroup" aria-label="Music">
        {MUSIC_LIBRARY.map((t) => {
          const selected = audio.track === t.id;
          return (
            <div key={t.id} className={`track ${selected ? 'is-active' : ''}`}>
              <button
                type="button"
                className="track-play"
                style={{ background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})` }}
                onClick={() => audition(t.id)}
                aria-label={playing === t.id ? `Stop ${t.name}` : `Preview ${t.name}`}
              >
                {loading === t.id ? <Loader2 size={14} className="spin" /> : playing === t.id ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                {playing === t.id && <span className="track-eq" aria-hidden><i /><i /><i /></span>}
              </button>
              <button type="button" role="radio" aria-checked={selected} className="track-main" onClick={() => choose(t.id)}>
                <span className="track-name">{t.name}</span>
                <span className="track-mood">
                  {t.mood} · {t.bpm} BPM
                </span>
              </button>
              {selected && <Check size={14} className="track-check" />}
            </div>
          );
        })}

        <div className={`track ${audio.track === 'upload' ? 'is-active' : ''}`}>
          <button type="button" className="track-play track-play-upload" onClick={() => input.current?.click()} aria-label="Upload music">
            <Upload size={14} />
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={audio.track === 'upload'}
            className="track-main"
            onClick={() => (audio.music ? choose('upload') : input.current?.click())}
          >
            <span className="track-name">{audio.music ? audio.musicName || 'Your track' : 'Your own music'}</span>
            <span className="track-mood">{audio.music ? 'Uploaded · loops & fades' : 'MP3, WAV or M4A'}</span>
          </button>
          {audio.track === 'upload' && <Check size={14} className="track-check" />}
        </div>

        <div className={`track ${audio.track === 'none' ? 'is-active' : ''}`}>
          <span className="track-play track-play-none" aria-hidden>
            <VolumeX size={14} />
          </span>
          <button type="button" role="radio" aria-checked={audio.track === 'none'} className="track-main" onClick={() => choose('none')}>
            <span className="track-name">No music</span>
            <span className="track-mood">Sound effects only</span>
          </button>
          {audio.track === 'none' && <Check size={14} className="track-check" />}
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept="audio/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            const music = await readFileAsDataURL(file);
            editor.update((p) => ({ ...p, audio: { ...p.audio, track: 'upload', music, musicName: file.name } }));
          }
          e.target.value = '';
        }}
      />

      <p className="section-note">Library tracks are composed in your browser as one continuous piece fitted to this edit — it builds through the intro, drops on the first scene, flows through every cut and resolves on the last frame. Royalty-free for any use.</p>

      {audio.track !== 'none' && (
        <Field label="Music volume" value={`${audio.musicVolume}%`}>
          <Slider value={audio.musicVolume} min={0} max={100} onChange={(musicVolume) => editor.update((p) => ({ ...p, audio: { ...p.audio, musicVolume } }), 'music-vol')} label="Music volume" />
        </Field>
      )}
    </>
  );
}
