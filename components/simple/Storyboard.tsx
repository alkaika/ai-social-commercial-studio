'use client';
import { useMemo, useState } from 'react';
import { useProject } from '@/stores/projectStore';
import { PLATFORMS, TONES } from '@/config/platforms';
import { META_AI_URL, STORY_VOICES, STORY_DEVICES, splitScriptIntoBatches, buildSingleStoryPrompt, copyText } from '@/lib/meta-sdk/prompts';
import { masterFit } from '@/lib/script-utils';

export default function Storyboard({ onDone, onBack }: { onDone: () => void; onBack?: () => void }) {
  const { set, durationSec, brand, tone, platform, sparkModel, script, masterScript } = useProject();
  const seed = useMemo(() => {
    if (masterScript?.trim()) return masterScript.trim();
    if (script?.scenes?.length) return script.scenes.map((s) => s.voiceover).join(' ');
    return '';
  }, [masterScript, script]);
  const [scriptText, setScriptText] = useState(seed);
  const [device, setDevice] = useState<string>(STORY_DEVICES[0]);
  const [voice, setVoice] = useState<string>(STORY_VOICES[0]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const pf = PLATFORMS[platform];
  const vibe = TONES.find((t) => t.id === tone)?.label || 'Friendly';
  const fit = masterFit(scriptText || '', durationSec);
  const batches = useMemo(() => splitScriptIntoBatches(scriptText || '', durationSec), [scriptText, durationSec]);
  const prompts = useMemo(() => batches.map((b) => buildSingleStoryPrompt({
    scriptText: b.text, batchIndex: b.index, batchTotal: b.total, totalDurationSec: durationSec,
    durationSec: b.batchSec, aspect: pf.aspect, width: pf.width, height: pf.height,
    platformLabel: pf.label, vibeLabel: vibe, brandName: brand.brandName || undefined, device, voice,
  })), [batches, durationSec, pf, vibe, brand.brandName, device, voice]);
  const doCopy = async (i: number) => {
    try { await copyText(prompts[i]); setCopiedIdx(i); setMsg(`Part ${i + 1} copied — paste into meta.ai with your screenshots.`); setTimeout(() => setCopiedIdx(null), 2500); }
    catch { setMsg('Copy blocked — select the prompt manually.'); }
  };
  const goNext = () => {
    const t = scriptText.trim();
    if (!t) { setMsg('Add your script text first.'); return; }
    set({ masterScript: t, masterApproved: true,
      script: { scenes: batches.map((b, i) => ({ id: `batch-${i + 1}`, heading: b.total > 1 ? `Part ${b.index} of ${b.total}` : 'Full commercial', voiceover: b.text, onScreenText: brand.tagline || brand.brandName || '', visualPrompt: `Woman using app on ${device} — part ${b.index}`, durationSec: b.batchSec })), totalSec: durationSec, sparkModel } });
    onDone();
  };
  return (
    <div className="space-y-4">
      <div className="card space-y-2">
        <h2 className="text-xl font-bold">Story — Meta.ai prompts in 10s batches</h2>
        <p className="text-sm text-neutral-600">Meta.ai makes max ~10s voice+video per go. Copy each part below, attach the same screenshots each time, keep the same voice + woman + {device} so parts stitch into one {durationSec}s video.</p>
        <div className="flex flex-wrap gap-2 text-sm"><span className="badge">⏱ {durationSec}s → {batches.length} part{batches.length > 1 ? 's' : ''}</span><span className="badge">📐 {pf.aspect} {pf.width}x{pf.height}</span><span className="badge">📱 {pf.label}</span><span className="badge">✨ {vibe}</span></div>
      </div>
      <div className="card space-y-2">
        <h3 className="font-semibold">1 · Full script (auto-split)</h3>
        <textarea className="input" rows={5} value={scriptText} onChange={(e) => setScriptText(e.target.value)} placeholder="Your full commercial script…" />
        <p className="text-xs text-neutral-500">{fit.wordCount} words · ~{fit.targetWords} for {durationSec}s · split: {batches.map((b) => `${b.batchSec}s`).join(' + ') || '—'}</p>
      </div>
      <div className="card space-y-3">
        <h3 className="font-semibold">2 · Voice + screen</h3>
        <label className="text-sm block">Voice<select className="input mt-1" value={voice} onChange={(e) => setVoice(e.target.value)}>{STORY_VOICES.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
        <div className="flex flex-wrap gap-2">{STORY_DEVICES.map((d) => <button key={d} onClick={() => setDevice(d)} className={`border-2 rounded-full px-4 py-2 ${device === d ? 'border-black bg-neutral-100' : 'border-neutral-200'}`}>{d === 'Mobile phone' ? '📱 Mobile phone' : '🖥 PC monitor'}</button>)}</div>
      </div>
      <div className="card space-y-4">
        <h3 className="font-semibold">3 · Copy each part into meta.ai</h3>
        {prompts.map((p, i) => (
          <div key={i} className="space-y-2 border rounded-xl p-3">
            <p className="font-medium text-sm">Part {i + 1} of {prompts.length} · {batches[i]?.batchSec}s · {batches[i]?.wordCount} words</p>
            <pre className="whitespace-pre-wrap text-sm bg-neutral-900 text-white rounded-xl p-4">{p}</pre>
            <div className="flex flex-wrap gap-2"><button className="btn-primary" onClick={() => doCopy(i)}>{copiedIdx === i ? '✅ Copied!' : `📋 Copy part ${i + 1}`}</button><a className="btn-secondary" href={META_AI_URL} target="_blank" rel="noreferrer">Open meta.ai →</a></div>
          </div>
        ))}
        <ol className="list-decimal ml-5 text-sm text-neutral-700 space-y-1"><li>Copy Part 1, open meta.ai, attach screenshots, generate + download.</li><li>Repeat for each part — same voice ({voice}), same woman, same {device}, same {pf.aspect}.</li><li>Stitch the {prompts.length} clips in order (any editor) → one {durationSec}s {pf.label} video.</li></ol>
        {msg && <p className="text-sm bg-neutral-100 border rounded-xl p-3">{msg}</p>}
      </div>
      <div className="flex justify-between items-center"><button className="btn-secondary" onClick={onBack}>← Back</button><button className="btn-primary" onClick={goNext}>Looks good — continue to export →</button></div>
    </div>
  );
}
