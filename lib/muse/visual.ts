import { callMuse } from './client';
import { mockImage } from './mocks';

export async function generateImage(opts: { key: string; baseUrl: string; prompt: string; aspect?: string }) {
  if (!opts.key || opts.key === 'DEMO') return { url: mockImage(opts.prompt, opts.aspect || '9:16'), mock: true };
  try {
    const data: any = await callMuse({
      key: opts.key, baseUrl: opts.baseUrl, path: '/v1/images/generations',
      body: { model: 'muse-image-1.0', prompt: opts.prompt, size: opts.aspect === '16:9' ? '1792x1024' : opts.aspect === '1:1' ? '1024x1024' : '1024x1792' },
      timeoutMs: 120000,
    });
    const url = data?.data?.[0]?.url || data?.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : mockImage(opts.prompt, opts.aspect || '');
    return { url, mock: false };
  } catch { return { url: mockImage(opts.prompt, opts.aspect || ''), mock: true }; }
}

export async function segmentImage(opts: { key: string; baseUrl: string; imageUrl: string; prompt?: string }) {
  if (!opts.key || opts.key === 'DEMO') return { maskUrl: '', mock: true };
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
  } catch { return { maskUrl: '', mock: true }; }
}

export type MotionTier = 'metai-upload' | 'kenburns';

// Motion flow: [uploaded meta.ai clip] -> [website screenshot] -> Ken Burns.
// - 'metai-upload': user-made clip from the consumer meta.ai app (10s w/ audio).
//   No API exists; the app accepts the upload and we mute/duck its baked-in
//   audio under real Voice-over at render time.
// - 'screenshot': website shot picked on the Story page (mShots/thum.io,
//   free, no key). Renders as a Ken Burns zoom over the shot.
// - 'kenburns': always-available local fallback (slow zoom over the still).
// (Wonder retired 2026-10-27: muse-wonder-1.0 was text-only, never video;
// all reasoning — script, organize, revision planning — runs on the user's
// chosen Spark writer.)
export function resolveMotionTier(scene: { videoUrl?: string; motionSource?: string }): MotionTier {
  if (scene.videoUrl && scene.motionSource === 'metai-upload') return 'metai-upload';
  return 'kenburns';
}

/** Retired stub — Wonder was text-only, never video. Motion = clips/Ken Burns. */
export async function generateMotion(opts: { key: string; baseUrl: string; imageUrl: string; prompt: string }) {
  void opts;
  return { videoUrl: '', mock: true, fallback: 'kenburns' as const, reason: 'wonder-retired-use-spark' as const };
}
