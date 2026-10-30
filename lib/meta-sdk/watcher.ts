// Downloads-folder watcher (File System Access API, Chromium browsers).
// Closes the last manual gap in the clip flow WITHOUT botting meta.ai
// (standing decision: no meta.ai automation, ToS): the user clicks
// "Copy + open meta.ai", generates + downloads the clip there, and this
// watcher auto-attaches the file the moment it lands in the watched folder.
// Read-only, user-granted, fully ToS-safe.
//
// Why polling, not events: browsers expose no directory-change events yet
// (FileSystemObserver is experimental), so we snapshot the folder every
// POLL_MS and only ingest files that are byte-stable across two snapshots
// (partial .crdownload/.part downloads never match WATCH_MEDIA_EXT anyway).
// Iteration uses the manual iterator protocol (no for-await) so this
// compiles regardless of tsconfig target.

export const WATCH_MEDIA_EXT = ['mp4', 'mov', 'webm', 'mp3', 'wav', 'm4a', 'aac', 'ogg'];
const POLL_MS = 2000;
const STABLE_POLLS = 2; // first sight + unchanged on the next poll

export interface WatchHandle {
  stop: () => void;
  folderName: string;
}

type PermState = 'granted' | 'prompt' | 'denied';

export function watcherSupported(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function';
}

/** Open the OS folder picker (starts at Downloads) and return a read-only handle. */
export async function pickWatchFolder(): Promise<any> {
  const pick = (window as any).showDirectoryPicker;
  if (typeof pick !== 'function') throw new Error('Folder watching needs Chrome or Edge.');
  return pick({ id: 'metaai-clips', mode: 'read', startIn: 'downloads' });
}

export async function folderPermission(dir: any, request: boolean): Promise<PermState> {
  try {
    if (request && typeof dir.requestPermission === 'function') {
      return await dir.requestPermission({ mode: 'read' });
    }
    if (typeof dir.queryPermission === 'function') return await dir.queryPermission({ mode: 'read' });
  } catch { /* ignore */ }
  return 'granted'; // best-effort (a fresh pick is always granted)
}

/**
 * Start polling `dir` for NEW media files. Files that already exist are
 * baselined (never swept) so random old downloads can't leak into scenes.
 * Fires onNewFiles once per batch of stabilized files; returns a stop() handle.
 */
export function startWatch(dir: any, onNewFiles: (files: File[]) => void, onError?: (msg: string) => void): WatchHandle {
  const seen = new Set<string>(); // baselined or already ingested
  const candidates = new Map<string, { size: number; polls: number }>();
  let stopped = false;
  let baselined = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  const isMedia = (name: string) => {
    const i = name.lastIndexOf('.');
    return i > 0 && WATCH_MEDIA_EXT.includes(name.slice(i + 1).toLowerCase());
  };

  const stop = () => {
    stopped = true;
    if (timer) clearInterval(timer);
  };

  const snapshot = async () => {
    if (stopped) return;
    try {
      // Manual async-iterator walk (target-safe, see header comment).
      const found = new Map<string, File>();
      const iter = (dir as any).values();
      for (;;) {
        const r = await iter.next();
        if (r.done) break;
        const entry = r.value;
        if (stopped) return;
        if (entry.kind !== 'file' || !isMedia(entry.name)) continue;
        let f: File;
        try { f = await entry.getFile(); } catch { continue; } // locked mid-write
        if (f.size > 0) found.set(entry.name, f);
      }
      if (!baselined) {
        // First pass: everything already in the folder is "seen", never swept.
        found.forEach((_f, name) => seen.add(name));
        baselined = true;
        return;
      }
      const ready: File[] = [];
      found.forEach((f, name) => {
        if (seen.has(name)) return; // forEach return === continue
        const prev = candidates.get(name);
        if (prev && prev.size === f.size) {
          if (prev.polls + 1 >= STABLE_POLLS) {
            seen.add(name);
            candidates.delete(name);
            ready.push(f);
          } else {
            candidates.set(name, { size: f.size, polls: prev.polls + 1 });
          }
        } else {
          candidates.set(name, { size: f.size, polls: 1 });
        }
      });
      // Drop candidates that vanished (renamed/deleted mid-download).
      for (const name of Array.from(candidates.keys())) if (!found.has(name)) candidates.delete(name);
      if (ready.length) onNewFiles(ready);
    } catch (e: any) {
      if (!stopped) {
        stop();
        onError?.(e?.message || 'Folder watch lost - re-pick the folder.');
      }
    }
  };

  snapshot().then(() => {
    if (!stopped) timer = setInterval(snapshot, POLL_MS);
  });

  return { stop, folderName: dir.name || 'folder' };
}