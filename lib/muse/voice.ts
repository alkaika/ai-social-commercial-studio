import type { SparkModelId } from '@/config/pricing';
import type { AdScript } from '@/lib/script-utils';
import { mockScript } from './mocks';

export function mockVoiceUrl(sceneId: string) { return ''; }

export async function synthesizeVoice(opts: { key: string; baseUrl: string; text: string; voice?: string; speed?: number }): Promise<{ audioBase64?: string; mock: boolean }> {
  if (!opts.key || opts.key === 'DEMO') return { mock: true };
  // Muse Voice Transcribe 1.0 — speech endpoint (OpenAI-compatible assumed).
  // If your gateway uses a different path, change only here.
  const { callMuse } = await import('./client');
  try {
    const data: any = await callMuse({
      key: opts.key, baseUrl: opts.baseUrl, path: '/v1/audio/speech',
      body: { model: 'muse-voice-transcribe-1.0', input: opts.text, voice: opts.voice || 'nova', speed: opts.speed || 1.0, response_format: 'mp3' },
      timeoutMs: 90000,
    });
    return { audioBase64: data?.audio_base64 || data?.data?.[0]?.b64 || undefined, mock: false };
  } catch { return { mock: true }; }
}

export async function transcribeCaptions(opts: { key: string; baseUrl: string; audioBase64: string }) {
  const { callMuse } = await import('./client');
  const data: any = await callMuse({
    key: opts.key, baseUrl: opts.baseUrl, path: '/v1/audio/transcriptions',
    body: { model: 'muse-voice-transcribe-1.0', audio: opts.audioBase64 },
  });
  return data;
}
