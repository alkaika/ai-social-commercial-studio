'use client';
import { DURATIONS, PLATFORMS, TONES, type PlatformId } from '@/config/platforms';
import { useProject } from '@/stores/projectStore';

export default function ConfigureStep({ onDone, onBack }: { onDone: () => void; onBack?: () => void }) {
  const { durationSec, platform, tone, set } = useProject();
  return (
    <div className="card space-y-5">
      <h2 className="text-xl font-bold">🎬 Pick your style</h2>
      <p className="text-sm text-neutral-600">Changing anything here starts a fresh cut on the next screen — your approved Business script stays untouched.</p>
      <div>
        <p className="font-medium mb-2">How long?</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {DURATIONS.map((d) => (
            <button key={d.sec} onClick={() => set({ durationSec: d.sec })}
              className={`border-2 rounded-2xl p-3 text-left ${durationSec === d.sec ? 'border-black bg-neutral-50' : 'border-neutral-200'}`}>
              <div className="font-bold">{d.label}</div><div className="text-xs text-neutral-600">{d.desc}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="font-medium mb-2">Where will you post it?</p>
        <div className="grid sm:grid-cols-3 gap-2">
          {(Object.keys(PLATFORMS) as PlatformId[]).map((id) => (
            <button key={id} onClick={() => set({ platform: id })}
              className={`border-2 rounded-2xl p-3 text-left ${platform === id ? 'border-black bg-neutral-50' : 'border-neutral-200'}`}>
              <div className="font-semibold text-sm">{PLATFORMS[id].label}</div>
              <div className="text-xs text-neutral-600">{PLATFORMS[id].aspect} · {PLATFORMS[id].note}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="font-medium mb-2">What vibe?</p>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <button key={t.id} onClick={() => set({ tone: t.id })} className={`border-2 rounded-full px-4 py-2 ${tone === t.id ? 'border-black bg-neutral-100' : 'border-neutral-200'}`}>{t.emoji} {t.label}</button>
          ))}
        </div>
      </div>
      <div className="flex justify-between items-center"><button className="btn-secondary" onClick={onBack}>← Back</button><button className="btn-primary" onClick={() => {
        // Fresh cut: drop any previously organized scenes. The approved
        // master script is untouched — the Story step re-organizes it
        // for the newly picked duration/platform/vibe.
        set({ script: null });
        onDone();
      }}>Generate my commercial →</button></div>
    </div>
  );
}
