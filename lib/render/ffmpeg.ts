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
/** Current phase maps raw FFmpeg 0..1 progress into a sub-range of 0..100. */
let progressBase = 0;
let progressSpan = 100;
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
  ff = null; loading = null; progressWired = false; latestProgress = null;
  progressBase = 0; progressSpan = 100; logLines.length = 0;
}

/** Raw FFmpeg progress is only trustworthy as a 0..1 fraction. Looped-image
 * inputs (Ken Burns segments) report garbage/negative times, which previously
 * surfaced as "Building -53339800%". Out-of-range values are ignored so the
 * bar steps discretely per phase instead of jumping wild. */
function clampProgress01(n: unknown): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  if (n < 0 || n > 1.05) return null;
  return Math.min(1, Math.max(0, n));
}

function wireProgress(inst: FFmpeg, onProgress?: (p: number) => void) {
  latestProgress = onProgress ?? null;
  if (!progressWired) {
    progressWired = true;
    inst.on('progress', ({ progress }: { progress: number }) => {
      const c = clampProgress01(progress);
      if (c === null || !latestProgress) return;
      latestProgress(Math.max(0, Math.min(100, Math.round(progressBase + c * progressSpan))));
    });
  }
}

/** Move the bar into a sub-range for the current phase and announce the step.
 * Pushes the phase start immediately so the UI never looks stuck when raw
 * progress events are indeterminate (looped images). */
