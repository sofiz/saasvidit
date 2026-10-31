import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { preloadProject } from './assets';
import { encodeWav, renderSoundtrack } from './audio';
import { Compositor } from './compositor';
import { STAGES } from './layout';
import type { Project } from './types';

export interface ExportOptions {
  /** Height of the short side, in pixels. */
  resolution: 720 | 1080 | 1440 | 2160;
  fps: 30 | 60;
  motionBlur: boolean;
  audio: boolean;
}

export interface ExportProgress {
  phase: 'prepare' | 'render' | 'audio' | 'finalize';
  frame: number;
  total: number;
  /** Seconds remaining, once it can be estimated. */
  eta: number | null;
  message: string;
}

export interface ExportResult {
  blob: Blob;
  width: number;
  height: number;
  duration: number;
  encoder: 'webcodecs' | 'ffmpeg';
}

const AVC_CODECS = ['avc1.640033', 'avc1.4d0033', 'avc1.640034', 'avc1.42e033', 'avc1.640028', 'avc1.42001f'];

export function outputSize(project: Project, resolution: number) {
  const stage = STAGES[project.aspect];
  const k = resolution / Math.min(stage.w, stage.h);
  const even = (v: number) => Math.round(v / 2) * 2;
  return { width: even(stage.w * k), height: even(stage.h * k) };
}

async function pickVideoConfig(width: number, height: number, fps: number): Promise<VideoEncoderConfig | null> {
  if (typeof VideoEncoder === 'undefined') return null;
  const bitrate = Math.round(width * height * fps * 0.26);
  for (const codec of AVC_CODECS) {
    const config: VideoEncoderConfig = { codec, width, height, bitrate, framerate: fps, avc: { format: 'avc' } };
    try {
      const support = await VideoEncoder.isConfigSupported(config);
      if (support.supported) return config;
    } catch {
      // try the next profile
    }
  }
  return null;
}

async function pickAudioConfig(): Promise<{ config: AudioEncoderConfig; muxCodec: 'aac' | 'opus' } | null> {
  if (typeof AudioEncoder === 'undefined') return null;
  const candidates: { config: AudioEncoderConfig; muxCodec: 'aac' | 'opus' }[] = [
    { config: { codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 }, muxCodec: 'aac' },
    { config: { codec: 'opus', sampleRate: 48000, numberOfChannels: 2, bitrate: 160000 }, muxCodec: 'opus' },
  ];
  for (const c of candidates) {
    try {
      if ((await AudioEncoder.isConfigSupported(c.config)).supported) return c;
    } catch {
      // try the next codec
    }
  }
  return null;
}

/** Yields to the event loop without the 1s timer clamp browsers apply to background tabs. */
const nextTick = () =>
  new Promise<void>((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(null);
  });

async function drain(encoder: VideoEncoder, max: number) {
  while (encoder.encodeQueueSize > max) {
    if ('ondequeue' in encoder) await new Promise<void>((r) => encoder.addEventListener('dequeue', () => r(), { once: true }));
    else await new Promise((r) => setTimeout(r, 2));
  }
}

class FrameRenderer {
  readonly compositor: Compositor;
  readonly canvas: HTMLCanvasElement;
  private accum: HTMLCanvasElement;
  private accumCtx: CanvasRenderingContext2D;
  private fps: number;
  private motionBlur: boolean;

  constructor(project: Project, width: number, fps: number, motionBlur: boolean) {
    this.fps = fps;
    this.motionBlur = motionBlur;
    this.canvas = document.createElement('canvas');
    this.compositor = new Compositor(this.canvas, 'export');
    this.compositor.setProject(project);
    this.compositor.setResolution(width);
    this.accum = document.createElement('canvas');
    this.accum.width = this.canvas.width;
    this.accum.height = this.canvas.height;
    this.accumCtx = this.accum.getContext('2d', { alpha: false })!;
  }

  /** Renders frame i, optionally averaging sub-frames across a 180° shutter for motion blur. */
  render(i: number): HTMLCanvasElement {
    const t = i / this.fps;
    if (!this.motionBlur) {
      this.compositor.render(t, i);
      return this.canvas;
    }
    const samples = this.fps >= 60 ? 3 : 5;
    const shutter = 0.5 / this.fps;
    for (let k = 0; k < samples; k++) {
      const tk = Math.max(0, t + ((k + 0.5) / samples - 0.5) * shutter);
      this.compositor.render(tk, i);
      this.accumCtx.globalAlpha = 1 / (k + 1);
      this.accumCtx.drawImage(this.canvas, 0, 0);
    }
    this.accumCtx.globalAlpha = 1;
    return this.accum;
  }

  dispose() {
    this.compositor.dispose();
  }
}

