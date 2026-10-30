// Meta AI Clip SDK — types.
// Honest boundary (verified 2026-10-27 against https://dev.meta.ai/docs):
// Meta Model API has NO text-to-speech and NO text-to-video endpoint.
// Voice + motion clips are authored in the consumer meta.ai app, then
// this SDK handles everything around that: prompt building, background
// ingest, validation, and auto-attach to the Storyboard store.

export type ClipKind = 'voice' | 'video';

export type ClipJobStatus =
  | 'prompt-ready' // prompt built, waiting for user to make clip at meta.ai
  | 'waiting-for-clip' // user opened meta.ai, no file yet
  | 'ingesting' // file picked, validating in background
  | 'attached' // auto-uploaded to Storyboard scene
  | 'error';

export interface ClipJob {
  id: string;
  sceneId: string;
  kind: ClipKind;
  prompt: string;
  metaAiUrl: string; // deep-link / help URL (meta.ai has no API, so this opens the app)
  status: ClipJobStatus;
  fileName?: string;
  objectUrl?: string;
  durationSec?: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface VoiceClipOptions {
  voice?: string; // e.g. 'warm female, energetic'
  speed?: number; // cadence hint, passed through for timing only
}

export interface VideoClipOptions {
  aspect?: string; // e.g. '9:16'
  visualPrompt?: string;
}

export interface IngestedClip {
  sceneId: string;
  kind: ClipKind;
  file: File;
  objectUrl: string;
  durationSec?: number;
}
