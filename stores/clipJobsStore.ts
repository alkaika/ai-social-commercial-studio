// Background job store + Dexie persistence.
// Flow: createJobsFromScript -> meta.ai -> ingest (validate + save blob) -> auto-attach.
// Blobs survive refresh via IndexedDB; hydrate() restores object URLs.

'use client';
import { create } from 'zustand';
import type { ClipJob, ClipJobStatus, ClipKind } from '@/lib/meta-sdk/types';
import { META_AI_URL, buildVoicePrompt, buildVideoPrompt } from '@/lib/meta-sdk/prompts';
import { ingestClipFile } from '@/lib/meta-sdk/ingest';
import { useProject } from '@/stores/projectStore';

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function persistClip(sceneId: string, kind: ClipKind, file: Blob, name: string, durationSec?: number) {
  try {
    const { saveStoredBlob, blobKeyForScene } = await import('@/lib/clips/db');
    const projectId = useProject.getState().projectId || 'unassigned';
    await saveStoredBlob({ key: blobKeyForScene(projectId, sceneId, kind), projectId, sceneId, kind, blob: file, name, mime: (file as File).type || 'video/mp4', durationSec, updatedAt: Date.now() });
  } catch { /* best-effort */ }
}

async function forgetClip(sceneId: string, kind: ClipKind) {
  try {
    const { removeStoredBlob, blobKeyForScene } = await import('@/lib/clips/db');
    const projectId = useProject.getState().projectId || 'unassigned';
    // Delete namespaced row; also try legacy un-namespaced key (pre-library).
    await removeStoredBlob(blobKeyForScene(projectId, sceneId, kind));
    await removeStoredBlob(`scene:${sceneId}:${kind}`);
  } catch { /* ignore */ }
}

interface ClipJobsState {
  jobs: ClipJob[];
  busy: boolean;
  lastError: string;
  hydrated: boolean;
  createJobsFromScript: (opts?: { voice?: string; aspect?: string; brandName?: string }) => void;
  setStatus: (id: string, status: ClipJobStatus, patch?: Partial<ClipJob>) => void;
  ingestAndAttach: (jobId: string, file: File) => Promise<void>;
  autoAttachBatch: (files: File[]) => Promise<void>;
  hydrate: () => Promise<void>;
  hydrateForProject: (projectId: string) => Promise<void>;
  resetForProject: () => void;
  clear: () => void;
  removeJobClip: (id: string) => void;
}

