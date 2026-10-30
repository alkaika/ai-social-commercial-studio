// Project header: New / Save / Open / Delete for named library.
// Studio ALWAYS boots blank — this bar is the only way past work returns.
'use client';
import { useCallback, useEffect, useState } from 'react';
import { useProject } from '@/stores/projectStore';
import type { NamedProject } from '@/lib/project/local';

function revokeUrls(list: string[]) {
  for (const u of list) {
    if (u && u.startsWith('blob:')) { try { URL.revokeObjectURL(u); } catch {} }
  }
}

export default function ProjectBar() {
  const proj = useProject();
  const [projects, setProjects] = useState<NamedProject[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { listProjectsLocal } = await import('@/lib/project/local');
      setProjects(listProjectsLocal());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { setName(proj.projectName || ''); }, [proj.projectId, proj.projectName]);

  const snapshot = () => ({
    durationSec: proj.durationSec, platform: proj.platform, tone: proj.tone,
    sparkModel: proj.sparkModel, brand: proj.brand, urls: proj.urls,
    snippets: proj.snippets, assets: proj.assets, script: proj.script,
    masterScript: proj.masterScript, masterApproved: proj.masterApproved,
    scriptGuidance: proj.scriptGuidance, step: proj.step,
  });

  const doSave = async () => {
    setBusy(true); setMsg('');
    try {
      const lib = await import('@/lib/project/local');
      const label = (name || proj.projectName || '').trim() || lib.suggestProjectName(snapshot());
      const rec = lib.saveNamedProject(proj.projectId, label, snapshot());
      proj.set({ projectName: rec.name });
      setName(rec.name);
      setProjects(lib.listProjectsLocal());
      setMsg('Saved "' + rec.name + '". Switch or refresh freely.');
    } catch (e: any) {
      setMsg(e?.message || 'Save failed.');
    } finally { setBusy(false); }
  };

  const doOpen = async (id: string) => {
    setBusy(true); setMsg('');
    try {
      const { getProjectLocal } = await import('@/lib/project/local');
      const rec = getProjectLocal(id);
      if (!rec) { setMsg('That project is gone.'); refresh(); return; }
      try {
        const cur = useProject.getState();
        revokeUrls([
          ...(cur.assets || []).map((a) => a.url),
          ...(cur.script?.scenes || []).flatMap((s) => [s.voiceClipUrl || '', s.voiceUrl || '', s.videoUrl || '']),
        ]);
      } catch {}
      const { useClipJobs } = await import('@/stores/clipJobsStore');
      useClipJobs.getState().resetForProject();
      proj.openProject(rec);
      proj.set({ projectName: rec.name });
      setName(rec.name);
      try {
        const { getBlobsForProject } = await import('@/lib/clips/db');
        const blobs = await getBlobsForProject(rec.id);
        const byAsset = new Map<string, string>();
        for (const b of blobs) {
          if (b.kind === 'asset' && b.assetId && b.blob && !byAsset.has(b.assetId)) {
            try { byAsset.set(b.assetId, URL.createObjectURL(b.blob)); } catch {}
          }
        }
        if (byAsset.size) {
          const st = useProject.getState();
          st.set({ assets: (st.assets || []).map((a) => (byAsset.has(a.id) ? { ...a, url: byAsset.get(a.id)! } : a)) });
        }
        await useClipJobs.getState().hydrateForProject(rec.id);
      } catch { /* text loads even if footage is gone */ }
      setOpen(false);
      setMsg('Opened "' + rec.name + '".');
    } catch (e: any) {
      setMsg(e?.message || 'Open failed.');
    } finally { setBusy(false); }
  };

  const doNew = async () => {
    try {
      const cur = useProject.getState();
      revokeUrls([
        ...(cur.assets || []).map((a) => a.url),
        ...(cur.script?.scenes || []).flatMap((s) => [s.voiceClipUrl || '', s.voiceUrl || '', s.videoUrl || '']),
      ]);
      const { useClipJobs } = await import('@/stores/clipJobsStore');
      useClipJobs.getState().resetForProject();
    } catch {}
    proj.newFreshProject();
    setName('');
    setMsg('Fresh canvas. Save when you want to keep this one.');
  };

  const doDelete = async (id: string) => {
    if (!confirm('Delete this saved project + its saved clips? Cannot be undone.')) return;
    setBusy(true);
    try {
      const { deleteProjectLocal, listProjectsLocal } = await import('@/lib/project/local');
      deleteProjectLocal(id);
      try {
        const { removeBlobsForProject } = await import('@/lib/clips/db');
        await removeBlobsForProject(id);
      } catch {}
      if (id === useProject.getState().projectId) { await doNew(); }
      setMsg('Deleted.');
      setProjects(listProjectsLocal());
    } finally { setBusy(false); }
  };

  const dirty = !!(proj.brand?.brandName || proj.masterScript || proj.script || (proj.urls?.length > 0));

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">📁</span>
          <div className="min-w-0">
            <p className="font-semibold truncate">{proj.projectName || 'Untitled commercial (unsaved)'}</p>
            <p className="text-xs text-neutral-500">Fresh start on every load · Save to keep · Open to resume</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button className="btn-secondary" disabled={busy} onClick={doNew}>＋ New</button>
          <button className="btn-secondary" disabled={busy} onClick={() => { setOpen((v) => !v); refresh(); }}>Open ({projects.length})</button>
          <button className="btn-secondary" disabled={busy} onClick={() => doDelete(proj.projectId)}>Delete</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <input
          className="input !w-auto flex-1 min-w-[200px]"
          placeholder="Name this project, e.g. Bakery — spring sale"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn-primary" disabled={busy} onClick={doSave}>💾 Save project</button>
      </div>
      {!proj.projectName && dirty ? (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2">Unsaved work — lives in this tab until you Save. Refreshing wipes it (by design).</p>
      ) : null}
      {open && (
        <div className="border rounded-xl divide-y max-h-72 overflow-auto">
          {projects.length === 0 ? (
            <p className="p-3 text-sm text-neutral-500">No saved projects yet. Save this one to start your library.</p>
          ) : projects.map((p) => (
            <div key={p.id} className="p-3 flex flex-wrap items-center gap-2 justify-between text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{p.name} {p.id === proj.projectId && <span className="badge ml-1">current</span>}</p>
                <p className="text-xs text-neutral-500">{p.brand?.brandName || 'No brand yet'} · {new Date(p.updatedAt || p.savedAt).toLocaleString()} · {p.script ? p.script.scenes.length + ' scenes' : 'no script yet'}</p>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary !py-1" disabled={busy} onClick={() => doOpen(p.id)}>Open</button>
                <button className="text-xs underline text-red-600" disabled={busy} onClick={() => doDelete(p.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {msg && <p className="text-sm bg-neutral-100 border rounded-xl p-3">{msg}</p>}
    </div>
  );
}