export async function exportVideo(
  project: Project,
  options: ExportOptions,
  onProgress: (p: ExportProgress) => void,
  signal: AbortSignal,
  onFrame?: (canvas: HTMLCanvasElement) => void,
): Promise<ExportResult> {
  const { width, height } = outputSize(project, options.resolution);
  onProgress({ phase: 'prepare', frame: 0, total: 0, eta: null, message: 'Loading fonts, screenshots and the 3D device…' });
  await preloadProject(project);

  const renderer = new FrameRenderer(project, width, options.fps, options.motionBlur);
  try {
    await renderer.compositor.ready;
    renderer.compositor.invalidate();
    const plan = renderer.compositor.plan!;
    const total = Math.max(1, Math.ceil(plan.duration * options.fps));

    const videoConfig = await pickVideoConfig(width, height, options.fps);
    if (!videoConfig) return await exportWithFFmpeg(project, options, renderer, total, width, height, plan.duration, onProgress, signal, onFrame);

    const audio = options.audio ? await pickAudioConfig() : null;
    let soundtrack: AudioBuffer | null = null;
    if (audio) {
      onProgress({ phase: 'prepare', frame: 0, total, eta: null, message: 'Mixing soundtrack…' });
      soundtrack = await renderSoundtrack(project, plan);
    }

    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: 'avc', width, height, frameRate: options.fps },
      audio: soundtrack && audio ? { codec: audio.muxCodec, numberOfChannels: 2, sampleRate: 48000 } : undefined,
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
    });

    let failure: unknown = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => {
        failure = e;
      },
    });
    encoder.configure(videoConfig);

    const started = performance.now();
    for (let i = 0; i < total; i++) {
      if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
      if (failure) throw failure;
      const canvas = renderer.render(i);
      const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / options.fps), duration: Math.round(1e6 / options.fps) });
      encoder.encode(frame, { keyFrame: i % (options.fps * 2) === 0 });
      frame.close();
      if (onFrame && i % 3 === 0) onFrame(canvas);
      await drain(encoder, 4);
      const elapsed = (performance.now() - started) / 1000;
      onProgress({
        phase: 'render',
        frame: i + 1,
        total,
        eta: i > 5 ? (elapsed / (i + 1)) * (total - i - 1) : null,
        message: `Rendering frame ${i + 1} of ${total}`,
      });
      if (i % 2 === 0) await nextTick();
    }
    await encoder.flush();
    encoder.close();
    if (failure) throw failure;

    if (soundtrack && audio) {
      onProgress({ phase: 'audio', frame: total, total, eta: null, message: 'Encoding audio…' });
      await encodeAudio(soundtrack, audio.config, muxer);
    }

    onProgress({ phase: 'finalize', frame: total, total, eta: null, message: 'Packaging MP4…' });
    muxer.finalize();
    const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
    return { blob, width, height, duration: plan.duration, encoder: 'webcodecs' };
  } finally {
    renderer.dispose();
  }
}

async function encodeAudio(buffer: AudioBuffer, config: AudioEncoderConfig, muxer: Muxer<ArrayBufferTarget>) {
  let failure: unknown = null;
  const encoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (e) => {
      failure = e;
    },
  });
  encoder.configure(config);
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
  const block = 4800;
  for (let start = 0; start < buffer.length; start += block) {
    const n = Math.min(block, buffer.length - start);
    const data = new Float32Array(n * 2);
    data.set(left.subarray(start, start + n), 0);
    data.set(right.subarray(start, start + n), n);
    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate: buffer.sampleRate,
      numberOfFrames: n,
      numberOfChannels: 2,
      timestamp: Math.round((start / buffer.sampleRate) * 1e6),
      data,
    });
    encoder.encode(audioData);
    audioData.close();
    if (failure) throw failure;
  }
  await encoder.flush();
  encoder.close();
}

// --- FFmpeg (WebAssembly) fallback for browsers without WebCodecs ---

async function exportWithFFmpeg(
  project: Project,
  options: ExportOptions,
  renderer: FrameRenderer,
  total: number,
  width: number,
  height: number,
  duration: number,
  onProgress: (p: ExportProgress) => void,
  signal: AbortSignal,
  onFrame?: (canvas: HTMLCanvasElement) => void,
): Promise<ExportResult> {
  onProgress({ phase: 'prepare', frame: 0, total, eta: null, message: 'Loading the FFmpeg encoder (~30 MB)…' });
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const { toBlobURL } = await import('@ffmpeg/util');
  const ffmpeg = new FFmpeg();
  const base = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  const names: string[] = [];
  try {
    const started = performance.now();
    for (let i = 0; i < total; i++) {
      if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
      const canvas = renderer.render(i);
      if (onFrame && i % 3 === 0) onFrame(canvas);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Frame capture failed'))), 'image/jpeg', 0.94));
      const name = `f${String(i).padStart(5, '0')}.jpg`;
      await ffmpeg.writeFile(name, new Uint8Array(await blob.arrayBuffer()));
      names.push(name);
      const elapsed = (performance.now() - started) / 1000;
      onProgress({ phase: 'render', frame: i + 1, total, eta: i > 5 ? (elapsed / (i + 1)) * (total - i - 1) * 1.3 : null, message: `Rendering frame ${i + 1} of ${total}` });
    }
    const args = ['-framerate', String(options.fps), '-i', 'f%05d.jpg'];
    if (options.audio) {
      const soundtrack = await renderSoundtrack(project, renderer.compositor.plan!);
      if (soundtrack) {
        await ffmpeg.writeFile('audio.wav', encodeWav(soundtrack));
        names.push('audio.wav');
        args.push('-i', 'audio.wav', '-c:a', 'aac', '-b:a', '192k', '-shortest');
      }
    }
    onProgress({ phase: 'finalize', frame: total, total, eta: null, message: 'Encoding H.264 with FFmpeg…' });
    args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'out.mp4');
    await ffmpeg.exec(args);
    const data = (await ffmpeg.readFile('out.mp4')) as Uint8Array;
    return { blob: new Blob([new Uint8Array(data)], { type: 'video/mp4' }), width, height, duration, encoder: 'ffmpeg' };
  } finally {
    for (const name of [...names, 'out.mp4']) await ffmpeg.deleteFile(name).catch(() => undefined);
    ffmpeg.terminate();
  }
}
