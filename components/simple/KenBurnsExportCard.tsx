'use client';
import { useEffect, useRef, useState } from 'react';
import { useProject } from '@/stores/projectStore';
import { PLATFORMS } from '@/config/platforms';
import { buildKenBurnsCommercial, resetFFmpeg, errText } from '@/lib/render/ffmpeg';

function probeSpans(parts: File[]): Promise<(number | undefined)[]> {
  return Promise.all(parts.map((f) => new Promise<number | undefined>((resolve) => {
    try {
      const url = URL.createObjectURL(f);
      const a = new Audio();
      a.preload = 'metadata';
      a.onloadedmetadata = () => { const d = a.duration; setTimeout(() => URL.revokeObjectURL(url), 2000); resolve(Number.isFinite(d) ? d : undefined); };
      a.onerror = () => { setTimeout(() => URL.revokeObjectURL(url), 2000); resolve(undefined); };
      a.src = url;
      setTimeout(() => resolve(undefined), 8000);
    } catch { resolve(undefined); }
  })));
}

const voiceKey = (pid: string, i: number) => `${pid}:voice-part-${i + 1}`;

export default function KenBurnsExportCard() {
  const { platform, durationSec, projectId, set, voicePartUrls, voicePartNames } = useProject();
  const pf = PLATFORMS[platform as keyof typeof PLATFORMS];
  const [images, setImages] = useState<File[]>([]);
  const [voices, setVoices] = useState<(File | null)[]>([]);
  const [voiceBusy, setVoiceBusy] = useState<number | null>(null);
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
        const { listVoiceParts } = await import('@/lib/clips/db');
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

  const onImages = (files: FileList | null) => {
    if (!files) return;
    const imgs = Array.from(files).filter((f) => /image\//i.test(f.type) || /\.(png|jpe?g|webp|gif)$/i.test(f.name)).slice(0, 12);
    if (!imgs.length) { setMsg('Pick image files (PNG/JPG) — saved website screenshots or Business photos.'); return; }
    setImages((prev) => [...prev, ...imgs].slice(0, 12)); setOutUrl('');
    setMsg(`${imgs.length} image(s) added for the motion.`);
  };

  const build = async () => {
    if (voiceDone < need) { setMsg(`Attach all ${need} voice MP3s first (Story step — ${voiceDone}/${need}).`); return; }
    if (!images.length) { setMsg('Add one image to start.'); return; }
    if (failed) { resetFFmpeg(); setFailed(false); }
    setBusy(true); setPct(0); setStep('Starting');
    setMsg('Loading studio renderer.');
    try {
      const parts = voices.slice(0, need) as File[];
      const spans = await probeSpans(parts);
      const r = await buildKenBurnsCommercial({ images, audioParts: parts, audioSecs: spans, width: pf.width, height: pf.height, onProgress: setPct, onStep: setStep });
      setOutUrl(r.url); setOutMB(`${(r.sizeBytes / 1048576).toFixed(1)} MB`); setStep('');
      setMsg(`Built — slow zoom over ${images.length} image(s) under your ${need} part(s).`);
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
      <p className="text-sm text-neutral-600">Your {need} voice part(s) join in order; each image gets equal time (slow zoom). Nothing uploads.</p>
      <div className="rounded-xl border bg-neutral-50 p-3 text-sm space-y-2">
        <p className="font-medium">Voice parts: {voiceDone}/{need} attached</p>
        <p className="text-xs text-neutral-500">Attach here or in Story card 2 (voice mode) — both stay in sync.</p>
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
        <p className="text-xs text-neutral-500">Save website screenshots on Story, then upload those files here. 1 image builds fine; up to 12 just adds variety (each part cycles images).</p>
      </div>
      <button className="btn-primary" disabled={busy || voiceDone < need || !images.length} onClick={build}>{busy ? `Building ${pct}%` : failed ? 'Retry build' : `Build ${durationSec}s commercial`}</button>
      {busy && <div className="h-2 bg-neutral-200 rounded-full overflow-hidden"><div className="h-full bg-black transition-all" style={{ width: `${pct}%` }} /></div>}
      {outUrl && <div className="space-y-2"><video src={outUrl} controls playsInline className="w-full max-w-sm mx-auto rounded-xl border" /><p className="text-xs text-neutral-500 text-center">{finalName} {outMB}</p><div className="flex justify-center"><a className="btn-primary" href={outUrl} download={finalName}>Download final MP4</a></div></div>}
      {msg && <p className="text-sm bg-neutral-100 border rounded-xl p-3">{msg}</p>}
    </div>
  );
}
