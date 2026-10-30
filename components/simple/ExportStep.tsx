'use client';
import { useMemo, useRef, useState } from 'react';
import { useProject } from '@/stores/projectStore';
import { PLATFORMS } from '@/config/platforms';
import { stitchParts, resetFFmpeg, errText } from '@/lib/render/ffmpeg';

export default function ExportStep({ onBack }: { onBack?: () => void }) {
  const { script, platform, brand, durationSec } = useProject();
  const pf = PLATFORMS[platform];
  const [parts, setParts] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [step, setStep] = useState('');
  const [failed, setFailed] = useState(false);
  const [showTech, setShowTech] = useState(false);
  const [outUrl, setOutUrl] = useState('');
  const [outMB, setOutMB] = useState('');
  const [msg, setMsg] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const need = useMemo(() => Math.max(1, Math.ceil(durationSec / 10)), [durationSec]);

  const download = (name: string, content: string | Blob) => {
    const url = typeof content === 'string' ? URL.createObjectURL(new Blob([content], { type: 'text/plain' })) : URL.createObjectURL(content);
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  };
  const srt = () => {
    if (!script) return '';
    let t = 0; let out = '';
    script.scenes.forEach((s, i) => {
      const f = (x: number) => new Date(x * 1000).toISOString().slice(11, 19) + ',000';
      out += `${i + 1}\n${f(t)} --> ${f(t + s.durationSec)}\n${s.voiceover}\n\n`; t += s.durationSec;
    });
    return out;
  };
  const onPick = (files: FileList | null) => {
    if (!files) return;
    const mp4 = Array.from(files).filter((f) => /mp4|video|quicktime|m4v/i.test(f.type) || /\.mp4$/i.test(f.name)).slice(0, 8);
    if (!mp4.length) { setMsg('Pick the .mp4 files you downloaded from meta.ai.'); return; }
    const sorted = [...mp4].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    setParts(sorted); setOutUrl('');
    setMsg(`${sorted.length} part(s) queued: ${sorted.map((f) => f.name).join(', ')}`);
  };
  const stitch = async () => {
    if (!parts.length) { setMsg(`Upload your Part MP4s first (need ${need} for ${durationSec}s).`); return; }
    if (failed) { resetFFmpeg(); setFailed(false); setShowTech(false); }
    setBusy(true); setPct(0); setStep('Starting…'); setMsg('Loading stitcher (~30MB first time)…');
    try {
      const r = await stitchParts(parts, { width: pf.width, height: pf.height, onProgress: setPct, onStep: setStep });
      setOutUrl(r.url); setOutMB(`${(r.sizeBytes / 1048576).toFixed(1)} MB`); setStep('');
      setMsg((r.usedRecode ? 'Joined with re-encode (clips differed). ' : 'Joined losslessly — preview + download below. ') + (r.log ? 'Tap "what happened" for the technical log.' : ''));
      if (r.log) setShowTech(true);
    } catch (e: unknown) {
      setFailed(true);
      const detail = errText(e);
      setMsg(detail === 'Stitch failed.' || !detail ? 'Stitch failed with no detail — press Retry once (log below), or use the manual command.' : detail);
    }
    finally { setBusy(false); }
  };
  if (!script) return <div className="card">Generate your commercial first.</div>;
  const finalName = `commercial-${platform}-${durationSec}s-final.mp4`;
  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <h2 className="text-xl font-bold">Export your commercial</h2>
        <p className="text-sm text-neutral-600">{pf.label} · {pf.width}x{pf.height} · {durationSec}s · Safe zones: {pf.captionSafe}</p>
        <div className="rounded-2xl border bg-neutral-900 text-white p-6 space-y-2 max-w-sm mx-auto" style={{ aspectRatio: pf.aspect.replace(':', '/') }}>
          <p className="font-bold">{brand.brandName}</p>
          {script.scenes.map((s) => <div key={s.id} className="text-sm opacity-90">🎬 {s.heading}</div>)}
          <p className="text-xs opacity-70">Phone preview — final MP4 renders at full {pf.width}x{pf.height}.</p>
        </div>
      </div>
      <div className="card space-y-3">
        <h3 className="font-semibold">Stitch my parts — one final MP4 (free, in browser)</h3>
        <p className="text-sm text-neutral-600">Upload the {need} Part MP4(s) from meta.ai in order. Open-source FFmpeg joins them on your device — nothing uploads.</p>
        <input ref={inputRef} type="file" accept="video/mp4,video/*,.mp4" multiple className="hidden" onChange={(e) => onPick(e.target.files)} />
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => inputRef.current?.click()}>Upload Part MP4s ({parts.length}/{need})</button>
          {parts.length > 0 && <button className="btn-secondary" onClick={() => { setParts([]); setOutUrl(''); setMsg(''); }}>Clear</button>}
        </div>
        {parts.length > 0 && <ol className="list-decimal ml-5 text-sm text-neutral-700">{parts.map((f, i) => <li key={i}>{f.name} · {(f.size / 1048576).toFixed(1)} MB</li>)}</ol>}
        <button className="btn-primary" disabled={busy || !parts.length} onClick={stitch}>{busy ? `Stitching… ${pct}%${step ? ` — ${step}` : ''}` : failed ? '🔁 Retry stitch' : `Stitch ${parts.length || need} part(s) → final MP4`}</button>
        {busy && <div className="h-2 bg-neutral-200 rounded-full overflow-hidden"><div className="h-full bg-black transition-all" style={{ width: `${pct}%` }} /></div>}
        {busy && step && <p className="text-xs text-neutral-500">{step}</p>}
        {outUrl && <div className="space-y-2"><video src={outUrl} controls playsInline className="w-full max-w-sm mx-auto rounded-xl border" style={{ aspectRatio: pf.aspect.replace(':', '/') }} /><p className="text-xs text-neutral-500 text-center">{finalName} · {outMB}</p><div className="flex justify-center"><a className="btn-primary" href={outUrl} download={finalName}>Download final MP4</a></div></div>}
        <details className="text-xs text-neutral-600"><summary className="cursor-pointer underline">Manual fallback (ffmpeg CLI)</summary><pre className="whitespace-pre-wrap bg-neutral-100 rounded-xl p-3 mt-2">{`ffmpeg -f concat -safe 0 -i list.txt -c copy ${finalName}`}</pre></details>
        {msg && <p className="text-sm bg-neutral-100 border rounded-xl p-3 whitespace-pre-wrap">{msg}</p>}
        {msg && msg.includes('Technical detail') && (
          <details className="text-xs text-neutral-600"><summary className="cursor-pointer underline">Copy technical detail for me</summary><pre className="whitespace-pre-wrap bg-neutral-100 rounded-xl p-3 mt-2">{msg}</pre></details>
        )}
      </div>
      <div className="card space-y-3">
        <h3 className="font-semibold">Captions + backup</h3>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => download(`commercial-${platform}.srt`, srt())}>Download captions (.srt)</button>
          <button className="btn-secondary" onClick={() => download('script.txt', script.scenes.map((s) => `${s.heading}\nVO: ${s.voiceover}\n`).join('\n'))}>Download script (.txt)</button>
          <button className="btn-secondary" onClick={() => download('project-backup.json', JSON.stringify({ script, brand, platform, durationSec }, null, 2))}>Download backup</button>
        </div>
        <div className="flex justify-between items-center"><button className="btn-secondary" onClick={onBack}>← Back to story</button><span className="text-sm text-neutral-500">Nothing is final — go back, tweak, re-export anytime.</span></div>
      </div>
    </div>
  );
}
