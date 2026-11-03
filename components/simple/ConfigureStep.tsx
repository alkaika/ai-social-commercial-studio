'use client';
import { useEffect } from 'react';
import { DURATIONS, PLATFORMS, TONES, normalizeDurationSec, type PlatformId } from '@/config/platforms';
import { useProject } from '@/stores/projectStore';

export default function ConfigureStep({ onDone, onBack }: { onDone: () => void; onBack?: () => void }) {
  const { durationSec, platform, tone, set } = useProject();
  // Snap legacy saves/open projects (5s / 15s) to the 10s batch grid.
  useEffect(() => {
    const fixed = normalizeDurationSec(durationSec);
    if (fixed !== durationSec) set({ durationSec: fixed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="card space-y-5">
      <p className="meta-eyebrow">Setup</p>
      <h2 className="font-semibold tracking-tight text-[22px] leading-tight">Choose your platform & settings</h2>
      <p className="text-base text-neutral-800">Your script will be written with these settings in mind — length, platform, and vibe shape the draft from the start.</p>
      <div>
        <p className="font-medium mb-2">How long?</p>
        <p className="text-base text-neutral-800 mb-2">Built in 10-second batches — TikTok, Reels & Shorts use 10s or 20s.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
      <div className="flex justify-between items-center"><button className="btn-secondary" onClick={onBack}>← Back</button><button className="btn-primary" onClick={onDone}>Continue →</button></div>
    </div>
  );
}
