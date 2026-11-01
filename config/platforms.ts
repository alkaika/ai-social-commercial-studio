export type PlatformId = 'tiktok' | 'reels' | 'shorts' | 'ig-feed' | 'square' | 'landscape';

export const PLATFORMS: Record<
  PlatformId,
  { id: PlatformId; label: string; width: number; height: number; aspect: string; captionSafe: string; note: string }
> = {
  tiktok:    { id: 'tiktok',    label: 'TikTok',            width: 1080, height: 1920, aspect: '9:16', captionSafe: 'Keep text clear of bottom 250px + right 120px', note: 'Most popular — vertical full-screen' },
  reels:     { id: 'reels',     label: 'Instagram Reels',   width: 1080, height: 1920, aspect: '9:16', captionSafe: 'Keep text clear of bottom 300px', note: 'Same size as TikTok' },
  shorts:    { id: 'shorts',    label: 'YouTube Shorts',    width: 1080, height: 1920, aspect: '9:16', captionSafe: 'Keep text clear of bottom 200px', note: 'Same size as TikTok' },
  'ig-feed': { id: 'ig-feed',   label: 'Instagram Feed',    width: 1080, height: 1350, aspect: '4:5',  captionSafe: 'Keep text inside middle 80%', note: 'Portrait feed post' },
  square:    { id: 'square',    label: 'Square (FB / X)',   width: 1080, height: 1080, aspect: '1:1',  captionSafe: 'Keep text inside middle 85%', note: 'Facebook, X, LinkedIn feed' },
  landscape: { id: 'landscape', label: 'Landscape (YouTube)', width: 1920, height: 1080, aspect: '16:9', captionSafe: 'Keep text inside middle 80%', note: 'YouTube + LinkedIn video' },
};

export const DURATIONS = [
  { sec: 10, label: '10s', desc: 'One message · 1 part', scenes: 1, words: 35 },
  { sec: 20, label: '20s', desc: 'TikTok / Reels / Shorts · 2 parts', scenes: 2, words: 70 },
  { sec: 30, label: '30s', desc: 'Tell a story · 3 parts', scenes: 3, words: 105 },
  { sec: 60, label: '60s', desc: 'Full showcase · 6 parts', scenes: 6, words: 210 },
];

// Scripts are built in 10s batches — only multiples of 10 are valid.
// Legacy saves (5s / 15s) snap to the nearest valid slot: 5 → 10, 15 → 20.
export const ALLOWED_DURATIONS = DURATIONS.map((d) => d.sec);

export function normalizeDurationSec(sec: unknown): number {
  const n = typeof sec === 'number' && Number.isFinite(sec) ? sec : 20;
  if ((ALLOWED_DURATIONS as number[]).includes(n)) return n;
  let best = ALLOWED_DURATIONS[0];
  let bestDist = Math.abs(n - best);
  for (const a of ALLOWED_DURATIONS) {
    const dist = Math.abs(n - a);
    // Round half-up (15 → 20, not 10) so legacy cuts keep their words.
    if (dist < bestDist || (dist === bestDist && a > best)) {
      best = a;
      bestDist = dist;
    }
  }
  return best;
}

export const TONES = [
  { id: 'fun', label: 'Fun', emoji: '😄' },
  { id: 'professional', label: 'Professional', emoji: '💼' },
  { id: 'bold', label: 'Bold', emoji: '🔥' },
  { id: 'friendly', label: 'Friendly', emoji: '😊' },
  { id: 'premium', label: 'Premium', emoji: '✨' },
];