export const useClipJobs = create<ClipJobsState>((set, get) => ({
  jobs: [],
  busy: false,
  lastError: '',
  hydrated: false,

  createJobsFromScript: (opts = {}) => {
    const { script, brand, platform } = useProject.getState();
    if (!script) {
      set({ lastError: 'Generate your Storyboard script first.' });
      return;
    }
    // Keep existing attached blobs when re-preparing (don't orphan Dexie rows).
    const prev = new Map(get().jobs.filter((j) => j.status === 'attached' && j.objectUrl).map((j) => [`${j.sceneId}:${j.kind}`, j]));
    const aspect =
      opts.aspect || (platform === 'landscape' ? '16:9' : platform === 'square' ? '1:1' : '9:16');
    const now = Date.now();
    const jobs: ClipJob[] = [];
    for (const s of script.scenes) {
      const pv = prev.get(`${s.id}:voice`);
      jobs.push({
        id: uid(),
        sceneId: s.id,
        kind: 'voice',
        prompt: buildVoicePrompt(s, opts.voice || 'warm female, energetic'),
        metaAiUrl: META_AI_URL,
        status: pv ? 'attached' : 'prompt-ready',
        fileName: pv?.fileName, objectUrl: pv?.objectUrl, durationSec: pv?.durationSec,
        createdAt: now,
        updatedAt: now,
      });
      const pm = prev.get(`${s.id}:video`);
      jobs.push({
        id: uid(),
        sceneId: s.id,
        kind: 'video',
        prompt: buildVideoPrompt(s, aspect, opts.brandName ?? brand.brandName),
        metaAiUrl: META_AI_URL,
        status: pm ? 'attached' : 'prompt-ready',
        fileName: pm?.fileName, objectUrl: pm?.objectUrl, durationSec: pm?.durationSec,
        createdAt: now,
        updatedAt: now,
      });
    }
    set({ jobs, lastError: '' });
  },

  setStatus: (id, status, patch = {}) =>
    set((st) => ({
      jobs: st.jobs.map((j) => (j.id === id ? { ...j, status, ...patch, updatedAt: Date.now() } : j)),
    })),

  ingestAndAttach: async (jobId, file) => {
    const job = get().jobs.find((j) => j.id === jobId);
    if (!job) return;
    get().setStatus(jobId, 'ingesting', { fileName: file.name });
    set({ busy: true });
    try {
      const clip = await ingestClipFile(job.sceneId, job.kind, file);
      await persistClip(job.sceneId, job.kind, file, file.name, clip.durationSec);
      // Auto-upload to Storyboard: write straight into projectStore.
      const { script, set } = useProject.getState();
      if (!script) throw new Error('Storyboard script missing — generate it first.');
      const scenes = script.scenes.map((s) => {
        if (s.id !== clip.sceneId) return s;
        if (clip.kind === 'voice') {
          return { ...s, voiceSource: 'metai-clip' as const, voiceClipUrl: clip.objectUrl, voiceUrl: clip.objectUrl };
        }
        return { ...s, videoUrl: clip.objectUrl, motionSource: 'metai-upload' as const, muteSourceAudio: s.muteSourceAudio ?? true };
      });
      set({ script: { ...script, scenes } });
      get().setStatus(jobId, 'attached', {
        fileName: file.name,
        objectUrl: clip.objectUrl,
        durationSec: clip.durationSec,
      });
    } catch (e: any) {
      get().setStatus(jobId, 'error', { error: e?.message || 'Ingest failed' });
    } finally {
      set({ busy: false });
    }
  },

  autoAttachBatch: async (files) => {
    const { matchFileToScene } = await import('@/lib/meta-sdk/ingest');
    for (const f of files) {
      const hint = matchFileToScene(f.name);
      let target = get().jobs.find(
        (j) =>
          j.status !== 'attached' &&
          (!hint.sceneId || j.sceneId === hint.sceneId) &&
          (!hint.kind || j.kind === hint.kind)
      );
      if (!target) {
        target = get().jobs.find((j) => j.status !== 'attached');
      }
      if (target) {
        const kind: ClipKind = hint.kind ?? target.kind;
        if (hint.sceneId || hint.kind) {
          const real = get().jobs.find(
            (j) => j.status !== 'attached' && j.sceneId === (hint.sceneId ?? target!.sceneId) && j.kind === kind
          );
          if (real) target = real;
        }
        await get().ingestAndAttach(target.id, f);
      }
    }
  },

  hydrate: async () => {
    if (get().hydrated) return;
    set({ hydrated: true });
    // Fresh-start behavior: nothing auto-loads. hydrate() is a no-op kept
    // for back-compat; explicit opens go through hydrateForProject().
  },

  hydrateForProject: async (projectId: string) => {
    try {
      const { getBlobsForProject, blobKeyForScene } = await import('@/lib/clips/db');
      const recs = await getBlobsForProject(projectId);
      const proj = useProject.getState();
      if (proj.script) {
        const scenes = proj.script.scenes.map((s) => {
          let next = s;
          const v = recs.find((r) => r.key === blobKeyForScene(projectId, s.id, 'voice'));
          if (v?.blob) {
            const u = URL.createObjectURL(v.blob);
            next = { ...next, voiceSource: 'metai-clip' as const, voiceClipUrl: u, voiceUrl: u };
          }
          const m = recs.find((r) => r.key === blobKeyForScene(projectId, s.id, 'video'));
          if (m?.blob) {
            const u = URL.createObjectURL(m.blob);
            next = { ...next, videoUrl: u, motionSource: 'metai-upload' as const, muteSourceAudio: next.muteSourceAudio ?? true };
          }
          return next;
        });
        proj.set({ script: { ...proj.script, scenes } });
      }
    } catch { /* best-effort */ }
  },

  resetForProject: () => set({ jobs: [], lastError: '', hydrated: true }),

  clear: () => set({ jobs: [], lastError: '' }),

  removeJobClip: (id) => {
    const job = get().jobs.find((j) => j.id === id);
    if (job?.objectUrl) { try { URL.revokeObjectURL(job.objectUrl); } catch { /* x */ } forgetClip(job.sceneId, job.kind); }
    try {
      const proj = useProject.getState();
      if (proj.script && job) {
        const scenes = proj.script.scenes.map((s) => {
          if (s.id !== job.sceneId) return s;
          if (job.kind === 'voice') return { ...s, voiceSource: undefined, voiceClipUrl: undefined, voiceUrl: undefined };
          return { ...s, videoUrl: undefined, motionSource: 'kenburns' as const };
        });
        proj.set({ script: { ...proj.script, scenes } });
      }
    } catch { /* x */ }
    set((st) => ({
      jobs: st.jobs.map((j) => (j.id === id ? { ...j, status: 'prompt-ready' as ClipJobStatus, objectUrl: undefined, fileName: undefined, error: undefined, updatedAt: Date.now() } : j)),
    }));
  },
}));
