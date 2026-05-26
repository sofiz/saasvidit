import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { domToPng } from 'modern-screenshot';

let ffmpegInstance: FFmpeg | null = null;

/**
 * Loads and retrieves the initialized FFmpeg WASM instance.
 * Uses a CDN to load the ~30MB WebAssembly core files to keep bundle size small.
 */
export async function getFFmpeg(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance) {
    if (onLog) {
      // Re-attach log handler if needed
      ffmpegInstance.on('log', ({ message }) => onLog(message));
    }
    return ffmpegInstance;
  }

  const ffmpeg = new FFmpeg();

  if (onLog) {
    ffmpeg.on('log', ({ message }) => {
      onLog(message);
    });
  }

  // Load ffmpeg-core from unpkg CDN
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

/**
 * Capture an HTML element as a PNG frame represented as a Uint8Array.
 * Uses modern-screenshot with forced 1920x1080 styling so that responsive CSS scaling 
 * does not affect the output quality.
 */
export async function captureDOMFrame(
  element: HTMLElement,
  width: number = 1920,
  height: number = 1080
): Promise<Uint8Array> {
  const originalCssText = element.style.cssText;
  try {
    // Force the element to lay out at its native full size 
    // to guarantee pixel-perfect framing and high-definition resolution in the snapshot.
    element.style.transform = 'none';
    element.style.left = '0';
    element.style.top = '0';
    element.style.margin = '0';
    element.style.position = 'relative';
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;

    // Snapshot the element with modern-screenshot
    const dataUrl = await domToPng(element, {
      width,
      height,
    });

    if (!dataUrl || dataUrl === 'data:,') {
      throw new Error('Empty screenshot generated.');
    }

    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.error('Frame capture failed:', error);
    throw new Error(`Failed to rasterize DOM to canvas: ${(error as Error).message}`);
  } finally {
    // Restore the original styling so the live preview is completely unaffected
    element.style.cssText = originalCssText;
  }
}

/**
 * Compiles a sequence of frames written into the FFmpeg FS into an MP4 file.
 * Returns the browser object URL for downloading.
 */
export async function compileVideo(
  ffmpeg: FFmpeg,
  fps: number,
  onProgress?: (msg: string) => void
): Promise<string> {
  if (onProgress) onProgress('Compiling video frames to H.264 MP4...');

  // Compile H.264 MP4 using libx264 and yuv420p for maximum compatibility
  await ffmpeg.exec([
    '-r',
    String(fps),
    '-i',
    'frame_%d.png',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-y', // Overwrite output if exists
    'output.mp4',
  ]);

  if (onProgress) onProgress('Reading compiled MP4 file from WASM filesystem...');
  
  const data = await ffmpeg.readFile('output.mp4');
  const uint8Array = data instanceof Uint8Array ? data : new Uint8Array(data as any);
  
  const videoBlob = new Blob([uint8Array], { type: 'video/mp4' });
  return URL.createObjectURL(videoBlob);
}

/**
 * Cleans up specific files in the FFmpeg virtual filesystem to prevent memory leaks.
 */
export async function cleanupFSDirectory(ffmpeg: FFmpeg, totalFrames: number) {
  for (let i = 0; i < totalFrames; i++) {
    try {
      await ffmpeg.deleteFile(`frame_${i}.png`);
    } catch {
      // Ignore if file was already deleted or doesn't exist
    }
  }
  try {
    await ffmpeg.deleteFile('output.mp4');
  } catch {
    // Ignore
  }
}
