import { callMuse } from './client';
import { endpointModelForSpark } from './models.config';
import type { SparkModelId } from '@/config/pricing';
import type { AdScript, BrandKit } from '@/lib/script-utils';
import { mockScript, mockMasterScript } from './mocks';

export interface MasterScriptInput {
  brand: BrandKit;
  tone: string;
  sparkModel: SparkModelId;
  extraContext?: string;
}

/** Draft the cohesive master narrative from homepage + about story. No duration math here. */
export function buildMasterScriptPrompt(i: MasterScriptInput) {
  const story = i.brand.aboutStory
    ? `BRAND STORY (from about page ${i.brand.aboutSource || ''}):\n${i.brand.aboutStory}\nStory beats: ${(i.brand.aboutPoints || []).join(' | ') || 'none'}`
    : 'BRAND STORY: none found (homepage only). Lean on homepage description + offer.';
  return `You are an expert brand storyteller writing the MASTER script for a business — the single source of truth every ad cut will be organized from.
Brand: ${i.brand.brandName} — ${i.brand.tagline}
Homepage pitch: ${i.brand.description}
${story}
Social proof: ${(i.brand.testimonials || []).slice(0, 3).join(' | ') || 'none'}
Offer: ${i.brand.offer || 'none'} | CTA: ${i.brand.cta}
Tone: ${i.tone}
Must-use-verbatim lines: ${(i.brand.pinned || []).join(' | ') || 'none'}
Avoid words: ${(i.brand.avoidWords || []).join(', ') || 'none'}
Extra: ${i.extraContext || 'none'}
RULES: Write 150–220 words as flowing paragraphs (hook, story, proof, offer, CTA). ONE cohesive narrative — no scene breaks, no timestamps, no slogans list. Ground every claim in the story above.
Return STRICT JSON: {"masterScript": "..."} (paragraphs separated by \\n\\n).`;
}

export async function generateMasterScript(opts: { key: string; baseUrl: string } & MasterScriptInput): Promise<string> {
  if (!opts.key || opts.key === 'DEMO') return mockMasterScript(opts.brand.brandName || 'this business');
  const data: any = await callMuse({
    key: opts.key, baseUrl: opts.baseUrl, path: '/v1/chat/completions',
    body: { model: endpointModelForSpark(opts.sparkModel), messages: [{ role: 'user', content: buildMasterScriptPrompt(opts) }], temperature: 0.8 },
  });
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  try {
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    if (typeof parsed.masterScript === 'string' && parsed.masterScript.length > 40) return parsed.masterScript;
  } catch {}
  // Fallback: raw text if the model skipped JSON.
  if (text.trim().length > 40) return text.trim().slice(0, 2000);
  return mockMasterScript(opts.brand.brandName || 'this business');
}

export interface ScriptInput {
  brand: BrandKit;
  durationSec: number;
  tone: string;
  platform: string;
  sparkModel: SparkModelId;
  extraContext?: string;
  masterScript?: string; // approved final script — organize this, don't reinvent
}

export function buildScriptPrompt(i: ScriptInput) {
  const words = Math.round(i.durationSec * 2.5);
  const master = i.masterScript?.trim()
    ? `FINAL APPROVED MASTER SCRIPT (the single source of truth — organize THIS into scenes, do not invent new claims):\n${i.masterScript.trim().slice(0, 2000)}`
    : (i.brand.aboutStory
      ? `BRAND STORY (from about page ${i.brand.aboutSource || ''} — weave this into the arc, don't just list facts):\n${i.brand.aboutStory}\nStory beats to dramatize across scenes: ${(i.brand.aboutPoints || []).join(' | ') || 'none'}`
      : 'BRAND STORY: none found (homepage only). Lean on homepage description + offer.');
  return `You are an expert social-media commercial organizer. The user already approved a final master script — your job is to ORGANIZE it into a ${i.durationSec}-second vertical video ad (~${words} spoken words total), not to write a new story.
${master}
Brand: ${i.brand.brandName} — ${i.brand.tagline}
Homepage pitch: ${i.brand.description}
Social proof: ${(i.brand.testimonials || []).slice(0, 3).join(' | ') || 'none'}
Offer: ${i.brand.offer || 'none'} | CTA: ${i.brand.cta}
Tone: ${i.tone} | Platform: ${i.platform}
Must-use-verbatim lines: ${(i.brand.pinned || []).join(' | ') || 'none'}
Avoid words: ${(i.brand.avoidWords || []).join(', ') || 'none'}
Extra: ${i.extraContext || 'none'}
RULES: Tell ONE cohesive story from hook -> proof -> offer -> CTA using ONLY the approved master wording (you may trim for time, never add new claims, dates, or stats). Every scene's voiceover must connect to the next (no isolated slogans). Put the strongest emotional beat first, the offer near the end.
Return STRICT JSON: {"scenes":[{"id":"s1","heading":"...","voiceover":"...","onScreenText":"...","visualPrompt":"...","durationSec":5,"storyBeat":"which brand truth this scene dramatizes"}]}. Keep total spoken words near ${words}.`;
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
      storyBeat: s.storyBeat || '',
    }));
    return { scenes, totalSec: opts.durationSec, sparkModel: opts.sparkModel };
  } catch { return mockScript(opts.durationSec, opts.sparkModel); }
}
