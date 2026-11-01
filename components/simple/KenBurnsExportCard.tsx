'use client';
import { useEffect, useRef, useState } from 'react';
import { useProject } from '@/stores/projectStore';
import { PLATFORMS } from '@/config/platforms';
import { buildKenBurnsCommercial, resetFFmpeg, errText } from '@/lib/render/ffmpeg';

function probeOne(f: File, tag: 'audio' | 'video'): Promise<number | undefined> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(f);
      const el = document.createElement(tag) as HTMLMediaElement;
      let done = false;
      const finish = (d?: number) => { if (done) return; done = true; setTimeout(() => URL.revokeObjectURL(url), 2000); resolve(d); };
      el.preload = 'metadata';
      el.onloadedmetadata = () => finish(Number.isFinite(el.duration) && el.duration > 0 ? el.duration : undefined);
      el.onerror = () => finish(undefined);
      el.src = url;
      setTimeout(() => finish(undefined), 8000);
    } catch { resolve(undefined); }
  });
}

/** Real duration of an audio file — stitched Meta.ai files may arrive as MP4,
 * so fall back to a <video> probe when <audio> cannot read it. */
async function probeMedia(f: File): Promise<number | undefined> {
  return (await probeOne(f, 'audio')) ?? (await probeOne(f, 'video'));
}

function probeSpans(parts: File[]): Promise<(number | undefined)[]> {
  return Promise.all(parts.map((f) => probeMedia(f)));
}

const voiceKey = (pid: string, i: number) => `${pid}:voice-part-${i + 1}`;
const stitchedKey = (pid: string) => `${pid}:voice-stitched`;

