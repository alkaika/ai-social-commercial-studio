'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { WebsiteShot } from '@/lib/screenshots';
import { microlinkUrl } from '@/lib/screenshots';

// mShots returns a small WP-logo placeholder on first hit (renders ~5-15s
// server-side). Opening in a new tab later shows the real shot. Detect the
// small placeholder by naturalWidth and auto-retry with a cache-buster,
// then fall through to thum.io -> microlink.
const PH_MAX_W = 700;
const MAX_RETRY = 5;
const DELAYS = [3000, 4000, 6000, 8000, 10000];

export default function ShotImg({ shot, alt }: { shot: WebsiteShot; alt: string }) {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const base = stage === 0 ? shot.imageUrl : stage === 1 ? shot.fallbackUrl : microlinkUrl(shot.pageUrl);
  const src = stage === 0 && attempt > 0 ? `${base}${base.includes('?') ? '&' : '?'}r=${attempt}&t=${Date.now()}` : base;

  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  useEffect(() => clear, []);
  useEffect(() => { clear(); setStage(0); setAttempt(0); setBusy(true); setFailed(false); }, [shot.imageUrl]);

  const retry = useCallback(() => {
    clear();
    if (attempt < MAX_RETRY) {
      timer.current = setTimeout(() => setAttempt((a) => a + 1), DELAYS[Math.min(attempt, DELAYS.length - 1)]);
    } else { setStage(1); setAttempt(0); setBusy(true); }
  }, [attempt]);

  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const w = e.currentTarget.naturalWidth || 0;
    if (stage === 0 && w > 0 && w < PH_MAX_W) { setBusy(true); retry(); return; }
    setBusy(false);
  };

  const onErr = () => {
    clear();
    if (stage === 0) {
      if (attempt < 2) { setBusy(true); timer.current = setTimeout(() => setAttempt((a) => a + 1), 3000); }
      else { setStage(1); setAttempt(0); setBusy(true); }
    } else if (stage === 1) { setStage(2); setBusy(true); }
    else { setBusy(false); setFailed(true); }
  };

  return (
    <span className="relative block w-full overflow-hidden rounded-xl bg-neutral-100">
      <span className="block w-full aspect-video overflow-hidden">
        {!failed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={`${stage}-${attempt}`} src={src} alt={alt} loading="lazy" onLoad={onLoad} onError={onErr} className="h-full w-full object-cover object-top" />
        )}
      </span>
      {busy && !failed && (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-neutral-100/85 text-center px-2">
          <span className="text-sm animate-pulse">Rendering website preview…</span>
          <span className="text-[11px] text-neutral-500">First render ~10s{attempt > 0 ? ` · retry ${attempt}/${MAX_RETRY}` : ''}</span>
        </span>
      )}
      {failed && (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-neutral-100 text-center p-2">
          <span className="text-xs text-neutral-500">Preview did not load.</span>
          <button type="button" className="text-xs underline" onClick={(e) => { e.stopPropagation(); setFailed(false); setBusy(true); setStage(0); setAttempt((a) => a + 1); }}>Try again</button>
        </span>
      )}
    </span>
  );
}
