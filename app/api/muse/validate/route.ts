import { NextRequest, NextResponse } from 'next/server';
import { byokHeaders, callMuse } from '@/lib/muse/client';
import { GATEWAY_MODELS } from '@/lib/muse/models.config';

export async function POST(req: NextRequest) {
  try {
    const { key, baseUrl } = byokHeaders(req);
    // Validate key against each model with a tiny call. Never logs the key.
    const checks: Record<string, 'ok' | 'fail'> = {};
    const tryCheck = async (name: string, path: string, body: any) => {
      try { await callMuse({ key, baseUrl, path, body, timeoutMs: 20000 }); checks[name] = 'ok'; }
      catch { checks[name] = 'fail'; }
    };
    await Promise.all([
      tryCheck('spark-standard', '/v1/chat/completions', { model: GATEWAY_MODELS.sparkStandard, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
      tryCheck('spark-contributor', '/v1/chat/completions', { model: GATEWAY_MODELS.sparkContributor, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
      tryCheck('image', '/v1/images/generations', { model: GATEWAY_MODELS.image, prompt: 'ping', size: '256x256' }),
      tryCheck('voice', '/v1/audio/speech', { model: GATEWAY_MODELS.voice, input: 'hi', voice: 'nova' }),
      tryCheck('sam', '/v1/sam/segment', { model: GATEWAY_MODELS.sam, image: 'ping' }),
      tryCheck('wonder', '/v1/video/generations', { model: GATEWAY_MODELS.wonder, prompt: 'ping' }),
    ]);
    return NextResponse.json({ checks });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Validation failed.' }, { status: 400 });
  }
}
