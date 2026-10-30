// Restores text project + blob footage after refresh.
// Mount once in studio layout: loads localStorage (text), then Dexie blobs,
// re-attaches object URLs into the stores. Saves text on every change.
'use client';
import { useEffect } from 'react';
import { useProject } from '@/stores/projectStore';
import { loadProjectLocal, saveProjectLocal } from '@/lib/project/local';

export default function PersistGate() {
  const state = useProject();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = loadProjectLocal();
        if (saved && !cancelled) {
          state.set({
            durationSec: saved.durationSec, platform: saved.platform,
            tone: saved.tone, sparkModel: saved.sparkModel,
            brand: saved.brand, urls: saved.urls || [],
            snippets: saved.snippets || [], script: saved.script,
            masterScript: saved.masterScript || '',
            masterApproved: !!saved.masterApproved,
            scriptGuidance: saved.scriptGuidance || '',
          });
          // Restore upload-asset blobs (SourceHub).
          try {
            const { getAllStoredBlobs } = await import('@/lib/clips/db');
            const recs = await getAllStoredBlobs();
            const assetRecs = recs.filter((r) => r.kind === 'asset' && r.assetId);
            if (assetRecs.length && saved.assets?.length) {
              const restored = saved.assets.map((a) => {
                const hit = assetRecs.find((r) => r.assetId === a.id);
                if (hit?.blob && (!a.url || a.url === '')) {
                  return { ...a, url: URL.createObjectURL(hit.blob) };
                }
                return a;
              });
              if (!cancelled) state.set({ assets: restored });
              else return;
            } else if (!cancelled) {
              state.set({ assets: saved.assets || [] });
            }
          } catch { if (!cancelled) state.set({ assets: saved.assets || [] }); }
        }
      } catch { /* first run */ }
      try {
        const { useClipJobs } = await import('@/stores/clipJobsStore');
        if (!cancelled) await useClipJobs.getState().hydrate();
      } catch { /* best-effort */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist text project on changes (debounced).
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        saveProjectLocal({
          durationSec: state.durationSec, platform: state.platform, tone: state.tone,
          sparkModel: state.sparkModel, brand: state.brand, urls: state.urls,
          snippets: state.snippets, assets: state.assets, script: state.script,
          masterScript: state.masterScript, masterApproved: state.masterApproved,
          scriptGuidance: state.scriptGuidance,
        });
      } catch { /* ignore */ }
    }, 600);
    return () => clearTimeout(t);
  }, [state.durationSec, state.platform, state.tone, state.sparkModel, state.brand, state.urls, state.snippets, state.assets, state.script, state.masterScript, state.masterApproved, state.scriptGuidance]);

  return null;
}
