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
  { sec: 5, label: '5s', desc: 'A quick teaser', scenes: 1, words: 12 },
  { sec: 10, label: '10s', desc: 'One message', scenes: 2, words: 25 },
  { sec: 15, label: '15s', desc: 'Most popular', scenes: 3, words: 37 },
  { sec: 30, label: '30s', desc: 'Tell a story', scenes: 5, words: 75 },
  { sec: 60, label: '60s', desc: 'Full showcase', scenes: 7, words: 150 },
];

export const TONES = [
  { id: 'fun', label: 'Fun', emoji: '😄' },
  { id: 'professional', label: 'Professional', emoji: '💼' },
  { id: 'bold', label: 'Bold', emoji: '🔥' },
  { id: 'friendly', label: 'Friendly', emoji: '😊' },
  { id: 'premium', label: 'Premium', emoji: '✨' },
];
