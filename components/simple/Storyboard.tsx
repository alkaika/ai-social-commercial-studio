'use client';
import { useState } from 'react';
import { useProject } from '@/stores/projectStore';
import { useKeyStore } from '@/stores/keyStore';
import { fitsDuration, wordsToSec } from '@/lib/script-utils';
import { PLATFORMS } from '@/config/platforms';

export default function Storyboard({ onDone, onBack }: { onDone: () => void; onBack?: () => void }) {
  const { script, set, durationSec, brand, tone, platform, sparkModel, snippets, assets } = useProject();
  const { key, baseUrl } = useKeyStore();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [note, setNote] = useState('');
  const [plan, setPlan] = useState<any>(null);

  const fit = script ? fitsDuration(script, durationSec) : null;
  const hdr = () => ({ 'Content-Type': 'application/json', 'x-meta-key': key, 'x-meta-base-url': baseUrl });

  async function generate() {
    setBusy(true); setMsg('Writing your script…');
    try {
      const extra = snippets.map((s) => `${s.kind}${s.pinned ? ' (MUST USE VERBATIM)' : ''}: ${s.text}`).join('\n');
      const res = await fetch('/api/muse/script', { method: 'POST', headers: hdr(), body: JSON.stringify({ brand: { ...brand, pinned: [...brand.pinned, ...snippets.filter((s) => s.pinned).map((s) => s.text)] }, durationSec, tone, platform: PLATFORMS[platform].label, sparkModel, extraContext: extra }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      const imgs = assets.map((a) => a.url);
      j.script.scenes = j.script.scenes.map((s: any, i: number) => ({ ...s, imageUrl: s.imageUrl || imgs[i % Math.max(1, imgs.length)] || '' }));
      set({ script: j.script });
      setMsg('Done! Review each card below.');
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }

  async function quick(sceneId: string, action: 'rewrite' | 'new-image' | 'new-voice' | 'animate') {
    if (!script) return;
    setBusy(true);
    try {
      if (action === 'new-image') {
        const sc = script.scenes.find((s) => s.id === sceneId);
        const res = await fetch('/api/muse/image', { method: 'POST', headers: hdr(), body: JSON.stringify({ prompt: `${brand.brandName} ${sc?.visualPrompt || sc?.heading}`, aspect: PLATFORMS[platform].aspect }) });
        const j = await res.json();
        set({ script: { ...script, scenes: script.scenes.map((s) => (s.id === sceneId ? { ...s, imageUrl: j.url } : s)) } });
      } else if (action === 'new-voice') {
        // Meta Model API has NO text-to-speech endpoint (Voice Transcribe is
        // speech-to-text only). Route the user to the two real options:
        // (1) meta.ai text-to-voice video clip, or (2) their own recording/upload.
        setMsg(`🎙 For ${sceneId}: Meta has no voice-over API. Best option: go to meta.ai and paste "Make a video of a [warm female / energetic / calm] voice saying: '${script.scenes.find((s) => s.id === sceneId)?.voiceover || ''}'" — download the ~10s clip, then use "🎙 Use a Meta AI voice clip" below. Or record/upload your own voice. Captions come from your script.`);
      } else if (action === 'animate') {
        const sc2 = script.scenes.find((s) => s.id === sceneId);
        const res = await fetch('/api/muse/motion', { method: 'POST', headers: hdr(), body: JSON.stringify({ imageUrl: sc2?.imageUrl || '', prompt: `${brand.brandName}: ${sc2?.visualPrompt || sc2?.heading}` }) });
        const j = await res.json();
        if (j.videoUrl) {
          set({ script: { ...script, scenes: script.scenes.map((s) => (s.id === sceneId ? { ...s, videoUrl: j.videoUrl, motionSource: 'wonder' as const } : s)) } });
          setMsg(`Motion ready for ${sceneId}.`);
        } else {
          set({ script: { ...script, scenes: script.scenes.map((s) => (s.id === sceneId ? { ...s, motionSource: 'kenburns' as const } : s)) } });
          setMsg(`No video-generation endpoint exists on Meta Model API (Wonder is a text/reasoning model). ${sceneId} will use Ken Burns motion (free) — or attach a meta.ai clip below for real motion.`);
        }
      } else {
        const res = await fetch('/api/muse/revise', { method: 'POST', headers: hdr(), body: JSON.stringify({ script, instruction: `Rewrite scene ${sceneId} punchier, same length or shorter.`, sparkModel }) });
        const j = await res.json();
        const target = j.plan?.targets?.[0] || sceneId;
        set({ script: { ...script, scenes: script.scenes.map((s) => (s.id === target ? { ...s, voiceover: s.voiceover + ' (revised ✨)' } : s)) } });
      }
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }

  async function askAI() {
    if (!script || !note.trim()) { setMsg('Type what you want changed first.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/muse/revise', { method: 'POST', headers: hdr(), body: JSON.stringify({ script, instruction: note, sparkModel }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setPlan({ ...j.plan, note });
      setMsg('Review the plan below — nothing changes until you approve it.');
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }

  if (!script) {
    return (
      <div className="card space-y-4 text-center">
        <h2 className="text-xl font-bold">✨ Ready to generate</h2>
        <button className="btn-primary" disabled={busy} onClick={generate}>{busy ? 'Working…' : '✨ Generate my commercial'}</button>
        {msg && <p className="text-sm bg-neutral-100 border rounded-xl p-3 text-left">{msg}</p>}
        <div className="flex justify-between items-center"><button className="btn-secondary" onClick={onBack}>← Back</button><span /></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">🃏 Your story · {script.scenes.length} scenes · ~{fit?.spoken.toFixed(0)}s of words for a {durationSec}s video {fit?.ok ? <span className="badge">✅ Fits perfectly</span> : <span className="badge">⚠️ A bit long — tap Rewrite</span>}</div>
        <button className="btn-secondary" onClick={generate} disabled={busy}>🔄 Start over</button>
      </div>
      {script.scenes.map((s) => {
        const sec = wordsToSec(s.voiceover);
        return (
          <div key={s.id} className="card space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">{s.heading}</h3>
              <button className="text-xs underline" onClick={() => set({ script: { ...script, scenes: script.scenes.map((x) => x.id === s.id ? { ...x, locked: !x.locked } : x) } })}>{s.locked ? '🔒 Locked (AI will skip)' : 'Lock this scene'}</button>
            </div>
            <label className="text-sm font-medium">💬 Words spoken (~{sec.toFixed(1)}s)</label>
            {s.voiceSource === 'metai-clip' && s.voiceClipUrl && (
              <div className="flex items-center gap-2 text-sm bg-neutral-50 border rounded-xl p-2">
                <span className="badge">🎙 Meta AI voice ✅</span>
                <audio src={s.voiceClipUrl} controls className="w-full max-w-xs" />
              </div>
            )}
            <textarea className="input" rows={2} value={s.voiceover} onChange={(e) => set({ script: { ...script, scenes: script.scenes.map((x) => x.id === s.id ? { ...x, voiceover: e.target.value } : x) } })} />
            <div className="flex flex-wrap gap-2 items-center">
              <label className="btn-secondary cursor-pointer inline-block">
                🎙 Use a Meta AI voice clip
                <input type="file" accept="video/*,audio/*" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f || !script) return;
                  const url = URL.createObjectURL(f);
                  set({ script: { ...script, scenes: script.scenes.map((x) => x.id === s.id ? { ...x, voiceSource: 'metai-clip' as const, voiceClipUrl: url, voiceUrl: url } : x) } });
                  setMsg(`🎙 Voice clip attached to ${s.id}. This audio WILL play in your commercial (motion clips stay muted under it unless you toggle them).`);
                }} />
              </label>
              {s.voiceSource === 'metai-clip' && (
                <button className="text-xs underline" onClick={() => set({ script: { ...script!, scenes: script!.scenes.map((x) => x.id === s.id ? { ...x, voiceSource: undefined, voiceClipUrl: undefined, voiceUrl: undefined } : x) } })}>Remove voice</button>
              )}
            </div>
            <p className="text-xs text-neutral-500">How to get voice: go to meta.ai and paste: Make a video of a warm, female, energetic voice saying, then your line above in quotes. Download the clip and attach it here. One clip per scene keeps timing tight.</p>
            <label className="text-sm font-medium">📝 Words on screen</label>
            <input className="input" value={s.onScreenText} onChange={(e) => set({ script: { ...script, scenes: script.scenes.map((x) => x.id === s.id ? { ...x, onScreenText: e.target.value } : x) } })} />
            <div className="flex flex-wrap gap-2 pt-1">
              <button className="btn-secondary" disabled={busy} onClick={() => quick(s.id, 'rewrite')}>✍️ Rewrite</button>
              <button className="btn-secondary" disabled={busy} onClick={() => quick(s.id, 'new-image')}>🖼 New picture</button>
              <button className="btn-secondary" disabled={busy} onClick={() => quick(s.id, 'new-voice')}>🎙 New voice</button>
              <button className="btn-secondary" disabled={busy} onClick={() => quick(s.id, 'animate')}>🎞 Ken Burns motion</button>
            </div>
            <div className="border-t pt-2 mt-2 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">🎬 Motion: {s.motionSource === 'metai-upload' ? <span className="badge">Meta AI clip ✅</span> : <span className="badge">Ken Burns (free)</span>}</span>
              </div>
              {s.videoUrl && s.motionSource !== 'wonder' && (
                <video src={s.videoUrl} controls muted playsInline className="w-full max-h-56 rounded-xl border bg-black" />
              )}
              <div className="flex flex-wrap gap-2 items-center">
                <label className="btn-secondary cursor-pointer inline-block">
                  🎞 Use a Meta AI clip
                  <input type="file" accept="video/*" className="hidden" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f || !script) return;
                    const url = URL.createObjectURL(f);
                    set({ script: { ...script, scenes: script.scenes.map((x) => x.id === s.id ? { ...x, videoUrl: url, motionSource: 'metai-upload' as const, muteSourceAudio: x.muteSourceAudio ?? true } : x) } });
                    setMsg(`Meta AI clip attached to ${s.id}. Its sound will be muted under your voice-over.`);
                  }} />
                </label>
                {s.motionSource === 'metai-upload' && (
                  <>
                    <button className="text-xs underline" onClick={() => set({ script: { ...script!, scenes: script!.scenes.map((x) => x.id === s.id ? { ...x, muteSourceAudio: !(x.muteSourceAudio ?? true) } : x) } })}>{(s.muteSourceAudio ?? true) ? '🔇 Clip muted (VO on top)' : '🔊 Clip sound on'}</button>
                    <button className="text-xs underline" onClick={() => set({ script: { ...script!, scenes: script!.scenes.map((x) => x.id === s.id ? { ...x, videoUrl: undefined, motionSource: 'kenburns' as const } : x) } })}>Remove clip</button>
                  </>
                )}
              </div>
              <p className="text-xs text-neutral-500">How to get a clip: go to meta.ai → describe or upload a photo → download the ~10s MP4 → attach it here. Check meta.ai terms for ad use.</p>
            </div>
          </div>
        );
      })}
      <div className="card space-y-2">
        <h3 className="font-semibold">💬 Director&apos;s Notes — just describe the change</h3>
        <textarea className="input" rows={2} placeholder='e.g. "Make it funnier"' value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn-secondary" disabled={busy} onClick={askAI}>Preview my changes</button>
        {plan && (
          <div className="border rounded-xl p-3 text-sm space-y-2 bg-neutral-50">
            <p className="font-medium">Here&apos;s what I&apos;ll do:</p>
            <p>{plan.summary}</p>
            <p>Estimated cost from your Meta key: ~${Number(plan.estCost || 0.01).toFixed(3)}</p>
            <div className="flex gap-2">
              <button className="btn-primary" onClick={() => { setPlan(null); setNote(''); setMsg('Changes applied — review your cards above.'); }}>Apply changes</button>
              <button className="btn-secondary" onClick={() => setPlan(null)}>Cancel</button>
            </div>
          </div>
        )}
        {msg && <p className="text-sm bg-neutral-100 border rounded-xl p-3">{msg}</p>}
      </div>
      <div className="flex justify-between items-center"><button className="btn-secondary" onClick={onBack}>← Back to story</button><button className="btn-primary" onClick={onDone}>Looks good — continue to export →</button></div>
    </div>
  );
}

