import { callMuse } from './client';
import { endpointModelForSpark, reasoningEffortForSpark } from './models.config';
import { normalizeDurationSec } from '@/config/platforms';
import type { SparkModelId } from '@/config/pricing';
import type { AdScript, BrandKit } from '@/lib/script-utils';
import { countWords, endsWithSentence, fitPartToWordTarget, partCountFor, WORDS_PER_SEC, WORDS_PER_PART, MIN_WORDS_PER_PART, MAX_WORDS_PER_PART, withinPartWordBand } from '@/lib/script-utils';

export interface MasterScriptInput {
  brand: BrandKit;
  tone: string;
  sparkModel: SparkModelId;
  extraContext?: string;
  durationSec?: number;
  platform?: string;
  guidance?: string; // user focus/exclude notes from the Business page box
}

/** Draft the master narrative as N EQUAL 10-second parts — each in the
 *  33–37 word band (35 ideal) and ending on a COMPLETE SENTENCE — so every
 *  Meta.ai take lands a finished thought and the final stitch syncs
 *  flawlessly. Spark is told to count each part before returning (xhigh
 *  self-verification); see generateMasterScript for the validation +
 *  diagnostic retry that enforce it. */
export function buildMasterScriptPrompt(i: MasterScriptInput) {
  const dSec = normalizeDurationSec(i.durationSec);
  const parts = partCountFor(dSec);
  const setting = 'SETTINGS: ' + dSec + 's cut for ' + (i.platform || 'video') + ', ' + i.tone + ' vibe, delivered as ' + parts + ' equal 10-second parts — each part ' + MIN_WORDS_PER_PART + '–' + MAX_WORDS_PER_PART + ' words (aim for ' + WORDS_PER_PART + '), each part ending on a complete sentence.';
  const story = i.brand.aboutStory
    ? `BRAND STORY (from about page ${i.brand.aboutSource || ''}):\n${i.brand.aboutStory}\nStory beats: ${(i.brand.aboutPoints || []).join(' | ') || 'none'}`
    : 'BRAND STORY: none found (homepage only). Lean on homepage description + offer.';
  const mid = parts <= 2 ? '' : `\n- Parts 2–${parts - 1}: story, social proof, offer beats (one idea each).`;
  const structure = parts === 1
    ? 'STRUCTURE — one paragraph: hook, one proof beat, offer, CTA.'
    : `STRUCTURE — one paragraph per 10-second part, in order:\n- Part 1: the hook — stop the scroll, name the problem or craving.${mid}\n- Part ${parts}: the payoff + call to action.`;
  return `You are an expert brand storyteller writing the MASTER script for a business — the single source of truth every ad cut will be organized from. The commercial is voiced in ${parts} separate 10-second takes at Meta.ai and stitched into one video, so you author the script part-by-part.
${setting}
${structure}
Brand: ${i.brand.brandName} — ${i.brand.tagline}
Homepage pitch: ${i.brand.description}
${story}
Social proof: ${(i.brand.testimonials || []).slice(0, 3).join(' | ') || 'none'}
Offer: ${i.brand.offer || 'none'} | CTA: ${i.brand.cta}
Must-use-verbatim lines: ${(i.brand.pinned || []).join(' | ') || 'none'}
Avoid words: ${(i.brand.avoidWords || []).join(', ') || 'none'}
Extra: ${i.extraContext || 'none'}
USER GUIDANCE (what to focus on / exclude — honor this over defaults): ${i.guidance?.trim() || 'none given'}
PART RULES (non-negotiable — count each part before returning):
1. EVERY part is ${MIN_WORDS_PER_PART}–${MAX_WORDS_PER_PART} words, aiming for ${WORDS_PER_PART} — count each part's words as you write it; any count in that range is fine.
2. EVERY part ends on a COMPLETE SENTENCE. A sentence may NEVER spill into the next part — each part is a finished spoken thought that still flows into the next.
3. One paragraph per part, separated by one blank line. No part labels, no headers, no numbers, no timestamps, no slogans list.
4. Ground every claim in the story above — never invent dates, awards, or stats.
LANGUAGE: never use the phrase "plain English" — write "plain words" instead (clear for every reader, whatever language they speak).
Return STRICT JSON: {"masterScript": "part 1 text\\n\\npart 2 text\\n\\n…"} with exactly ${parts} paragraphs, blank-line separated.`;
}

