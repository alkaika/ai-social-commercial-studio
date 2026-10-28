import { NextRequest, NextResponse } from 'next/server';
import { byokHeaders, callMuse, normalizeBase, MuseGatewayError } from '@/lib/muse/client';
import { GATEWAY_MODELS } from '@/lib/muse/models.config';

// Candidate paths per capability. Meta Model API exposes chat + image at
// OpenAI-style paths; audio/video/SAM paths are guesses we probe in order.
// First 2xx wins; if all fail we report the LAST error (most informative).
const CANDIDATES: Record<string, { path: string; body: any }[]> = {
  'spark-standard': [
    { path: '/v1/chat/completions', body: { model: GATEWAY_MODELS.sparkStandard, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 } },
  ],
  'spark-contributor': [
    { path: '/v1/chat/completions', body: { model: GATEWAY_MODELS.sparkContributor, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 } },
  ],
  image: [
    { path: '/v1/images/generations', body: { model: GATEWAY_MODELS.image, prompt: 'ping', size: '256x256' } },
  ],
  voice: [
    // TTS guess first, then transcription-style probe
    { path: '/v1/audio/speech', body: { model: GATEWAY_MODELS.voice, input: 'hi', voice: 'nova' } },
    { path: '/v1/audio/transcriptions', body: { model: GATEWAY_MODELS.voice, input: 'hi' } },
  ],
  sam: [
    { path: '/v1/sam/segment', body: { model: GATEWAY_MODELS.sam, image: 'ping' } },
    { path: '/v1/images/edits', body: { model: GATEWAY_MODELS.sam, image: 'ping', prompt: 'segment' } },
  ],
  wonder: [
    { path: '/v1/video/generations', body: { model: GATEWAY_MODELS.wonder, prompt: 'ping' } },
    { path: '/v1/videos/generations', body: { model: GATEWAY_MODELS.wonder, prompt: 'ping' } },
  ],
};

export async function POST(req: NextRequest) {
  try {
    const { key, baseUrl } = byokHeaders(req);
    // Validate key against each model with a tiny call. Never logs the key.
    // Returns per-model status + short error reason so the UI can explain WHY.
    // Probes candidate paths in order; 401/403 (auth-shaped) counts as "endpoint
    // exists" → 'auth' status, while 404 tries the next candidate.
    const base = normalizeBase(baseUrl);
    const checks: Record<string, 'ok' | 'fail' | 'auth'> = {};
    const details: Record<string, string> = {};
    const tryCheck = async (name: string) => {
      let lastErr = '';
      for (const c of CANDIDATES[name]) {
        const url = `${base}${c.path}`;
        try {
          await callMuse({ key, baseUrl, path: c.path, body: c.body, timeoutMs: 20000 });
          checks[name] = 'ok';
          details[name] = `OK (${url})`;
          return;
        } catch (e: any) {
          const status = e instanceof MuseGatewayError ? e.status : 0;
          lastErr = `${url} → ${(e?.message || 'failed').slice(0, 300)}`;
          // Auth-shaped error = endpoint EXISTS, key lacks scope. Don't 404-fail it.
          if (status === 401 || status === 403) {
            checks[name] = 'auth';
            details[name] = lastErr + ' — endpoint exists, key rejected (wrong scope or plan).';
            return;
          }
          // else try next candidate
        }
      }
      checks[name] = 'fail';
      details[name] = lastErr;
    };
    await Promise.all(Object.keys(CANDIDATES).map(tryCheck));
    return NextResponse.json({ checks, details, baseUrl: base });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Validation failed.' }, { status: 400 });
  }
}
