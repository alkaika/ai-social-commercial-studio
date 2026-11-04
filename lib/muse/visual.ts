import { callMuse } from './client';
import { MuseGatewayError, PublicError } from '@/lib/errors';

export async function generateImage(opts: { key: string; baseUrl: string; prompt: string; aspect?: string }) {
  if (!opts.key) throw new PublicError('Missing API key. Add your Meta key first — it is sent with this request only.');
  const data: any = await callMuse({
    key: opts.key, baseUrl: opts.baseUrl, path: '/v1/images/generations',
    body: { model: 'muse-image-1.0', prompt: opts.prompt, size: opts.aspect === '16:9' ? '1792x1024' : opts.aspect === '1:1' ? '1024x1024' : '1024x1792' },
    timeoutMs: 120000,
  });
  const url = data?.data?.[0]?.url || (data?.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : '');
  if (!url) throw new PublicError('Image generation came back empty — try again.');
  return { url, mock: false };
}

export async function segmentImage(opts: { key: string; baseUrl: string; imageUrl: string; prompt?: string }) {
  if (!opts.key) throw new PublicError('Missing API key. Add your Meta key first — it is sent with this request only.');
  try {
    // SAM 3.1 via Responses API (model sam-3-1), verified against dev.meta.ai docs:
    // POST /v1/responses { model, input: [{ role:'user', content:[
    //   {type:'input_text', text}, {type:'input_image', image_url} ] }] }
    const data: any = await callMuse({
      key: opts.key, baseUrl: opts.baseUrl, path: '/v1/responses',
      body: {
        model: 'sam-3-1',
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: opts.prompt || 'segment the main subject, return mask' },
            { type: 'input_image', image_url: opts.imageUrl },
          ],
        }],
      },
    });
    return { maskUrl: data?.output?.[0]?.content?.[0]?.mask_url || data?.mask_url || '', mock: false, raw: data };
  } catch (e: any) {
    // Keep user-safe messages (gateway diagnostics, PublicErrors); hide internals.
    if (e instanceof MuseGatewayError || e instanceof PublicError) throw e;
    throw new PublicError('Segmentation failed — try again.');
  }
}

// Motion tier logic moved to lib/muse/motion-tier.ts (pure, client-safe) so
// client render code (lib/render/ffmpeg.ts) never imports this server-only
// module. Re-exported here for backward compatibility with server imports.
export { resolveMotionTier } from './motion-tier';
export type { MotionTier } from './motion-tier';

/** Retired stub — Wonder was text-only, never video. Motion = clips/Ken Burns. */
export async function generateMotion(opts: { key: string; baseUrl: string; imageUrl: string; prompt: string }) {
  void opts;
  return { videoUrl: '', mock: true, fallback: 'kenburns' as const, reason: 'wonder-retired-use-spark' as const };
}
