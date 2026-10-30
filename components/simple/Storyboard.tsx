'use client';
import { useEffect, useMemo, useState } from 'react';
import { useProject } from '@/stores/projectStore';
import { PLATFORMS, TONES } from '@/config/platforms';
import { META_AI_URL, STORY_VOICES, STORY_DEVICES, buildSingleStoryPrompt, copyText } from '@/lib/meta-sdk/prompts';
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
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { if (seed && !scriptText) setScriptText(seed); }, [seed]);

  const pf = PLATFORMS[platform];
  const vibe = TONES.find((t) => t.id === tone)?.label || 'Friendly';
  const fit = masterFit(scriptText || '', durationSec);
  const prompt = useMemo(() => buildSingleStoryPrompt({
    scriptText: scriptText || '[paste your script above]',
    durationSec, aspect: pf.aspect, width: pf.width, height: pf.height,
    platformLabel: pf.label, vibeLabel: vibe,
    brandName: brand.brandName || undefined, device, voice,
  }), [scriptText, durationSec, pf, vibe, brand.brandName, device, voice]);

  const doCopy = async () => {
    try {
      await copyText(prompt);
      setCopied(true);
      setMsg('Copied — paste into meta.ai and attach your screenshots there.');
      setTimeout(() => setCopied(false), 2500);
    } catch { setMsg('Copy blocked — select the prompt manually.'); }
  };

  const goNext = () => {
    const t = scriptText.trim();
    if (!t) { setMsg('Add your script text first.'); return; }
    set({
      masterScript: t, masterApproved: true,
      script: { scenes: [{ id: 'scene-1', heading: 'Full commercial', voiceover: t, onScreenText: brand.tagline || brand.brandName || '', visualPrompt: `Woman using app on ${device}`, durationSec }], totalSec: durationSec, sparkModel },
    });
    onDone();
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-2">
        <h2 className="text-xl font-bold">Story — one Meta.ai prompt</h2>
        <p className="text-sm text-neutral-600">Voice + video are made at <b>meta.ai</b>. Copy the prompt, attach screenshots of your web / mobile app there, download the video.</p>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="badge">⏱ {durationSec}s</span>
          <span className="badge">📐 {pf.aspect} {pf.width}x{pf.height}</span>
          <span className="badge">📱 {pf.label}</span>
          <span className="badge">✨ {vibe}</span>
        </div>
      </div>
      <div className="card space-y-2">
        <h3 className="font-semibold">1 · Script (entire voiceover)</h3>
        <textarea className="input" rows={5} value={scriptText} onChange={(e) => setScriptText(e.target.value)} placeholder="Your full commercial script…" />
        <p className="text-xs text-neutral-500">{fit.wordCount} words · ~{fit.targetWords} for {durationSec}s · ~{fit.secAtNatural}s {fit.fitsNatural ? '✅ fits' : '· long — shorten or pick longer slot'}</p>
      </div>
      <div className="card space-y-3">
        <h3 className="font-semibold">2 · Voice + screen</h3>
        <label className="text-sm block">Voice<select className="input mt-1" value={voice} onChange={(e) => setVoice(e.target.value)}>{STORY_VOICES.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
        <div className="flex flex-wrap gap-2">{STORY_DEVICES.map((d) => <button key={d} onClick={() => setDevice(d)} className={`border-2 rounded-full px-4 py-2 ${device === d ? 'border-black bg-neutral-100' : 'border-neutral-200'}`}>{d === 'Mobile phone' ? '📱 Mobile phone' : '🖥 PC monitor'}</button>)}</div>
      </div>
      <div className="card space-y-3">
        <h3 className="font-semibold">3 · Copy into meta.ai</h3>
        <pre className="whitespace-pre-wrap text-sm bg-neutral-900 text-white rounded-xl p-4">{prompt}</pre>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={doCopy}>{copied ? '✅ Copied!' : '📋 Copy prompt'}</button>
          <a className="btn-secondary" href={META_AI_URL} target="_blank" rel="noreferrer">Open meta.ai →</a>
        </div>
        <ol className="list-decimal ml-5 text-sm text-neutral-700 space-y-1">
          <li>Copy prompt, open meta.ai.</li>
          <li>Attach screenshots of your website / app.</li>
          <li>Paste + generate: {voice} voice saying your script while showing her using the app on her {device} ({pf.aspect} for {pf.label}, {vibe.toLowerCase()} vibe, {durationSec}s).</li>
        </ol>
        {msg && <p className="text-sm bg-neutral-100 border rounded-xl p-3">{msg}</p>}
      </div>
      <div className="flex justify-between items-center"><button className="btn-secondary" onClick={onBack}>← Back</button><button className="btn-primary" onClick={goNext}>Looks good — continue to export →</button></div>
    </div>
  );
}
