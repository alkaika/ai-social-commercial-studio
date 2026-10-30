// Browser preview voice — free, instant, no key.
// Uses SpeechSynthesis so the cadence slider (0.85x–1.2x) can actually be
// heard. Labeled everywhere as PREVIEW — final VO is meta.ai clips.
'use client';

export function previewSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function listPreviewVoices(): SpeechSynthesisVoice[] {
  if (!previewSupported()) return [];
  return window.speechSynthesis.getVoices();
}

export function pickPreviewVoice(prefer?: string): SpeechSynthesisVoice | null {
  const voices = listPreviewVoices();
  if (!voices.length) return null;
  if (prefer) {
    const hit = voices.find((v) => v.voiceURI === prefer || v.name === prefer);
    if (hit) return hit;
  }
  // Prefer a natural English voice; fall back to default.
  return (
    voices.find((v) => v.default && v.lang.startsWith('en')) ||
    voices.find((v) => v.lang.startsWith('en')) ||
    voices[0]
  );
}

export function stopPreview(): void {
  if (previewSupported()) window.speechSynthesis.cancel();
}

export function speakPreview(
  text: string,
  opts: { rate?: number; voiceURI?: string; onend?: () => void; onerror?: (m: string) => void } = {}
): void {
  if (!previewSupported()) {
    opts.onerror?.('Preview voice not supported in this browser.');
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.slice(0, 800));
  u.rate = Math.min(2, Math.max(0.5, opts.rate ?? 1));
  const v = opts.voiceURI ? listPreviewVoices().find((x) => x.voiceURI === opts.voiceURI || x.name === opts.voiceURI) : pickPreviewVoice();
  if (v) u.voice = v;
  u.onend = () => opts.onend?.();
  u.onerror = () => opts.onerror?.('Preview playback failed.');
  window.speechSynthesis.speak(u);
}
