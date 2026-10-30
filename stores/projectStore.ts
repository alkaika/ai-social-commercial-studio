import { create } from 'zustand';
import type { AdScript, BrandKit } from '@/lib/script-utils';
import type { SparkModelId } from '@/config/pricing';
import type { PlatformId } from '@/config/platforms';
import { usePrefs } from '@/stores/preferences';

export type Step = 'key' | 'writer' | 'sources' | 'brand' | 'configure' | 'script' | 'review' | 'export';

const freshId = () => {
  try {
    const c = globalThis.crypto as unknown as { randomUUID?: () => string } | undefined;
    if (c?.randomUUID) return `p_${c.randomUUID().slice(0, 8)}`;
  } catch { /* fallback */ }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};

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
    scriptGuidance: string; step?: Step;
  }) => void;
}

const defaultBrand: BrandKit = {
  brandName: '', tagline: '', description: '', colors: ['#111111', '#ffffff'],
  cta: 'Shop now', offer: '', testimonials: [], pinned: [], avoidWords: [],
};

export const useProject = create<ProjectState>((set) => ({
  step: 'key',
  projectId: freshId(),
  projectName: '',
  durationSec: 15,
  platform: 'tiktok',
  tone: 'friendly',
  sparkModel: 'spark-contributor',
  brand: defaultBrand,
  urls: [],
  snippets: [],
  assets: [],
  script: null,
  masterScript: '',
  masterApproved: false,
  scriptGuidance: '',
  set: (p) => set(p),
  newFreshProject: () => set({
    step: 'key',
    projectId: freshId(),
    projectName: '',
    durationSec: 15,
    platform: 'tiktok',
    tone: 'friendly',
    sparkModel: usePrefs.getState().lastWriter || 'spark-contributor',
    brand: { ...defaultBrand },
    urls: [],
    snippets: [],
    assets: [],
    script: null,
    masterScript: '',
    masterApproved: false,
    scriptGuidance: '',
  }),
  openProject: (p) => set({
    step: p.step && p.step !== 'key' && p.step !== 'writer' ? p.step : 'sources',
    projectId: p.projectId || p.id || freshId(),
    projectName: p.projectName || p.name || '',
    durationSec: p.durationSec,
    platform: p.platform,
    tone: p.tone,
    sparkModel: p.sparkModel,
    brand: p.brand,
    urls: p.urls || [],
    snippets: p.snippets || [],
    assets: p.assets || [],
    script: p.script,
    masterScript: p.masterScript || '',
    masterApproved: !!p.masterApproved,
    scriptGuidance: p.scriptGuidance || '',
  }),
}));
