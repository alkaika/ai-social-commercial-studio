'use client';
import { useEffect, useRef, useState } from 'react';
import { useProject } from '@/stores/projectStore';
import { PLATFORMS } from '@/config/platforms';
import { buildKenBurnsCommercial, resetFFmpeg, errText } from '@/lib/render/ffmpeg';

function probeAudioSec(url: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    try {
      const a = new Audio();
      a.preload = 'metadata';
      a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) ? a.duration : undefined);
      a.onerror = () => resolve(undefined);
      a.src = url;
      setTimeout(() => resolve(undefined), 8000);
    } catch { resolve(undefined); }
  });
}

export default function KenBurnsExportCard() {
  const { platform, durationSec, projectId, voiceMp3Name } = useProject();
  const pf = PLATFORMS[platform as keyof typeof PLATFORMS];
  const [images, setImages] = useState<File[]>([]);
  const [voice, setVoice] = useState<File | null>(null);
  const [voiceName, setVoiceName] = useState<string>(voiceMp3Name || '');
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [step, setStep] = useState('');
  const [failed, setFailed] = useState(false);
  const [outUrl, setOutUrl] = useState('');
  const [outMB, setOutMB] = useState('');
  const [msg, setMsg] = useState('');
  const imgRef = useRef<HTMLInputElement | null>(null);
  const voiceRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (voice) return;
        const { getStoredBlob } = await import('@/lib/clips/db');
        const rec = await getStoredBlob(`${projectId || 'unassigned'}:voice-full`);
        if (rec?.blob && live) {
          setVoice(new File([rec.blob], rec.name || voiceMp3Name || 'voice.mp3', { type: rec.mime || 'audio/mpeg' }));
          setVoiceName(rec.name || voiceMp3Name || 'voice.mp3');
        }
      } catch {}
    })();
    return () => { live = false; };
  }, [projectId]);

  const onImages = (files: FileList | null) => {
    if (!files) return;
    const imgs = Array.from(files).filter((f) => /image\//i.test(f.type) || /\.(png|jpe?g|webp|gif)$/i.test(f.name)).slice(0, 12);
    if (!imgs.length) { setMsg('Pick image files (PNG/JPG) — saved website screenshots or Business photos.'); return; }
    setImages((prev) => [...prev, ...imgs].slice(0, 12)); setOutUrl('');
    setMsg(`${imgs.length} image(s) added for the motion.`);
  };

  const onVoice = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (!/audio|video|mp3|wav|m4a|aac|ogg|mp4/i.test(f.type + ' ' + f.name)) { setMsg('That is not audio — pick the MP3 (or MP4) from meta.ai.'); return; }
    setVoice(f); setVoiceName(f.name); setOutUrl('');
    try {
      const { useProject: useP } = await import('@/stores/projectStore');
      const url = URL.createObjectURL(f);
      try { const cur = useP.getState() as any; if (cur.voiceMp3Url?.startsWith('blob:')) URL.revokeObjectURL(cur.voiceMp3Url); } catch {}
      useP.getState().set({ voiceMp3Url: url, voiceMp3Name: f.name });
      const { saveStoredBlob } = await import('@/lib/clips/db');
      const pid = (projectId || 'unassigned') as string;
      await saveStoredBlob({ key: `${pid}:voice-full`, projectId: pid, sceneId: 'full', kind: 'voice-full', blob: f, name: f.name, mime: f.type || 'audio/mpeg', updatedAt: Date.now() });
    } catch {}
    setMsg(`Voice set: "${f.name}" — this exact audio plays in the final mix.`);
  };

  const build = async () => {
    if (!voice) { setMsg('Add your Meta.ai voice MP3 first (Story step, or below).'); return; }
    if (!images.length) { setMsg('Add one image to start.'); return; }
    if (failed) { resetFFmpeg(); setFailed(false); }
    setBusy(true); setPct(0); setStep('Starting');
    setMsg('Loading studio renderer.');
    try {
      const vUrl = URL.createObjectURL(voice);
      const audioSec = await probeAudioSec(vUrl);
      setTimeout(() => URL.revokeObjectURL(vUrl), 4000);
      const r = await buildKenBurnsCommercial({ images, audio: voice, audioSec, width: pf.width, height: pf.height, onProgress: setPct, onStep: setStep });
      setOutUrl(r.url); setOutMB(`${(r.sizeBytes / 1048576).toFixed(1)} MB`); setStep('');
      setMsg(`Built — slow zoom over ${images.length} image(s) under your voice.`);
    } catch (e: unknown) {
      setFailed(true);
      const d = errText(e);
      setMsg(!d ? 'Build failed — press Retry once.' : d);
    } finally { setBusy(false); }
  };

  const finalName = `kb-${platform}-${durationSec}s-final.mp4`;
  return (
    <div className="card space-y-3">
      <h3 className="font-semibold">Voice MP3 + Ken Burns — one final MP4</h3>
      <p className="text-sm text-neutral-600">Your Meta.ai voice plays while each image gets equal time (slow zoom). Nothing uploads.</p>
      <div className="rounded-xl border bg-neutral-50 p-3 text-sm space-y-1">
        <p className="font-medium">Voice: {voice ? voiceName : 'no voice yet'}</p>
        <input ref={voiceRef} type="file" accept="audio/*,video/mp4,video/*,.mp3,.wav,.m4a,.aac,.ogg,.mp4" className="hidden" onChange={(e) => { onVoice(e.target.files); e.target.value = ''; }} />
        <button className="btn-secondary" onClick={() => voiceRef.current?.click()}>{voice ? 'Replace voice file' : 'Upload voice MP3'}</button>
      </div>
      <div className="space-y-2">
        <p className="font-medium text-sm">Images ({images.length}/12)</p>
        <input ref={imgRef} type="file" accept="image/*,.png,.jpg,.jpeg,.webp,.gif" multiple className="hidden" onChange={(e) => { onImages(e.target.files); e.target.value = ''; }} />
        <button className="btn-secondary" onClick={() => imgRef.current?.click()}>Upload images ({images.length}/12)</button>
        <p className="text-xs text-neutral-500">Save website screenshots on Story, then upload those files here.</p>
      </div>
      <button className="btn-primary" disabled={busy || !voice || !images.length} onClick={build}>{busy ? `Building ${pct}%` : failed ? 'Retry build' : `Build ${durationSec}s commercial`}</button>
      {busy && <div className="h-2 bg-neutral-200 rounded-full overflow-hidden"><div className="h-full bg-black transition-all" style={{ width: `${pct}%` }} /></div>}
      {outUrl && <div className="space-y-2"><video src={outUrl} controls playsInline className="w-full max-w-sm mx-auto rounded-xl border" /><p className="text-xs text-neutral-500 text-center">{finalName} {outMB}</p><div className="flex justify-center"><a className="btn-primary" href={outUrl} download={finalName}>Download final MP4</a></div></div>}
      {msg && <p className="text-sm bg-neutral-100 border rounded-xl p-3">{msg}</p>}
    </div>
  );
}
