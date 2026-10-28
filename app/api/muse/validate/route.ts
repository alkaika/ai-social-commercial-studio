import { NextRequest, NextResponse } from 'next/server';
import { byokHeaders, callMuse, callMuseGet, normalizeBase, MuseGatewayError } from '@/lib/muse/client';
import { GATEWAY_MODELS } from '@/lib/muse/models.config';

// Verified against https://dev.meta.ai/docs (2026-10-27):
// - Spark (both IDs) + Image generation WORK at OpenAI-style paths (user live test: 3/6 ✅).
// - SAM 3.1: model ID is `sam-3-1` (hyphens). Segmentation via POST /v1/responses.
// - Voice Transcribe: model muse-voice-transcribe-1.0, SPEECH-TO-TEXT ONLY at
//   POST /v1/asr/transcribe (multipart). There is NO TTS endpoint, so we never
//   probe /v1/audio/speech again (404).
// - Wonder: muse-wonder-1.0 is a reasoning/coding model (text out). There is NO
//   video-generation endpoint (POST /v1/videos/generations → 405), so we never
//   probe it as video. We only check the model exists in the catalog.
// Strategy: GET /v1/models + GET /v1/models/{id} for existence (cheap, no
// generation cost), plus a 1-token chat ping for the two Spark writers to
// prove inference actually works. 401/403 = 'auth' (endpoint exists, key
// rejected); 404 = 'fail'.

export async function POST(req: NextRequest) {
  try {
    const { key, baseUrl } = byokHeaders(req);
    // Validate key against each model. Never logs the key.
    const base = normalizeBase(baseUrl);
    const checks: Record<string, 'ok' | 'fail' | 'auth'> = {};
    const details: Record<string, string> = {};

    const failFrom = (e: any, url: string): ['fail' | 'auth', string] => {
      const status = e instanceof MuseGatewayError ? e.status : 0;
      const msg = `${url} → ${(e?.message || 'failed').slice(0, 300)}`;
      return status === 401 || status === 403
        ? ['auth', msg + ' — endpoint exists, key rejected (wrong scope or plan).']
        : ['fail', msg];
    };

    // 1) Cheap catalog check for every model (no generation cost).
    const catalog = async (name: string, modelId: string, note: string) => {
      const url = `${base}/v1/models/${modelId}`;
      try {
        await callMuseGet({ key, baseUrl, path: `/v1/models/${modelId}` });
        checks[name] = 'ok';
        details[name] = `Model found (${url}). ${note}`;
      } catch (e: any) {
        const [s, d] = failFrom(e, url);
        checks[name] = s;
        details[name] = d;
      }
    };

    // 2) Real 1-token inference ping for the two Spark writers + image gen.
    const pingChat = async (name: string, modelId: string) => {
      const url = `${base}/v1/chat/completions`;
      try {
        await callMuse({
          key, baseUrl, path: '/v1/chat/completions',
          body: { model: modelId, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 },
          timeoutMs: 20000,
        });
        checks[name] = 'ok';
        details[name] = `OK (${url}, model ${modelId})`;
      } catch (e: any) {
        const [s, d] = failFrom(e, url);
        checks[name] = s;
        details[name] = d;
      }
    };

    const pingImage = async () => {
      const url = `${base}/v1/images/generations`;
      try {
        await callMuse({
          key, baseUrl, path: '/v1/images/generations',
          body: { model: GATEWAY_MODELS.image, prompt: 'ping', n: 1 },
          timeoutMs: 30000,
        });
        checks['image'] = 'ok';
        details['image'] = `OK (${url}, model ${GATEWAY_MODELS.image})`;
      } catch (e: any) {
        const [s, d] = failFrom(e, url);
        checks['image'] = s;
        details['image'] = d;
      }
    };

    await Promise.all([
      pingChat('spark-standard', GATEWAY_MODELS.sparkStandard),
      pingChat('spark-contributor', GATEWAY_MODELS.sparkContributor),
      pingImage(),
      catalog('voice', GATEWAY_MODELS.voice, 'Speech-to-text only (captions/QC) at POST /v1/asr/transcribe — no voice-over synthesis endpoint exists.'),
      catalog('sam', GATEWAY_MODELS.sam, 'Segmentation via POST /v1/responses (model sam-3-1).'),
      catalog('wonder', GATEWAY_MODELS.wonder, 'Reasoning/coding model (text out) — NOT video generation. No video endpoint exists; motion uses uploaded meta.ai clips or Ken Burns.'),
    ]);
    return NextResponse.json({ checks, details, baseUrl: base });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Validation failed.' }, { status: 400 });
  }
}
