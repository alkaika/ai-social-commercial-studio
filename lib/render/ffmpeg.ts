// Final MP4 stitching: FFmpeg.wasm runs fully in the browser (open-source,
// LGPL: ffmpeg + @ffmpeg/ffmpeg + @ffmpeg/util + @ffmpeg/core from npm).
// No server upload, no extra cost. Single-thread core needs no COOP/COEP.
//
// Loading strategy (2026-10-30 fix for "Cannot find module 'blob:...'" +
// "cannot be accessed from origin"):
// - NEVER use toBlobURL() for coreURL — the class-worker does
//   `await import(coreURL)` and a blob: ESM import fails under Next.js.
// - NEVER use a cross-origin classWorkerURL — `new Worker(https CDN url)`
//   is blocked by the browser ("cannot be accessed from origin") and the
//   worker's own `./const.js` / `./errors.js` relative imports break.
//   The class-worker is ALWAYS the same-origin `/ffmpeg/ffmpeg-worker.js`;
//   only coreURL/wasmURL vary (local file → CDN file). A same-origin worker
//   CAN `await import()` a CORS-enabled CDN core (unpkg/jsdelivr send ACAO:*).
// - classWorkerURL/coreURL/wasmURL are ABSOLUTE (origin + path): FFmpeg does
//   `new URL(url, import.meta.url)` and import.meta.url is webpack-internal
//   in Next.js dev, so a relative '/ffmpeg/...' path throws Invalid URL.
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ff: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;
let progressWired = false;
let latestProgress: ((p: number) => void) | null = null;
const logLines: string[] = [];
// The class-worker MUST be same-origin (plain absolute URL). Only
// coreURL/wasmURL fall back to CDN files — a same-origin module worker CAN
// `await import()` a CORS-enabled (ACAO:*) CDN core.
const CORE_VER = '0.12.10';
interface CoreSrc { label: string; coreURL: string; wasmURL: string }
const CDN_CORE_SOURCES: CoreSrc[] = [
  {
    label: 'unpkg CDN',
    coreURL: `https://unpkg.com/@ffmpeg/core@${CORE_VER}/dist/esm/ffmpeg-core.js`,
    wasmURL: `https://unpkg.com/@ffmpeg/core@${CORE_VER}/dist/esm/ffmpeg-core.wasm`,
  },
  {
    label: 'jsdelivr CDN',
    coreURL: `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VER}/dist/esm/ffmpeg-core.js`,
    wasmURL: `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VER}/dist/esm/ffmpeg-core.wasm`,
  },
];

function pushLog(m: string) { logLines.push(m); if (logLines.length > 120) logLines.splice(0, logLines.length - 120); }
/** Call before Retry after a load failure so the next attempt starts fresh. */
export function resetFFmpeg() {
  try { ff?.terminate(); } catch { /* worker may never have spawned */ }
  ff = null; loading = null; progressWired = false; latestProgress = null; logLines.length = 0;
}

// NOTE: the ffmpeg web-worker rejects with a PLAIN STRING (e.toString()),
// not an Error object — so every catch must handle `typeof e === 'string'`.
export const errText = (e: unknown) => (typeof e === 'string' ? e : e instanceof Error ? e.message : String(e));
const tailLog = (n = 12): string => logLines.slice(-n).join('\n');

export async function loadFFmpeg(onLog?: (m: string) => void): Promise<FFmpeg> {
  if (ff) return ff;
  if (loading) return loading;
  loading = (async () => {
    const inst = new FFmpeg();
    inst.on('log', ({ message }: { message: string }) => { pushLog(message); onLog?.(message); });
    // Absolute same-origin worker URL: FFmpeg does
    // `new Worker(new URL(classWorkerURL, import.meta.url))` and import.meta.url
    // is webpack-internal under Next.js, so a relative path throws Invalid URL.
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const classWorkerURL = `${origin}/ffmpeg/ffmpeg-worker.js`;
    let lastErr = 'unknown load error';
    // Candidate core/wasm pairs: local app files first, then CDN files.
    const candidates: CoreSrc[] = [
      { label: 'app files (/ffmpeg)', coreURL: `${origin}/ffmpeg/ffmpeg-core.js`, wasmURL: `${origin}/ffmpeg/ffmpeg-core.wasm` },
      ...CDN_CORE_SOURCES,
    ];
    for (const src of candidates) {
      try {
        pushLog(`[loader v3] worker=${classWorkerURL}`);
        pushLog(`loading core from ${src.label}: ${src.coreURL}`);
        // Plain URLs only — NO toBlobURL(). classWorkerURL stays same-origin
        // (cross-origin Worker construction is blocked by the browser); only
        // coreURL/wasmURL vary. The worker `await import()`s coreURL, which
        // works cross-origin because unpkg/jsdelivr send ACAO:*.
        await inst.load({
          classWorkerURL,
          coreURL: src.coreURL,
          wasmURL: src.wasmURL,
        } as never);
        ff = inst;
        pushLog(`core ready via ${src.label}`);
        return inst;
      } catch (e) { lastErr = errText(e); pushLog(`core load failed from ${src.label}: ${lastErr}`); }
    }
    throw new Error(`Could not load the video joiner (~32MB) [loader v3]. Tried app files then ${candidates.length - 1} CDN backup(s). Check connection/VPN/ad-blocker and press Retry. Last error: ${lastErr}\n\nTechnical detail:\n${tailLog(30)}`);
  })();
  try {
    return await loading;
  } catch (e) {
    loading = null;
    throw e;
  }
}