export default function KenBurnsExportCard() {
  const { platform, durationSec, projectId, set, voicePartUrls, voicePartNames, stitchedVoiceUrl, stitchedVoiceName } = useProject();
  const pf = PLATFORMS[platform as keyof typeof PLATFORMS];
  const [images, setImages] = useState<File[]>([]);
  const [voices, setVoices] = useState<(File | null)[]>([]);
  const [voiceBusy, setVoiceBusy] = useState<number | null>(null);
  // Meta.ai's already-stitched voice file (MP3/MP4): when present the app
  // skips the per-part join and only adds Ken Burns motion.
  const [stitchedFile, setStitchedFile] = useState<File | null>(null);
  const [stitchedBusy, setStitchedBusy] = useState(false);
  const hasStitched = !!stitchedFile || !!stitchedVoiceUrl;
  const stitchedIsVideo = /video/i.test(stitchedFile?.type || '') || /\.mp4|m4v|mov|webm/i.test(stitchedFile?.name || stitchedVoiceName || '');
  const need = Math.max(1, Math.ceil(durationSec / 10));
  const voiceDone = voices.filter(Boolean).length;
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [step, setStep] = useState('');
  const [failed, setFailed] = useState(false);
  const [outUrl, setOutUrl] = useState('');
  const [outMB, setOutMB] = useState('');
  const [msg, setMsg] = useState('');
  const imgRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (voices.some(Boolean)) return;
        const { listVoiceParts, getStitchedVoice } = await import('@/lib/clips/db');
        try {
          const st = await getStitchedVoice(projectId || 'unassigned');
          if (st && live && !stitchedFile) {
            setStitchedFile(new File([st.blob], st.name, { type: st.mime || 'audio/mpeg' }));
            if (!stitchedVoiceUrl) {
              try { set({ stitchedVoiceUrl: URL.createObjectURL(st.blob), stitchedVoiceName: stitchedVoiceName || st.name }); } catch {}
            }
          }
        } catch {}
        const found = await listVoiceParts(projectId || 'unassigned', need);
        if (found.length && live) {
          const arr: (File | null)[] = Array(Math.max(need, found.length)).fill(null);
          for (const f of found) arr[f.index] = new File([f.blob], f.name, { type: f.mime || 'audio/mpeg' });
          const cur = (await import('@/stores/projectStore')).useProject.getState();
          const urls: string[] = [...(cur.voicePartUrls || [])];
          const names: string[] = [...(cur.voicePartNames || [])];
          for (const f of found) {
            if (!urls[f.index]) { try { urls[f.index] = URL.createObjectURL(f.blob); } catch {} }
            if (!names[f.index]) names[f.index] = f.name;
          }
          setVoices(arr);
          set({ voicePartUrls: urls, voicePartNames: names });
        }
      } catch {}
    })();
    return () => { live = false; };
  }, [projectId, need]);

  const onVoiceFile = async (i: number, files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (!/audio/i.test(f.type) && !/mp3|wav|m4a|aac|ogg|mp4/i.test(f.name)) {
      setMsg(`Part ${i + 1}: that is not audio — pick the MP3 from meta.ai.`);
      return;
    }
    setVoiceBusy(i); setMsg(`Attaching voice Part ${i + 1}…`);
    try {
      const pid = projectId || 'unassigned';
      try {
        const { saveStoredBlob } = await import('@/lib/clips/db');
        await saveStoredBlob({ key: voiceKey(pid, i), projectId: pid, sceneId: `part-${i + 1}`, kind: 'voice-part', blob: f, name: f.name, mime: f.type || 'audio/mpeg', updatedAt: Date.now() });
      } catch {}
      const url = URL.createObjectURL(f);
      setVoices((prev) => { const arr = [...prev]; while (arr.length < need) arr.push(null); arr[i] = f; return arr; });
      const urls = [...(voicePartUrls || [])];
      const names = [...(voicePartNames || [])];
      try { if (urls[i]?.startsWith('blob:')) URL.revokeObjectURL(urls[i]); } catch {}
      urls[i] = url; names[i] = f.name;
      set({ voicePartUrls: urls, voicePartNames: names });
      setMsg(`Voice Part ${i + 1} attached (${f.name}).`);
    } catch (e: unknown) { setMsg(e instanceof Error ? e.message : 'Voice attach failed.'); }
    finally { setVoiceBusy(null); }
  };

  const removeVoice = async (i: number) => {
    try {
      setVoices((prev) => { const arr = [...prev]; arr[i] = null; return arr; });
      const urls = [...(voicePartUrls || [])]; const names = [...(voicePartNames || [])];
      try { if (urls[i]?.startsWith('blob:')) URL.revokeObjectURL(urls[i]); } catch {}
      urls[i] = ''; names[i] = '';
      set({ voicePartUrls: urls, voicePartNames: names });
      try {
        const { removeStoredBlob } = await import('@/lib/clips/db');
        await removeStoredBlob(voiceKey(projectId || 'unassigned', i));
      } catch {}
      setMsg(`Voice Part ${i + 1} removed.`);
    } catch {}
  };

  const onStitchedFile = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (!/audio|video/i.test(f.type) && !/mp3|wav|m4a|aac|ogg|mp4|m4v|mov|webm/i.test(f.name)) {
      setMsg('That is not a media file — pick the finished file Meta.ai stitched (MP3 or MP4).');
      return;
    }
    setStitchedBusy(true); setMsg('Attaching your finished voice file…');
    try {
      const pid = projectId || 'unassigned';
      try {
        const { saveStoredBlob } = await import('@/lib/clips/db');
        await saveStoredBlob({ key: stitchedKey(pid), projectId: pid, sceneId: 'stitched', kind: 'voice-stitched', blob: f, name: f.name, mime: f.type || 'audio/mpeg', updatedAt: Date.now() });
      } catch {}
      const url = URL.createObjectURL(f);
      try { if (stitchedVoiceUrl?.startsWith('blob:')) URL.revokeObjectURL(stitchedVoiceUrl); } catch {}
      setStitchedFile(f);
      set({ stitchedVoiceUrl: url, stitchedVoiceName: f.name });
      setMsg(`Finished voice attached (${f.name}). The app now only adds the Ken Burns motion below.`);
    } catch (e: unknown) { setMsg(e instanceof Error ? e.message : 'Voice attach failed.'); }
    finally { setStitchedBusy(false); }
  };

  const removeStitched = async () => {
    try {
      setStitchedFile(null);
      try { if (stitchedVoiceUrl?.startsWith('blob:')) URL.revokeObjectURL(stitchedVoiceUrl); } catch {}
      set({ stitchedVoiceUrl: '', stitchedVoiceName: '' });
      try {
        const { removeStoredBlob } = await import('@/lib/clips/db');
        await removeStoredBlob(stitchedKey(projectId || 'unassigned'));
      } catch {}
      setMsg('Finished voice removed — the separate parts will join at Build instead.');
    } catch {}
  };

  const onImages = (files: FileList | null) => {
    if (!files) return;
    const imgs = Array.from(files).filter((f) => /image\//i.test(f.type) || /\.(png|jpe?g|webp|gif)$/i.test(f.name)).slice(0, 12);
    if (!imgs.length) { setMsg('Pick image files (PNG/JPG) — saved website screenshots or Business photos.'); return; }
    setImages((prev) => [...prev, ...imgs].slice(0, 12)); setOutUrl('');
    setMsg(`${imgs.length} image(s) added for the motion.`);
  };

  const build = async () => {
    if (hasStitched && !stitchedFile) { setMsg('Your finished voice is still restoring — give it a second, or re-attach the file.'); return; }
    if (!hasStitched && voiceDone < need) { setMsg(`Attach all ${need} voice MP3s first (${voiceDone}/${need}) — or upload the finished file Meta.ai stitched above.`); return; }
    if (!hasStitched && voices.slice(0, need).some((v) => !v)) { setMsg(`One of the first ${need} voice part(s) is missing — attach each part under its own number.`); return; }
    if (!images.length) { setMsg('Add one image to start.'); return; }
    if (failed) { resetFFmpeg(); setFailed(false); }
    setBusy(true); setPct(0); setStep('Starting');
    setMsg('Loading studio renderer.');
    try {
      // Stitched priority: Meta.ai already joined the voice, so the app only
      // adds Ken Burns motion. Otherwise join the per-part MP3s in order.
      const r = hasStitched && stitchedFile
        ? await buildKenBurnsCommercial({ images, audioParts: [stitchedFile], audioSecs: [await probeMedia(stitchedFile)], stitched: true, fallbackTotalSec: durationSec, width: pf.width, height: pf.height, onProgress: setPct, onStep: setStep })
        : await (async () => {
            const parts = voices.slice(0, need) as File[];
            const spans = await probeSpans(parts);
            return buildKenBurnsCommercial({ images, audioParts: parts, audioSecs: spans, width: pf.width, height: pf.height, onProgress: setPct, onStep: setStep });
          })();
      setOutUrl(r.url); setOutMB(`${(r.sizeBytes / 1048576).toFixed(1)} MB`); setStep('');
      setMsg(hasStitched ? `Built — slow zoom over ${images.length} image(s) across your finished voice.` : `Built — slow zoom over ${images.length} image(s) under your ${need} part(s).`);
    } catch (e: unknown) {
      setFailed(true);
      const d = errText(e);
      setMsg(!d ? 'Build failed — press Retry once.' : d);
    } finally { setBusy(false); }
  };

  const finalName = `kb-${platform}-${durationSec}s-final.mp4`;
  return (
    <div className="card space-y-3">
      <h3 className="font-semibold">Voice MP3s + Ken Burns — one final MP4</h3>
      <p className="text-sm text-neutral-600">{hasStitched ? 'Meta.ai stitched the voice for you — the app only adds the Ken Burns motion over your images. Nothing uploads.' : `Your ${need} voice part(s) join in order; each image gets equal time (slow zoom). Nothing uploads.`}</p>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm space-y-2">
        <p className="font-medium">✂ Meta.ai stitched your voice already? Upload the finished file — Ken Burns only</p>
        <p className="text-xs text-neutral-600">On the LAST part, Meta.ai can join your parts into one finished file. Upload that single ~{durationSec}s voice file here (MP3 or MP4) and the app skips the join — it only builds the slow-zoom motion over your images below.</p>
        <input type="file" accept="audio/*,video/mp4,video/*,.mp3,.wav,.m4a,.aac,.ogg,.mp4,.m4v,.mov,.webm" className="text-xs" onChange={(e) => { onStitchedFile(e.target.files); e.target.value = ''; }} />
        {stitchedBusy && <p className="text-xs text-neutral-500">Attaching…</p>}
        {hasStitched && (
          <div className="space-y-1">
            <p className="text-xs font-medium">✅ Finished voice — {stitchedFile?.name || stitchedVoiceName || 'attached'}</p>
            {stitchedVoiceUrl && (stitchedIsVideo ? <video src={stitchedVoiceUrl} controls playsInline className="w-full max-w-sm rounded-xl border" /> : <audio src={stitchedVoiceUrl} controls className="w-full" />)}
            <button className="text-xs underline text-red-600" onClick={removeStitched}>Remove finished file</button>
          </div>
        )}
      </div>
      <div className={`rounded-xl border bg-neutral-50 p-3 text-sm space-y-2 ${hasStitched ? 'opacity-50' : ''}`}>
        <p className="font-medium">Voice parts: {voiceDone}/{need} attached{hasStitched ? ' (not needed — finished file attached)' : ''}</p>
        <p className="text-xs text-neutral-500">{hasStitched ? 'Skipped — your finished file above replaces the per-part join.' : 'Attach here or in Story card 2 (voice mode) — both stay in sync.'}</p>
        {Array.from({ length: need }, (_, i) => (
          <div key={i} className="border rounded-xl p-2 bg-white space-y-1">
            <p className="text-xs font-medium">Part {i + 1} MP3 {voices[i] ? `— ${voices[i]?.name}` : (voicePartNames?.[i] ? `— ${voicePartNames[i]}` : '— missing')}</p>
            <input type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.mp4" className="text-xs" onChange={(e) => { onVoiceFile(i, e.target.files); e.target.value = ''; }} />
            {voiceBusy === i && <p className="text-xs text-neutral-500">Attaching…</p>}
            {(voices[i] || voicePartUrls?.[i]) && (
              <div className="space-y-1">
                {voicePartUrls?.[i] && <audio src={voicePartUrls[i]} controls className="w-full" />}
                <button className="text-xs underline text-red-600" onClick={() => removeVoice(i)}>Remove Part {i + 1}</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <p className="font-medium text-sm">Images ({images.length}/12) — 1 is enough to build</p>
        <input ref={imgRef} type="file" accept="image/*,.png,.jpg,.jpeg,.webp,.gif" multiple className="hidden" onChange={(e) => { onImages(e.target.files); e.target.value = ''; }} />
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => imgRef.current?.click()}>Upload images ({images.length}/12)</button>
          {images.length > 0 && <button className="btn-secondary" onClick={() => { setImages([]); setOutUrl(''); setMsg('Images cleared.'); }}>Clear</button>}
        </div>
        {images.length > 0 && <ol className="list-decimal ml-5 text-xs text-neutral-700">{images.map((f, i) => <li key={i}>{f.name} <button className="underline text-red-600" onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}>remove</button></li>)}</ol>}
        <p className="text-xs text-neutral-500">{hasStitched ? 'Save website screenshots on Story, then upload those files here. 1 image builds fine; up to 12 just adds variety (images share your finished voice evenly).' : 'Save website screenshots on Story, then upload those files here. 1 image builds fine; up to 12 just adds variety (each part cycles images).'}</p>
      </div>
      <button className="btn-primary" disabled={busy || (!hasStitched && voiceDone < need) || !images.length} onClick={build}>{busy ? `Building ${Math.max(0, Math.min(100, pct))}%` : failed ? 'Retry build' : hasStitched ? '🎞 Build Ken Burns MP4 (voice already stitched)' : `Build ${durationSec}s commercial`}</button>
      {busy && <div className="h-2 bg-neutral-200 rounded-full overflow-hidden"><div className="h-full bg-black transition-all" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>}
      {busy && step && <p className="text-xs text-neutral-500">{step}</p>}
      {outUrl && <div className="space-y-2"><video src={outUrl} controls playsInline className="w-full max-w-sm mx-auto rounded-xl border" /><p className="text-xs text-neutral-500 text-center">{finalName} {outMB}</p><div className="flex justify-center"><a className="btn-primary" href={outUrl} download={finalName}>Download final MP4</a></div></div>}
      {msg && <p className="text-sm bg-neutral-100 border rounded-xl p-3">{msg}</p>}
    </div>
  );
}
