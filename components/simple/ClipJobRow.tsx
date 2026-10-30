// One background job row: prompt + attach + live status.
'use client';
import { useClipJobs } from '@/stores/clipJobsStore';
import { copyText } from '@/lib/meta-sdk/prompts';
import type { ClipJob } from '@/lib/meta-sdk/types';

const LABEL: Record<ClipJob['status'], string> = {
  'prompt-ready': 'Prompt ready',
  'waiting-for-clip': 'Waiting for clip',
  ingesting: 'Ingesting...',
  attached: 'Attached',
  error: 'Needs attention',
};

export default function ClipJobRow({ job, onMsg }: { job: ClipJob; onMsg: (m: string) => void }) {
  const { busy, ingestAndAttach, setStatus } = useClipJobs();
  const copy = async () => {
    try { await copyText(job.prompt); onMsg('Prompt copied - paste at meta.ai.'); }
    catch { onMsg('Copy failed - select prompt manually.'); }
  };
  return (
    <div className="border rounded-xl p-3 text-sm space-y-2 bg-neutral-50">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <span><b>{job.sceneId}</b> {job.kind === 'voice' ? 'Voice' : 'Video'} <span className="badge">{LABEL[job.status]}</span></span>
        <span className="flex gap-2">
          <button className="text-xs underline" onClick={copy}>Copy prompt</button>
          <button className="text-xs underline" onClick={() => {
            // Copy fires async but stays inside this click task, so
            // window.open keeps its user activation (no popup blocking).
            copyText(job.prompt).catch(() => {});
            window.open(job.metaAiUrl, '_blank', 'noopener');
            setStatus(job.id, 'waiting-for-clip');
            onMsg('Prompt copied - paste at meta.ai, download the clip, the watcher does the rest.');
          }}>Copy + open meta.ai</button>
        </span>
      </div>
      <p className="text-xs bg-white border rounded-lg p-2 italic">{job.prompt}</p>
      {job.status === 'attached' && job.objectUrl ? (
        job.kind === 'voice' ? <audio src={job.objectUrl} controls className="w-full max-w-xs" /> : <video src={job.objectUrl} controls muted playsInline className="w-full max-h-40 rounded-lg border bg-black" />
      ) : (
        <label className="btn-secondary cursor-pointer inline-block text-xs">{busy ? 'Ingesting...' : `Attach ${job.kind} for ${job.sceneId}`}
          <input type="file" accept={job.kind === 'voice' ? 'video/*,audio/*' : 'video/*'} className="hidden" disabled={busy}
            onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; await ingestAndAttach(job.id, f); onMsg(`${job.kind} attached to ${job.sceneId}.`); }} />
        </label>
      )}
      {job.error && <p className="text-xs text-red-600">{job.error}</p>}
      {job.fileName && <p className="text-[11px] text-neutral-500">{job.fileName}{job.durationSec ? ` ~${job.durationSec.toFixed(1)}s` : ''}</p>}
    </div>
  );
}