export interface StitchResult { blob: Blob; url: string; sizeBytes: number; usedRecode: boolean; log: string }

/** Concat N mp4 parts in order. Checks exec exit codes; throws actionable errors. */
export async function stitchParts(
  files: File[],
  opts: { width?: number; height?: number; onProgress?: (p: number) => void; onStep?: (s: string) => void; onLog?: (m: string) => void } = {}
): Promise<StitchResult> {
  if (files.length === 0) throw new Error('Add at least one MP4 part.');
  const empty = files.find((f) => !f.size);
  if (empty) throw new Error(`"${empty.name}" is 0 bytes — re-download it from meta.ai and try again.`);
  if (files.length === 1) {
    const buf = await files[0].arrayBuffer();
    const blob = new Blob([buf], { type: 'video/mp4' });
    return { blob, url: URL.createObjectURL(blob), sizeBytes: blob.size, usedRecode: false, log: '' };
  }
  opts.onStep?.('Loading joiner…');
  const ffmpeg = await loadFFmpeg(opts.onLog);
  latestProgress = opts.onProgress ?? null;
  if (!progressWired) { progressWired = true; ffmpeg.on('progress', ({ progress }: { progress: number }) => latestProgress?.(Math.round(progress * 100))); }
  opts.onStep?.(`Writing ${files.length} parts…`);
  const names: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const n = `part${i}.mp4`;
    try {
      await ffmpeg.writeFile(n, await fetchFile(files[i]));
    } catch (e) {
      throw new Error(`Could not load "${files[i].name}" into the joiner (${errText(e)}). Try re-picking the files or reloading the page.`);
    }
    names.push(n);
  }
  try {
    await ffmpeg.writeFile('list.txt', names.map((n) => `file '${n}'`).join('\n'));
  } catch (e) {
    throw new Error(`Could not start the join (${errText(e)}). Reload and press Retry.`);
  }
  const out = 'final.mp4';
  try { await ffmpeg.deleteFile(out); } catch { /* fresh run */ }
  opts.onStep?.('Joining (lossless)…');
  let code: number;
  try {
    code = await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', out]);
  } catch (e) {
    throw new Error(`Join could not start (${errText(e)}). Reload the page and press Retry.\n\nTechnical detail:\n${tailLog()}`);
  }
  let usedRecode = false;
  if (code !== 0) {
    usedRecode = true;
    const w = opts.width || 1080;
    const h = opts.height || 1920;
    opts.onStep?.('Clips differ — re-encoding to match…');
    try {
      code = await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-vf', `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', out]);
    } catch (e) {
      throw new Error(`Re-encode could not start (${errText(e)}). Reload and press Retry.\n\nTechnical detail:\n${tailLog()}`);
    }
    if (code !== 0) throw new Error(`Join failed (exit ${code}). The parts may be corrupted or mixed formats — re-download all parts from meta.ai as MP4 and retry.\n\nTechnical detail:\n${tailLog()}`);
  }
  let data: Uint8Array;
  try {
    data = (await ffmpeg.readFile(out)) as unknown as Uint8Array;
  } catch {
    throw new Error(`Join finished but produced no file. Re-download the parts and retry.\n\nTechnical detail:\n${tailLog()}`);
  }
  const bytes = new Uint8Array(data);
  if (!bytes.length) throw new Error(`Join produced an empty file. Re-download the parts and retry.\n\nTechnical detail:\n${tailLog()}`);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'video/mp4' });
  return { blob, url: URL.createObjectURL(blob), sizeBytes: blob.size, usedRecode, log: tailLog(30) };
}

export function motionPlan(scenes: { id: string; videoUrl?: string; motionSource?: string; imageUrl?: string; voiceSource?: string; voiceClipUrl?: string; cadence?: number }[]) {
  const { resolveMotionTier } = require('@/lib/muse/visual') as typeof import('@/lib/muse/visual');
  return scenes.map((s) => ({ id: s.id, tier: resolveMotionTier(s), src: s.videoUrl || s.imageUrl || '', vo: s.voiceClipUrl || null, voSource: s.voiceSource || 'script', cadence: s.cadence ?? 1 }));
}

export async function renderCommercial(): Promise<never> {
  throw new Error('Use stitchParts(files) — upload the meta.ai Part MP4s in Export to join them.');
}

