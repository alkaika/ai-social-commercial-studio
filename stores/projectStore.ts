import { create } from 'zustand';
import type { AdScript, BrandKit } from '@/lib/script-utils';
import type { SparkModelId } from '@/config/pricing';
import { normalizeDurationSec, type PlatformId } from '@/config/platforms';
import { usePrefs } from '@/stores/preferences';
import { JUDGING_MODE } from '@/lib/judging';

export type Step = 'key' | 'writer' | 'sources' | 'brand' | 'configure' | 'script' | 'review' | 'export';

const freshId = () => {
  try {
    const c = globalThis.crypto as unknown as { randomUUID?: () => string } | undefined;
    if (c?.randomUUID) return `p_${c.randomUUID().slice(0, 8)}`;
  } catch { /* fallback */ }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};

export type StoryMode = 'people' | 'voices-meta' | 'voice-kenburns';

interface ProjectState {
  step: Step;
  projectId: string;
  projectName: string;
  durationSec: number;
  platform: PlatformId;
  tone: string;
  sparkModel: SparkModelId;
  brand: BrandKit;
  urls: string[];
  snippets: { id: string; kind: string; text: string; pinned: boolean }[];
  assets: { id: string; name: string; url: string; tag: string }[];
  script: AdScript | null;
  // Story mode: how voice + visuals are produced.
  // 'people' = Meta.ai testimonial video parts (person on camera).
  // 'voices-meta' = Meta.ai voiceover video parts over screenshots.
  // 'voice-kenburns' = Meta.ai voice-only MP3 (single file, no batching)
  //   + in-app Ken Burns over the user's screenshots/images.
  storyMode: StoryMode;
  // Voice-only MP3 (mode 3): object URL for the uploaded Meta.ai MP3 +
  // original file name. Blob itself lives in Dexie (`{projectId}:voice-full`).
  voiceMp3Url: string;
  voiceMp3Name: string;
  // Master (final) script: cohesive brand narrative drafted on the Business
  // page right after the website scan, edited + approved by the user.
  // The timed Storyboard script is ORGANIZED from this — never reinvented.
  masterScript: string;
  masterApproved: boolean;
  // Guidance chat: what the user wants the script to focus on / exclude.
  // Sent to Spark with every master draft; editable before each re-draft.
  scriptGuidance: string;
  set: (p: Partial<ProjectState>) => void;
  newFreshProject: () => void;
  openProject: (p: {
    projectId?: string; id?: string; name?: string; projectName?: string;
    durationSec: number; platform: PlatformId; tone: string;
    sparkModel: SparkModelId; brand: BrandKit; urls: string[];
    snippets: { id: string; kind: string; text: string; pinned: boolean }[];
    assets: { id: string; name: string; url: string; tag: string }[];
    script: AdScript | null; masterScript: string; masterApproved: boolean;
    scriptGuidance: string; step?: Step; storyMode?: StoryMode;
    voiceMp3Name?: string;
  }) => void;
}

const defaultBrand: BrandKit = {
  brandName: '', tagline: '', description: '', colors: ['#111111', '#ffffff'],
  cta: 'Shop now', offer: '', testimonials: [], pinned: [], avoidWords: [],
};

export const useProject = create<ProjectState>((set) => ({
  // Judging mode boots straight at Writer (Key step hidden); normal BYOK boots at Key.
  step: JUDGING_MODE ? 'writer' : 'key',
  projectId: freshId(),
  projectName: '',
  durationSec: 20,
  platform: 'tiktok',
  tone: 'friendly',
  sparkModel: 'spark-contributor',
  brand: defaultBrand,
  urls: [],
  snippets: [],
  assets: [],
  script: null,
  storyMode: 'people',
  voiceMp3Url: '',
  voiceMp3Name: '',
  masterScript: '',
  masterApproved: false,
  scriptGuidance: '',
  set: (p) => set(
    (p as any).durationSec !== undefined
      ? { ...p, durationSec: normalizeDurationSec((p as any).durationSec) }
      : p
  ),
  newFreshProject: () => set({
    // New projects also skip Key while judging (fresh start lands on Writer).
    step: JUDGING_MODE ? 'writer' : 'key',
    projectId: freshId(),
    projectName: '',
    durationSec: 20,
    platform: 'tiktok',
    tone: 'friendly',
    sparkModel: usePrefs.getState().lastWriter || 'spark-contributor',
    brand: { ...defaultBrand },
    urls: [],
    snippets: [],
    assets: [],
    script: null,
    storyMode: 'people',
    voiceMp3Url: '',
    voiceMp3Name: '',
    masterScript: '',
    masterApproved: false,
    scriptGuidance: '',
  }),
  openProject: (p) => set({
    step: p.step && p.step !== 'key' && p.step !== 'writer' ? p.step : 'sources',
    projectId: p.projectId || p.id || freshId(),
    projectName: p.projectName || p.name || '',
    durationSec: normalizeDurationSec((p as any).durationSec),
    platform: p.platform,
    tone: p.tone,
    sparkModel: p.sparkModel,
    brand: p.brand,
    urls: p.urls || [],
    snippets: p.snippets || [],
    assets: p.assets || [],
    script: p.script,
    storyMode: (p as any).storyMode || 'people',
    voiceMp3Url: '',
    voiceMp3Name: (p as any).voiceMp3Name || '',
    masterScript: p.masterScript || '',
    masterApproved: !!p.masterApproved,
    scriptGuidance: p.scriptGuidance || '',
  }),
}));
