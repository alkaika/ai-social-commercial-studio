import * as cheerio from 'cheerio';

export interface ScrapeResult {
  brandName: string; tagline: string; description: string;
  colors: string[]; logoUrl?: string; heroImages: string[];
  cta: string; testimonials: string[];
}

const TIMEOUT = Number(process.env.SCRAPE_TIMEOUT_MS || 15000);

export async function scrapeUrl(rawUrl: string): Promise<ScrapeResult> {
  let u: URL;
  try { u = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`); }
  catch { throw new Error('That link does not look like a website address. Check it and try again.'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Only http(s) websites can be read.');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(u.toString(), { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (AI Commercial Studio)' } });
    if (!res.ok) throw new Error(`That website returned ${res.status}. No problem — paste your text below instead.`);
    const html = (await res.text()).slice(0, Number(process.env.SCRAPE_MAX_BYTES || 2000000));
    const $ = cheerio.load(html);
    const title = $('title').first().text().trim();
    const desc = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || $('p').first().text().trim().slice(0, 300);
    const tagline = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim().slice(0, 120);
    const logo = $('link[rel="icon"]').attr('href') || $('img[src*="logo"]').first().attr('src') || $('meta[property="og:logo"]').attr('content');
    const abs = (s?: string) => { try { return s ? new URL(s, u).toString() : undefined; } catch { return undefined; } };
    const heroImages = $('meta[property="og:image"]').map((_, e) => abs($(e).attr('content'))).get().filter(Boolean).slice(0, 6) as string[];
    $('img').each((_, e) => { if (heroImages.length < 8) { const s = abs($(e).attr('src')); if (s && !heroImages.includes(s)) heroImages.push(s); } });
    const cta = $('a:contains("Shop"),a:contains("Buy"),a:contains("Sign up"),a:contains("Get started")').first().text().trim().slice(0, 40) || 'Shop now';
    const testimonials: string[] = [];
    $('blockquote, [class*="testimonial"], [class*="review"]').each((_, e) => { const tx = $(e).text().trim().slice(0, 200); if (tx.length > 20 && testimonials.length < 5) testimonials.push(tx); });
    // brand colors: theme-color + inline guesses
    const theme = $('meta[name="theme-color"]').attr('content');
    const colors = [theme || '#111111', '#ffffff'];
    return { brandName: title.split('|')[0].split('—')[0].trim() || u.hostname, tagline, description: desc, colors, logoUrl: abs(logo || undefined), heroImages, cta, testimonials };
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('That website took too long to respond. Try pasting your text instead.');
    throw e instanceof Error ? e : new Error('Could not read that website. Paste your text instead.');
  } finally { clearTimeout(t); }
}
