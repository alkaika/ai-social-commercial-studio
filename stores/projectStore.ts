import { create } from 'zustand';
import type { AdScript, BrandKit } from '@/lib/script-utils';
import type { SparkModelId } from '@/config/pricing';
import { normalizeDurationSec, type PlatformId } from '@/config/platforms';
import { usePrefs } from '@/stores/preferences';
import { JUDGING_BUILD } from '@/lib/judging';

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
  // 'voice-kenburns' = Meta.ai voice-only MP3s, one per ~10s part (same
  //   10s cap as video) + in-app Ken Burns over screenshots/images.
  //   N MP3s are concatenated in Export under the motion.
  storyMode: StoryMode;
  // Voice-only MP3s (mode 3): object URLs for the uploaded per-part MP3s +
  // original file names. Blobs live in Dexie (`{projectId}:voice-part-{i}`).
  voicePartUrls: string[];
  voicePartNames: string[];
  // Meta.ai's already-stitched voice file (MP3/MP4) + its name. When set,
  // Export skips the per-part join — the app only adds Ken Burns motion.
  // Blob lives in Dexie (`{projectId}:voice-stitched`).
  stitchedVoiceUrl: string;
  stitchedVoiceName: string;
  // Master (final) script: cohesive brand narrative drafted on the Business
  // page right after the website scan, edited + approved by the user.
  // The timed Storyboard script is ORGANIZED from this — never reinvented.
  masterScript: string;
  masterApproved: boolean;
  // Per-part script tweaks on Story: minor word-only edits to each ~10s
  // prompt part without redrafting. Keyed by part index; merged into
  // masterScript/script on Continue and persisted with the project.
  storyPartEdits: Record<number, string>;
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
    voicePartNames?: string[]; stitchedVoiceName?: string;
    storyPartEdits?: Record<number, string>;
  }) => void;
}

const defaultBrand: BrandKit = {
  brandName: '', tagline: '', description: '', colors: ['#111111', '#ffffff'],
  cta: 'Shop now', offer: '', testimonials: [], pinned: [], avoidWords: [],
};

export const useProject = create<ProjectState>((set) => ({
  // Boot/new step follows the BUILD flag (SSR-safe: judging builds boot at
  // Writer, BYOK builds at Key). The studio page corrects to the runtime view
  // (?build=byok preview) client-side once the toggle resolves.
  step: JUDGING_BUILD ? 'writer' : 'key',
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
  voicePartUrls: [],
  voicePartNames: [],
  stitchedVoiceUrl: '',
  stitchedVoiceName: '',
  masterScript: '',
  masterApproved: false,
  storyPartEdits: {},
  scriptGuidance: '',
  set: (p) => set(
    (p as any).durationSec !== undefined
      ? { ...p, durationSec: normalizeDurationSec((p as any).durationSec) }
      : p
  ),
  newFreshProject: () => set({
    // New projects also skip Key in judging builds (fresh start lands on Writer).
    step: JUDGING_BUILD ? 'writer' : 'key',
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
    voicePartUrls: [],
    voicePartNames: [],
    stitchedVoiceUrl: '',
    stitchedVoiceName: '',
    masterScript: '',
    masterApproved: false,
    storyPartEdits: {},
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
    voicePartUrls: [],
    voicePartNames: (p as any).voicePartNames || [],
    stitchedVoiceUrl: '',
    stitchedVoiceName: (p as any).stitchedVoiceName || '',
    masterScript: p.masterScript || '',
    masterApproved: !!p.masterApproved,
    storyPartEdits: (p as any).storyPartEdits || {},
    scriptGuidance: p.scriptGuidance || '',
  }),
}));
