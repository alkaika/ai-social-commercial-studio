// Clip jobs panel: background ingest + auto-upload to Storyboard.
// No Meta TTS/video endpoint exists, so this automates around meta.ai.
// Watcher (2026-10-29): user-granted read-only watch of the Downloads folder
// auto-attaches meta.ai clip downloads the moment they land — automation
// WITHOUT botting meta.ai (ToS-safe per active decision).
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useClipJobs } from '@/stores/clipJobsStore';
import { useProject } from '@/stores/projectStore';
import ClipJobRow from '@/components/simple/ClipJobRow';
import { watcherSupported, pickWatchFolder, startWatch, folderPermission, type WatchHandle } from '@/lib/meta-sdk/watcher';

const WATCH_PREF = 'watchFolder'; // prefs key holding the directory handle

export default function ClipJobsPanel() {
  const { script } = useProject();
  const { jobs, lastError, createJobsFromScript, autoAttachBatch, clear } = useClipJobs();
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState<'all' | 'voice' | 'video'>('all');
  const [watch, setWatch] = useState<{ on: boolean; folder: string }>({ on: false, folder: '' });
  const watchRef = useRef<WatchHandle | null>(null);
  const autoBatchRef = useRef(autoAttachBatch);
  autoBatchRef.current = autoAttachBatch;
  const canWatch = watcherSupported();

  const stopWatch = useCallback(() => {
    watchRef.current?.stop();
    watchRef.current = null;
    setWatch({ on: false, folder: '' });
  }, []);

  const beginWatch = useCallback(async (dir: any) => {
    stopWatch();
    if ((await folderPermission(dir, true)) === 'denied') {
      setMsg('Folder permission denied - pick the folder again.');
      return;
    }
    watchRef.current = startWatch(
      dir,
      async (files) => {
        try {
          await autoBatchRef.current(files); // single ingest path: validate + probe + attach
          setMsg(`Auto-attached ${files.length} clip(s) from ${dir.name} - scenes updated above.`);
        } catch (e: any) {
          setMsg(e?.message || 'Auto-attach failed - drop files below instead.');
        }
      },
      (m) => { setMsg(m); stopWatch(); }
    );
    setWatch({ on: true, folder: dir.name });
    setMsg(`Watching ${dir.name} - make clips at meta.ai; downloads attach themselves.`);
  }, [stopWatch]);

  const chooseFolder = async () => {
    try {
      const dir = await pickWatchFolder();
      const { savePref } = await import('@/lib/clips/db');
      await savePref(WATCH_PREF, dir); // directory handles are structured-clonable (Chromium)
      await beginWatch(dir);
    } catch (e: any) {
      if (e?.name !== 'AbortError') setMsg(e?.message || 'Could not watch that folder.');
    }
  };

  // Restore last session's folder when Chromium kept the grant (no gesture needed).
  useEffect(() => {
    if (!canWatch) return;
    let cancelled = false;
    (async () => {
      try {
        const { getPref } = await import('@/lib/clips/db');
        const dir = await getPref<any>(WATCH_PREF);
        if (cancelled || !dir || typeof dir.values !== 'function') return;
        if ((await folderPermission(dir, false)) === 'granted') beginWatch(dir);
      } catch { /* stays off until the user re-picks */ }
    })();
    return () => { cancelled = true; watchRef.current?.stop(); };
  }, [beginWatch, canWatch]);

  if (!script) return null;
  const shown = jobs.filter((j) => (filter === 'all' ? true : j.kind === filter));
  const attached = jobs.filter((j) => j.status === 'attached').length;
  const onFiles = async (fl: FileList | File[]) => {
    const arr = Array.from(fl || []);
    if (!arr.length) return;
    setMsg(`Ingesting ${arr.length} clip(s) in background...`);
    try { await autoAttachBatch(arr); setMsg('Clips attached - scenes updated above.'); }
    catch (e: any) { setMsg(e?.message || 'Batch ingest failed.'); }
  };
  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Background clips {jobs.length > 0 && <span className="badge">{attached}/{jobs.length}</span>}</h3>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={() => { createJobsFromScript(); setMsg('Prompts ready - make clips at meta.ai, drop downloads below.'); }}>
            Prepare clips ({script.scenes.length * 2})
          </button>
          {jobs.length > 0 && <button className="btn-secondary" onClick={clear}>Clear</button>}
        </div>
      </div>
      <p className="text-xs text-neutral-600">Meta has no voice/video API (and bots break its ToS) - clips are made at meta.ai. One click copies the prompt + opens it; the folder watcher auto-attaches downloads. Name files like s1-voice.mp4 to auto-route.</p>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {watch.on ? (
          <>
            <span className="badge !bg-green-100 !text-green-800">👁 Watching {watch.folder} - new downloads auto-attach</span>
            <button className="underline" onClick={stopWatch}>Stop watching</button>
            <button className="underline" onClick={chooseFolder}>Change folder</button>
          </>
        ) : canWatch ? (
          <button className="btn-secondary !py-1 !px-3" onClick={chooseFolder}>👁 Auto-watch Downloads folder</button>
        ) : (
          <span className="text-neutral-500">Auto-watch needs Chrome/Edge - drag files below instead.</span>
        )}
      </div>
      {lastError && <p className="text-sm bg-red-50 border border-red-200 rounded-xl p-2">{lastError}</p>}
      {jobs.length > 0 && (
        <div className="border-2 border-dashed rounded-xl p-4 text-center text-sm" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}>
          Drop meta.ai downloads here - auto-attaches to scenes.
          <br />
          <label className="btn-secondary inline-block mt-2 cursor-pointer">Choose files
            <input type="file" accept="video/*,audio/*" multiple className="hidden" onChange={(e) => { if (e.target.files) onFiles(e.target.files); e.target.value = ''; }} />
          </label>
          <div className="mt-2 flex gap-2 justify-center text-xs">
            {(['all', 'voice', 'video'] as const).map((f) => (
              <button key={f} className={`badge ${filter === f ? '!bg-black !text-white' : ''}`} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
        </div>
      )}
      {jobs.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-auto">
          {shown.map((j) => (<ClipJobRow key={j.id} job={j} onMsg={setMsg} />))}
        </div>
      )}
      {msg && <p className="text-sm bg-neutral-100 border rounded-xl p-3">{msg}</p>}
    </div>
  );
}
