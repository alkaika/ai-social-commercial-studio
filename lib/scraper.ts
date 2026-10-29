import * as cheerio from 'cheerio';

export interface ScrapeResult {
  brandName: string; tagline: string; description: string;
  colors: string[]; logoUrl?: string; heroImages: string[];
  cta: string; testimonials: string[];
  // About-page enrichment (new): story + proof scraped from /about, /story,
  // /our-story, /mission, /team, /company variants.
  aboutSummary?: string;   // cohesive 2–4 sentence story (Spark-ready)
  aboutPoints?: string[];  // founding, mission, differentiators, milestones
  aboutSource?: string;    // which about URL actually worked
}

const TIMEOUT = Number(process.env.SCRAPE_TIMEOUT_MS || 15000);
const MAX_BYTES = Number(process.env.SCRAPE_MAX_BYTES || 2000000);

const ABOUT_PATHS = ['/about', '/about-us', '/our-story', '/story', '/mission', '/team', '/company', '/who-we-are'];

function cleanText(t: string, max = 2000) {
  return t.replace(/\s+/g, ' ').replace(/(cookie|privacy policy|terms of service|subscribe|newsletter).{0,80}/gi, '').trim().slice(0, max);
}

function extractAbout($: cheerio.CheerioAPI, base: URL) {
  const chunks: string[] = [];
  // Prefer main/article, then section headings + paragraphs near story keywords.
  const main = $('main, article').first().text();
  const body = main.length > 200 ? main : $('body').text();
  const paras = cleanText(body, 6000).split(/(?<=[.!?])\s+/);
  const keep = /found|founded|since|mission|story|believe|passion|craft|quality|family|team|commit|promise|value|dream|journey|started|decade|generation/i;
  for (const p of paras) {
    if (p.length > 60 && p.length < 600 && keep.test(p) && chunks.join(' ').length < 1500) chunks.push(p.trim());
  }
  // Fallback: first 3 substantial paragraphs.
  if (!chunks.length) {
    for (const p of paras) {
      if (p.length > 80 && chunks.length < 3) chunks.push(p.trim());
    }
  }
  const points = chunks.slice(0, 5);
  return {
    summary: points.slice(0, 3).join(' '),
    points,
    heroImages: [] as string[],
  };
}

async function fetchHtml(u: URL): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(u.toString(), { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (AI Commercial Studio)' } });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return (await res.text()).slice(0, MAX_BYTES);
  } finally { clearTimeout(t); }
}

/** Try homepage + about variants; return merged brand with about story. */
export async function scrapeSite(rawUrl: string): Promise<ScrapeResult> {
  let u: URL;
  try { u = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`); }
  catch { throw new Error('That link does not look like a website address. Check it and try again.'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Only http(s) websites can be read.');
  try {
    const html = await fetchHtml(u);
    const $ = cheerio.load(html);
    const title = $('title').first().text().trim();
    const desc = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || $('p').first().text().trim().slice(0, 300);
    const tagline = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim().slice(0, 120);
    const logo = $('link[rel="icon"]').attr('href') || $('img[src*="logo"]').first().attr('src') || $('meta[property="og:logo"]').attr('content');
    const abs = (s?: string, base: URL = u) => { try { return s ? new URL(s, base).toString() : undefined; } catch { return undefined; } };
    const heroImages = $('meta[property="og:image"]').map((_, e) => abs($(e).attr('content'))).get().filter(Boolean).slice(0, 6) as string[];
    $('img').each((_, e) => { if (heroImages.length < 8) { const s = abs($(e).attr('src')); if (s && !heroImages.includes(s)) heroImages.push(s); } });
    const cta = $('a:contains("Shop"),a:contains("Buy"),a:contains("Sign up"),a:contains("Get started")').first().text().trim().slice(0, 40) || 'Shop now';
    const testimonials: string[] = [];
    $('blockquote, [class*="testimonial"], [class*="review"]').each((_, e) => { const tx = $(e).text().trim().slice(0, 200); if (tx.length > 20 && testimonials.length < 5) testimonials.push(tx); });
    const theme = $('meta[name="theme-color"]').attr('content');
    const colors = [theme || '#111111', '#ffffff'];

    // About-page pass: follow in-page /about links first, then known variants.
    let aboutSummary = '';
    let aboutPoints: string[] = [];
    let aboutSource = '';
    const linked = new Set<string>();
    $('a[href]').each((_, e) => {
      const href = ($(e).attr('href') || '').toLowerCase();
      if (/about|story|mission|team|company/.test(href)) {
        try { linked.add(new URL($(e).attr('href') || '', u).toString()); } catch {}
      }
    });
    const candidates = Array.from(linked).slice(0, 3);
    for (const p of ABOUT_PATHS) {
      try { candidates.push(new URL(p, u).toString()); } catch {}
    }
    for (const c of candidates.slice(0, 5)) {
      try {
        const au = new URL(c);
        if (au.origin !== u.origin) continue;
        const ahtml = await fetchHtml(au);
        const $a = cheerio.load(ahtml);
        const { summary, points } = extractAbout($a, au);
        if (summary.length > 80) {
          aboutSummary = cleanText(summary, 600);
          aboutPoints = points.slice(0, 5);
          aboutSource = au.pathname;
          // pull a couple of extra images from the about page
          $a('img').each((_, e) => {
            if (heroImages.length < 8) {
              const s = abs($a(e).attr('src'), au);
              if (s && !heroImages.includes(s)) heroImages.push(s);
            }
          });
          break;
        }
      } catch { /* try next candidate */ }
    }

    return { brandName: title.split('|')[0].split('—')[0].trim() || u.hostname, tagline, description: desc, colors, logoUrl: abs(logo || undefined), heroImages, cta, testimonials, aboutSummary, aboutPoints, aboutSource };
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('That website took too long to respond. Try pasting your text instead.');
    throw e instanceof Error ? e : new Error('Could not read that website. Paste your text instead.');
  }
}

/** Back-compat alias — single-page scrape callers keep working. */
export const scrapeUrl = scrapeSite;
