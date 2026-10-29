'use client';
import { useProject } from '@/stores/projectStore';
import { PLATFORMS } from '@/config/platforms';

export default function ExportStep({ onBack }: { onBack?: () => void }) {
  const { script, platform, brand, durationSec } = useProject();

  const download = (name: string, text: string, type = 'text/plain') => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; a.click();
  };

  const srt = () => {
    if (!script) return '';
    let t = 0; let out = '';
    script.scenes.forEach((s, i) => {
      const dur = s.durationSec;
      const f = (x: number) => new Date(x * 1000).toISOString().slice(11, 19) + ',000';
      out += `${i + 1}\n${f(t)} --> ${f(t + dur)}\n${s.voiceover}\n\n`;
      t += dur;
    });
    return out;
  };

  if (!script) return <div className="card">Generate your commercial first.</div>;

  return (
    <div className="card space-y-4">
      <h2 className="text-xl font-bold">📤 Export your commercial</h2>
      <p className="text-sm text-neutral-600">{PLATFORMS[platform].label} · {PLATFORMS[platform].width}×{PLATFORMS[platform].height} · {durationSec}s · Safe zones: {PLATFORMS[platform].captionSafe}</p>
      <div className="rounded-2xl border bg-neutral-900 text-white p-6 space-y-2 max-w-sm mx-auto" style={{ aspectRatio: PLATFORMS[platform].aspect.replace(':', '/') }}>
        <p className="font-bold">{brand.brandName}</p>
        {script.scenes.map((s) => (
          <div key={s.id} className="text-sm opacity-90">🎬 {s.heading}: {s.onScreenText} {s.motionSource === 'metai-upload' ? '🎞' : '🖼'}</div>
        ))}
        <p className="text-xs opacity-70">Phone preview — final MP4 renders at full {PLATFORMS[platform].width}×{PLATFORMS[platform].height}.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => download(`commercial-${platform}.srt`, srt())}>Download captions (.srt)</button>
        <button className="btn-secondary" onClick={() => download('script.txt', script.scenes.map((s) => `${s.heading}\nVO: ${s.voiceover}\nOn-screen: ${s.onScreenText}\nVisual: ${s.visualPrompt}\n`).join('\n'))}>Download script (.txt)</button>
        <button className="btn-secondary" onClick={() => download('project-backup.json', JSON.stringify({ script, brand, platform, durationSec }, null, 2), 'application/json')}>Download project backup</button>
      </div>
      <div className="flex justify-between items-center"><button className="btn-secondary" onClick={onBack}>← Back to story</button><span className="text-sm text-neutral-500">Nothing is final — go back, tweak, re-export anytime.</span></div>
      <p className="text-sm text-neutral-600">Full MP4 rendering uses FFmpeg.wasm in your browser (no server upload). Wire <code>lib/render/ffmpeg.ts</code> to enable one-click MP4 — captions + script export work today.</p>
    </div>
  );
}
