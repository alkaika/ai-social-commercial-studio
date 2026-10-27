'use client';
import { useState } from 'react';
import { useProject } from '@/stores/projectStore';
import { useKeyStore } from '@/stores/keyStore';
import { fitsDuration, wordsToSec } from '@/lib/script-utils';
import { PLATFORMS } from '@/config/platforms';

export default function Storyboard({ onDone }: { onDone: () => void }) {
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

  async function quick(sceneId: string, action: 'rewrite' | 'new-image' | 'new-voice') {
    if (!script) return;
    setBusy(true);
    try {
      if (action === 'new-image') {
        const sc = script.scenes.find((s) => s.id === sceneId);
        const res = await fetch('/api/muse/image', { method: 'POST', headers: hdr(), body: JSON.stringify({ prompt: `${brand.brandName} ${sc?.visualPrompt || sc?.heading}`, aspect: PLATFORMS[platform].aspect }) });
        const j = await res.json();
        set({ script: { ...script, scenes: script.scenes.map((s) => (s.id === sceneId ? { ...s, imageUrl: j.url } : s)) } });
      } else if (action === 'new-voice') {
        const sc = script.scenes.find((s) => s.id === sceneId);
        await fetch('/api/muse/voice', { method: 'POST', headers: hdr(), body: JSON.stringify({ text: sc?.voiceover || '' }) });
        setMsg(`New voice for ${sceneId} ready.`);
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
            <textarea className="input" rows={2} value={s.voiceover} onChange={(e) => set({ script: { ...script, scenes: script.scenes.map((x) => x.id === s.id ? { ...x, voiceover: e.target.value } : x) } })} />
            <label className="text-sm font-medium">📝 Words on screen</label>
            <input className="input" value={s.onScreenText} onChange={(e) => set({ script: { ...script, scenes: script.scenes.map((x) => x.id === s.id ? { ...x, onScreenText: e.target.value } : x) } })} />
            <div className="flex flex-wrap gap-2 pt-1">
              <button className="btn-secondary" disabled={busy} onClick={() => quick(s.id, 'rewrite')}>✍️ Rewrite</button>
              <button className="btn-secondary" disabled={busy} onClick={() => quick(s.id, 'new-image')}>🖼 New picture</button>
              <button className="btn-secondary" disabled={busy} onClick={() => quick(s.id, 'new-voice')}>🎙 New voice</button>
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
      <div className="text-right"><button className="btn-primary" onClick={onDone}>Looks good — continue to export →</button></div>
    </div>
  );
}

