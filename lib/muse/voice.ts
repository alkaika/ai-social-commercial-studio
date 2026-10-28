import type { SparkModelId } from '@/config/pricing';
import type { AdScript } from '@/lib/script-utils';
import { mockScript } from './mocks';

export function mockVoiceUrl(sceneId: string) { return ''; }

// Verified against https://dev.meta.ai/docs (2026-10-27):
// Muse Voice Transcribe (muse-voice-transcribe-1.0, $0.18/hour) is
// SPEECH-TO-TEXT ONLY. Transcription is POST /v1/asr/transcribe
// (multipart/form-data: `request` JSON + `audio` WAV file).
// There is NO text-to-speech endpoint on Meta Model API — we must never
// probe /v1/audio/speech (404) or promise synthetic voice-over.
export async function synthesizeVoice(opts: { key: string; baseUrl: string; text: string; voice?: string; speed?: number }): Promise<{ audioBase64?: string; mock: boolean; reason?: string }> {
  void opts;
  // Seam kept for API compatibility with /api/muse/voice. Real voice-over
  // today comes from: user recording/upload, or the audio baked into an
  // uploaded meta.ai clip. Captions are generated from the script + (later)
  // /v1/asr/transcribe on the final mix.
  return { mock: true, reason: 'no-tts-endpoint' };
}

export async function transcribeCaptions(opts: { key: string; baseUrl: string; audioBase64: string }) {
  void opts;
  // Real path (multipart, not JSON): POST /v1/asr/transcribe with
  // -F 'request={"model":"muse-voice-transcribe-1.0","audioEncoding":"WAV","mode":"PUSH_TO_TALK"}'
  // -F "audio=@recording.wav;type=audio/wav"
  // Wire this when final-mix audio exists (FFmpeg phase). Until then captions
  // are derived from the approved script lines (zero cost, exact timing).
  return { mock: true, note: 'captions-from-script' as const };
}
