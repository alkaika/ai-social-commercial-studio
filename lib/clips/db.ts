// Local clip persistence via Dexie (IndexedDB).
// Why Dexie, not /public or S3:
// - /public is build-time read-only on serverless hosts.
// - S3 would break the BYOK promise (you'd pay/host user footage).
// - IndexedDB keeps blobs on-device, survives refresh, works offline,
//   zero server cost, zero privacy change.
import Dexie, { type Table } from 'dexie';

export interface StoredBlob {
  key: string; // scene:s1:voice | scene:s1:video | asset:<id>
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
