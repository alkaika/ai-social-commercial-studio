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
export const MAX_BATCH_SEC = 10;

export interface StoryBatch {
  index: number; total: number; batchSec: number; text: string; wordCount: number;
}

export function splitScriptIntoBatches(scriptText: string, durationSec: number, maxBatchSec = MAX_BATCH_SEC): StoryBatch[] {
  const clean = (scriptText || '').trim().replace(/\s+/g, ' ');
  if (!clean) return [];
  const total = Math.max(1, Math.ceil(durationSec / maxBatchSec));
  const words = clean.split(' ').filter(Boolean);
  if (total === 1) return [{ index: 1, total, batchSec: durationSec, text: clean, wordCount: words.length }];
  const secs: number[] = [];
  let rem = durationSec;
  for (let i = 0; i < total; i++) {
    const s = i < total - 1 ? maxBatchSec : rem;
    secs.push(s); rem -= s;
  }
  const targets = secs.map((s) => Math.round((s / durationSec) * words.length));
  targets[targets.length - 1] += words.length - targets.reduce((a, b) => a + b, 0);
  const sentences = clean.match(/[^.!?]+[.!?]+["']?/g)?.map((s) => s.trim()).filter(Boolean) || [];
  if (sentences.length >= total) {
    const out: StoryBatch[] = [];
    let si = 0;
    for (let b = 0; b < total; b++) {
      const target = targets[b];
      const acc: string[] = [];
      let wc = 0;
      while (si < sentences.length && (acc.length === 0 || wc < target)) {
        const sw = sentences[si].split(' ').filter(Boolean).length;
        if (acc.length > 0 && wc + sw > target + 4 && b < total - 1) break;
        acc.push(sentences[si]); wc += sw; si++;
        if (wc >= target) break;
      }
      if (b === total - 1) { while (si < sentences.length) acc.push(sentences[si++]); }
      const text = acc.join(' ');
      out.push({ index: b + 1, total, batchSec: secs[b], text, wordCount: text.split(' ').filter(Boolean).length });
    }
    return out;
  }
  const out: StoryBatch[] = [];
  let pos = 0;
  for (let b = 0; b < total; b++) {
    const n = b === total - 1 ? words.length - pos : targets[b];
    const slice = words.slice(pos, pos + n).join(' ');
    pos += n;
    out.push({ index: b + 1, total, batchSec: secs[b], text: slice, wordCount: slice.split(' ').filter(Boolean).length });
  }
  return out;
}

export interface SingleStoryPromptInput {
  scriptText: string;
  batchIndex?: number;
  batchTotal?: number;
  totalDurationSec?: number;
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
  const batchLabel =
    input.batchTotal && input.batchTotal > 1 && input.batchIndex
      ? ` (Part ${input.batchIndex} of ${input.batchTotal})`
      : '';
  const orientation =
    input.aspect === '16:9'
      ? 'landscape widescreen'
      : input.aspect === '1:1'
        ? 'square'
        : input.aspect === '4:5'
          ? 'vertical portrait'
          : 'vertical full-screen';
  const brandBit = input.brandName ? ` for ${input.brandName}` : '';
  const multi = (input.batchTotal || 1) > 1;
  const continuityLine = multi
    ? `This is Part ${input.batchIndex} of ${input.batchTotal} of one ${input.totalDurationSec || input.durationSec}s commercial — use the SAME woman, SAME ${input.voice} voice, SAME ${input.device} framing, and SAME ${input.vibeLabel.toLowerCase()} style as the other parts so they stitch together seamlessly. Continue naturally; do NOT repeat earlier parts and do NOT add a new intro/outro.`
    : '';
  return [
    `Make a ${input.durationSec}-second ${orientation} video${batchLabel} (${input.aspect}, ${input.width}x${input.height}) for ${input.platformLabel}${brandBit} with a ${input.vibeLabel.toLowerCase()} vibe.`,
    ...(multi ? [``, continuityLine] : []),
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

// --- Combined single-prompt with per-10s batch instructions ---
// One paste into meta.ai that carries the FULL script split into explicit
// ~10s voice+video segments, so meta.ai outputs everything together as one
// continuous commercial (no separate pastes, no manual stitching).

export interface CombinedStoryPromptInput {
  batches: StoryBatch[];
  durationSec: number;
  aspect: string;
  width: number;
  height: number;
  platformLabel: string;
  vibeLabel: string;
  brandName?: string;
  device: StoryDevice | string;
  voice: string;
}

export function buildCombinedStoryPrompt(input: CombinedStoryPromptInput): string {
  const { batches, durationSec, aspect, width, height, platformLabel, vibeLabel, brandName, device, voice } = input;
  const full = batches.map((b) => b.text).join(' ').replace(/\s+/g, ' ').trim() || '[paste your script above]';
  const orientation =
    aspect === '16:9' ? 'landscape widescreen'
      : aspect === '1:1' ? 'square'
        : aspect === '4:5' ? 'vertical portrait' : 'vertical full-screen';
  const brandBit = brandName ? ` for ${brandName}` : '';
  const multi = batches.length > 1;
  const lines: string[] = [
    `Make a ${durationSec}-second ${orientation} video (${aspect}, ${width}x${height}) for ${platformLabel}${brandBit} with a ${vibeLabel.toLowerCase()} vibe${multi ? ` — deliver as ${batches.length} back-to-back segments that join into one continuous commercial` : ''}.`,
    ``,
    `Make a video of a ${voice} voice saying: "${full}" while simultaneously showing the same woman using the app on her ${device} with the attached screenshots.`,
    ``,
  ];
  if (multi) {
    lines.push(`Use the SAME woman, SAME ${voice} voice, SAME ${device} framing, and SAME ${vibeLabel.toLowerCase()} style across ALL ${batches.length} segments so they cut together seamlessly. Do NOT repeat lines between segments. Do NOT add a new intro/outro.`);
    lines.push(``);
    batches.forEach((b) => {
      lines.push(`--- SEGMENT ${b.index} OF ${b.total} (~${b.batchSec}s voice + video) ---`);
      lines.push(`Say exactly (word-for-word, no paraphrase): "${b.text}"`);
      lines.push(`While saying it, show: the same woman using the app on her ${device}; cut between her and close-ups of the attached screenshots shown clearly on the ${device} screen. Bright, cinematic, real-app look. Finish this line inside ~${b.batchSec} seconds. End the segment the instant the last word is spoken — cut immediately, no pause, no trailing silence, no hold on the last frame, so the next segment starts clean with no time gap.`);
      lines.push(``);
    });
  }
  lines.push(`Requirements:`);
  lines.push(`- Total runtime: exactly ${durationSec} seconds in one continuous take — the voiceover starts immediately and finishes inside ${durationSec} seconds.`);
  lines.push(`- Tight endings: end each segment (and the whole video) the instant the last word is spoken — cut immediately with no pause, no trailing silence, and no hold on the last frame, so the final stitched video flows naturally with no time gaps.`);
  if (multi) lines.push(`- Each segment is ~10 seconds max of voice + video (${batches.map((b) => `${b.batchSec}s`).join(' + ')} = ${durationSec}s); keep segment boundaries clean for seamless joining.`);
  lines.push(`- Screen ratio: ${aspect} (${width}x${height}) — fill the full frame, no black bars, no cropping of the ${device} screen.`);
  lines.push(`- Platform: ${platformLabel}.`);
  lines.push(`- Vibe: ${vibeLabel.toLowerCase()} delivery and visuals.`);
  lines.push(`- Visual: a friendly woman on screen using the app on her ${device}; cut between her and close-ups of the attached screenshots shown clearly on the ${device} screen. Bright, cinematic, real-app look.`);
  lines.push(`- Audio: ${voice} voice, clear studio quality, no background music louder than the voice.`);
  lines.push(`- No burned-in text overlays or auto-subtitles (captions are added later).`);
  lines.push(``);
  lines.push(`I have attached screenshots of the website / mobile app — show them on the ${device} screen in the video.`);
  return lines.join('\n');
}

export function copyText(text: string): Promise<void> {
  if (navigator?.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return Promise.reject(new Error('Clipboard unavailable'));
}

