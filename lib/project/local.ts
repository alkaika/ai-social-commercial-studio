// Project library persistence (localStorage) — text/config only, never blobs.
// Blob footage lives in Dexie (lib/clips/db.ts); blob: URLs are stripped
// on save and re-attached from Dexie on open by ProjectBar.
// Behavior: app ALWAYS starts fresh. Nothing auto-loads.
// Users explicitly Save / Open / Delete named projects from studio header.
// Legacy single-slot autosave (meta-studio-project-v1) is migrated once into
// the library as a "Recovered project" so no prior work is lost.
import type { AdScript, BrandKit } from '@/lib/script-utils';
import type { PlatformId } from '@/config/platforms';
import type { SparkModelId } from '@/config/pricing';
import type { Step } from '@/stores/projectStore';

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
  step?: Step;
  savedAt: number;
}

export interface NamedProject extends PersistedProject {
  id: string;
  name: string;
  updatedAt: number;
}

const LEGACY_KEY = 'meta-studio-project-v1';
const LIB_KEY = 'meta-studio-projects-v1';

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

export function newProjectId(): string {
  try {
    const c = globalThis.crypto as unknown as { randomUUID?: () => string } | undefined;
    if (c?.randomUUID) return `p_${c.randomUUID().slice(0, 8)}`;
  } catch { /* fallback below */ }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function suggestProjectName(p: Partial<PersistedProject>): string {
  const brand = (p.brand as BrandKit | undefined)?.brandName?.trim();
  const d = new Date();
  const date = `${d.getMonth() + 1}/${d.getDate()}`;
  return brand ? `${brand} — ${date}` : `Untitled commercial — ${date}`;
}

type LibShape = Record<string, NamedProject>;

function readLib(): LibShape {
  try {
    const raw = localStorage.getItem(LIB_KEY);
    if (!raw) return {};
    const j = JSON.parse(raw);
    if (!j || typeof j !== 'object') return {};
    if (Array.isArray(j)) {
      const out: LibShape = {};
      for (const r of j) if (r && r.id) out[r.id] = r as NamedProject;
      return out;
    }
    return j as LibShape;
  } catch {
    return {};
  }
}

function writeLib(lib: LibShape): void {
  try {
    localStorage.setItem(LIB_KEY, JSON.stringify(lib));
  } catch { /* quota or private mode — ignore */ }
}

export function listProjectsLocal(): NamedProject[] {
  const lib = readLib();
  return Object.values(lib).sort((a, b) => (b.updatedAt || b.savedAt || 0) - (a.updatedAt || a.savedAt || 0));
}

export function getProjectLocal(id: string): NamedProject | null {
  try {
    return readLib()[id] || null;
  } catch {
    return null;
  }
}

export function saveNamedProject(id: string, name: string, p: Omit<PersistedProject, 'v' | 'savedAt'>): NamedProject {
  const clean = stripBlobUrls(p);
  const now = Date.now();
  const rec: NamedProject = { v: 1, savedAt: now, updatedAt: now, ...clean, id, name: name.trim() || suggestProjectName(clean) };
  const lib = readLib();
  const prev = lib[id];
  if (prev?.savedAt) rec.savedAt = prev.savedAt;
  lib[id] = rec;
  writeLib(lib);
  return rec;
}

export function deleteProjectLocal(id: string): void {
  try {
    const lib = readLib();
    delete lib[id];
    writeLib(lib);
  } catch { /* ignore */ }
}

export function renameProjectLocal(id: string, name: string): NamedProject | null {
  try {
    const lib = readLib();
    const prev = lib[id];
    if (!prev) return null;
    prev.name = name.trim() || prev.name;
    prev.updatedAt = Date.now();
    writeLib(lib);
    return prev;
  } catch {
    return null;
  }
}

/** Legacy single-slot autosave (pre-library). Returns null when absent. */
export function loadLegacyProjectLocal(): PersistedProject | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (!j || j.v !== 1) return null;
    return j as PersistedProject;
  } catch {
    return null;
  }
}

export function clearLegacyProjectLocal(): void {
  try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
}

/** One-time migration: library empty + legacy autosave exists => import it. */
export function migrateLegacyIfNeeded(): NamedProject | null {
  try {
    const keys = Object.keys(readLib());
    if (keys.length > 0) return null;
    const legacy = loadLegacyProjectLocal();
    if (!legacy) return null;
    const id = newProjectId();
    const base = suggestProjectName(legacy);
    const name = base.replace('Untitled commercial', 'Recovered project');
    return saveNamedProject(id, name, {
      durationSec: legacy.durationSec, platform: legacy.platform, tone: legacy.tone,
      sparkModel: legacy.sparkModel, brand: legacy.brand, urls: legacy.urls || [],
      snippets: legacy.snippets || [], assets: legacy.assets || [], script: legacy.script,
      masterScript: legacy.masterScript || '', masterApproved: !!legacy.masterApproved,
      scriptGuidance: legacy.scriptGuidance || '',
    });
  } catch {
    return null;
  }
}

// Back-compat: old PersistGate imports these; new code uses named library.
export function saveProjectLocal(p: Omit<PersistedProject, 'v' | 'savedAt'>): void {
  try {
    const clean = stripBlobUrls(p);
    const rec: PersistedProject = { v: 1, savedAt: Date.now(), ...clean };
    localStorage.setItem(LEGACY_KEY, JSON.stringify(rec));
  } catch { /* ignore */ }
}
export function loadProjectLocal(): PersistedProject | null {
  return loadLegacyProjectLocal();
}
export function clearProjectLocal(): void {
  clearLegacyProjectLocal();
}
