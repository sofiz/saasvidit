import { useSyncExternalStore } from 'react';

/** Playhead shared by the preview, transport and timeline without re-rendering the whole editor. */
export class Clock {
  time = 0;
  playing = false;
  duration = 1;
  loop = false;
  /** Incremented on every manual seek so audio can resynchronise. */
  seeks = 0;
  private listeners = new Set<() => void>();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getTime = () => this.time;
  getPlaying = () => this.playing;

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  seek(t: number) {
    const next = Math.min(this.duration, Math.max(0, t));
    if (next === this.time) return;
    this.time = next;
    this.seeks++;
    this.emit();
  }

  /** Advances during playback; returns false once the end is reached without looping. */
  advance(dt: number) {
    let next = this.time + dt;
    let wrapped = false;
    if (next >= this.duration) {
      if (this.loop) {
        next = next % this.duration;
        wrapped = true;
      } else {
        this.time = this.duration;
        this.playing = false;
        this.emit();
        return { ended: true, wrapped };
      }
    }
    this.time = next;
    this.emit();
    return { ended: false, wrapped };
  }

  setDuration(duration: number) {
    this.duration = Math.max(0.1, duration);
    if (this.time > this.duration) this.seek(this.duration);
  }

  setLoop(loop: boolean) {
    this.loop = loop;
  }

  setPlaying(playing: boolean) {
    if (playing && this.time >= this.duration - 1e-3) this.time = 0;
    if (playing === this.playing) return;
    this.playing = playing;
    this.emit();
  }

  toggle() {
    this.setPlaying(!this.playing);
  }
}

export const useClockTime = (clock: Clock) => useSyncExternalStore(clock.subscribe, clock.getTime);
export const useClockPlaying = (clock: Clock) => useSyncExternalStore(clock.subscribe, clock.getPlaying);

export function formatTime(t: number, fps = 30) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const f = Math.floor((t % 1) * fps);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(f).padStart(2, '0')}`;
}
