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

// --- Single-prompt Story builder (Story page, simple mode) ---
// One copy-paste prompt that carries video + voice + timing + the full
// script, so the user only pastes once into meta.ai and attaches their
// website/app screenshots there.

export const STORY_VOICES = [
  'warm female, energetic',
  'warm female, calm and friendly',
  'warm male, energetic',
  'warm male, calm and professional',
] as const;

export const STORY_DEVICES = ['Mobile phone', 'PC monitor'] as const;
export type StoryDevice = (typeof STORY_DEVICES)[number];

export interface SingleStoryPromptInput {
  scriptText: string;
  durationSec: number;
  aspect: string; // e.g. '9:16'
  width: number;
  height: number;
  platformLabel: string; // e.g. 'TikTok'
  vibeLabel: string; // e.g. 'Friendly'
  brandName?: string;
  device: StoryDevice | string;
  voice: string;
}

export function buildSingleStoryPrompt(input: SingleStoryPromptInput): string {
  const script = (input.scriptText || '').trim().replace(/\s+/g, ' ');
  const orientation =
    input.aspect === '16:9'
      ? 'landscape widescreen'
      : input.aspect === '1:1'
        ? 'square'
        : input.aspect === '4:5'
          ? 'vertical portrait'
          : 'vertical full-screen';
  const brandBit = input.brandName ? ` for ${input.brandName}` : '';
  return [
    `Make a ${input.durationSec}-second ${orientation} video (${input.aspect}, ${input.width}x${input.height}) for ${input.platformLabel}${brandBit} with a ${input.vibeLabel.toLowerCase()} vibe.`,
    ``,
    `Make a video of a ${input.voice} voice saying: "${script}" while simultaneously showing the same woman using the app on her ${input.device} with the attached screenshots.`,
    ``,
    `Requirements:`,
    `- Total runtime: exactly ${input.durationSec} seconds in one continuous take — the voiceover must start immediately and finish inside ${input.durationSec} seconds.`,
    `- Screen ratio: ${input.aspect} (${input.width}x${input.height}) — fill the full frame, no black bars, no cropping of the ${input.device} screen.`,
    `- Platform: ${input.platformLabel}.`,
    `- Vibe: ${input.vibeLabel.toLowerCase()} delivery and visuals.`,
    `- Visual: a friendly woman on screen using the app on her ${input.device}; cut between her and close-ups of the attached screenshots shown clearly on the ${input.device} screen. Bright, cinematic, real-app look.`,
    `- Audio: ${input.voice} voice, clear studio quality, no background music louder than the voice.`,
    `- No burned-in text overlays or auto-subtitles (captions are added later).`,
    ``,
    `I have attached screenshots of the website / mobile app — show them on the ${input.device} screen in the video.`,
  ].join('\n');
}

export function copyText(text: string): Promise<void> {
  if (navigator?.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return Promise.reject(new Error('Clipboard unavailable'));
}

