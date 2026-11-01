import type { SparkModelId } from '@/config/pricing';

export interface BrandKit {
  brandName: string;
  tagline: string;
  description: string;
  colors: string[];
  logoUrl?: string;
  cta: string;
  offer?: string;
  testimonials: string[];
  pinned: string[]; // must-use-verbatim snippets
  avoidWords: string[];
  aboutStory?: string;   // cohesive brand story (homepage + about page merged)
  aboutPoints?: string[]; // story beats: founding, mission, differentiators
  aboutSource?: string;   // which about URL it came from
  sitePages?: string[];   // main site pages (sitemap + nav, up to 12) for screenshots
}

export type MotionSource = 'metai-upload' | 'kenburns' | 'screenshot';

export interface ScriptScene {
  id: string;
  heading: string;
  voiceover: string;
  onScreenText: string;
  visualPrompt: string;
  durationSec: number;
  locked?: boolean;
  voiceUrl?: string;
  imageUrl?: string;
  cadence?: number; // per-scene voice speed 0.85–1.2 (default 1). Final mix honors this.
  // Trim recommendation: set when the full approved script can't fit even at
  // 1.2x. { trimmed } is the suggested shorter wording — user approves per scene.
  trimSuggestion?: string;
  trimApproved?: boolean;
  // Motion flow: [uploaded meta.ai clip] -> [website screenshot] -> Ken Burns.
  // (Old saved projects may still carry motionSource 'wonder' — treated as
  // kenburns everywhere. Wonder retired 2026-10-27; all reasoning runs on
  // the user's chosen Spark writer.)
  motionSource?: MotionSource;
  screenshotPageUrl?: string; // which site page the screenshot was rendered from
  videoUrl?: string; // object URL or remote URL for uploaded meta.ai clip
  muteSourceAudio?: boolean; // strip/duck baked-in motion-clip audio when layering VO (default true)
  // Voice-over sources (Meta has NO TTS endpoint on the API):
  // - 'metai-clip': audio baked into an uploaded meta.ai text-to-voice video
  //   ("Make a video of a warm female voice saying: '...'"). Set voiceUrl to
  //   the clip URL and keep clip sound ON.
  // - 'upload' | 'record': user-provided audio (future record button).
  // - default/undefined: script text is the source of truth; captions derive
  //   from it until final-mix transcription via /v1/asr/transcribe.
  voiceSource?: 'metai-clip' | 'upload' | 'record';
  voiceClipUrl?: string; // audio or video URL used as the actual VO audio
  storyBeat?: string; // which brand truth this scene dramatizes
}

/** Live timing readout for the Business page master editor. */
export function masterFit(masterScript: string, durationSec: number) {
  const wc = countWords(masterScript || '');
  const { target, hardMax } = targetWordRange(durationSec);
  const atMax = Math.round((wc / WORDS_PER_SEC / MAX_CADENCE) * 10) / 10;
  return {
    wordCount: wc,
    targetWords: target,
    targetSec: durationSec,
    wordsDelta: wc - target,
    isExact: wc === target,
    secAtNatural: Math.round((wc / WORDS_PER_SEC) * 10) / 10,
    secAtMax: atMax,
    fitsNatural: wc === target,
    fitsWithCadence: wc <= hardMax,
  };
}
export interface AdScript {
  scenes: ScriptScene[];
  totalSec: number;
  sparkModel: SparkModelId;
}

export const WORDS_PER_SEC = 3.5; // ~210 wpm at 1.0x cadence — 35 words per 10s, 210 per 60s

// Cadence bounds: 0.85x (slow, emphatic) to 1.2x (brisk, energetic).
// Outside this range speech sounds unnatural — that's the trim trigger.
export const MIN_CADENCE = 0.85;
export const MAX_CADENCE = 1.2;

export function wordsToSec(words: string, cadence = 1) {
  const n = words.trim().split(/\s+/).filter(Boolean).length;
  return n / (WORDS_PER_SEC * cadence);
}

export function fitsDuration(script: AdScript, targetSec: number, cadence = 1) {
  const spoken = script.scenes.reduce((a, s) => a + wordsToSec(s.voiceover, cadence), 0);
  return { spoken, target: targetSec, ok: spoken <= targetSec + 1, overBy: Math.max(0, spoken - targetSec) };
}

