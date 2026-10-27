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
}

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
