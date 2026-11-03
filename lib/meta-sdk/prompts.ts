// Prompt builders for meta.ai clips.
// Meta Model API has no TTS / video endpoint, so voice + motion are
// authored at https://www.meta.ai (consumer app). These builders produce
// copy-paste prompts that yield consistent voice + on-brand visuals.

import type { ScriptScene } from '@/lib/script-utils';
import { WORDS_PER_SEC } from '@/lib/script-utils';
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

export const STORY_VOICE_STYLES = [
  'energetic',
  'calm and friendly',
  'professional',
  'cheerful and upbeat',
  'confident and bold',
] as const;

// Voice-only choices for 🎙 Voices + screenshots and 🎧 Voice MP3 modes —
// voice description ONLY, never a physical description (no hair/age/outfit).
// 🧍 People + app keeps using STORY_TESTIMONIAL_PERSONAS below (face + voice).
export const STORY_VOICES = [
  'warm female, energetic',
  'warm female, calm and friendly',
  'warm female, professional',
  'warm female, cheerful and upbeat',
  'warm female, confident and bold',
  'warm male, energetic',
  'warm male, calm and friendly',
  'warm male, professional',
  'warm male, cheerful and upbeat',
  'warm male, confident and bold',
] as const;

export const STORY_DEVICES = ['Mobile phone', 'Tablet', 'Laptop', 'PC monitor'] as const;
export type StoryDevice = (typeof STORY_DEVICES)[number];

export const STORY_TESTIMONIAL_PERSONAS = [
  { voice: 'warm female, energetic', person: 'woman' as const, appearance: 'young woman in her 20s with long dark hair', short: 'Young woman - dark hair' },
  { voice: 'warm male, energetic', person: 'man' as const, appearance: 'young man in his 20s with short curly hair', short: 'Young man - curly hair' },
  { voice: 'warm female, calm and friendly', person: 'woman' as const, appearance: 'woman in her 30s with a short blonde bob', short: 'Woman - blonde bob' },
  { voice: 'warm male, calm and friendly', person: 'man' as const, appearance: 'man in his 30s with a short beard and glasses', short: 'Man - beard + glasses' },
  { voice: 'warm female, professional', person: 'woman' as const, appearance: 'professional woman in her 40s with shoulder-length brown hair in a blazer', short: 'Professional woman - blazer' },
  { voice: 'warm male, professional', person: 'man' as const, appearance: 'professional man in his 40s with neat short hair in a button-down shirt', short: 'Professional man - button-down' },
];

// 🧍 People + app only — physical cast lives here. Voice-only modes
// (🎙 Voices + screenshots, 🎧 Voice MP3 + Ken Burns) use STORY_VOICES
// above precisely so no hair/age/outfit text ever leaks into voice pickers,
// headers, or Meta.ai prompts.

export const STORY_DEVICE_ICONS: Record<string, string> = {
  'Mobile phone': '📱',
  Tablet: '📲',
  Laptop: '💻',
  'PC monitor': '🖥',
};

export const STORY_MUSIC = [
  { id: 'none', label: 'No music — voice only', emoji: '🔇', desc: 'Clean VO, silence between lines', prompt: '' },
  { id: 'soft-piano', label: 'Soft piano', emoji: '🎹', desc: 'Calm, minimal chords', prompt: 'soft royalty-free piano, slow minimal chords, calm and clean' },
  { id: 'acoustic', label: 'Light acoustic', emoji: '🎸', desc: 'Warm fingerpicked guitar', prompt: 'light royalty-free acoustic guitar, warm fingerpicked, friendly and airy' },
  { id: 'ambient', label: 'Ambient pads', emoji: '🌫️', desc: 'Modern, spacious tech feel', prompt: 'airy royalty-free ambient pads, modern tech feel, spacious and calm' },
  { id: 'corporate', label: 'Light corporate', emoji: '💼', desc: 'Subtle pulse, motivational', prompt: 'light royalty-free corporate bed, subtle pulse, motivational but restrained' },
  { id: 'lofi', label: 'Chill lo-fi', emoji: '🎧', desc: 'Mellow, soft beat', prompt: 'mellow royalty-free lo-fi, soft brushed beat, relaxed and unobtrusive' },
] as const;
export type StoryMusicId = (typeof STORY_MUSIC)[number]['id'];

