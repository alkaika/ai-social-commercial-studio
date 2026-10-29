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
}

export type MotionSource = 'metai-upload' | 'kenburns';

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
  // Motion flow: [uploaded meta.ai clip] -> Ken Burns.
  // (Old saved projects may still carry motionSource 'wonder' — treated as
  // kenburns everywhere. Wonder retired 2026-10-27; all reasoning runs on
  // the user's chosen Spark writer.)
  motionSource?: MotionSource;
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
  const { target, max, hardMax } = targetWordRange(durationSec);
  const atMax = Math.round((wc / 2.5 / 1.2) * 10) / 10;
  return {
    wordCount: wc,
    targetWords: target,
    targetSec: durationSec,
    secAtNatural: Math.round((wc / 2.5) * 10) / 10,
    secAtMax: atMax,
    fitsNatural: wc <= max,
    fitsWithCadence: wc <= hardMax,
  };
}
export interface AdScript {
  scenes: ScriptScene[];
  totalSec: number;
  sparkModel: SparkModelId;
}

export const WORDS_PER_SEC = 2.5; // ~150 wpm at 1.0x cadence

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

/** Natural-pace word budget for a slot. Drafts aim inside [min, max] at 1.0x. */
export function targetWordRange(durationSec: number): { target: number; min: number; max: number; hardMax: number } {
  const target = Math.round(durationSec * WORDS_PER_SEC);
  return {
    target,
    min: Math.max(5, Math.floor(target * 0.85)),
    max: target + 2,
    // Fastest natural cadence ceiling — beyond this even 1.2x cannot fit.
    hardMax: Math.floor(durationSec * WORDS_PER_SEC * MAX_CADENCE),
  };
}

/** Guarantee a draft fits the slot before approval: trim (hook + CTA preserved) only when over the natural max. */
export function constrainToWordRange(text: string, durationSec: number): { text: string; wordCount: number; targetWords: number; adjusted: boolean } {
  const range = targetWordRange(durationSec);
  const wc = countWords(text);
  if (wc <= range.max) return { text: text.trim(), wordCount: wc, targetWords: range.target, adjusted: false };
  const trimmed = trimWords(text, range.target);
  return { text: trimmed, wordCount: countWords(trimmed), targetWords: range.target, adjusted: true };
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
