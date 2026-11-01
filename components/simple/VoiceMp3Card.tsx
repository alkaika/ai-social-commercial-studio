// Voice-only MP3 card (Story mode 3): ONE Meta.ai prompt for the whole script.
// Meta.ai easily voices ~1 minute in a single file — no batching. The MP3
// is paired in-app with the user's screenshots/images via Ken Burns.
'use client';
import { useState } from 'react';
import { META_AI_URL, STORY_TESTIMONIAL_PERSONAS, buildVoiceOnlyPrompt, copyText } from '@/lib/meta-sdk/prompts';
import { useProject } from '@/stores/projectStore';

export default function VoiceMp3Card({ scriptText }: { scriptText: string }) {
  const { projectId, set, voiceMp3Url, voiceMp3Name } = useProject();
  const [voice, setVoice] = useState(STORY_TESTIMONIAL_PERSONAS[0].voice);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const prompt = buildVoiceOnlyPrompt(scriptText || '', voice);
  const words = (scriptText || '').trim().split(/\s+/).filter(Boolean).length;

  const doCopy = async () => {
    if (!scriptText.trim()) { setMsg('Add your script text first (card 1).'); return; }
    try { await copyText(prompt); setCopied(true); setMsg('Copied — paste into meta.ai, generate, download the MP3.'); }
    catch { setMsg('Copy blocked — select the prompt manually.'); }
  };

  const onFile = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (!/audio|video|mp3|wav|m4a|aac|ogg|mp4/i.test(f.type + ' ' + f.name)) {
      setMsg('That file is not audio — pick the MP3 (or MP4) you downloaded from meta.ai.');
      return;
    }
    setBusy(true); setMsg('Attaching voice…');
    try {
      const url = URL.createObjectURL(f);
      const pid = projectId || 'unassigned';
      try {
        const { saveStoredBlob } = await import('@/lib/clips/db');
        await saveStoredBlob({
          key: `${pid}:voice-full`, projectId: pid, sceneId: 'full',
          kind: 'voice-full', blob: f, name: f.name,
          mime: f.type || 'audio/mpeg', updatedAt: Date.now(),
        });
      } catch { /* preview still works this session */ }
      try { if (voiceMp3Url?.startsWith('blob:')) URL.revokeObjectURL(voiceMp3Url); } catch {}
      set({ voiceMp3Url: url, voiceMp3Name: f.name });
      setMsg(`Attached "${f.name}" — preview below, then continue to Export for the Ken Burns build.`);
    } catch (e: any) {
      setMsg(e?.message || 'Could not attach that file.');
    } finally { setBusy(false); }
  };

  const remove = async () => {
    try { if (voiceMp3Url?.startsWith('blob:')) URL.revokeObjectURL(voiceMp3Url); } catch {}
    try {
      const { removeStoredBlob } = await import('@/lib/clips/db');
      await removeStoredBlob(`${projectId || 'unassigned'}:voice-full`);
    } catch {}
    set({ voiceMp3Url: '', voiceMp3Name: '' });
    setMsg('Voice removed.');
  };

  return (
    <div className="space-y-3 border rounded-xl p-3">
      <p className="font-medium text-sm">🎧 ONE voice prompt — whole script, one MP3 (no batching)</p>
      <p className="text-xs text-neutral-600">
        Meta.ai reads ~1 minute of text-to-voice in a single file. {words ? `${words} words — ` : ''}
        paste once, download the MP3, attach it below. Our app animates your images under it in Export.
      </p>
      <label className="block text-sm space-y-1">
        <span className="font-medium">Voice</span>
        <select className="input" value={voice} onChange={(e) => setVoice(e.target.value)}>
          {STORY_TESTIMONIAL_PERSONAS.map((p) => (
            <option key={p.voice} value={p.voice}>{p.short} — {p.voice}</option>
          ))}
        </select>
      </label>
      <pre className="whitespace-pre-wrap text-sm bg-neutral-900 text-white rounded-xl p-4">{prompt}</pre>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={doCopy}>{copied ? '✅ Copied!' : '📋 Copy voice prompt'}</button>
        <a className="btn-secondary" href={META_AI_URL} target="_blank" rel="noreferrer">Open meta.ai →</a>
      </div>
      <div className="space-y-2 border-t pt-3">
        <p className="font-medium text-sm">Upload your Meta.ai voice file</p>
        <input type="file" accept="audio/*,video/mp4,video/*,.mp3,.wav,.m4a,.aac,.ogg,.mp4" className="text-sm"
          onChange={(e) => { onFile(e.target.files); e.target.value = ''; }} />
        {busy && <p className="text-xs text-neutral-500">Attaching…</p>}
        {voiceMp3Url && (
          <div className="space-y-1">
            <p className="text-xs text-neutral-600">🎧 {voiceMp3Name || 'voice file'}</p>
            <audio src={voiceMp3Url} controls className="w-full" />
            <button className="text-xs underline text-red-600" onClick={remove}>Remove voice</button>
          </div>
        )}
      </div>
      <ol className="list-decimal ml-5 text-sm text-neutral-700 space-y-1">
        <li>Copy the prompt, open meta.ai, generate + download the voice file.</li>
        <li>Upload it above (preview it — this exact audio plays in the final mix).</li>
        <li>In Export, add your images → Build — slow zoom over each, voice underneath.</li>
      </ol>
      {msg && <p className="text-sm bg-neutral-100 border rounded-xl p-3 whitespace-pre-wrap">{msg}</p>}
    </div>
  );
}