export function storyMusicById(id: string) {
  return STORY_MUSIC.find((m) => m.id === id) || STORY_MUSIC[0];
}

// Screenshot source follows the selected device: phone shows the mobile app,
// larger screens show the website. Keeps the prompt footer specific.
export function deviceSourceLabel(device: StoryDevice | string): 'Website' | 'Mobile app' {
  return device === 'Mobile phone' ? 'Mobile app' : 'Website';
}
export const MAX_BATCH_SEC = 10;

export interface StoryBatch {
  index: number; total: number; batchSec: number; text: string; wordCount: number;
}

export function voicePerson(voice: string): 'woman' | 'man' | 'person' {
  const v = (voice || '').toLowerCase();
  if (v.includes('female')) return 'woman';
  if (v.includes('male')) return 'man';
  return 'person';
}

export interface BatchBalance {
  even: boolean;
  maxDriftWords: number;
  maxDriftSec: number;
  needsRebalance: boolean;
  warnings: string[];
}

/** Check the current split still fits ~10s/segment before writing the prompt. */
export function checkBatchBalance(batches: StoryBatch[], durationSec: number): BatchBalance {
  const warnings: string[] = [];
  if (!batches.length) return { even: false, maxDriftWords: 0, maxDriftSec: 0, needsRebalance: true, warnings: ['Script is empty — add your script text first.'] };
  const totalWords = batches.flatMap((b) => b.text.split(' ').filter(Boolean)).length;
  const totalSecs = batches.reduce((a, b) => a + b.batchSec, 0) || durationSec;
  // Proportional expectation: a 5s tail should carry ~half the words of a 10s head.
  const expectedFor = (batchSec: number) => Math.round((totalWords * batchSec) / totalSecs);
  let maxDriftWords = 0;
  for (const b of batches) {
    const drift = Math.abs(b.wordCount - expectedFor(b.batchSec));
    maxDriftWords = Math.max(maxDriftWords, drift);
  }
  const natural = batches.map((b) => Math.round((b.wordCount / WORDS_PER_SEC) * 10) / 10);
  const overflow = batches
    .map((b, i) => ({ b, spoken: natural[i] }))
    .filter(({ b, spoken }) => spoken > b.batchSec + 1);
  let maxDriftSec = 0;
  for (const { b, spoken } of overflow) {
    maxDriftSec = Math.max(maxDriftSec, Math.round((spoken - b.batchSec) * 10) / 10);
    warnings.push(`Segment ${b.index} is long: ~${b.wordCount} words ≈ ${spoken}s natural speech for a ~${b.batchSec}s slot. Shorten it or slow the delivery.`);
  }
  const empty = batches.filter((b) => !b.text.trim());
  for (const b of empty) warnings.push(`Segment ${b.index} is empty — the split ran before the script was finished. Re-check after editing.`);
  const needsRebalance = maxDriftWords > 6 || overflow.length > 0 || empty.length > 0;
  if (maxDriftWords > 6 && !overflow.length) {
    warnings.push(`Word spread is uneven for the segment lengths (biggest gap ~${maxDriftWords} words off its proportional share). Rebalance evens the segments.`);
  }
  return { even: !needsRebalance && warnings.length === 0, maxDriftWords, maxDriftSec, needsRebalance, warnings };
}

/** Even out word counts after an edit (proportional to each segment's seconds, keeps order).
 * Sentence-aware first (never cuts mid-sentence when a clean split is close),
 * word-level fallback guarantees evenness when sentences are huge/lopsided. */
