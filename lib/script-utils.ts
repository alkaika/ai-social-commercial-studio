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

export const WORDS_PER_SEC = 2.5; // ~150 wpm

export function wordsToSec(words: string) {
  const n = words.trim().split(/\s+/).filter(Boolean).length;
  return n / WORDS_PER_SEC;
}

export function fitsDuration(script: AdScript, targetSec: number) {
  const spoken = script.scenes.reduce((a, s) => a + wordsToSec(s.voiceover), 0);
  return { spoken, target: targetSec, ok: spoken <= targetSec + 1, overBy: Math.max(0, spoken - targetSec) };
}
