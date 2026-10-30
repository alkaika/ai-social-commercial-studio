// Background ingest: validate a dropped/picked meta.ai file off the main
// flow, probe its duration, then hand an object URL back for auto-attach.
// Runs async so the Storyboard stays interactive while clips process.

import type { ClipKind, IngestedClip } from './types';

const VOICE_EXT = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'mp4', 'mov', 'webm'];
const VIDEO_EXT = ['mp4', 'mov', 'webm', 'm4a'];

export function kindFromFile(file: File, expect: ClipKind): { ok: boolean; reason?: string } {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const list = expect === 'voice' ? VOICE_EXT : VIDEO_EXT;
  if (!list.includes(ext) && file.type && !file.type.startsWith(expect === 'voice' ? 'audio' : 'video') && file.type !== 'video/mp4') {
    // meta.ai voice clips download as MP4 video — accept video for voice too.
    if (!(expect === 'voice' && file.type.startsWith('video'))) {
      return { ok: false, reason: `Unexpected file type .${ext} for ${expect} clip` };
    }
  }
  if (file.size > 200 * 1024 * 1024) return { ok: false, reason: 'File over 200MB' };
  return { ok: true };
}

function probeDuration(url: string, kind: ClipKind): Promise<number | undefined> {
  return new Promise((resolve) => {
    try {
      const el = kind === 'voice' ? new Audio() : document.createElement('video');
      el.preload = 'metadata';
      el.onloadedmetadata = () => {
        const d = (el as HTMLMediaElement).duration;
        resolve(Number.isFinite(d) ? d : undefined);
      };
      el.onerror = () => resolve(undefined);
      el.src = url;
      // Safety timeout — never block ingest on metadata.
      setTimeout(() => resolve(undefined), 8000);
    } catch {
      resolve(undefined);
    }
  });
}

export async function ingestClipFile(sceneId: string, kind: ClipKind, file: File): Promise<IngestedClip> {
  const check = kindFromFile(file, kind);
  if (!check.ok) throw new Error(check.reason);
  const objectUrl = URL.createObjectURL(file);
  // Probe in background; attach happens even if duration is unknown.
  const durationSec = await probeDuration(objectUrl, kind);
  return { sceneId, kind, file, objectUrl, durationSec };
}

/** Match a filename like s1-voice.mp4 / s2_video.mov to a scene + kind. */
export function matchFileToScene(fileName: string): { sceneId?: string; kind?: ClipKind } {
  const base = fileName.toLowerCase();
  const sceneMatch = base.match(/s(\d+)/);
  const sceneId = sceneMatch ? `s${sceneMatch[1]}` : undefined;
  let kind: ClipKind | undefined;
  if (base.includes('voice') || base.includes('vo') || base.includes('audio')) kind = 'voice';
  else if (base.includes('video') || base.includes('motion') || base.includes('clip')) kind = 'video';
  return { sceneId, kind };
}
