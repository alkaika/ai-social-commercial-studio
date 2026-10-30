// Boot: fresh start every load. No auto-load, no autosave.
// One-time migration: legacy single-slot autosave -> named library entry,
// plus legacy Dexie blobs -> recovered project's namespace. Runs once.
'use client';
import { useEffect } from 'react';

export default function PersistGate() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { migrateLegacyIfNeeded, clearLegacyProjectLocal } = await import('@/lib/project/local');
        const recovered = migrateLegacyIfNeeded();
        if (recovered && !cancelled) {
          try {
            const { migrateLegacyBlobsToProject } = await import('@/lib/clips/db');
            await migrateLegacyBlobsToProject(recovered.id);
          } catch { /* best-effort */ }
          // Legacy slot consumed — future loads stay blank until user opens.
          clearLegacyProjectLocal();
        }
      } catch { /* first run — nothing to migrate */ }
    })();
    return () => { cancelled = true; };
  }, []);
  return null;
}

