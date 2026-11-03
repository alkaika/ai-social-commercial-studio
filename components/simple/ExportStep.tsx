'use client';
import { useMemo, useRef, useState } from 'react';
import { useProject } from '@/stores/projectStore';
import { PLATFORMS } from '@/config/platforms';
import { stitchParts, stitchAudioParts, resetFFmpeg, errText } from '@/lib/render/ffmpeg';
import KenBurnsExportCard from '@/components/simple/KenBurnsExportCard';

export default function ExportStep({ onBack }: { onBack?: () => void }) {
  const { script, platform, durationSec, storyMode } = useProject();
  const kbMode = (storyMode as string) === 'voice-kenburns';
  const pf = PLATFORMS[platform as keyof typeof PLATFORMS];
  const [parts, setParts] = useState<File[]>([]);
  const [partKind, setPartKind] = useState<'video' | 'audio'>('video');
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

  const onPick = (files: FileList | null) => {
    if (!files) return;
    const isAudio = (f: File) => /mp3|mpeg|m4a|aac|wav|ogg|audio/i.test(f.type) || /\.(mp3|m4a|aac|wav|ogg|mp4)$/i.test(f.name);
    const isVideo = (f: File) => /mp4|video|quicktime|m4v/i.test(f.type) || /\.mp4$/i.test(f.name);
    // Keep the batch single-type: if the first accepted file is audio, take
    // audio files; otherwise take video files. Mixed drops go video-first.
    const arr = Array.from(files);
    const firstVideoIdx = arr.findIndex(isVideo);
    const firstAudioOnlyIdx = arr.findIndex((f) => isAudio(f) && !isVideo(f));
    const wantAudio = firstAudioOnlyIdx !== -1 && (firstVideoIdx === -1 || firstAudioOnlyIdx < firstVideoIdx);
    const picked = arr.filter((f) => (wantAudio ? (isAudio(f) && !isVideo(f)) : isVideo(f))).slice(0, 8);
    if (!picked.length) { setMsg('Pick the files you downloaded from meta.ai (.mp4 video parts or .mp3 audio parts).'); return; }
    const kind = wantAudio ? 'audio' : 'video';
    const sorted = [...picked].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    setParts(sorted); setPartKind(kind); setOutUrl('');
    setMsg(`${sorted.length} ${kind} part(s) queued: ${sorted.map((f) => f.name).join(', ')}`);
  };
  const stitch = async () => {
    if (!parts.length) { setMsg(`Upload your Part ${partKind === 'audio' ? 'MP3s' : 'MP4s'} first (need ${need} for ${durationSec}s).`); return; }
    if (failed) { resetFFmpeg(); setFailed(false); setShowTech(false); }
    setBusy(true); setPct(0); setStep('Starting…'); setMsg('Loading stitcher (~30MB first time)…');
    try {
      const r = partKind === 'audio'
        ? await stitchAudioParts(parts, { onProgress: setPct, onStep: setStep })
        : await stitchParts(parts, { width: pf.width, height: pf.height, onProgress: setPct, onStep: setStep });
      setOutUrl(r.url); setOutMB(`${(r.sizeBytes / 1048576).toFixed(1)} MB`); setStep('');
      setMsg(('Joined + normalized — preview + download below. ') + (r.log ? 'Tap "what happened" for the technical log.' : ''));
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
  const finalNameAudio = `commercial-${platform}-${durationSec}s-final.mp3`;
  return (
    <div className="space-y-4">
      {kbMode ? (<KenBurnsExportCard />) : (
      <div className="card space-y-3">
        <h3 className="font-semibold">Stitch my parts — one final file (free, in browser)</h3>
        <p className="text-base text-neutral-800">Meta.ai should stitch the parts for you on the last paste — download that finished file first. Only use this if Meta.ai gave you separate part files: upload the {need} Part MP4s or Part MP3s in order. Open-source FFmpeg joins them on your device — nothing uploads.</p>
        <input ref={inputRef} type="file" accept="video/mp4,video/*,audio/mpeg,audio/*,.mp4,.mp3,.m4a,.aac,.wav,.ogg" multiple className="hidden" onChange={(e) => { onPick(e.target.files); e.target.value = ''; }} />
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => inputRef.current?.click()}>Upload Part files ({parts.length}/{need}){partKind === 'audio' ? ' · MP3' : ''}</button>
          {parts.length > 0 && <button className="btn-secondary" onClick={() => { setParts([]); setPartKind('video'); setOutUrl(''); setMsg(''); }}>Clear</button>}
        </div>
        {parts.length > 0 && <ol className="list-decimal ml-5 text-sm text-neutral-700">{parts.map((f, i) => <li key={i}>{f.name} · {(f.size / 1048576).toFixed(1)} MB</li>)}</ol>}
        <button className="btn-primary" disabled={busy || !parts.length} onClick={stitch}>{busy ? `Stitching… ${Math.max(0, Math.min(100, pct))}%${step ? ` — ${step}` : ''}` : failed ? '🔁 Retry stitch' : partKind === 'audio' ? `Stitch ${parts.length || need} part(s) → final MP3` : `Stitch ${parts.length || need} part(s) → final MP4`}</button>
        {busy && <div className="h-2 bg-neutral-200 rounded-full overflow-hidden"><div className="h-full bg-black transition-all" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>}
        {busy && step && <p className="text-base text-neutral-800">{step}</p>}
        {outUrl && (partKind === 'audio'
          ? (<div className="space-y-2"><audio src={outUrl} controls className="w-full" /><p className="text-base text-neutral-800 text-center">{finalNameAudio} · {outMB}</p><div className="flex justify-center"><a className="btn-primary" href={outUrl} download={finalNameAudio}>Download final MP3</a></div></div>)
          : (<div className="space-y-2"><video src={outUrl} controls playsInline className="w-full max-w-sm mx-auto rounded-xl border" style={{ aspectRatio: pf.aspect.replace(':', '/') }} /><p className="text-base text-neutral-800 text-center">{finalName} · {outMB}</p><div className="flex justify-center"><a className="btn-primary" href={outUrl} download={finalName}>Download final MP4</a></div></div>))}
        <details className="text-base text-neutral-800"><summary className="cursor-pointer underline">Manual fallback (ffmpeg CLI)</summary><pre className="whitespace-pre-wrap bg-neutral-100 rounded-xl p-3 mt-2">{`# parts must be listed in order in list.txt as:\n# file 'part1.mp4'\n# file 'part2.mp4'\nffmpeg -fflags +genpts -f concat -safe 0 -i list.txt -vf "scale=${pf.width}:${pf.height}:force_original_aspect_ratio=increase,crop=${pf.width}:${pf.height},setsar=1,fps=30" -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -r 30 -c:a aac -b:a 128k -ar 44100 -ac 2 -movflags +faststart -avoid_negative_ts make_zero ${finalName}`}</pre></details>
        {msg && <p className="text-sm bg-neutral-100 border rounded-xl p-3 whitespace-pre-wrap">{msg}</p>}
        {msg && msg.includes('Technical detail') && (
          <details className="text-base text-neutral-800"><summary className="cursor-pointer underline">Copy technical detail for me</summary><pre className="whitespace-pre-wrap bg-neutral-100 rounded-xl p-3 mt-2">{msg}</pre></details>
        )}
      </div>
      )}
      <div className="flex justify-between items-center"><button className="btn-secondary" onClick={onBack}>← Back to story</button><span className="text-sm text-neutral-500">Nothing is final — go back, tweak, re-stitch anytime.</span></div>
    </div>
  );
}
