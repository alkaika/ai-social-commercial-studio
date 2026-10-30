// Prompt builders for meta.ai clips.
// Meta Model API has no TTS / video endpoint, so voice + motion are
// authored at https://www.meta.ai (consumer app). These builders produce
// copy-paste prompts that yield consistent voice + on-brand visuals.

import type { ScriptScene } from '@/lib/script-utils';
import type { ClipKind } from './types';

export const META_AI_URL = 'https://www.meta.ai/';

export function buildVoicePrompt(scene: ScriptScene, voice = 'warm female, energetic'): string {
  const line = (scene.voiceover || '').trim().replace(/\s+/g, ' ');
  return `Make a video of a ${voice} voice saying: "${line}"`;
}

export function buildVideoPrompt(scene: ScriptScene, aspect = '9:16', brandName = ''): string {
  const visual = (scene.visualPrompt || scene.heading || '').trim();
  const brand = brandName ? ` for ${brandName}` : '';
  return `Vertical ${aspect} commercial clip${brand}: ${visual}. Cinematic, bright, no text overlay, 3 seconds. Scene: ${scene.heading}.`;
}

export function buildAllPrompts(
  scenes: ScriptScene[],
  opts: { voice?: string; aspect?: string; brandName?: string } = {}
): { sceneId: string; kind: ClipKind; prompt: string }[] {
  const out: { sceneId: string; kind: ClipKind; prompt: string }[] = [];
  for (const s of scenes) {
    out.push({ sceneId: s.id, kind: 'voice', prompt: buildVoicePrompt(s, opts.voice) });
    out.push({
      sceneId: s.id,
      kind: 'video',
      prompt: buildVideoPrompt(s, opts.aspect || '9:16', opts.brandName || ''),
    });
  }
  return out;
}

export function copyText(text: string): Promise<void> {
  if (navigator?.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return Promise.reject(new Error('Clipboard unavailable'));
}
