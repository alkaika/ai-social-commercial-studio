import { create } from 'zustand';
import type { AdScript, BrandKit } from '@/lib/script-utils';
import type { SparkModelId } from '@/config/pricing';
import type { PlatformId } from '@/config/platforms';

export type Step = 'key' | 'writer' | 'sources' | 'brand' | 'configure' | 'script' | 'review' | 'export';

interface ProjectState {
  step: Step;
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
  set: (p: Partial<ProjectState>) => void;
}

const defaultBrand: BrandKit = {
  brandName: '', tagline: '', description: '', colors: ['#111111', '#ffffff'],
  cta: 'Shop now', offer: '', testimonials: [], pinned: [], avoidWords: [],
};

export const useProject = create<ProjectState>((set) => ({
  step: 'key',
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
  set: (p) => set(p),
}));
