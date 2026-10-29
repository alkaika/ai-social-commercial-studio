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

export type MotionSource = 'metai-upload' | 'wonder' | 'kenburns';

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
  // ('wonder' value is reserved — Meta has no video-generation endpoint today.)
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

export function trimWords(masterScript: string, targetWords: number) {
  const words = masterScript.trim().split(/\s+/).filter(Boolean);
  if (words.length <= targetWords) return masterScript.trim();
  // Keep hook (first 20%) + offer/CTA (last 15%), trim the middle proof section.
  const head = Math.max(10, Math.round(targetWords * 0.35));
  const tail = Math.max(8, Math.round(targetWords * 0.25));
  const mid = Math.max(0, targetWords - head - tail);
  const midWords = words.slice(head, head + Math.max(20, mid * 2)).slice(0, mid);
  return [...words.slice(0, head), ...midWords, ...words.slice(-tail)].join(' ');
}
