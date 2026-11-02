'use client';
import { useEffect, useMemo, useState } from 'react';
import { useProject } from '@/stores/projectStore';
import { PLATFORMS, TONES } from '@/config/platforms';
import { META_AI_URL, STORY_DEVICES, STORY_DEVICE_ICONS, STORY_MUSIC, STORY_TESTIMONIAL_PERSONAS, STORY_VOICES, voicePerson, deviceSourceLabel, splitScriptIntoBalancedBatches, checkBatchBalance, assignBatchSpeakers, assignBatchVoices, buildBatchTestimonialPrompt, copyText, type BatchSpeaker } from '@/lib/meta-sdk/prompts';
import { masterFit } from '@/lib/script-utils';
import ShotImg from '@/components/simple/ShotImg';
import VoiceMp3Card from '@/components/simple/VoiceMp3Card';
import KenBurnsExportCard from '@/components/simple/KenBurnsExportCard';
import { downloadWebsiteShot, screenshotCandidates } from '@/lib/screenshots';

export default function Storyboard({ onDone, onBack }: { onDone: () => void; onBack?: () => void }) {
  const { set, durationSec, brand, urls, tone, platform, sparkModel, script, masterScript, storyMode, storyPartEdits, projectId } = useProject();
  const seed = useMemo(() => {
    if (masterScript?.trim()) return masterScript.trim();
    if (script?.scenes?.length) return script.scenes.map((s) => s.voiceover).join(' ');
    return '';
  }, [masterScript, script]);
  const [scriptText, setScriptText] = useState(seed);
  const [device, setDevice] = useState<string>(STORY_DEVICES[0]);
  const [musicId, setMusicId] = useState<string>('none');
  const mode = storyMode || 'people';
  const showPerson = mode === 'people';
  const setMode = (m: 'people' | 'voices-meta' | 'voice-kenburns') => set({ storyMode: m });
  const [speakerIdx, setSpeakerIdx] = useState<number[]>([]);
  const [partEdits, setPartEdits] = useState<Record<number, string>>((storyPartEdits as Record<number, string>) || {});
  const updatePartEdit = (idx: number, text: string) => {
    setPartEdits((prev) => {
      const next = { ...prev, [idx]: text };
      if (!text.trim()) delete (next as any)[idx];
      try { set({ storyPartEdits: { ...next } } as any); } catch {}
      return next;
    });
  };
  const resetPartEdit = (idx: number) => {
    setPartEdits((prev) => {
      const next = { ...prev };
      delete (next as any)[idx];
      try { set({ storyPartEdits: { ...next } } as any); } catch {}
      return next;
    });
  };
  // Adopt saved tweaks when a project is opened elsewhere while Story stays mounted.
  useEffect(() => {
    const saved = (storyPartEdits as Record<number, string>) || {};
    setPartEdits((prev) => {
      const a = JSON.stringify(prev || {});
      const b = JSON.stringify(saved || {});
      return a === b ? prev : { ...(saved as Record<number, string>) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [attachPopup, setAttachPopup] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [shotMsg, setShotMsg] = useState('');
  const shots = useMemo(
    () => screenshotCandidates(urls, (brand as any)?.aboutSource || '', (brand as any)?.sitePages || []),
    [urls, (brand as any)?.aboutSource, (brand as any)?.sitePages]
  );
  const pf = PLATFORMS[platform];
  const vibe = TONES.find((t) => t.id === tone)?.label || 'Friendly';
  const fit = masterFit(scriptText || '', durationSec);
  const source = deviceSourceLabel(device);
  // Auto-balanced on every keystroke: the split re-evens itself, so the user
  // never taps Rebalance or counts words. No manual state needed.
  const batches = useMemo(() => splitScriptIntoBalancedBatches(scriptText || '', durationSec), [scriptText, durationSec]);
  // Per-part script overrides — minor tweaks without redrafting the whole script.
  // Keyed by part index; cleared when the full script changes.
  const effectiveBatches = useMemo(() => batches.map((b, i) => {
    const override = (partEdits[i] ?? '').trim();
    if (!override) return b;
    return { ...b, text: override, wordCount: override.split(/\s+/).filter(Boolean).length };
  }), [batches, partEdits]);
  const effectiveBalance = useMemo(() => checkBatchBalance(effectiveBatches, durationSec), [effectiveBatches, durationSec]);
  const autoSpeakers = useMemo(() => showPerson ? assignBatchSpeakers(Math.max(1, effectiveBatches.length)) : assignBatchVoices(Math.max(1, effectiveBatches.length)), [effectiveBatches.length, showPerson]);
  const speakers: BatchSpeaker[] = effectiveBatches.map((b, i) => {
    if (!showPerson) {
      const voice = (STORY_VOICES[(speakerIdx[i] ?? i) % STORY_VOICES.length] as string) || STORY_VOICES[0];
      return { batchIndex: b.index, voice, person: voicePerson(voice), appearance: '', short: voice };
    }
    const p = STORY_TESTIMONIAL_PERSONAS[(speakerIdx[i] ?? i) % STORY_TESTIMONIAL_PERSONAS.length];
    return { batchIndex: b.index, voice: p.voice, person: p.person, appearance: p.appearance, short: p.short };
  });
  const prompts = useMemo(() => effectiveBatches.map((b, i) => buildBatchTestimonialPrompt({
    batch: b, speaker: speakers[i] || autoSpeakers[i] || autoSpeakers[0],
    aspect: pf.aspect, width: pf.width, height: pf.height, platformLabel: pf.label, vibeLabel: vibe,
    brandName: brand.brandName || undefined, device, musicId, showPerson,
    totalDurationSec: durationSec,
  })), [effectiveBatches, speakers, autoSpeakers, pf.aspect, pf.width, pf.height, pf.label, vibe, brand.brandName, device, musicId, showPerson, durationSec]);
  const doCopy = async (i: number) => {
    try { await copyText(prompts[i]); setCopiedIdx(i); setAttachPopup(i); setMsg(`Part ${i + 1} copied — paste into meta.ai (attach ${source} screenshots). ${showPerson ? `Speaker: ${speakers[i]?.short} (${speakers[i]?.voice}).` : `Voice: ${speakers[i]?.voice} (voiceover only, no person on camera).`}`); setTimeout(() => setCopiedIdx(null), 2500); }
    catch { setMsg('Copy blocked — select the prompt manually.'); }
  };
  const goNext = () => {
    const finalParts = (typeof effectiveBatches !== 'undefined' ? effectiveBatches : batches).map((b) => b.text.trim()).filter(Boolean);
    const t = finalParts.join(' ').trim() || scriptText.trim();
    if (!t) { setMsg('Add your script text first.'); return; }
    set({ masterScript: t, masterApproved: true, storyPartEdits: { ...partEdits },
      script: { scenes: (typeof effectiveBatches !== 'undefined' ? effectiveBatches : batches).map((b, i) => ({ id: `batch-${b.index}`, heading: b.total > 1 ? (showPerson ? `Part ${b.index} of ${b.total} — ${speakers[i]?.short}` : `Part ${b.index} of ${b.total} — Voice: ${speakers[i]?.voice}`) : (showPerson ? `Full commercial — ${speakers[i]?.short}` : `Full commercial — Voice: ${speakers[i]?.voice}`), voiceover: b.text, onScreenText: brand.tagline || brand.brandName || '', visualPrompt: showPerson ? `${speakers[i]?.appearance} testimonial on ${device} — part ${b.index}` : `Full-screen ${source} on ${device} — voiceover ${speakers[i]?.voice} — part ${b.index}`, durationSec: b.batchSec })), totalSec: durationSec, sparkModel } });
    onDone();
  };
  return (
    <div className="space-y-4">
      <div className="card space-y-2">
        <h2 className="text-xl font-bold">Platform Settings</h2>
        <div className="flex flex-wrap gap-2 text-sm"><span className="badge">⏱ {durationSec}s ({effectiveBatches.length || 1} parts)</span><span className="badge">📐 {pf.aspect} {pf.width}x{pf.height}</span><span className="badge">📱 {pf.label}</span><span className="badge">✨ {vibe}</span></div>
      </div>
      <div className="card space-y-2">
        <h3 className="font-semibold">1 · Full script (auto-split, re-checked on every edit)</h3>
        <textarea className="input" rows={5} value={scriptText} onChange={(e) => { setScriptText(e.target.value); try { set({ storyPartEdits: {} } as any); } catch {} setPartEdits({}); }} placeholder="Your full commercial script…" />
        <p className="text-xs text-neutral-500">{fit.wordCount} words · exactly {fit.targetWords} for {durationSec}s{fit.isExact ? ' ✅ exact' : ` · ${fit.wordsDelta > 0 ? '+' + fit.wordsDelta + ' over' : fit.wordsDelta + ' short'}`}{effectiveBatches.length > 1 ? ` · parts: ${effectiveBatches.map((b) => `P${b.index} ~${b.wordCount}w/${b.batchSec}s`).join(' · ')}` : ''}</p>
        <div className={`rounded-xl border p-3 text-sm space-y-1 ${effectiveBalance.even ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
          <p className="font-semibold">{effectiveBalance.even ? `✅ Split check: even across ${effectiveBatches.length || 1} part(s) — auto-balanced` : `⚠️ Split check: one part runs long — trim a few words`}</p>
          {effectiveBalance.even ? <p className="text-neutral-700">Auto-balanced on every edit. Each part fits its ~10s slot — just copy.</p> : <>
            <ul className="list-disc ml-5 text-neutral-700 space-y-0.5">{effectiveBalance.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            <p className="text-neutral-600 text-xs">Tip: delete a sentence or shorten a long part — the split re-evens itself.</p>
          </>}
        </div>
      </div>
      <div className="card space-y-3">
        <h3 className="font-semibold">{mode === 'voice-kenburns' ? '2 · Voice — Meta.ai MP3s, one per 10s part' : '2 · Choose your preferences'}</h3>
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-3 space-y-2"><p className="text-xs font-bold uppercase tracking-widest text-neutral-500">Format — pick one</p><div className="flex flex-wrap gap-2"><button onClick={() => setMode('people')} className={`border-2 rounded-full px-4 py-2 ${mode === 'people' ? 'border-black bg-neutral-100' : 'border-neutral-200'}`}>🧍 People + app (Meta.ai)</button><button onClick={() => setMode('voices-meta')} className={`border-2 rounded-full px-4 py-2 ${mode === 'voices-meta' ? 'border-black bg-neutral-100' : 'border-neutral-200'}`}>🎙 Voices + screenshots only (Meta.ai)</button><button onClick={() => setMode('voice-kenburns')} className={`border-2 rounded-full px-4 py-2 ${mode === 'voice-kenburns' ? 'border-black bg-neutral-100' : 'border-neutral-200'}`}>🎧 Voice MP3 (Meta.ai) + Ken Burns in app</button></div></div>
        {mode === 'voice-kenburns' ? (<><VoiceMp3Card batches={effectiveBatches} partEdits={partEdits} onPartEdit={updatePartEdit} onResetPart={resetPartEdit} /><div className="border-t pt-3"><KenBurnsExportCard hideVoiceParts bare /></div></>) : (<>
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-3 space-y-2">
        <p className="text-sm font-semibold text-neutral-800">{showPerson ? 'People mode renders a person on camera.' : 'Voices mode renders voiceover parts — voice only, no person on camera.'}</p>
        <div className="text-sm space-y-1"><p className="font-medium">{showPerson ? 'Speakers — one per part (tap to recast)' : 'Voices — one per part (tap to recast)'}</p><div className="grid sm:grid-cols-2 gap-2">{speakers.map((s, i) => <div key={i} className="border-2 rounded-xl p-2 border-neutral-200">{showPerson ? (<><p className="font-semibold text-sm">Part {i + 1}: {s.short}</p><p className="text-xs text-neutral-600">{s.voice}</p></>) : (<p className="font-semibold text-sm">Part {i + 1}: {s.voice}</p>)}<select className="input mt-1 text-sm" value={speakerIdx[i] ?? i} onChange={(e) => { const next = [...speakerIdx]; next[i] = Number(e.target.value); setSpeakerIdx(next); }}>{showPerson ? STORY_TESTIMONIAL_PERSONAS.map((p, pi) => <option key={pi} value={pi}>{p.short} — {p.voice}</option>) : STORY_VOICES.map((v, vi) => <option key={vi} value={vi}>{v}</option>)}</select></div>)}</div></div></div>
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-3 space-y-2"><p className="text-xs font-bold uppercase tracking-widest text-neutral-500">Screen — pick one</p><div className="flex flex-wrap gap-2">{STORY_DEVICES.map((d) => <button key={d} onClick={() => setDevice(d)} className={`border-2 rounded-full px-4 py-2 ${device === d ? 'border-black bg-neutral-100' : 'border-neutral-200'}`}>{STORY_DEVICE_ICONS[d] || '📺'} {d}</button>)}</div></div>
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-3 space-y-2"><div className="text-sm space-y-1"><p className="font-medium">🎵 Music (subtle — stays under each voice)</p><div className="grid sm:grid-cols-2 gap-2">{STORY_MUSIC.map((m) => <button key={m.id} onClick={() => setMusicId(m.id)} className={`border-2 rounded-xl p-3 text-left ${musicId === m.id ? 'border-black bg-neutral-50' : 'border-neutral-200'}`}><div className="font-semibold">{m.emoji} {m.label}</div><div className="text-xs text-neutral-600">{m.desc}</div></button>)}</div></div></div>
        </>
        )}
      </div>
      <div className="card space-y-4">
        <h3 className="font-semibold">{mode === 'voice-kenburns' ? '3 · Your images for the Ken Burns motion' : '3 · Follow the instructions below for copying each 10-second prompt part into meta.ai'}</h3>
        {mode === 'voice-kenburns' ? (<p className="text-sm text-neutral-700">Save the website pages below to your drive (same gallery as Business), then upload them — plus any Business photos — as <b>images in the builder right above (Card 2)</b>. Our app slowly zooms each image while your per-part Meta.ai MP3s play in order underneath. Nothing renders at meta.ai for visuals in this path. You can build the final MP4 right here on Story — Export is optional.</p>) : (<><p className="text-sm font-bold tracking-widest text-neutral-500 text-center">INSTRUCTIONS</p><div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-base space-y-1"><ol className="list-decimal ml-5 text-neutral-900 space-y-1"><li><span className="font-semibold">🧠 Pick the right mode in Meta.ai</span><br />No Meta One Core subscription → use <b>Instant</b> mode. Have a Meta One Core sub → use <b>Thinking</b> mode.</li><li>Copy Part 1, open meta.ai, pick Instant/Thinking, paste copied prompt, attach {source} screenshots, click submit to generate file.</li><li>Use the same chat, Copy Part 2, paste copied prompt, attach {source} screenshots, click submit to generate file.</li><li>Meta.ai should automatically stitch your parts together into one 20 second video — download your completed commercial. If Meta.ai only gives separate parts, stitch them in order using our Stitch feature on the next page.</li></ol></div></>)}
        {shots.length > 0 && (
          <div className="space-y-2 border rounded-xl p-3 bg-neutral-50">
            <p className="font-medium text-sm">🌐 Your website pages ({shots.length}) — {mode === 'voice-kenburns' ? 'save these, then upload them as images in the builder above' : 'save + attach these in meta.ai'}</p>
            <p className="text-xs text-neutral-600">{mode === 'voice-kenburns' ? 'Same gallery as Business. Save the pages to your drive, then upload them as motion images in the builder in Card 2 above.' : 'Same gallery as Business. Save the pages to your drive, then attach them alongside each prompt paste.'}</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary !py-1" onClick={async () => { setShotMsg('Saving all…'); let n = 0; for (let i = 0; i < shots.length; i++) { try { if ((await downloadWebsiteShot(shots[i], i)) === 'saved') n++; } catch {} await new Promise((r) => setTimeout(r, 400)); } setShotMsg(n ? `Saved ${n} of ${shots.length} — attach them in meta.ai.` : 'Opened in tabs — right-click → Save image.'); }}>💾 Save all {shots.length} for meta.ai</button>
            </div>
            {shotMsg && <p className="text-xs bg-white border rounded-xl p-2">{shotMsg}</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {shots.map((sh, i) => (
                <div key={sh.id} className="relative rounded-xl overflow-hidden border bg-white">
                  <ShotImg shot={sh} alt={sh.label} />
                  <div className="absolute bottom-1 left-1 right-1 flex gap-1">
                    <span className="text-[11px] font-medium bg-black/70 text-white rounded-lg px-2 py-0.5 truncate flex-1">{i + 1}. {sh.label}</span>
                    <button className="text-[11px] font-medium rounded-lg px-2 py-0.5 bg-white/95 border shrink-0" title={`Save ${sh.label} to your drive`} onClick={() => downloadWebsiteShot(sh, i).then((r) => setShotMsg(r === 'saved' ? `Saved ${i + 1} of ${shots.length} — attach it in meta.ai.` : 'Opened in a tab — right-click → Save image.'))}>💾</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {mode !== 'voice-kenburns' && prompts.map((p, i) => (
          <div key={i} className="space-y-2 border rounded-xl p-3">
            <p className="font-medium text-sm">Part {i + 1} of {prompts.length} · {effectiveBatches[i]?.batchSec}s · {effectiveBatches[i]?.wordCount} words · {showPerson ? `${speakers[i]?.short} · ${speakers[i]?.voice}` : `Voice: ${speakers[i]?.voice}`}</p>
            <label className="block text-sm space-y-1">
              <span className="font-medium">Script for this part — tweak words only (timing + visuals stay locked)</span>
              <textarea className="input" rows={3} value={partEdits[i] ?? effectiveBatches[i]?.text ?? ''} onChange={(e) => updatePartEdit(i, e.target.value)} placeholder="Edit just this part's spoken lines…" />
              <span className="text-xs text-neutral-500">{(partEdits[i] ?? effectiveBatches[i]?.text ?? '').trim().split(/\s+/).filter(Boolean).length} words · ~{effectiveBatches[i]?.batchSec}s slot {(partEdits[i] ?? '') !== '' ? '· edited ✏️' : '· auto-split'} {((partEdits[i] ?? '') !== '' ) && <button className="underline ml-1" onClick={() => resetPartEdit(i)}>Reset to auto-split</button>}</span>
            </label>
            <pre className="whitespace-pre-wrap text-sm bg-neutral-900 text-white rounded-xl p-4">{p}</pre>
            <div className="flex flex-wrap gap-2"><button className="btn-primary" onClick={() => doCopy(i)}>{copiedIdx === i ? '✅ Copied!' : `📋 Copy part ${i + 1}`}</button><a className="btn-secondary" href={META_AI_URL} target="_blank" rel="noreferrer">Open meta.ai →</a></div>
          </div>
        ))}
        {msg && <p className="text-sm bg-neutral-100 border rounded-xl p-3 whitespace-pre-wrap">{msg}</p>}
        {attachPopup !== null && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 50 }} onClick={() => setAttachPopup(null)}>
            <div className="bg-white rounded-2xl shadow-card border border-neutral-200 p-5 max-w-sm w-full space-y-3" onClick={(e) => e.stopPropagation()}>
              <p className="font-semibold text-base">📎 Attach your images with Part {attachPopup + 1}</p>
              <p className="text-sm text-neutral-700">Part {attachPopup + 1} copied! In meta.ai, paste the prompt <b>AND attach</b> your {source.toLowerCase()} screenshots{shots.length > 0 ? ` (${shots.length} saved above)` : ''} — plus any Business photos — before you hit generate. Meta.ai can't see your site without them.</p>
              <div className="flex flex-wrap gap-2">
                <a className="btn-primary" href={META_AI_URL} target="_blank" rel="noreferrer" onClick={() => setAttachPopup(null)}>Open meta.ai →</a>
                <button className="btn-secondary" onClick={() => setAttachPopup(null)}>Got it</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-between items-center"><button className="btn-secondary" onClick={onBack}>← Back</button><button className="btn-primary" onClick={goNext}>{mode === 'voice-kenburns' ? 'Stitch Voice Files or Download Files →' : 'Stitch Video Files or Download Files →'}</button></div>
    </div>
  );
}
