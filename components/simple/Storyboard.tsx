'use client';
import { useMemo, useState } from 'react';
import { useProject } from '@/stores/projectStore';
import { useKeyStore } from '@/stores/keyStore';
import { fitsDuration, bestCadence, trimWords, wordsToSec, MIN_CADENCE, MAX_CADENCE } from '@/lib/script-utils';
import { PLATFORMS } from '@/config/platforms';
import { screenshotCandidates } from '@/lib/screenshots';
import WebsiteShots from '@/components/simple/WebsiteShots';
import ClipJobsPanel from '@/components/simple/ClipJobsPanel';
import PreviewVoiceButton from '@/components/voice/PreviewVoiceButton';
import { useClipJobs } from '@/stores/clipJobsStore';

export default function Storyboard({ onDone, onBack }: { onDone: () => void; onBack?: () => void }) {
  const { script, set, durationSec, brand, tone, platform, sparkModel, snippets, assets, masterScript, masterApproved, urls, projectId } = useProject();
  const { key, baseUrl } = useKeyStore();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [note, setNote] = useState('');
  const [plan, setPlan] = useState<any>(null);
  const [shotsOpen, setShotsOpen] = useState<Record<string, boolean>>({});

  // Free website screenshots (homepage + about variants) for the motion picker.
  // No API key — mShots render of the user's own scanned site(s).
  const shots = useMemo(
    () => screenshotCandidates(urls || [], brand.aboutSource || ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(urls || []), brand.aboutSource]
  );

  const fit = script ? fitsDuration(script, durationSec, 1) : null;
  // Best cadence across ALL scenes (single voice delivery speed).
  const pace = script ? bestCadence(script, durationSec) : null;
  const effectiveCadence = script ? Math.min(...script.scenes.map((s) => s.cadence ?? 1)) : 1;
  const hdr = () => ({ 'Content-Type': 'application/json', 'x-meta-key': key, 'x-meta-base-url': baseUrl });

  const applyCadence = (c: number) => {
    if (!script) return;
    set({ script: { ...script, scenes: script.scenes.map((s) => ({ ...s, cadence: c })) } });
  };

  const suggestTrim = () => {
    if (!script) return;
    const perSceneWords = Math.max(6, Math.round((durationSec * 2.5 * MAX_CADENCE) / script.scenes.length));
    set({
      script: {
        ...script,
        scenes: script.scenes.map((s) => ({
          ...s,
          trimSuggestion: trimWords(s.voiceover, perSceneWords),
          trimApproved: false,
        })),
      },
    });
    setMsg(`Even at ${MAX_CADENCE}x (fastest natural delivery) the full script runs ~${pace?.spokenAtMax.toFixed(0)}s in a ${durationSec}s slot. Review the suggested shorter wording under each scene — approve the ones you like, or edit freely. Nothing changes until you approve.`);
  };

  async function generate() {
    setBusy(true); setMsg('Organizing your approved script into timed scenes…');
    try {
      const extra = snippets.map((s) => `${s.kind}${s.pinned ? ' (MUST USE VERBATIM)' : ''}: ${s.text}`).join('\n');
      const res = await fetch('/api/muse/script', { method: 'POST', headers: hdr(), body: JSON.stringify({ brand: { ...brand, pinned: [...brand.pinned, ...snippets.filter((s) => s.pinned).map((s) => s.text)] }, durationSec, tone, platform: PLATFORMS[platform].label, sparkModel, extraContext: extra, masterScript: masterApproved ? masterScript : '' }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      const imgs = assets.map((a) => a.url);
      const withImages = j.script.scenes.map((s: any, i: number) => ({ ...s, imageUrl: s.imageUrl || imgs[i % Math.max(1, imgs.length)] || '' }));
      const tmp = { ...j.script, scenes: withImages };
      // Auto-apply the slowest cadence that fits, so the user lands on working timing.
      const best = bestCadence(tmp, durationSec);
      const organized = best.fits ? { ...tmp, scenes: withImages.map((s: any) => ({ ...s, cadence: best.cadence })) } : tmp;
      set({ script: organized });
      setMsg(masterApproved ? (best.fits ? `Organized from your approved script — fits at ${best.cadence}x cadence. Review each card.` : `Organized from your approved script — it's long for a ${durationSec}s slot even at ${MAX_CADENCE}x. Either pick a longer slot or review the trim suggestion below.`) : 'Done! Review each card below.');
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
        // Captions info: Voice Transcribe is STT-only, kept for auto-captions.
        setMsg(`Captions for ${sceneId}: auto-generated from your script lines. Voice-over audio comes from your meta.ai clip.`);
      } else if (action === 'animate') {
        // Ken Burns is the motion for stills (no video-generation endpoint
        // exists). All reasoning already runs on the user's chosen Spark
        // writer — this just marks the scene; render applies the zoom.
        set({ script: { ...script, scenes: script.scenes.map((s) => (s.id === sceneId ? { ...s, motionSource: 'kenburns' as const } : s)) } });
        setMsg(`${sceneId} will use Ken Burns motion (free) — or attach a meta.ai clip below for real motion.`);
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
        <h2 className="text-xl font-bold">✨ Organize your script for {durationSec}s</h2>
        <p className="text-sm text-neutral-600">{masterApproved ? 'Your approved script will be organized into timed scenes — no new story, just arranged to fit.' : 'No approved script yet — go back to Business and approve one, or generate freely below.'}</p>
        <button className="btn-primary" disabled={busy} onClick={generate}>{busy ? 'Working…' : masterApproved ? '✨ Organize my approved script' : '✨ Generate my commercial'}</button>
        {msg && <p className="text-sm bg-neutral-100 border rounded-xl p-3 text-left">{msg}</p>}
        <div className="flex justify-between items-center"><button className="btn-secondary" onClick={onBack}>← Back</button><span /></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">🃏 Your story · {script.scenes.length} scenes · playing at {effectiveCadence.toFixed(2)}x {fit?.ok ? <span className="badge">✅ Fits the {durationSec}s slot</span> : <span className="badge">⚠️ Over the {durationSec}s slot — adjust below</span>}</div>
        <button className="btn-secondary" onClick={generate} disabled={busy}>🔄 Re-organize</button>
      </div>
      <div className="card space-y-2">
        <h3 className="font-semibold">🎙 Voice cadence — delivery speed for this {durationSec}s slot</h3>
        <p className="text-xs text-neutral-600">{pace?.fits ? <>All {script.scenes.length} scenes play in full at <b>{effectiveCadence.toFixed(2)}x</b>. Slide to taste ({MIN_CADENCE}x slow · {MAX_CADENCE}x brisk) — timing updates live. {fit?.ok ? 'Nothing to fix.' : 'You are over the slot: speed up, or approve a trim below.'}</> : <>Even at {MAX_CADENCE}x (fastest natural delivery) the full script runs ~{pace?.spokenAtMax.toFixed(0)}s in a {durationSec}s slot. Nothing is cut automatically — pick a longer slot, or approve a shorter cut per scene below.</>}</p>
        <div className="flex items-center gap-3">
          <span className="text-xs">🐢 {MIN_CADENCE}x</span>
          <input type="range" min={MIN_CADENCE} max={MAX_CADENCE} step={0.05} value={effectiveCadence}
            onChange={(e) => applyCadence(Math.round(Number(e.target.value) * 100) / 100)} className="w-full" />
          <span className="text-xs">🐇 {MAX_CADENCE}x</span>
          <span className="badge">{effectiveCadence.toFixed(2)}x · ~{script.scenes.reduce((a, s) => a + wordsToSec(s.voiceover, s.cadence ?? 1), 0).toFixed(1)}s</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" disabled={!pace?.fits} onClick={() => pace && applyCadence(pace.cadence)}>✨ Auto-fit ({pace?.cadence ?? '—'}x)</button>
          {!pace?.fits && <button className="btn-primary" onClick={suggestTrim}>✂️ Recommend a shorter cut</button>}
        </div>
      </div>
      <ClipJobsPanel />
      {script.scenes.map((s) => {
        const sec = wordsToSec(s.voiceover, s.cadence ?? 1);
        return (
          <div key={s.id} className="card space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">{s.heading}</h3>
              <button className="text-xs underline" onClick={() => set({ script: { ...script, scenes: script.scenes.map((x) => x.id === s.id ? { ...x, locked: !x.locked } : x) } })}>{s.locked ? '🔒 Locked (AI will skip)' : 'Lock this scene'}</button>
            </div>
            {s.storyBeat && <p className="text-xs text-neutral-500">📖 Story beat: {s.storyBeat}</p>}
            <label className="text-sm font-medium">💬 Words spoken (~{sec.toFixed(1)}s at {(s.cadence ?? 1).toFixed(2)}x)</label>
            {s.trimSuggestion && !s.trimApproved && (
              <div className="border border-amber-300 bg-amber-50 rounded-xl p-2 text-sm space-y-1">
                <p className="font-medium">✂️ Suggested shorter cut (full script is too long for {durationSec}s even at {MAX_CADENCE}x):</p>
                <p className="italic">“{s.trimSuggestion}”</p>
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={() => set({ script: { ...script, scenes: script.scenes.map((x) => x.id === s.id ? { ...x, voiceover: s.trimSuggestion || x.voiceover, trimApproved: true } : x) } })}>Use this cut</button>
                  <button className="text-xs underline" onClick={() => set({ script: { ...script, scenes: script.scenes.map((x) => x.id === s.id ? { ...x, trimSuggestion: undefined, trimApproved: false } : x) } })}>Keep full wording</button>
                </div>
              </div>
            )}
            {s.trimApproved && <p className="text-xs"><span className="badge">✂️ Trimmed cut approved — full original kept on Business page</span></p>}
            {s.voiceSource === 'metai-clip' && s.voiceClipUrl && (
              <div className="flex items-center gap-2 text-sm bg-neutral-50 border rounded-xl p-2">
                <span className="badge">🎙 Meta AI voice ✅</span>
                <audio src={s.voiceClipUrl} controls className="w-full max-w-xs" />
              </div>
            )}
            <textarea className="input" rows={2} value={s.voiceover} onChange={(e) => set({ script: { ...script, scenes: script.scenes.map((x) => x.id === s.id ? { ...x, voiceover: e.target.value } : x) } })} />
            <div className="flex flex-wrap gap-2 items-center">
              <PreviewVoiceButton text={s.voiceover} rate={s.cadence ?? 1} />
              <label className="btn-secondary cursor-pointer inline-block">
                🎙 Use a Meta AI voice clip
                <input type="file" accept="video/*,audio/*" className="hidden" onChange={async (e) => {
                  const f = e.target.files?.[0];
                  (e.target as HTMLInputElement).value = '';
                  if (!f || !script) return;
                  const pid = projectId || 'unassigned';
                  const url = URL.createObjectURL(f);
                  try { const { saveStoredBlob, blobKeyForScene } = await import('@/lib/clips/db'); await saveStoredBlob({ key: blobKeyForScene(pid, s.id, 'voice'), projectId: pid, sceneId: s.id, kind: 'voice', blob: f, name: f.name, mime: f.type || 'video/mp4', updatedAt: Date.now() }); } catch {}
                  try { const st = useClipJobs.getState(); const hit = st.jobs.find((j) => j.sceneId === s.id && j.kind === 'voice' && j.status !== 'attached'); if (hit) st.setStatus(hit.id, 'attached', { fileName: f.name, objectUrl: url }); } catch {}
                  set({ script: { ...script, scenes: script.scenes.map((x) => x.id === s.id ? { ...x, voiceSource: 'metai-clip' as const, voiceClipUrl: url, voiceUrl: url } : x) } });
                  setMsg(`🎙 Voice clip attached to ${s.id} + saved with this project — Open restores it. This audio WILL play in your commercial.`);
                }} />
              </label>
              {s.voiceSource === 'metai-clip' && (
                <button className="text-xs underline" onClick={() => { try { import('@/lib/clips/db').then(({ removeStoredBlob, blobKeyForScene }) => { removeStoredBlob(blobKeyForScene(projectId || 'unassigned', s.id, 'voice')); removeStoredBlob(`scene:${s.id}:voice`); }); } catch {} set({ script: { ...script!, scenes: script!.scenes.map((x) => x.id === s.id ? { ...x, voiceSource: undefined, voiceClipUrl: undefined, voiceUrl: undefined } : x) } }) }}>Remove voice</button>
              )}
            </div>
            <p className="text-xs text-neutral-500">How to get voice: go to meta.ai and paste: Make a video of a warm, female, energetic voice saying, then your line above in quotes. Download the clip and attach it here. One clip per scene keeps timing tight.</p>
            <label className="text-sm font-medium">📝 Words on screen</label>
            <input className="input" value={s.onScreenText} onChange={(e) => set({ script: { ...script, scenes: script.scenes.map((x) => x.id === s.id ? { ...x, onScreenText: e.target.value } : x) } })} />
            <div className="flex flex-wrap gap-2 pt-1">
              <button className="btn-secondary" disabled={busy} onClick={() => quick(s.id, 'rewrite')}>✍️ Rewrite</button>
              <button className="btn-secondary" disabled={busy} onClick={() => quick(s.id, 'new-image')}>🖼 New picture</button>
              <button className="btn-secondary" disabled={busy} onClick={() => quick(s.id, 'new-voice')}>📝 Captions info</button>
              <button className="btn-secondary" disabled={busy} onClick={() => quick(s.id, 'animate')}>🎞 Ken Burns motion</button>
            </div>
            <div className="border-t pt-2 mt-2 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">Motion: {s.motionSource === 'metai-upload' ? <span className="badge">Meta AI clip picked</span> : s.motionSource === 'screenshot' ? <span className="badge">Website shot picked</span> : <span className="badge">Ken Burns (free)</span>}</span>
              </div>
              {s.videoUrl && s.motionSource === 'metai-upload' && (
                <video src={s.videoUrl} controls muted playsInline className="w-full max-h-56 rounded-xl border bg-black" />
              )}
              <div className="flex flex-wrap gap-2 items-center">
                <label className="btn-secondary cursor-pointer inline-block">
                  Use a Meta AI video clip
                  <input type="file" accept="video/*" className="hidden" onChange={async (e) => {
                    const f = e.target.files?.[0];
                    (e.target as HTMLInputElement).value = '';
                    if (!f || !script) return;
                    const pid = projectId || 'unassigned';
                    const url = URL.createObjectURL(f);
                    try { const { saveStoredBlob, blobKeyForScene } = await import('@/lib/clips/db'); await saveStoredBlob({ key: blobKeyForScene(pid, s.id, 'video'), projectId: pid, sceneId: s.id, kind: 'video', blob: f, name: f.name, mime: f.type || 'video/mp4', updatedAt: Date.now() }); } catch {}
                    try { const st = useClipJobs.getState(); const hit = st.jobs.find((j) => j.sceneId === s.id && j.kind === 'video' && j.status !== 'attached'); if (hit) st.setStatus(hit.id, 'attached', { fileName: f.name, objectUrl: url }); } catch {}
                    set({ script: { ...script, scenes: script.scenes.map((x) => x.id === s.id ? { ...x, videoUrl: url, motionSource: 'metai-upload' as const, muteSourceAudio: x.muteSourceAudio ?? true } : x) } });
                    setMsg('Meta AI clip attached to ' + s.id + ' + saved with this project.');
                  }} />
                </label>
                {s.motionSource === 'metai-upload' && (
                  <>
                    <button className="text-xs underline" onClick={() => set({ script: { ...script!, scenes: script!.scenes.map((x) => x.id === s.id ? { ...x, muteSourceAudio: !(x.muteSourceAudio ?? true) } : x) } })}>{(s.muteSourceAudio ?? true) ? 'Clip muted (VO on top)' : 'Clip sound on'}</button>
                    <button className="text-xs underline" onClick={() => { set({ script: { ...script!, scenes: script!.scenes.map((x) => x.id === s.id ? { ...x, videoUrl: undefined, motionSource: 'kenburns' as const } : x) } }); try { import('@/lib/clips/db').then(({ removeStoredBlob, blobKeyForScene }) => { removeStoredBlob(blobKeyForScene(projectId || 'unassigned', s.id, 'video')); removeStoredBlob(`scene:${s.id}:video`); }); } catch {} }}>Remove clip</button>
                  </>
                )}
              </div>
              <WebsiteShots
                sceneId={s.id}
                imageUrl={s.imageUrl}
                motionSource={s.motionSource}
                shots={shots}
                open={!!shotsOpen[s.id]}
                onToggle={() => setShotsOpen((prev) => ({ ...prev, [s.id]: !prev[s.id] }))}
                onPick={(shot) => {
                  if (!script) return;
                  set({ script: { ...script, scenes: script.scenes.map((x) => x.id === s.id ? { ...x, imageUrl: shot.imageUrl, screenshotPageUrl: shot.pageUrl, motionSource: 'screenshot' as const } : x) } });
                  setMsg('Website shot picked for ' + s.id + ' (' + shot.label + '). Plays with a slow zoom.');
                }}
                onClear={() => {
                  if (!script) return;
                  set({ script: { ...script, scenes: script.scenes.map((x) => x.id === s.id ? { ...x, imageUrl: '', screenshotPageUrl: undefined, motionSource: 'kenburns' as const } : x) } });
                }}
              />
              {shots.length > 0 && (
                <button
                  className="text-xs underline"
                  onClick={() => {
                    if (!script) return;
                    set({
                      script: {
                        ...script,
                        scenes: script.scenes.map((x, idx) => {
                          const pick = shots[idx % shots.length];
                          return { ...x, imageUrl: pick.imageUrl, screenshotPageUrl: pick.pageUrl, motionSource: 'screenshot' as const };
                        }),
                      },
                    });
                    setMsg('Applied one website shot per scene. Tap any scene to swap it.');
                  }}
                >
                  Apply one website shot per scene
                </button>
              )}
              <p className="text-xs text-neutral-500">How to get a clip: go to meta.ai, describe or upload a photo, download the MP4, attach it here. Or pick a free website shot above. Check meta.ai terms for ad use.</p>
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