// Machine-enforce the part discipline (2026-11-04): every 10s part inside the
// 33–37 word band (aim 35) and sentence-final. Spark self-counts at xhigh;
// validation + ONE diagnostic retry (exact per-part miss list) fix near-misses;
// a deterministic per-part fit (fitPartToWordTarget) is the final backstop so
// Story always starts with clean, equal, sentence-complete parts.
export async function generateMasterScript(opts: { key: string; baseUrl: string } & MasterScriptInput): Promise<string> {
  const dSec = normalizeDurationSec(opts.durationSec);
  const parts = partCountFor(dSec);
  if (!opts.key) throw new Error('Missing API key. Add your Meta key first — it is sent with this request only.');
  const call = async (content: string, temperature: number): Promise<string> => {
    const data: any = await callMuse({
      key: opts.key, baseUrl: opts.baseUrl, path: '/v1/chat/completions',
      body: { model: endpointModelForSpark(opts.sparkModel), messages: [{ role: 'user', content }], temperature, reasoning_effort: reasoningEffortForSpark(opts.sparkModel) },
    });
    return data?.choices?.[0]?.message?.content ?? '';
  };
  const extract = (text: string): string => {
    try {
      const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
      if (typeof parsed.masterScript === 'string' && parsed.masterScript.length > 40) return parsed.masterScript;
    } catch {}
    return text.trim().length > 40 ? text.trim().slice(0, 2000) : '';
  };
  // Normalize any draft into `parts` blocks: blank-line paragraphs first; else
  // regroup WHOLE sentences into near-equal blocks; else word-split.
  const partBlocks = (raw: string): string[] => {
    const cleaned = (raw || '').replace(/\r/g, '').trim();
    if (!cleaned) return [];
    let blocks = cleaned.split(/\n{2,}/).map((b) => b.trim().replace(/\s+/g, ' ')).filter(Boolean);
    if (blocks.length === parts) return blocks;
    const flat = cleaned.replace(/\s+/g, ' ').trim();
    const words = flat.split(' ').filter(Boolean);
    const sentences = flat.match(/[^.!?]+[.!?]+["')\]]?/g)?.map((s) => s.trim()).filter(Boolean) || [];
    if (sentences.length >= parts) {
      const target = Math.max(1, Math.round(words.length / parts));
      blocks = [];
      let si = 0;
      for (let p = 0; p < parts; p++) {
        if (p === parts - 1) { blocks.push(sentences.slice(si).join(' ')); break; }
        const acc: string[] = [];
        let wc = 0;
        while (si < sentences.length && (sentences.length - si) > (parts - p - 1)) {
          const sw = sentences[si].split(' ').filter(Boolean).length;
          if (acc.length > 0 && wc + sw > target + 6) break;
          acc.push(sentences[si]); wc += sw; si++;
          if (wc >= target) break;
        }
        if (!acc.length && si < sentences.length) { acc.push(sentences[si]); si++; }
        blocks.push(acc.join(' '));
      }
      return blocks.filter(Boolean);
    }
    const out: string[] = [];
    const per = Math.max(1, Math.round(words.length / parts));
    let pos = 0;
    for (let p = 0; p < parts; p++) {
      const n = p === parts - 1 ? words.length - pos : per;
      out.push(words.slice(pos, pos + n).join(' '));
      pos += n;
    }
    return out.filter(Boolean);
  };
  const valid = (blocks: string[]) =>
    blocks.length === parts && blocks.every((b) => withinPartWordBand(countWords(b)) && endsWithSentence(b));
  const normalize = (blocks: string[]) => blocks.map((b) => b.trim().replace(/\s+/g, ' ')).join('\n\n');
  const diagnose = (blocks: string[]) =>
    blocks.map((b, i) => `Part ${i + 1}: ${countWords(b)} words (needs ${MIN_WORDS_PER_PART}–${MAX_WORDS_PER_PART}, aim ${WORDS_PER_PART})${endsWithSentence(b) ? '' : ' — does NOT end on a complete sentence'}.`).join('\n');

  const first = extract(await call(buildMasterScriptPrompt(opts), 0.8));
  if (!first) throw new Error('Script draft came back empty — try again.');
  let blocks = partBlocks(first);
  if (valid(blocks)) return normalize(blocks);
  // One diagnostic retry — xhigh reasons over its own miss list.
  try {
    const retry = extract(await call(
      `Rewrite this ${dSec}-second commercial master script as EXACTLY ${parts} paragraphs (one blank line between paragraphs), for a ${opts.platform || 'video'} ad with a ${opts.tone} vibe.\nHARD RULES: every paragraph is ${MIN_WORDS_PER_PART}–${MAX_WORDS_PER_PART} words (aim for ${WORDS_PER_PART}) and ends on a complete sentence — a sentence may never spill into the next paragraph. Count every paragraph's words before answering. Never use the phrase "plain English" — write "plain words" instead.\nYour previous attempt failed validation:\n${diagnose(blocks)}\nFix ALL issues, keep the same brand facts and story arc, keep the hook first and the CTA last. Return STRICT JSON {"masterScript": "..."} with exactly ${parts} paragraphs, blank-line separated.\n\n${first.slice(0, 1800)}`,
      0.6,
    ));
    if (retry) {
      const retryBlocks = partBlocks(retry);
      if (valid(retryBlocks)) return normalize(retryBlocks);
      if (retryBlocks.length === parts) blocks = retryBlocks; // closer than the first try
    }
  } catch {}
  return blocks.map((b) => fitPartToWordTarget(b, WORDS_PER_PART)).join('\n\n');
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
  const dSec = normalizeDurationSec((i as any).durationSec);
  const words = Math.round(dSec * WORDS_PER_SEC);
  const master = i.masterScript?.trim()
    ? `FINAL APPROVED MASTER SCRIPT — USE EVERY WORD of it, organized across scenes. Do NOT summarize, shorten, or drop lines to hit the time slot. If the words exceed ~${words} spoken words, still emit scenes covering the ENTIRE script in order (hook first, CTA last) and flag the overflow in storyBeat — timing will be handled with voice cadence (0.85x–1.2x), never by cutting your output:\n${i.masterScript.trim().slice(0, 2500)}`
    : (i.brand.aboutStory
      ? `BRAND STORY (from about page ${i.brand.aboutSource || ''} — weave this into the arc, don't just list facts):\n${i.brand.aboutStory}\nStory beats to dramatize across scenes: ${(i.brand.aboutPoints || []).join(' | ') || 'none'}`
      : 'BRAND STORY: none found (homepage only). Lean on homepage description + offer.');
  return `You are an expert social-media commercial organizer. The user already approved a final master script — your job is to ORGANIZE its every word into a ${dSec}-second vertical video ad (~${words} spoken words at natural pace), not to write a new story or trim to fit.
${master}
Brand: ${i.brand.brandName} — ${i.brand.tagline}
Homepage pitch: ${i.brand.description}
Social proof: ${(i.brand.testimonials || []).slice(0, 3).join(' | ') || 'none'}
Offer: ${i.brand.offer || 'none'} | CTA: ${i.brand.cta}
Tone: ${i.tone} | Platform: ${i.platform}
Must-use-verbatim lines: ${(i.brand.pinned || []).join(' | ') || 'none'}
Avoid words: ${(i.brand.avoidWords || []).join(', ') || 'none'}
Extra: ${i.extraContext || 'none'}
RULES: Cover the ENTIRE master script in scene order (hook -> proof -> offer -> CTA), using ONLY the approved wording — never add claims, dates, or stats, and never drop or summarize lines. Scenes map 1:1 to the 10-second Meta.ai parts: every scene is exactly 10 seconds, its voiceover is as close to 35 words as the approved wording allows (33–37), and it ends on a COMPLETE sentence — never split a sentence across scenes. Every scene's voiceover must connect to the next. If the script is long for the slot, split into MORE scenes (one idea each) rather than cutting words — cadence will compress timing later.
Return STRICT JSON: {"scenes":[{"id":"s1","heading":"...","voiceover":"...","onScreenText":"...","visualPrompt":"...","durationSec":10,"storyBeat":"which brand truth this scene dramatizes"}]}. Keep total spoken words equal to the full master.`;
}

export async function generateScript(opts: { key: string; baseUrl: string } & ScriptInput): Promise<AdScript> {
  const dSec = normalizeDurationSec((opts as any).durationSec);
  if (!opts.key) throw new Error('Missing API key. Add your Meta key first — it is sent with this request only.');
  const data: any = await callMuse({
    key: opts.key, baseUrl: opts.baseUrl, path: '/v1/chat/completions',
    body: { model: endpointModelForSpark(opts.sparkModel), messages: [{ role: 'user', content: buildScriptPrompt(opts) }], temperature: 0.8, reasoning_effort: reasoningEffortForSpark(opts.sparkModel) },
  });
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  try {
    const start = text.indexOf('{'); const end = text.lastIndexOf('}');
    const parsed = JSON.parse(text.slice(start, end + 1));
    const scenes = (parsed.scenes || []).map((s: any, idx: number) => ({
      id: s.id || `s${idx + 1}`, heading: s.heading || `Scene ${idx + 1}`,
      voiceover: s.voiceover || '', onScreenText: s.onScreenText || '',
      visualPrompt: s.visualPrompt || '', durationSec: Number(s.durationSec) || 5,
      storyBeat: s.storyBeat || '', cadence: 1,
    }));
    if (!scenes.length) throw new Error('Script organize came back empty — try again.');
    return { scenes, totalSec: dSec, sparkModel: opts.sparkModel };
  } catch (e: any) {
    if (e?.message?.includes('came back empty')) throw e;
    throw new Error('Script organize failed — try again.');
  }
}
