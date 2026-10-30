// Project JSON persistence (localStorage) — text/config only, never blobs.
// Blob footage lives in Dexie (lib/clips/db.ts); blob: URLs are stripped
// on save and re-attached from Dexie on load by PersistGate.
import type { AdScript, BrandKit } from '@/lib/script-utils';
import type { PlatformId } from '@/config/platforms';
import type { SparkModelId } from '@/config/pricing';

export interface PersistedProject {
  v: 1;
  durationSec: number;
  platform: PlatformId;
  tone: string;
  sparkModel: SparkModelId;
  brand: BrandKit;
  urls: string[];
  snippets: { id: string; kind: string; text: string; pinned: boolean }[];
  assets: { id: string; name: string; url: string; tag: string }[];
  script: AdScript | null;
  masterScript: string;
  masterApproved: boolean;
  scriptGuidance: string;
  savedAt: number;
}

const LS_KEY = 'meta-studio-project-v1';

function stripBlobUrls<T>(v: T): T {
  try {
    const s = JSON.stringify(v, (k, val) => {
      if ((k === 'url' || k === 'voiceClipUrl' || k === 'voiceUrl' || k === 'videoUrl') && typeof val === 'string' && val.startsWith('blob:')) return '';
      return val;
    });
    return JSON.parse(s);
  } catch {
    return v;
  }
}

export function saveProjectLocal(p: Omit<PersistedProject, 'v' | 'savedAt'>): void {
  try {
    const clean = stripBlobUrls(p);
    const rec: PersistedProject = { v: 1, savedAt: Date.now(), ...clean };
    localStorage.setItem(LS_KEY, JSON.stringify(rec));
  } catch { /* quota or private mode — ignore */ }
}

export function loadProjectLocal(): PersistedProject | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (!j || j.v !== 1) return null;
    return j as PersistedProject;
  } catch {
    return null;
  }
}

export function clearProjectLocal(): void {
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
}
