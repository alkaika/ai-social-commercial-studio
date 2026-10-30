// Meta AI Clip SDK — public wrapper.
// Use from any page: builds meta.ai prompts, tracks background jobs,
// ingests files, and auto-uploads (attaches) clips to the Storyboard.
//
// Meta boundary: no TTS / video-generation endpoint exists on
// https://dev.meta.ai/docs — clips are made at https://www.meta.ai.
// This SDK automates everything around that step.

export * from './types';
export * from './prompts';
export * from './ingest';
export * from './watcher';

import type { ScriptScene } from '@/lib/script-utils';
import type { ClipKind, ClipJob, IngestedClip } from './types';
import { buildVoicePrompt, buildVideoPrompt, META_AI_URL } from './prompts';
import { matchFileToScene } from './ingest';

export interface MetaClipSDKOptions {
  voice?: string;
  aspect?: string;
  brandName?: string;
  /** Called in background right after each clip attaches to Storyboard. */
  onAttached?: (job: ClipJob, clip: IngestedClip) => void;
  onError?: (job: ClipJob, error: Error) => void;
}

export class MetaClipSDK {
  voice: string;
  aspect: string;
  brandName: string;
  onAttached?: MetaClipSDKOptions['onAttached'];
  onError?: MetaClipSDKOptions['onError'];

  constructor(opts: MetaClipSDKOptions = {}) {
    this.voice = opts.voice || 'warm female, energetic';
    this.aspect = opts.aspect || '9:16';
    this.brandName = opts.brandName || '';
    this.onAttached = opts.onAttached;
    this.onError = opts.onError;
  }

  get metaAiUrl() {
    return META_AI_URL;
  }

  /** One-click prompts for every scene — copy into meta.ai. */
  promptsFor(scenes: ScriptScene[]): { sceneId: string; kind: ClipKind; prompt: string }[] {
    return scenes.flatMap((s) => [
      { sceneId: s.id, kind: 'voice' as ClipKind, prompt: buildVoicePrompt(s, this.voice) },
      { sceneId: s.id, kind: 'video' as ClipKind, prompt: buildVideoPrompt(s, this.aspect, this.brandName) },
    ]);
  }

  promptFor(scene: ScriptScene, kind: ClipKind): string {
    return kind === 'voice' ? buildVoicePrompt(scene, this.voice) : buildVideoPrompt(scene, this.aspect, this.brandName);
  }

  matchFile(fileName: string) {
    return matchFileToScene(fileName);
  }

  /**
   * Background ingest + auto-upload to Storyboard.
   * Safe to call from a drop handler — validates off-flow, probes
   * duration, writes the object URL into useProject, and resolves
   * with the clip. Never blocks the UI.
   */
  async ingestAndAttach(job: ClipJob, file: File): Promise<IngestedClip> {
    // Delegate to the background job store (single ingest path).
    const { useClipJobs } = (await import('@/stores/clipJobsStore')) as typeof import('@/stores/clipJobsStore');
    const before = useClipJobs.getState().jobs.find((j) => j.id === job.id);
    await useClipJobs.getState().ingestAndAttach(job.id, file);
    const after =
      useClipJobs.getState().jobs.find((j) => j.id === job.id) ?? before ?? job;
    if (after.status === 'error') {
      const err = new Error(after.error || 'Ingest failed');
      this.onError?.(after, err);
      throw err;
    }
    const clip: IngestedClip = {
      sceneId: after.sceneId,
      kind: after.kind,
      file,
      objectUrl: after.objectUrl || '',
      durationSec: after.durationSec,
    };
    this.onAttached?.(after, clip);
    return clip;
  }
}

/** Default singleton for the Storyboard page. */
export const metaClipSDK = new MetaClipSDK();