function setPhase(base: number, span: number, onStep?: (s: string) => void, label?: string) {
  progressBase = base; progressSpan = span;
  if (label && onStep) onStep(label);
  latestProgress?.(Math.max(0, Math.min(100, Math.round(base))));
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
  wireProgress(ffmpeg, opts.onProgress);
  setPhase(0, 100, opts.onStep, `Writing ${files.length} parts…`);
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
  // FIX (2026-11-01: 20s duration but freezes at ~9s): `-c copy` via the
  // concat demuxer exits 0 even when the parts differ (codec/timebase/
  // fps/size/audio) — the 2nd part's packets keep overlapping timestamps
  // so players show summed duration but stall after part 1. Always
  // normalize with a re-encode: uniform size/fps/pix_fmt + AAC audio,
  // regenerated PTS (+genpts/make_zero) and faststart for preview.
  const w = opts.width || 1080;
  const h = opts.height || 1920;
  setPhase(5, 95, opts.onStep, 'Joining + normalizing clips…');
  let code: number;
  let usedRecode = true;
  const baseArgs = [
    '-fflags', '+genpts',
    '-f', 'concat', '-safe', '0', '-i', 'list.txt',
    '-vf', `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=30`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2',
    '-movflags', '+faststart',
    '-avoid_negative_ts', 'make_zero',
    out,
  ];
  try {
    code = await ffmpeg.exec(baseArgs);
  } catch (e) {
    throw new Error(`Join could not start (${errText(e)}). Reload the page and press Retry.\n\nTechnical detail:\n${tailLog()}`);
  }
  if (code !== 0) {
    // One/all parts may have no audio track — retry as video-only.
    setPhase(5, 95, opts.onStep, 'No audio track detected — joining video…');
    try { await ffmpeg.deleteFile(out); } catch { /* retry fresh */ }
    const noAudioArgs = [
      '-fflags', '+genpts',
      '-f', 'concat', '-safe', '0', '-i', 'list.txt',
      '-vf', `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=30`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30',
      '-an',
      '-movflags', '+faststart',
      '-avoid_negative_ts', 'make_zero',
      out,
    ];
    try {
      code = await ffmpeg.exec(noAudioArgs);
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

/** Ken Burns commercial: slow zoom over each still + per-part Meta.ai voice.
 * Meta.ai caps voice at ~10s per file too, so each ~10s part has its own
 * MP3; they are concatenated in order and each motion segment is timed to
 * its own part's real duration (fallback ~10s each). Alternating zoom
 * in/out. All in-browser, free. */
export async function buildKenBurnsCommercial(opts: {
  images: File[]; audioParts: File[]; audioSecs?: (number | undefined)[];
  /** True when audioParts[0] is Meta.ai's finished, already-stitched voice
   *  file (MP3 or MP4): no join needed — the app only adds Ken Burns motion,
   *  spread across the images for the file's full real duration. */
  stitched?: boolean;
  /** Used only if a stitched file's duration cannot be probed. */
  fallbackTotalSec?: number;
  width?: number; height?: number; fps?: number;
  onProgress?: (p: number) => void; onStep?: (s: string) => void; onLog?: (m: string) => void;
}): Promise<{ blob: Blob; url: string; sizeBytes: number; log: string }> {
  const { images, audioParts } = opts;
  const W = opts.width || 1080;
  const H = opts.height || 1920;
  const fps = opts.fps || 30;
  if (!images.length) throw new Error('Add at least one image — save screenshots on the Story step first.');
  if (!audioParts?.length) throw new Error('Add your Meta.ai voice MP3s first (one per 10s part).');
  if (images.length > 12) throw new Error('Keep it to 12 images max (one per page).');
  const emptyImg = images.find((f) => !f.size);
  if (emptyImg) throw new Error(`"${emptyImg.name}" is 0 bytes — re-save that screenshot and try again.`);
  const emptyAud = audioParts.find((f) => !f.size);
  if (emptyAud) throw new Error(`"${emptyAud.name}" is 0 bytes — re-download it from meta.ai and try again.`);
  const probed = audioParts.map((_, i) => {
    const d = opts.audioSecs?.[i];
    return d && Number.isFinite(d) && d > 0.5 ? d : undefined;
  });
  // Motion segments follow the REAL voice durations. The old 15s clamp
  // chopped longer parts so the final `-shortest` mux cut the voice off
  // mid-sentence. Stitched mode: one finished file, so segments divide
  // its full length evenly across the images.
  let segDurs: number[];
  if (opts.stitched) {
    const total = probed[0] ?? (opts.fallbackTotalSec && opts.fallbackTotalSec > 0 ? opts.fallbackTotalSec : 10);
    const nSeg = Math.max(1, images.length);
    segDurs = Array.from({ length: nSeg }, () => total / nSeg);
  } else {
    segDurs = probed.map((d) => (d ? Math.min(120, Math.max(2, d)) : 10));
  }
  const totalSec = segDurs.reduce((a, b) => a + b, 0);
  opts.onStep?.('Loading studio renderer…');
  const ffmpeg = await loadFFmpeg(opts.onLog);
  wireProgress(ffmpeg, opts.onProgress);
  setPhase(0, 6, opts.onStep, 'Loading studio renderer…');
  const imgNames: string[] = [];
  opts.onStep?.(`Loading ${images.length} image(s)…`);
  for (let i = 0; i < images.length; i++) {
    const f = images[i];
    const m = (f.name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    const ext = m ? `.${m[1]}` : '.jpg';
    const n = `kb_img${i}${ext}`;
    try {
      await ffmpeg.writeFile(n, await fetchFile(f));
    } catch (e) {
      throw new Error(`Could not load image "${f.name}" (${errText(e)}). Try a JPG/PNG export of the page.`);
    }
    imgNames.push(n);
  }
  const aNames: string[] = [];
  opts.onStep?.(`Loading ${audioParts.length} voice part(s)…`);
  for (let i = 0; i < audioParts.length; i++) {
    const f = audioParts[i];
    const m = (f.name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    const n = `kb_voice${i}${m ? `.${m[1]}` : '.mp3'}`;
    try {
      await ffmpeg.writeFile(n, await fetchFile(f));
    } catch (e) {
      throw new Error(`Could not load voice Part ${i + 1} "${f.name}" (${errText(e)}). Re-download the MP3 from meta.ai.`);
    }
    aNames.push(n);
  }
  // Build ONE voice track. Separate parts join via the concat FILTER (each
  // input resampled to 44.1k stereo first) — the concat demuxer used before
  // could fail or go silent on MP3s with mismatched params / ID3 tags. A
  // stitched Meta.ai file (or a single part) just normalizes straight through
  // (also extracts the audio when Meta.ai handed back an MP4).
  const vName = 'kb_voice_full.m4a';
  try { await ffmpeg.deleteFile(vName); } catch { /* fresh */ }
  setPhase(6, 12, opts.onStep, opts.stitched ? 'Reading your stitched voice file…' : 'Joining voice parts…');
  let vcode: number;
  try {
    if (aNames.length === 1) {
      vcode = await ffmpeg.exec(['-i', aNames[0], '-vn', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2', vName]);
    } else {
      const inputs: string[] = [];
      const filters: string[] = [];
      aNames.forEach((n, i) => { inputs.push('-i', n); filters.push(`[${i}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]`); });
      const fc = `${filters.join(';')};${aNames.map((_, i) => `[a${i}]`).join('')}concat=n=${aNames.length}:v=0:a=1[aout]`;
      vcode = await ffmpeg.exec([...inputs, '-filter_complex', fc, '-map', '[aout]', '-c:a', 'aac', '-b:a', '128k', vName]);
    }
  } catch (e) {
    throw new Error(`Voice join could not start (${errText(e)}). Reload and press Retry.\n\nTechnical detail:\n${tailLog()}`);
  }
  if (vcode !== 0) throw new Error(`Voice join failed (exit ${vcode}). ${opts.stitched ? 'That file may not contain audio — re-download the stitched file from meta.ai.' : 'Re-download the part MP3s.'}\n\nTechnical detail:\n${tailLog()}`);
  const segNames: string[] = [];
  // One motion segment per voice part — or, in stitched mode, one per image
  // across the full stitched duration. Phase range 18→82 is shared evenly,
  // and each step is announced immediately, because `-loop` inputs report
  // indeterminate progress (the old "-53339800%" source).
  const stepSpan = Math.max(1, 64 / segDurs.length);
  for (let i = 0; i < segDurs.length; i++) {
    const segDur = segDurs[i];
    const frames = Math.max(30, Math.round(segDur * fps));
    const seg = `kb_seg${i}.mp4`;
    try { await ffmpeg.deleteFile(seg); } catch { /* fresh */ }
    const zin = `1+0.12*on/${frames}`;
    const zout = `1.12-0.12*on/${frames}`;
    const z = i % 2 === 0 ? zin : zout;
    const img = imgNames[i % imgNames.length];
    setPhase(18 + i * stepSpan, stepSpan, opts.onStep, `Animating ${opts.stitched ? 'image' : 'part'} ${i + 1}/${segDurs.length}…`);
    let code: number;
    try {
      code = await ffmpeg.exec([
        '-loop', '1', '-framerate', String(fps), '-t', segDur.toFixed(2), '-i', img,
        '-vf', `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},zoompan=z='${z}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${fps}`,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
        '-an', seg,
      ]);
    } catch (e) {
      throw new Error(`Motion build could not start (${errText(e)}). Reload and press Retry.\n\nTechnical detail:\n${tailLog()}`);
    }
    if (code !== 0) throw new Error(`Could not animate image ${i + 1} (exit ${code}). Try fewer/smaller images.\n\nTechnical detail:\n${tailLog()}`);
    segNames.push(seg);
  }
  try {
    await ffmpeg.writeFile('kb_list.txt', segNames.map((n) => `file '${n}'`).join('\n'));
  } catch (e) {
    throw new Error(`Could not start the join (${errText(e)}). Reload and press Retry.`);
  }
  const silent = 'kb_silent.mp4';
  try { await ffmpeg.deleteFile(silent); } catch { /* fresh */ }
  setPhase(82, 10, opts.onStep, 'Joining motion…');
  let code: number;
  try {
    // Normalized re-encode, NOT `-c copy`: concat-copy timestamps caused the
    // earlier "right total duration but freezes mid-way" class of bugs.
    code = await ffmpeg.exec([
      '-fflags', '+genpts', '-f', 'concat', '-safe', '0', '-i', 'kb_list.txt',
      '-vf', `fps=${fps}`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(fps),
      '-an', '-movflags', '+faststart', '-avoid_negative_ts', 'make_zero', silent,
    ]);
  } catch (e) {
    throw new Error(`Join could not start (${errText(e)}). Reload and press Retry.\n\nTechnical detail:\n${tailLog()}`);
  }
  if (code !== 0) throw new Error(`Join failed (exit ${code}). Try fewer images.\n\nTechnical detail:\n${tailLog()}`);
  const out = 'kb_final.mp4';
  try { await ffmpeg.deleteFile(out); } catch { /* fresh */ }
  setPhase(92, 8, opts.onStep, 'Laying your Meta.ai voice over the motion…');
  try {
    // `-shortest` kept, `-t totalSec` dropped: segments now add up to the
    // real voice length, so neither side needs to be chopped blind.
    code = await ffmpeg.exec(['-i', silent, '-i', vName, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2', '-shortest', '-movflags', '+faststart', out]);
  } catch (e) {
    throw new Error(`Voice mix could not start (${errText(e)}). Reload and press Retry.\n\nTechnical detail:\n${tailLog()}`);
  }
  if (code !== 0) throw new Error(`Voice mix failed (exit ${code}). The MP3 may be DRM'd — re-download from meta.ai.\n\nTechnical detail:\n${tailLog()}`);
  let data: Uint8Array;
  try {
    data = (await ffmpeg.readFile(out)) as unknown as Uint8Array;
  } catch {
    throw new Error(`Finished but produced no file. Retry.\n\nTechnical detail:\n${tailLog()}`);
  }
  const bytes = new Uint8Array(data);
  if (!bytes.length) throw new Error(`Produced an empty file. Retry.\n\nTechnical detail:\n${tailLog()}`);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'video/mp4' });
  latestProgress?.(100);
  return { blob, url: URL.createObjectURL(blob), sizeBytes: blob.size, log: tailLog(30) };
}

export function motionPlan(scenes: { id: string; videoUrl?: string; motionSource?: string; imageUrl?: string; voiceSource?: string; voiceClipUrl?: string; cadence?: number }[]) {
  const { resolveMotionTier } = require('@/lib/muse/visual') as typeof import('@/lib/muse/visual');
  return scenes.map((s) => ({ id: s.id, tier: resolveMotionTier(s), src: s.videoUrl || s.imageUrl || '', vo: s.voiceClipUrl || null, voSource: s.voiceSource || 'script', cadence: s.cadence ?? 1 }));
}

export async function renderCommercial(): Promise<never> {
  throw new Error('Use stitchParts(files) — upload the meta.ai Part MP4s in Export to join them.');
}