export function rebalanceBatches(batches: StoryBatch[]): StoryBatch[] {
  if (batches.length < 2) return batches;
  const full = batches.map((b) => b.text).join(' ').trim().replace(/\s+/g, ' ');
  if (!full) return batches;
  const words = full.split(' ').filter(Boolean);
  if (!words.length) return batches;
  const totalSecs = batches.reduce((a, b) => a + b.batchSec, 0) || batches.length;
  // Proportional split: a 5s tail gets ~half the words of a 10s head.
  const targets = batches.map((b) => Math.round((words.length * b.batchSec) / totalSecs));
  targets[targets.length - 1] += words.length - targets.reduce((a, n) => a + n, 0);
  // Word-level proportional split (always exact).
  const wordSplit = (): StoryBatch[] => {
    const out: StoryBatch[] = [];
    let pos = 0;
    batches.forEach((b, i) => {
      const n = i === batches.length - 1 ? words.length - pos : targets[i];
      const slice = words.slice(pos, pos + n).join(' ');
      pos += n;
      out.push({ ...b, text: slice, wordCount: slice.split(' ').filter(Boolean).length });
    });
    return out;
  };
  // 1) Try sentence-aware split — keeps "Say exactly" lines natural.
  const sentences = full.match(/[^.!?]+[.!?]+["']?/g)?.map((s) => s.trim()).filter(Boolean) || [];
  if (sentences.length >= batches.length) {
    const sentOut: StoryBatch[] = [];
    let si = 0;
    for (let i = 0; i < batches.length; i++) {
      const target = targets[i];
      const remaining = batches.length - i;
      if (i === batches.length - 1) {
        const text = sentences.slice(si).join(' ');
        sentOut.push({ ...batches[i], text, wordCount: text.split(' ').filter(Boolean).length });
        break;
      }
      const acc: string[] = [];
      let wc = 0;
      // Must leave >=1 sentence for each remaining batch.
      while (si < sentences.length && (sentences.length - si) > (remaining - 1)) {
        const sw = sentences[si].split(' ').filter(Boolean).length;
        if (acc.length > 0) {
          // Stop if we're at/over target and adding more drifts further.
          const without = Math.abs(wc - target);
          const withNext = Math.abs(wc + sw - target);
          if (wc >= target && without <= withNext) break;
          // Stop if adding this sentence overshoots by >4 while we're close.
          if (wc >= target - 2 && withNext > 4 && without < withNext) break;
        }
        acc.push(sentences[si]); wc += sw; si++;
        if (wc >= target) break;
      }
      // Guarantee progress: every non-last batch takes >=1 sentence.
      if (!acc.length && si < sentences.length) { acc.push(sentences[si]); si++; }
      const text = acc.join(' ');
      sentOut.push({ ...batches[i], text, wordCount: text.split(' ').filter(Boolean).length });
    }
    if (sentOut.length === batches.length) {
      const maxDrift = Math.max(...sentOut.map((b, i) => Math.abs(b.wordCount - targets[i])));
      const hasEmpty = sentOut.some((b) => !b.text.trim());
      if (!hasEmpty && maxDrift <= 6) return sentOut;
    }
  }
  // 2) Word-level fallback — guaranteed proportional, may cut mid-sentence.
  return wordSplit();
}

/** Auto-balanced split: sentence-aware split + automatic rebalance when the
 * sentence pass drifts >6 words off proportional share. Story UI calls this
 * so the user never taps a Rebalance button. */
export function splitScriptIntoBalancedBatches(scriptText: string, durationSec: number, maxBatchSec = MAX_BATCH_SEC): StoryBatch[] {
  const auto = splitScriptIntoBatches(scriptText, durationSec, maxBatchSec);
  if (auto.length < 2) return auto;
  const totalWords = auto.flatMap((b) => b.text.split(' ').filter(Boolean)).length;
  const totalSecs = auto.reduce((a, b) => a + b.batchSec, 0) || durationSec;
  const expectedFor = (batchSec: number) => Math.round((totalWords * batchSec) / totalSecs);
  let maxDrift = 0;
  for (const b of auto) maxDrift = Math.max(maxDrift, Math.abs(b.wordCount - expectedFor(b.batchSec)));
  const hasEmpty = auto.some((b) => !b.text.trim());
  if (maxDrift > 6 || hasEmpty) return rebalanceBatches(auto);
  return auto;
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
  const source = deviceSourceLabel(input.device);
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
    `- Voice pacing: this app aims for ~35 words per 10 seconds (~3.5 words/sec natural pace). If this part has fewer than ~35 words per 10s, slow/stretch delivery slightly to fill the full ${input.durationSec}s; if more, quicken delivery slightly to fit — always landing the last word exactly at the end with no cut-off and no trailing silence.`,
    `- Screen ratio: ${input.aspect} (${input.width}x${input.height}) — fill the full frame, no black bars, no cropping of the ${input.device} screen.`,
    `- Platform: ${input.platformLabel}.`,
    `- Vibe: ${input.vibeLabel.toLowerCase()} delivery and visuals.`,
    `- Visual: a friendly woman on screen using the app on her ${input.device}; cut between her and close-ups of the attached screenshots shown clearly on the ${input.device} screen. UI taken straight from the attachments (never redesigned) but shown alive — taps, scrolling, popups opening, switching between attached screens, recombining regions from the same set. Rotate through every attached screenshot evenly so each gets roughly equal screen time. Bright, cinematic, real-app look.`,
    `- Screenshot use (STRICT but ALIVE): every pixel of app UI must come from the attached screenshots — same layout, text, buttons, colors, logos. Do NOT redesign, restyle, recolor, rewrite, or "improve" anything; no fake UI, no lorem ipsum, no invented screens. You MAY make the app feel actively used: simulate taps and scrolling, open popups/dialogs/menus that appear in the screenshots, switch between attached screens as if navigating, and recombine cropped regions from the SAME attached set. Never alter text, colors, branding, or layout styling. All on-screen UI stays readable.`,
    `- Audio: ${input.voice} voice, clear studio quality, no background music louder than the voice.`,
    `- No burned-in text overlays or auto-subtitles (captions are added later).`,
    ``,
    `I have attached screenshots of the ${source} — show them on the ${input.device} screen in the video.`,
  ].join('\n');
}

// --- Combined single-prompt with per-10s batch instructions ---
// One paste into meta.ai that carries the FULL script split into explicit
// ~10s voice+video segments, so meta.ai outputs everything together as one
// continuous commercial (no separate pastes, no manual stitching).

export interface BatchSpeaker {
  batchIndex: number;
  voice: string;
  person: 'woman' | 'man' | 'person';
  appearance: string;
  short: string;
}

/** Assign a DIFFERENT voice + face to every 10s batch (testimonial style). */
/** 🧍 People + app only — DIFFERENT face + voice per part. */
export function assignBatchSpeakers(total: number): BatchSpeaker[] {
  const out: BatchSpeaker[] = [];
  for (let i = 0; i < total; i++) {
    const p = STORY_TESTIMONIAL_PERSONAS[i % STORY_TESTIMONIAL_PERSONAS.length];
    out.push({ batchIndex: i + 1, voice: p.voice, person: p.person, appearance: p.appearance, short: p.short });
  }
  return out;
}

/** 🎙 Voices + screenshots only — DIFFERENT voice per part, NO face/appearance.
 *  Cycles the 10 voice-only options so voice pickers/headers/prompts never
 *  leak hair/age/outfit text. `appearance` stays '' and `short` === voice. */
export function assignBatchVoices(total: number): BatchSpeaker[] {
  const out: BatchSpeaker[] = [];
  for (let i = 0; i < total; i++) {
    const voice = STORY_VOICES[i % STORY_VOICES.length] as string;
    out.push({ batchIndex: i + 1, voice, person: voicePerson(voice), appearance: '', short: voice });
  }
  return out;
}

export interface BatchTestimonialPromptInput {
  batch: StoryBatch;
  speaker: BatchSpeaker;
  aspect: string;
  width: number;
  height: number;
  platformLabel: string;
  vibeLabel: string;
  brandName?: string;
  device: StoryDevice | string;
  musicId?: string;
  showPerson?: boolean;
  totalDurationSec?: number;
}

export interface CombinedStoryPromptInput {
  batches: StoryBatch[];
  musicId?: string;
  showPerson?: boolean; // false = voiceover + screenshots only, no person on camera
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
  const music = storyMusicById(input.musicId || 'none');
  const audioLine = music.prompt
    ? `- Audio: ${voice} voice front and center, clear studio quality. Underneath: ${music.prompt} at low background level (~-20dB under the voice, ducked whenever speaking) so the voice stays fully clear and intelligible. No lyrics in the music.`
    : `- Audio: ${voice} voice, clear studio quality. Voice only — no background music, no sound effects.`;
  const person = voicePerson(voice);
  const showPerson = input.showPerson !== false;
  const samePerson = person === 'woman' ? 'SAME woman' : person === 'man' ? 'SAME man' : 'SAME person';
  const aPerson = person === 'woman' ? 'the same woman' : person === 'man' ? 'the same man' : 'the same person';
  const poss = person === 'woman' ? 'her' : person === 'man' ? 'his' : 'their';
  const him = person === 'woman' ? 'her' : person === 'man' ? 'him' : 'them';
  const source = deviceSourceLabel(device);
  const sourceLine = `I have attached screenshots of the ${source} — show them on the ${device} screen in the video, giving each screenshot roughly equal screen time across the full ${durationSec}s.`;
  const likenessLine = `- Screenshot use (STRICT but ALIVE): every pixel of app UI must come from the attached screenshots — same layout, text, buttons, colors, logos. Do NOT redesign, restyle, recolor, rewrite, or "improve" anything; no fake UI, no lorem ipsum, no invented screens. You MAY make the app feel actively used: simulate taps and scrolling, open popups/dialogs/menus that appear in the screenshots, switch between attached screens as if navigating, and crop/zoom/pan or recombine cropped regions from the SAME attached set (e.g. layer a popup from one screenshot over another). Never alter text, colors, branding, or layout styling — only show, navigate, and layer what is already attached. All on-screen UI stays readable.`;
  const screenNoun = device === 'Mobile phone' ? 'a phone screen' : `a ${device.toLowerCase()} screen`;
  const pacingLine = `- Screenshot pacing: spread ALL attached screenshots evenly across the full ${durationSec}s — each screenshot gets roughly equal screen time (total time divided by number of screenshots). Cycle through every screenshot at least once, never linger on one, never skip one, never repeat the same screenshot twice in a row. Keep the on-screen app visuals changing in rhythm with the voiceover.`;
  const segmentPacing = (secs: number) => `Give each screenshot shown in this segment a roughly equal share of these ~${secs}s — rotate evenly, no lingering, no repeats back-to-back.`;
  const openLine = showPerson
    ? `Make a video of a ${voice} voice saying: "${full}" while simultaneously showing ${aPerson} using the app on ${poss} ${device} with the attached screenshots.`
    : `Make a voiceover video with a ${voice} voice saying: "${full}" over full-screen app footage built from the attached screenshots on ${screenNoun} — voiceover only, no person on camera, no actor, no avatar.`;
  const continuousLine = showPerson
    ? `Use the ${samePerson}, SAME ${voice} voice, SAME ${device} framing, and SAME ${vibeLabel.toLowerCase()} style across ALL ${batches.length} segments so they cut together seamlessly. Do NOT repeat lines between segments. Do NOT add a new intro/outro.`
    : `Use the SAME ${voice} voiceover, SAME ${device} screen framing, and SAME ${vibeLabel.toLowerCase()} style across ALL ${batches.length} segments so they cut together seamlessly. Voiceover only throughout — no person on camera at any point. Do NOT repeat lines between segments. Do NOT add a new intro/outro.`;
  const segmentVisual = (text: string, secs: number) => showPerson
    ? `While saying it, show: ${aPerson} using the app on ${poss} ${device}; cut between ${him} and close-ups of the attached screenshots shown clearly on the ${device} screen — UI taken STRAIGHT from the attachments (never redesigned), but shown ALIVE: taps, scrolling, popups/dialogs opening, switching between attached screens, recombining cropped regions from the same set to simulate real use. Content always readable. ${segmentPacing(secs)} Bright, cinematic, real-app look. Finish this line inside ~${secs} seconds. End the segment the instant the last word is spoken — cut immediately, no pause, no trailing silence, no hold on the last frame, so the next segment starts clean with no time gap.`
    : `While saying it, show full-screen app footage only: the attached ${source.toLowerCase()} screenshots fill the frame on ${screenNoun} — UI taken STRAIGHT from the attachments (never redesigned or rewritten), but shown ALIVE: taps, scrolling, popups/dialogs opening, switching between attached screens, recombining cropped regions from the same set to simulate real use. ${segmentPacing(secs)} Bright, cinematic, real-app look. Finish this line inside ~${secs} seconds. End the segment the instant the last word is spoken — cut immediately, no pause, no trailing silence, no hold on the last frame, so the next segment starts clean with no time gap.`;
    // NOTE: no person/actor/avatar/face ban repeated here — it lives in openLine/continuousLine/visualReqLine below.
  const visualReqLine = showPerson
    ? `- Visual: a friendly ${person} on screen using the app on ${poss} ${device}; cut between ${him} and close-ups of the attached screenshots shown clearly on the ${device} screen. UI taken straight from the attachments (never redesigned) but shown alive — taps, scrolling, popups opening, switching between attached screens, recombining regions from the same set. Rotate through every attached screenshot evenly so each gets roughly equal screen time. Bright, cinematic, real-app look.`
    : `- Visual: full-screen app footage only — the attached ${source.toLowerCase()} screenshots fill the frame on ${screenNoun}, UI taken straight from the attachments (never redesigned) but shown alive: taps, scrolling, popups/dialogs opening, switching between attached screens, recombining cropped regions from the same set. Rotate through every attached screenshot evenly so each gets roughly equal screen time. Absolutely no person, actor, avatar, or face on camera at any point. Bright, cinematic, real-app look.`;
  const lines: string[] = [
    `Make a ${durationSec}-second ${orientation} video (${aspect}, ${width}x${height}) for ${platformLabel}${brandBit} with a ${vibeLabel.toLowerCase()} vibe${multi ? ` — deliver as ${batches.length} back-to-back segments that join into one continuous commercial` : ''}.`,
    ``,
    openLine,
    ``,
  ];
  if (multi) {
    // Self-verification block: forces Meta.ai to recount before rendering,
    // so an edited script can't leave one segment overloaded. Targets are
    // PROPORTIONAL to each segment's seconds (a 5s tail holds ~half the
    // words of a 10s head) — never a flat per-segment average.
    const totalWords = batches.reduce((a, b) => a + b.wordCount, 0);
    const totalSecs = batches.reduce((a, b) => a + b.batchSec, 0) || durationSec;
    const targetFor = (secs: number) => Math.round((totalWords * secs) / totalSecs);
    lines.push(`DOUBLE-CHECK BEFORE RENDERING — script must stay evenly spread across ${batches.length} segments (total ~${totalWords} words / ${totalSecs}s, ~${WORDS_PER_SEC} words per second):`);
    batches.forEach((b) => {
      lines.push(`- Segment ${b.index}: ~${b.wordCount} words for ~${b.batchSec}s (proportional target ~${targetFor(b.batchSec)} words for this ${b.batchSec}s slot). If any segment is much longer or shorter than its proportional target, rebalance the lines proportionally before rendering — do NOT render an uneven split.`);
    });
    lines.push(`If the script was edited, recount and re-split evenly first — never carry over a stale split.`);
    lines.push(``);
    lines.push(continuousLine);
    lines.push(``);
    batches.forEach((b) => {
      lines.push(`--- SEGMENT ${b.index} OF ${b.total} (~${b.batchSec}s voice + video) ---`);
      lines.push(`Say exactly (word-for-word, no paraphrase): "${b.text}"`);
      lines.push(segmentVisual(b.text, b.batchSec));
      lines.push(``);
    });
  }
  lines.push(`Requirements:`);
  lines.push(pacingLine);
  lines.push(likenessLine);
  lines.push(`- Total runtime: exactly ${durationSec} seconds in one continuous take — the voiceover starts immediately and finishes inside ${durationSec} seconds.`);
  lines.push(`- Voice pacing: this app aims for ~35 words per 10 seconds (~3.5 words/sec natural pace). If any segment has fewer than ~35 words per 10s, slow/stretch delivery slightly to fill its full slot; if more, quicken delivery slightly to fit — always landing each segment's last word exactly at its boundary with no cut-off and no trailing silence.`);
  lines.push(`- Tight endings: end each segment (and the whole video) the instant the last word is spoken — cut immediately with no pause, no trailing silence, and no hold on the last frame, so the final stitched video flows naturally with no time gaps.`);
  if (multi) lines.push(`- Each segment is ~10 seconds max of voice + video (${batches.map((b) => `${b.batchSec}s`).join(' + ')} = ${durationSec}s); keep segment boundaries clean for seamless joining.`);
  lines.push(`- Screen ratio: ${aspect} (${width}x${height}) — fill the full frame, no black bars, no cropping of the ${device} screen.`);
  lines.push(`- Platform: ${platformLabel}.`);
  lines.push(`- Vibe: ${vibeLabel.toLowerCase()} delivery and visuals.`);
  lines.push(visualReqLine);
  lines.push(audioLine);
  lines.push(`- No burned-in text overlays or auto-subtitles (captions are added later).`);
  lines.push(``);
  lines.push(sourceLine);
  return lines.join('\n');
}

/** One self-contained 10s Meta.ai prompt: its own voice + face + lines. */
export function buildBatchTestimonialPrompt(input: BatchTestimonialPromptInput): string {
  const { batch, speaker } = input;
  const music = storyMusicById(input.musicId || 'none');
  const showPerson = input.showPerson !== false;
  const person = voicePerson(speaker.voice);
  const poss = person === 'woman' ? 'her' : person === 'man' ? 'his' : 'their';
  const him = person === 'woman' ? 'her' : person === 'man' ? 'him' : 'them';
  const source = deviceSourceLabel(input.device);
  const screenNoun = input.device === 'Mobile phone' ? 'a phone screen' : `a ${String(input.device).toLowerCase()} screen`;
  const orientation = input.aspect === '16:9' ? 'landscape widescreen' : input.aspect === '1:1' ? 'square' : input.aspect === '4:5' ? 'vertical portrait' : 'vertical full-screen';
  const brandBit = input.brandName ? ` for ${input.brandName}` : '';
  const audioLine = music.prompt
    ? `- Audio: ${speaker.voice} voice front and center, clear studio quality. Underneath: ${music.prompt} at low background level (~-20dB, ducked while speaking) so the voice stays fully clear. No lyrics.`
    : `- Audio: ${speaker.voice} voice, clear studio quality. Voice only — no background music, no sound effects.`;
  const visualLine = showPerson
    ? `- Visual: ${speaker.appearance} speaking to camera as a happy-customer testimonial, using the app on ${poss} ${input.device}; cut between ${him} and close-ups of the attached ${source.toLowerCase()} screenshots on the ${input.device} screen. UI straight from attachments (never redesigned) but alive — taps, scrolling, popups. Bright, cinematic, real-app look.`
    : `- Visual: full-screen app footage only — attached ${source.toLowerCase()} screenshots fill ${screenNoun}, straight from attachments (never redesigned) but alive: taps, scrolls, popups. No person, actor, avatar, or face at any point. Bright, cinematic, real-app look.`;
  const openLine = showPerson
    ? `Make a video of a ${speaker.voice} voice saying: "${batch.text}" while showing ${speaker.appearance} speaking directly to camera as testimonial speaker ${batch.index}, using the app on ${poss} ${input.device} with the attached screenshots.`
    : `Make a voiceover video with a ${speaker.voice} voice saying: "${batch.text}" over full-screen app footage from the attached screenshots on ${screenNoun} — voiceover only, no person on camera, no actor, no avatar. This is Part ${batch.index} of ${batch.total}.`;
  const titleLine = showPerson
    ? `Make a ${batch.batchSec}-second ${orientation} customer-testimonial video (Part ${batch.index} of ${batch.total}, ${input.aspect}, ${input.width}x${input.height}) for ${input.platformLabel}${brandBit} with a ${input.vibeLabel.toLowerCase()} vibe.`
    : `Make a ${batch.batchSec}-second ${orientation} voiceover video (Part ${batch.index} of ${batch.total}, ${input.aspect}, ${input.width}x${input.height}) for ${input.platformLabel}${brandBit} with a ${input.vibeLabel.toLowerCase()} vibe.`;
  const isLast = batch.total > 1 && batch.index === batch.total;
  const fullLen = input.totalDurationSec || batch.total * batch.batchSec;
  const stitchLine = isLast
    ? `FINAL STEP — STITCH FIRST: you now have all ${batch.total} voice + video parts. Stitch/join them in order (Part 1 → Part ${batch.total}) into ONE finished ${fullLen}-second ${input.aspect} commercial for ${input.platformLabel} — matching ${input.vibeLabel.toLowerCase()} style throughout, tight cuts with no gaps between parts. Output/download that single stitched video as the final result (keep the individual parts too). If you cannot stitch in-app, export the parts separately in order and I will join them.`
    : '';
  const continuityLine = showPerson
    ? `This is a DIFFERENT speaker from the other parts — new face, new voice. Keep the SAME ${input.aspect} framing, SAME ${input.device} screen, SAME ${input.vibeLabel.toLowerCase()} style so the parts stitch into one ${batch.total}-person testimonial commercial. Do NOT repeat other parts' lines. Do NOT add an intro/outro.`
    : `This is a DIFFERENT voice from the other parts — new voice, same delivery style. Keep the SAME ${input.aspect} framing, SAME ${input.device} screen, SAME ${input.vibeLabel.toLowerCase()} style so the parts stitch into one ${batch.total}-part voiceover commercial. Do NOT repeat other parts' lines. Do NOT add an intro/outro.`;
  return [
    titleLine,
    ``,
    openLine,
    ``,
    continuityLine,
    ``,
    ...(isLast ? [stitchLine, ``] : []),
    `Requirements:`,
    `- Total runtime: exactly ${batch.batchSec} seconds — voiceover starts immediately and ends the instant the last word is spoken: cut immediately, no pause, no trailing silence, no hold on the last frame, so the stitched video flows with no gaps.`,
    `- Voice pacing: this app aims for ~35 words per 10 seconds (~3.5 words/sec natural pace). If this part has fewer than ~35 words per 10s, slow/stretch delivery slightly to fill the full ${batch.batchSec}s; if more, quicken delivery slightly to fit — always landing the last word exactly at the end with no cut-off and no trailing silence.`,
    `- Screen ratio: ${input.aspect} (${input.width}x${input.height}) — fill the full frame, no black bars.`,
    `- Platform: ${input.platformLabel}. Vibe: ${input.vibeLabel.toLowerCase()} delivery and visuals.`,
    visualLine,
    audioLine,
    `- Screenshot use (STRICT but ALIVE): every pixel of app UI comes from the attached screenshots — no redesign, no fake UI. You MAY show taps, scrolling, popups from the screenshots, and recombine cropped regions from the SAME set. All UI stays readable.`,
    `- No burned-in text overlays or auto-subtitles (captions are added later).`,
    ``,
    `I have attached screenshots of the ${source} — show them on the ${input.device} screen in this part, giving each screenshot fair screen time.`,
  ].join('\n');
}

export function copyText(text: string): Promise<void> {
  if (navigator?.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return Promise.reject(new Error('Clipboard unavailable'));
}

/** Voice-only MP3 prompt for Meta.ai — 10s batches, like video.
 * Meta.ai caps voice at ~10s per file too, so each ~10s part gets its own
 * paste + MP3. The N MP3s are concatenated in-app under Ken Burns motion. */
export function buildVoiceOnlyPrompt(fullText: string, voice: string): string {
  const line = (fullText || '').trim().replace(/\s+/g, ' ');
  return buildVoiceBatchPrompt({ text: line, index: 1, total: 1, batchSec: 10, voice });
}

export interface VoiceBatchPromptInput {
  text: string;
  index: number;
  total: number;
  batchSec: number;
  voice: string;
  totalDurationSec?: number;
}

/** One voice-only MP3 prompt per ~10s batch: Part i of n with its own lines.
 * Same voice across all parts of the commercial (one narrator), so parts
 * join seamlessly under the Ken Burns motion. The LAST part asks Meta.ai
 * to stitch all MP3s first (app join is the fallback). */
export function buildVoiceBatchPrompt(input: VoiceBatchPromptInput): string {
  const line = (input.text || '').trim().replace(/\s+/g, ' ');
  const partBit = input.total > 1 ? ` (Part ${input.index} of ${input.total})` : '';
  const isLast = input.total > 1 && input.index === input.total;
  const fullLen = input.totalDurationSec || input.total * input.batchSec;
  const stitchBit = isLast
    ? `\n\nFINAL STEP — STITCH FIRST: you now have all ${input.total} voice MP3 parts. Stitch/join them in order (Part 1 → Part ${input.total}) into ONE finished ~${fullLen}-second voiceover MP3 — same ${input.voice} voice throughout, tight cuts with no gaps or silence between parts. Output/download that single stitched MP3 as the final result (keep the individual parts too). If you cannot stitch in-app, export the parts separately in order and I will join them.`
    : '';
  return [
    `Make a ${input.batchSec}-second audio-only voiceover MP3 of a ${input.voice} voice saying word-for-word${partBit}: "${line}"`,
    ``,
    `Voice only — no video, no music, no sound effects, no background noise.`,
    `Clear studio quality, natural pacing, exact words only, in order. SAME voice as the other parts — one narrator for the whole commercial.`,
    `Voice pacing: this app aims for ~35 words per 10 seconds (~3.5 words/sec natural pace). If this part has fewer than ~35 words per 10s, slow/stretch delivery slightly to fill the full ~${input.batchSec}s; if more, quicken delivery slightly to fit — always landing the last word exactly at the end with no cut-off and no trailing silence.`,
    `One take, no intro/outro. Exactly ~${input.batchSec} seconds — start immediately, end the instant the last word is spoken, no trailing silence so the parts join with no gaps.${stitchBit}`,
  ].join('\n');
}

