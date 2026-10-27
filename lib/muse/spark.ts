import { callMuse } from './client';
import { endpointModelForSpark } from './models.config';
import type { SparkModelId } from '@/config/pricing';
import type { AdScript, BrandKit } from '@/lib/script-utils';
import { mockScript } from './mocks';

export interface ScriptInput {
  brand: BrandKit;
  durationSec: number;
  tone: string;
  platform: string;
  sparkModel: SparkModelId;
  extraContext?: string;
}

export function buildScriptPrompt(i: ScriptInput) {
  const words = Math.round(i.durationSec * 2.5);
  return `You are an expert social-media commercial writer.
Write a ${i.durationSec}-second vertical video ad (~${words} spoken words total).
Brand: ${i.brand.brandName} — ${i.brand.tagline}
About: ${i.brand.description}
Offer: ${i.brand.offer || 'none'} | CTA: ${i.brand.cta}
Tone: ${i.tone} | Platform: ${i.platform}
Must-use-verbatim lines: ${(i.brand.pinned || []).join(' | ') || 'none'}
Avoid words: ${(i.brand.avoidWords || []).join(', ') || 'none'}
Extra: ${i.extraContext || 'none'}
Return STRICT JSON: {"scenes":[{"id":"s1","heading":"...","voiceover":"...","onScreenText":"...","visualPrompt":"...","durationSec":5}]}. Keep total spoken words near ${words}.`;
}

export async function generateScript(opts: { key: string; baseUrl: string } & ScriptInput): Promise<AdScript> {
  if (!opts.key || opts.key === 'DEMO') return mockScript(opts.durationSec, opts.sparkModel);
  const data: any = await callMuse({
    key: opts.key, baseUrl: opts.baseUrl, path: '/v1/chat/completions',
    body: { model: endpointModelForSpark(opts.sparkModel), messages: [{ role: 'user', content: buildScriptPrompt(opts) }], temperature: 0.8 },
  });
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  try {
    const start = text.indexOf('{'); const end = text.lastIndexOf('}');
    const parsed = JSON.parse(text.slice(start, end + 1));
    const scenes = (parsed.scenes || []).map((s: any, idx: number) => ({
      id: s.id || `s${idx + 1}`, heading: s.heading || `Scene ${idx + 1}`,
      voiceover: s.voiceover || '', onScreenText: s.onScreenText || '',
      visualPrompt: s.visualPrompt || '', durationSec: Number(s.durationSec) || 5,
    }));
    return { scenes, totalSec: opts.durationSec, sparkModel: opts.sparkModel };
  } catch { return mockScript(opts.durationSec, opts.sparkModel); }
}
