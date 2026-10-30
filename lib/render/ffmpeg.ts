// Final MP4 stitching: FFmpeg.wasm runs fully in the browser (open-source,
// LGPL: ffmpeg + @ffmpeg/ffmpeg + @ffmpeg/util + @ffmpeg/core from npm).
// No server upload, no extra cost. Single-thread core needs no COOP/COEP.
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ff: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;
const CORE_VER = '0.12.10';
const CORE_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VER}/dist/esm`;

export async function loadFFmpeg(onLog?: (m: string) => void): Promise<FFmpeg> {
  if (ff) return ff;
  if (loading) return loading;
  loading = (async () => {
    const inst = new FFmpeg();
    if (onLog) inst.on('log', ({ message }: { message: string }) => onLog(message));
    await inst.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    } as never);
    ff = inst;
    return inst;
  })();
  return loading;
}

export interface StitchResult { blob: Blob; url: string; sizeBytes: number; usedRecode: boolean }

/** Concat N mp4 parts in order. Tries stream-copy first, falls back to re-encode. */
export async function stitchParts(
  files: File[],
  opts: { width?: number; height?: number; onProgress?: (p: number) => void; onLog?: (m: string) => void } = {}
): Promise<StitchResult> {
  if (files.length === 0) throw new Error('Add at least one MP4 part.');
  if (files.length === 1) {
    const blob = new Blob([files[0]], { type: 'video/mp4' });
    return { blob, url: URL.createObjectURL(blob), sizeBytes: files[0].size, usedRecode: false };
  }
  const ffmpeg = await loadFFmpeg(opts.onLog);
  if (opts.onProgress) { ffmpeg.on('progress', ({ progress }: { progress: number }) => opts.onProgress!(Math.round(progress * 100))); }
  const names: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const n = `part${i}.mp4`;
    await ffmpeg.writeFile(n, await fetchFile(files[i]));
    names.push(n);
  }
  await ffmpeg.writeFile('list.txt', names.map((n) => `file '${n}'`).join('\n'));
  const out = 'final.mp4';
  try { await ffmpeg.deleteFile(out); } catch { /* fresh */ }
  let usedRecode = false;
  try {
    await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', out]);
  } catch {
    usedRecode = true;
    const w = opts.width || 1080;
    const h = opts.height || 1920;
    await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-vf', `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', out]);
  }
  const data = (await ffmpeg.readFile(out)) as Uint8Array;
  const bytes = new Uint8Array(data);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'video/mp4' });
  return { blob, url: URL.createObjectURL(blob), sizeBytes: blob.size, usedRecode };
}

export function motionPlan(scenes: { id: string; videoUrl?: string; motionSource?: string; imageUrl?: string; voiceSource?: string; voiceClipUrl?: string; cadence?: number }[]) {
  const { resolveMotionTier } = require('@/lib/muse/visual') as typeof import('@/lib/muse/visual');
  return scenes.map((s) => ({ id: s.id, tier: resolveMotionTier(s), src: s.videoUrl || s.imageUrl || '', vo: s.voiceClipUrl || null, voSource: s.voiceSource || 'script', cadence: s.cadence ?? 1 }));
}

export async function renderCommercial(): Promise<never> {
  throw new Error('Use stitchParts(files) — upload the meta.ai Part MP4s in Export to join them.');
}

