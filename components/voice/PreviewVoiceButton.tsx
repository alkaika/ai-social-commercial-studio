// Preview voice button: free instant speech via SpeechSynthesis.
// Clearly labeled PREVIEW — final VO is meta.ai clips. Rate follows the
// scene cadence so the 0.85x–1.2x slider can actually be heard.
'use client';
import { useEffect, useState } from 'react';
import { previewSupported, listPreviewVoices, speakPreview, stopPreview } from '@/lib/voice/preview';

export default function PreviewVoiceButton({ text, rate = 1 }: { text: string; rate?: number }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState('');
  const [playing, setPlaying] = useState(false);
  const ok = previewSupported();
  useEffect(() => {
    if (!ok) return;
    const load = () => setVoices(listPreviewVoices());
    load();
    try { window.speechSynthesis.onvoiceschanged = load; } catch { /* x */ }
    return () => { stopPreview(); };
  }, [ok]);
  if (!ok) return null;
  const play = () => {
    if (playing) { stopPreview(); setPlaying(false); return; }
    setPlaying(true);
    speakPreview(text, { rate, voiceURI: voiceURI || undefined, onend: () => setPlaying(false), onerror: () => setPlaying(false) });
  };
  return (
    <span className="inline-flex items-center gap-1">
      <button className="btn-secondary !py-1 !px-3 text-xs" onClick={play}>{playing ? 'Stop preview' : 'Hear preview'}</button>
      {voices.length > 0 && (
        <select className="text-xs border rounded-lg px-1 py-1 max-w-[140px]" value={voiceURI} onChange={(e) => setVoiceURI(e.target.value)} title="Preview voice (browser only)">
          <option value="">Auto voice</option>
          {voices.slice(0, 30).map((v) => (<option key={v.voiceURI} value={v.voiceURI}>{v.name.slice(0, 28)}</option>))}
        </select>
      )}
      <span className="text-[11px] text-neutral-500">preview only</span>
    </span>
  );
}