/** Best cadence that fits the slot without trimming. Null = even 1.2x can't fit → recommend a trim. */
export function bestCadence(script: AdScript, targetSec: number): { cadence: number; fits: boolean; spokenAtMax: number } {
  const spokenAtMax = script.scenes.reduce((a, s) => a + wordsToSec(s.voiceover, MAX_CADENCE), 0);
  if (spokenAtMax <= targetSec + 1) {
    // Slowest cadence that still fits (prefer natural delivery).
    for (let c = MIN_CADENCE; c <= MAX_CADENCE + 1e-9; c += 0.05) {
      const spoken = script.scenes.reduce((a, s) => a + wordsToSec(s.voiceover, c), 0);
      if (spoken <= targetSec + 1) return { cadence: Math.round(c * 100) / 100, fits: true, spokenAtMax };
    }
  }
  return { cadence: MAX_CADENCE, fits: false, spokenAtMax };
}

export function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Neutral, brand-safe filler words used ONLY as a last-resort local backstop
 *  to pad a short draft up to the exact target (LLM retry is tried first).
 *  Generic commercial language — no invented claims, dates, or stats. */
const EXACT_FILLER_WORDS =
  `Bring a friend, stay for the flavor, come back soon. Fresh daily, made with care, served with a smile. Taste the difference today and see you soon again`.split(/\s+/).filter(Boolean);

/** Deterministically fit any text to EXACTLY targetWords.
 *  Over → trimWords (hook + CTA preserved). Under → append filler words
 *  sliced to the exact deficit. */
export function fitToExactWordCount(text: string, targetWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === targetWords) return text.trim();
  if (words.length > targetWords) return trimWords(text, targetWords);
  const need = targetWords - words.length;
  const pad: string[] = [];
  for (let i = 0; pad.length < need; i++) pad.push(EXACT_FILLER_WORDS[i % EXACT_FILLER_WORDS.length]);
  return [...words, ...pad].join(' ');
}

/** Natural-pace word budget for a slot. Drafts aim for EXACTLY target at 1.0x. */
export function targetWordRange(durationSec: number): { target: number; min: number; max: number; hardMax: number } {
  const target = Math.round(durationSec * WORDS_PER_SEC);
  return {
    target,
    min: target,
    max: target,
    // Fastest natural cadence ceiling — beyond this even 1.2x cannot fit.
    hardMax: Math.floor(durationSec * WORDS_PER_SEC * MAX_CADENCE),
  };
}

/** Guarantee a draft hits the EXACT word target: over → trimWords
 *  (hook + CTA preserved); under → local filler backstop so the draft is
 *  never short. LLM retry is always tried first (see spark.ts) — this is
 *  the deterministic last resort. */
export function constrainToWordRange(text: string, durationSec: number): { text: string; wordCount: number; targetWords: number; adjusted: boolean } {
  const range = targetWordRange(durationSec);
  const wc = countWords(text);
  if (wc === range.target) return { text: text.trim(), wordCount: wc, targetWords: range.target, adjusted: false };
  const fitted = fitToExactWordCount(text, range.target);
  return { text: fitted, wordCount: countWords(fitted), targetWords: range.target, adjusted: true };
}

export function trimWords(masterScript: string, targetWords: number) {
  const words = masterScript.trim().split(/\s+/).filter(Boolean);
  if (words.length <= targetWords) return masterScript.trim();
  if (targetWords <= 0) return '';
  // Keep hook (first 45%) + offer/CTA (last 30%), sample the middle proof
  // section — preserves the story arc while hitting the exact budget.
  const headCount = Math.min(words.length, Math.floor(targetWords * 0.45));
  const tailCount = Math.min(words.length - headCount, Math.floor(targetWords * 0.3));
  const midCount = Math.max(0, targetWords - headCount - tailCount);
  const midStart = Math.max(headCount, Math.floor((words.length - midCount) / 2));
  return [...words.slice(0, headCount), ...words.slice(midStart, midStart + midCount), ...words.slice(words.length - tailCount)].join(' ');
}
