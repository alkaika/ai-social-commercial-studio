import type { SparkModelId } from '@/config/pricing';
import type { AdScript } from '@/lib/script-utils';
import { mockScript } from './mocks';

export function mockVoiceUrl(sceneId: string) { return ''; }

// Captions adapter (KEPT per user decision 2026-10-27 — relabeled, not removed).
// Verified against https://dev.meta.ai/docs:
// Muse Voice Transcribe (muse-voice-transcribe-1.0, $0.18/hour) is
// SPEECH-TO-TEXT ONLY for auto-captions/QC. Transcription is POST
// /v1/asr/transcribe (multipart/form-data: `request` JSON + `audio` WAV file).
// There is NO text-to-speech endpoint on Meta Model API — voice-over comes
// from meta.ai text-to-voice clips (see voiceClipUrl on ScriptScene).
// Old names kept as aliases so existing imports never break.
/** @deprecated Use checkCaptionsAvailability — Voice Transcribe is STT-only, no synthesis. */
export async function synthesizeVoice(opts: { key: string; baseUrl: string; text: string; voice?: string; speed?: number }): Promise<{ audioBase64?: string; mock: boolean; reason?: string }> {
  void opts;
  return { mock: true, reason: 'no-tts-endpoint-use-metai-clip' };
}
export const checkCaptionsAvailability = synthesizeVoice;

export async function transcribeCaptions(opts: { key: string; baseUrl: string; audioBase64: string }) {
  void opts;
  // Real path (multipart, not JSON): POST /v1/asr/transcribe with
  // -F 'request={"model":"muse-voice-transcribe-1.0","audioEncoding":"WAV","mode":"PUSH_TO_TALK"}'
  // -F "audio=@recording.wav;type=audio/wav"
  // Wire this when final-mix audio exists (FFmpeg phase). Until then captions
  // are derived from the approved script lines (zero cost, exact timing).
  return { mock: true, note: 'captions-from-script' as const };
}
