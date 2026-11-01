// Voice-only MP3 card (Story mode 3): one Meta.ai prompt per ~10s part.
// Meta.ai caps voice at ~10s per file too, so each part gets its own paste
// + MP3 (same narrator voice throughout). The N MP3s join in Export under
// Ken Burns motion over the user's screenshots/images.
'use client';
import { useEffect, useMemo, useState } from 'react';
import { META_AI_URL, STORY_VOICES, buildVoiceBatchPrompt, copyText } from '@/lib/meta-sdk/prompts';
import type { StoryBatch } from '@/lib/meta-sdk/prompts';
import { useProject } from '@/stores/projectStore';

const voiceKey = (pid: string, i: number) => `${pid}:voice-part-${i + 1}`;

export default function VoiceMp3Card({ batches }: { batches: StoryBatch[] }) {
  const { projectId, set, voicePartUrls, voicePartNames, durationSec } = useProject();
  const [voice, setVoice] = useState<string>(STORY_VOICES[0] as string);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [busyIdx, setBusyIdx] = useState<number | null>(null);

  const parts = useMemo(() => (batches?.length ? batches : []), [batches]);
  const total = parts.length || 1;
  const fullLen = parts.reduce((a, b) => a + (b.batchSec || 0), 0) || total * 10;
  const prompts = useMemo(
    () => parts.map((b) => buildVoiceBatchPrompt({ text: b.text, index: b.index, total, batchSec: b.batchSec, voice, totalDurationSec: fullLen || durationSec })),
    [parts, total, voice, fullLen, durationSec]
  );

  const doCopy = async (i: number) => {
    try { await copyText(prompts[i]); setCopiedIdx(i); setMsg(`Part ${i + 1} copied — paste into meta.ai.`); }
    catch { setMsg('Copy blocked.'); }
  };

  // Rehydrate per-part blobs after a project Open (opens wipe object URLs).
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const cur = (await import('@/stores/projectStore')).useProject.getState();
        if ((cur.voicePartUrls || []).some(Boolean)) return;
        const { listVoiceParts } = await import('@/lib/clips/db');
        const found = await listVoiceParts(projectId || 'unassigned', total);
        if (found.length && live) {
          const urls: string[] = [];
          const names: string[] = [...(cur.voicePartNames || [])];
          for (const f of found) {
            try { urls[f.index] = URL.createObjectURL(f.blob); if (!names[f.index]) names[f.index] = f.name; } catch {}
          }
          set({ voicePartUrls: urls, voicePartNames: names });
        }
      } catch {}
    })();
    return () => { live = false; };
  }, [projectId, total]);
  const onFile = async (i: number, files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (!/audio/i.test(f.type) && !/mp3|wav|m4a|aac|ogg|mp4/i.test(f.name)) {
      setMsg(`Part ${i + 1}: that is not audio.`); return;
    }
    setBusyIdx(i); setMsg(`Attaching Part ${i + 1}…`);
    try {
      const url = URL.createObjectURL(f);
      const pid = projectId || 'unassigned';
      try {
        const { saveStoredBlob } = await import('@/lib/clips/db');
        await saveStoredBlob({ key: voiceKey(pid, i), projectId: pid, sceneId: `part-${i + 1}`, kind: 'voice-part', blob: f, name: f.name, mime: f.type || 'audio/mpeg', updatedAt: Date.now() });
      } catch {}
      const urls = [...(voicePartUrls || [])];
      const names = [...(voicePartNames || [])];
      try { if (urls[i]?.startsWith('blob:')) URL.revokeObjectURL(urls[i]); } catch {}
      urls[i] = url; names[i] = f.name;
      set({ voicePartUrls: urls, voicePartNames: names });
      setMsg(`Part ${i + 1} attached.`);
    } catch (e: any) { setMsg(e?.message || 'Attach failed.'); }
    finally { setBusyIdx(null); }
  };

  const remove = async (i: number) => {
    try {
      const urls = [...(voicePartUrls || [])];
      const names = [...(voicePartNames || [])];
      try { if (urls[i]?.startsWith('blob:')) URL.revokeObjectURL(urls[i]); } catch {}
      try {
        const { removeStoredBlob } = await import('@/lib/clips/db');
        await removeStoredBlob(voiceKey(projectId || 'unassigned', i));
      } catch {}
      urls[i] = ''; names[i] = '';
      set({ voicePartUrls: urls, voicePartNames: names });
      setMsg(`Part ${i + 1} removed.`);
    } catch {}
  };

  const done = (voicePartUrls || []).filter(Boolean).length;

  return (
    <div className="space-y-3 border rounded-xl p-3">
      <p className="font-medium text-sm">Voice MP3s — one per part ({done}/{total})</p>
      <p className="text-xs text-neutral-600">Meta.ai caps voice at ~10s too. Same narrator voice for all parts. The LAST part asks Meta.ai to stitch all MP3s into one file — download that first; our Export join is the fallback.</p>
      <label className="block text-sm space-y-1">
        <span className="font-medium">Narrator voice (all parts)</span>
        <select className="input" value={voice} onChange={(e) => setVoice(e.target.value)}>
          {STORY_VOICES.map((v) => (<option key={v} value={v}>{v}</option>))}
        </select>
      </label>
      {parts.map((b, i) => (
        <div key={b.index} className="space-y-2 border rounded-xl p-3 bg-white">
          <p className="font-medium text-sm">Part {b.index} of {total} · ~{b.batchSec}s · {b.wordCount} words</p>
          <pre className="whitespace-pre-wrap text-sm bg-neutral-900 text-white rounded-xl p-4">{prompts[i]}</pre>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => doCopy(i)}>{copiedIdx === i ? 'Copied!' : `Copy part ${i + 1}`}</button>
            <a className="btn-secondary" href={META_AI_URL} target="_blank" rel="noreferrer">Open meta.ai</a>
          </div>
          <p className="text-xs font-medium">Part {b.index} MP3 {voicePartUrls?.[i] ? `— ${(voicePartNames || [])[i] || 'attached'}` : '— missing'}</p>
          <input type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.mp4" className="text-sm" onChange={(e) => { onFile(i, e.target.files); e.target.value = ''; }} />
          {busyIdx === i && <p className="text-xs text-neutral-500">Attaching…</p>}
          {voicePartUrls?.[i] && (<div className="space-y-1"><audio src={voicePartUrls[i]} controls className="w-full" /><button className="text-xs underline text-red-600" onClick={() => remove(i)}>Remove Part {b.index}</button></div>)}
        </div>
      ))}
      <ol className="list-decimal ml-5 text-sm text-neutral-700 space-y-1">
        <li>Copy Part 1, open meta.ai, generate + download the MP3. Repeat per part (same voice).</li>
        <li>The LAST part asks Meta.ai to stitch all MP3s — download that finished file first.</li>
        <li>Upload each MP3 under its part (or just the stitched file under Part 1).</li>
        <li>Export: add images, Build — parts join in order (fallback if Meta.ai did not stitch).</li>
      </ol>
      {msg && <p className="text-sm bg-neutral-100 border rounded-xl p-3">{msg}</p>}
    </div>
  );
}
