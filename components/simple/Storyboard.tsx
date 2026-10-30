'use client';
import { useEffect, useMemo, useState } from 'react';
import { useProject } from '@/stores/projectStore';
import { PLATFORMS, TONES } from '@/config/platforms';
import { META_AI_URL, STORY_VOICE_STYLES, STORY_DEVICES, STORY_DEVICE_ICONS, STORY_MUSIC, deviceSourceLabel, splitScriptIntoBatches, rebalanceBatches, checkBatchBalance, buildCombinedStoryPrompt, copyText, voicePerson } from '@/lib/meta-sdk/prompts';
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
  const [gender, setGender] = useState<'female' | 'male'>('female');
  const [style, setStyle] = useState<string>(STORY_VOICE_STYLES[0]);
  const [musicId, setMusicId] = useState<string>('none');
  const [showPerson, setShowPerson] = useState<boolean>(true);
  const voice = `warm ${gender}, ${style}`;
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState('');
  const pf = PLATFORMS[platform];
  const vibe = TONES.find((t) => t.id === tone)?.label || 'Friendly';
  const fit = masterFit(scriptText || '', durationSec);
  const autoBatches = useMemo(() => splitScriptIntoBatches(scriptText || '', durationSec), [scriptText, durationSec]);
  const [rebalanced, setRebalanced] = useState<typeof autoBatches | null>(null);
  const batches = rebalanced ?? autoBatches;
  const balance = useMemo(() => checkBatchBalance(autoBatches, durationSec), [autoBatches, durationSec]);
  const effectiveBalance = useMemo(() => checkBatchBalance(batches, durationSec), [batches, durationSec]);
  // Any script edit invalidates a manual rebalance — fresh auto-split takes over.
  useEffect(() => { setRebalanced(null); }, [scriptText, durationSec]);
  const prompt = useMemo(() => buildCombinedStoryPrompt({
    batches: batches.length ? batches : [{ index: 1, total: 1, batchSec: durationSec, text: '[paste your script above]', wordCount: 0 }],
    durationSec, aspect: pf.aspect, width: pf.width, height: pf.height, musicId, showPerson,
    platformLabel: pf.label, vibeLabel: vibe, brandName: brand.brandName || undefined, device, voice,
  }), [batches, durationSec, pf, vibe, brand.brandName, device, voice, musicId, showPerson]);
  const who = voicePerson(voice) === 'man' ? 'man' : 'woman';
  const poss = who === 'woman' ? 'her' : 'his';
  const source = deviceSourceLabel(device);
  const doCopy = async () => {
    if (!scriptText.trim()) { setMsg('Add your script text first — the split check needs words to verify.'); return; }
    if (!effectiveBalance.even) { setMsg('Split is uneven — shorten the long segment or tap Rebalance, then copy. The prompt always uses the latest checked split.'); return; }
    try { await copyText(prompt); setCopied(true); setMsg(`Copied — 1 paste into meta.ai with ${batches.length} labeled ~10s segment(s). Attach ${source} screenshots there.`); setTimeout(() => setCopied(false), 2500); }
    catch { setMsg('Copy blocked — select the prompt manually.'); }
  };
  const goNext = () => {
    const t = scriptText.trim();
    if (!t) { setMsg('Add your script text first.'); return; }
    set({ masterScript: t, masterApproved: true,
      script: { scenes: batches.map((b) => ({ id: `batch-${b.index}`, heading: b.total > 1 ? `Segment ${b.index} of ${b.total}` : 'Full commercial', voiceover: b.text, onScreenText: brand.tagline || brand.brandName || '', visualPrompt: showPerson ? `${who} using app on ${device} — segment ${b.index}` : `Full-screen ${source} screenshots on ${device} — voiceover only, no person — segment ${b.index}`, durationSec: b.batchSec })), totalSec: durationSec, sparkModel } });
    onDone();
  };
  return (
    <div className="space-y-4">
      <div className="card space-y-2">
        <h2 className="text-xl font-bold">Story — one Meta.ai prompt</h2>
        <p className="text-sm text-neutral-600">One paste into meta.ai. Full script + labeled ~10s directions so meta.ai outputs one {durationSec}s video. Attach screenshots there.</p>
        <div className="flex flex-wrap gap-2 text-sm"><span className="badge">⏱ {durationSec}s ({batches.length || 1} segs)</span><span className="badge">📐 {pf.aspect} {pf.width}x{pf.height}</span><span className="badge">📱 {pf.label}</span><span className="badge">✨ {vibe}</span><span className="badge">🎙 {voice}</span><span className="badge">{showPerson ? `🧍 ${who} + ${device}` : `🎙 Voice + ${source} only`}</span></div>
      </div>
      <div className="card space-y-2">
        <h3 className="font-semibold">1 · Full script</h3>
        <textarea className="input" rows={5} value={scriptText} onChange={(e) => setScriptText(e.target.value)} placeholder="Your full commercial script…" />
        <p className="text-xs text-neutral-500">{fit.wordCount} words · ~{fit.targetWords} for {durationSec}s{batches.length > 1 ? ` · sections: ${batches.map((b) => `S${b.index} ~${b.wordCount}w/${b.batchSec}s`).join(' · ')}` : ''}</p>
        <div className={`rounded-xl border p-3 text-sm space-y-1 ${effectiveBalance.even ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
          <p className="font-semibold">{effectiveBalance.even ? `✅ Split check: evenly spread across ${batches.length || 1} ~10s segment(s)` : `⚠️ Split check: uneven — fix before copying`}</p>
          {effectiveBalance.even ? (
            <p className="text-neutral-700">Re-checked on every edit. Each segment fits its ~10s slot at natural pace.</p>
          ) : (
            <>
              <ul className="list-disc ml-5 text-neutral-700 space-y-0.5">{effectiveBalance.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              {balance.needsRebalance && batches.length > 1 && (
                <button className="btn-secondary" onClick={() => { setRebalanced(rebalanceBatches(autoBatches)); setMsg('Rebalanced — segments evened out. Prompt below uses the new split.'); }}>⚖️ Rebalance segments evenly</button>
              )}
            </>
          )}
        </div>
      </div>
      <div className="card space-y-3">
        <h3 className="font-semibold">2 · Voice + screen</h3>
        <div className="text-sm space-y-1"><p className="font-medium">On camera</p><div className="flex flex-wrap gap-2"><button onClick={() => setShowPerson(true)} className={`border-2 rounded-full px-4 py-2 ${showPerson ? 'border-black bg-neutral-100' : 'border-neutral-200'}`}>🧍 Person + app</button><button onClick={() => setShowPerson(false)} className={`border-2 rounded-full px-4 py-2 ${!showPerson ? 'border-black bg-neutral-100' : 'border-neutral-200'}`}>🎙 Voice + screenshots only</button></div></div>
        <div className="flex flex-wrap gap-2">{(['female', 'male'] as const).map((g) => <button key={g} onClick={() => setGender(g)} className={`border-2 rounded-full px-4 py-2 ${gender === g ? 'border-black bg-neutral-100' : 'border-neutral-200'}`}>{g === 'female' ? '👩 Female' : '👨 Male'}</button>)}</div>
        <label className="text-sm block">Style (same 5 for both)<select className="input mt-1" value={style} onChange={(e) => setStyle(e.target.value)}>{STORY_VOICE_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
        <p className="text-xs text-neutral-500">Selected: {voice}{showPerson ? ` — the ${who} in the video uses this voice.` : ' — voiceover only, no one on camera.'}</p>
        <div className="text-sm space-y-1"><p className="font-medium">Screen — showing the app on {poss}…</p><div className="flex flex-wrap gap-2">{STORY_DEVICES.map((d) => <button key={d} onClick={() => setDevice(d)} className={`border-2 rounded-full px-4 py-2 ${device === d ? 'border-black bg-neutral-100' : 'border-neutral-200'}`}>{STORY_DEVICE_ICONS[d] || '📺'} {d}</button>)}</div></div>
        <div className="text-sm space-y-1"><p className="font-medium">🎵 Background music (royalty-free, subtle — stays under the voice)</p><div className="grid sm:grid-cols-2 gap-2">{STORY_MUSIC.map((m) => <button key={m.id} onClick={() => setMusicId(m.id)} className={`border-2 rounded-xl p-3 text-left ${musicId === m.id ? 'border-black bg-neutral-50' : 'border-neutral-200'}`}><div className="font-semibold">{m.emoji} {m.label}</div><div className="text-xs text-neutral-600">{m.desc}</div></button>)}</div></div>
      </div>
      <div className="card space-y-3">
        <h3 className="font-semibold">3 · Copy this one prompt into meta.ai</h3>
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm space-y-1">
          <p className="font-semibold">🧠 Pick the right mode in Meta.ai</p>
          <p className="text-neutral-700">No Meta One Core subscription → use <b>Instant</b> mode. Have a Meta One Core subscription → use <b>Thinking</b> mode (follows multi-segment scripts, exact word-for-word lines, and tight endings better — Instant tends to skip segments or paraphrase).</p>
        </div>
        <pre className="whitespace-pre-wrap text-sm bg-neutral-900 text-white rounded-xl p-4">{prompt}</pre>
        <div className="flex flex-wrap gap-2"><button className="btn-primary" onClick={doCopy}>{copied ? '✅ Copied!' : '📋 Copy prompt'}</button><a className="btn-secondary" href={META_AI_URL} target="_blank" rel="noreferrer">Open meta.ai →</a></div>
        <ol className="list-decimal ml-5 text-sm text-neutral-700 space-y-1"><li>Copy, open meta.ai, pick <b>Instant</b> (no One Core sub) or <b>Thinking</b> (with One Core sub), attach {source} screenshots.</li><li>Paste once — {durationSec}s {pf.label}: {voice} voice{showPerson ? ` + ${who} on ${poss} ${device}` : ` over full-screen ${source} footage, no one on camera`}.</li><li>Download → continue to export for captions.</li></ol>
        {msg && <p className="text-sm bg-neutral-100 border rounded-xl p-3">{msg}</p>}
      </div>
      <div className="flex justify-between items-center"><button className="btn-secondary" onClick={onBack}>← Back</button><button className="btn-primary" onClick={goNext}>Looks good — continue to export →</button></div>
    </div>
  );
}
