// Local clip persistence via Dexie (IndexedDB).
// Why Dexie, not /public or S3:
// - /public is build-time read-only on serverless hosts.
// - S3 would break the BYOK promise (you'd pay/host user footage).
// - IndexedDB keeps blobs on-device, survives refresh, works offline,
//   zero server cost, zero privacy change.
import Dexie, { type Table } from 'dexie';

export interface StoredBlob {
  key: string; // {projectId}:scene:s1:voice | {projectId}:scene:s1:video | {projectId}:asset:<id>
  // Namespaced per project so the library can hold many commercials.
  // Legacy rows (pre-library) have no projectId — migrated on first run.
  projectId?: string;
  sceneId?: string;
  kind?: string; // voice | video | asset
  assetId?: string;
  blob: Blob;
  name: string;
  mime: string;
  durationSec?: number;
  updatedAt: number;
}

export interface StoredPref {
  key: string; // 'watchFolder' — a user-granted FileSystemDirectoryHandle
  value: unknown; // structured-clonable values only (handles are, in Chromium)
}

class ClipsDB extends Dexie {
  blobs!: Table<StoredBlob, string>;
  prefs!: Table<StoredPref, string>;
  constructor() {
    super('meta-studio-clips');
    // v2 adds `prefs` for small settings (watched-downloads folder handle).
    // Same blobs schema + new store only → v1 databases upgrade in place.
    this.version(1).stores({ blobs: 'key, sceneId, kind, assetId' });
    this.version(2).stores({ blobs: 'key, sceneId, kind, assetId', prefs: 'key' });
    // v3 adds `projectId` index so the project library can namespace footage
    // per saved project. No data loss — old rows upgrade in place.
    this.version(3).stores({ blobs: 'key, projectId, sceneId, kind, assetId', prefs: 'key' });
  }
}

export const clipsDb = new ClipsDB();

export async function saveStoredBlob(rec: StoredBlob): Promise<void> {
  await clipsDb.blobs.put(rec);
}

export async function getStoredBlob(key: string): Promise<StoredBlob | undefined> {
  try {
    return await clipsDb.blobs.get(key);
  } catch {
    return undefined;
  }
}

export async function getBlobsForProject(projectId: string): Promise<StoredBlob[]> {
  try {
    return await clipsDb.blobs.where('projectId').equals(projectId).toArray();
  } catch {
    return [];
  }
}

export async function removeBlobsForProject(projectId: string): Promise<void> {
  try {
    await clipsDb.blobs.where('projectId').equals(projectId).delete();
  } catch { /* ignore */ }
}

/** Namespaced key builders — single source of truth for blob keys. */
export const blobKeyForScene = (projectId: string, sceneId: string, kind: string) =>
  `${projectId}:scene:${sceneId}:${kind}`;
export const blobKeyForAsset = (projectId: string, assetId: string) =>
  `${projectId}:asset:${assetId}`;

/**
 * One-time migration: legacy rows (no projectId, keys like
 * `scene:s1:voice`) are copied into the recovered project's namespace.
 * Old rows are kept (harmless) — new saves use namespaced keys.
 */
export async function migrateLegacyBlobsToProject(projectId: string): Promise<number> {
  try {
    const all = await clipsDb.blobs.toArray();
    const legacy = all.filter((r) => !r.projectId);
    if (!legacy.length) return 0;
    let n = 0;
    for (const r of legacy) {
      try {
        let key = r.key;
        let sceneId = r.sceneId;
        let kind = r.kind;
        let assetId = r.assetId;
        // Infer from legacy key shape when fields are missing.
        if (key.startsWith('scene:')) {
          const parts = key.split(':');
          sceneId = sceneId || parts[1];
          kind = kind || parts[2];
          if (sceneId && kind) key = blobKeyForScene(projectId, sceneId, kind);
          else key = `${projectId}:${r.key}`;
        } else if (key.startsWith('asset:')) {
          const parts = key.split(':');
          assetId = assetId || parts[1];
          kind = 'asset';
          if (assetId) key = blobKeyForAsset(projectId, assetId);
          else key = `${projectId}:${r.key}`;
        } else {
          key = `${projectId}:${r.key}`;
        }
        await clipsDb.blobs.put({ ...r, key, projectId, sceneId, kind, assetId, updatedAt: r.updatedAt || Date.now() });
        n++;
      } catch { /* skip bad row */ }
    }
    return n;
  } catch {
    return 0;
  }
}

export async function getAllStoredBlobs(): Promise<StoredBlob[]> {
  try {
    return await clipsDb.blobs.toArray();
  } catch {
    return [];
  }
}

export async function removeStoredBlob(key: string): Promise<void> {
  try {
    await clipsDb.blobs.delete(key);
  } catch { /* ignore */ }
}

export async function savePref(key: string, value: unknown): Promise<void> {
  try {
    await clipsDb.prefs.put({ key, value });
  } catch { /* best-effort: watching still works for this session */ }
}

export async function getPref<T = unknown>(key: string): Promise<T | undefined> {
  try {
    const rec = await clipsDb.prefs.get(key);
    return rec?.value as T | undefined;
  } catch {
    return undefined;
  }
}

export async function removePref(key: string): Promise<void> {
  try {
    await clipsDb.prefs.delete(key);
  } catch { /* ignore */ }
}
