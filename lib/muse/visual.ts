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

export async function segmentImage(opts: { key: string; baseUrl: string; imageUrl: string }) {
  if (!opts.key || opts.key === 'DEMO') return { maskUrl: '', mock: true };
  try {
    const data: any = await callMuse({
      key: opts.key, baseUrl: opts.baseUrl, path: '/v1/sam/segment',
      body: { model: 'sam-3.1', image: opts.imageUrl },
    });
    return { maskUrl: data?.mask_url || '', mock: false, raw: data };
  } catch { return { maskUrl: '', mock: true }; }
}

export async function generateMotion(opts: { key: string; baseUrl: string; imageUrl: string; prompt: string }) {
  if (!opts.key || opts.key === 'DEMO') return { videoUrl: '', mock: true, fallback: 'kenburns' as const };
  try {
    const data: any = await callMuse({
      key: opts.key, baseUrl: opts.baseUrl, path: '/v1/video/generations',
      body: { model: 'muse-wonder-1.0', image: opts.imageUrl, prompt: opts.prompt },
      timeoutMs: 180000,
    });
    return { videoUrl: data?.data?.[0]?.url || '', mock: false, fallback: 'kenburns' as const };
  } catch { return { videoUrl: '', mock: true, fallback: 'kenburns' as const }; }
}
