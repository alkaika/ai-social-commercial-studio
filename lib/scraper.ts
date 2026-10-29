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
  needsJs?: boolean;       // true when pages render in a browser but serve an
                           // empty JS shell to the scraper (e.g. SPA)
}

const TIMEOUT = Number(process.env.SCRAPE_TIMEOUT_MS || 15000);
const MAX_BYTES = Number(process.env.SCRAPE_MAX_BYTES || 2000000);

const ABOUT_PATHS = ['/about', '/about-us', '/our-story', '/story', '/mission', '/team', '/company', '/who-we-are'];

function cleanText(t: string, max = 2000) {
  return t.replace(/\s+/g, ' ').replace(/(cookie|privacy policy|terms of service|subscribe|newsletter).{0,80}/gi, '').trim().slice(0, max);
}

// Universal text collector: works for ANY framework (React/Next, Vue/Nuxt,
// Svelte/SvelteKit, Angular, Astro, Remix, plain HTML) because it walks parsed
// JSON + DOM instead of framework code. Recursively pulls human sentences out
// of embedded state blobs.
function collectStrings(node: any, out: string[], depth = 0) {
  if (depth > 6 || out.join(' ').length > 6000) return;
  if (typeof node === 'string') {
    const s = node.replace(/\s+/g, ' ').trim();
    if (s.length >= 40 && s.length <= 600 && /[a-zA-Z]{3,}/.test(s) && /\s/.test(s)) out.push(s);
    return;
  }
  if (Array.isArray(node)) { for (const v of node.slice(0, 50)) collectStrings(v, out, depth + 1); return; }
  if (node && typeof node === 'object') { for (const v of Object.values(node).slice(0, 80)) collectStrings(v, out, depth + 1); }
}

function extractEmbeddedText($: cheerio.CheerioAPI, rawHtml: string): string[] {
  const out: string[] = [];
  try {
    // 1) JSON-LD structured data (all frameworks / SEO plugins).
    $('script[type="application/ld+json"]').each((_, e) => {
      try { collectStrings(JSON.parse($(e).text()), out); } catch {}
    });
    // 2) Known state blobs: Next, Nuxt, Remix, Apollo, generic __INITIAL__*.
    const selectors = ['#__NEXT_DATA__', '#__NUXT_DATA__', '#__NUXT__', '[id*="__INITIAL"]', '[id*="__APP_DATA"]', '[id*="__PRELOADED"]', '[id*="__REMIX"]'];
    for (const sel of selectors) {
      $(sel).each((_, e) => { try { collectStrings(JSON.parse($(e).text()), out); } catch {} });
    }
    // 3) Inline window assignments: window.__X__ = {...}; (any language).
    const inline: string[] = [];
    try {
      const re = new RegExp('window\\.__[A-Z0-9_]+__\\s*=\\s*(\\{.+?\\});', 'g');
      let mm: RegExpExecArray | null;
      while ((mm = re.exec(rawHtml)) && inline.length < 3) inline.push(mm[0]);
    } catch {}
    for (const m of inline) {
      const jsonPart = m.replace(/^[^=]*=\s*/, '').replace(/;$/, '');
      try { collectStrings(JSON.parse(jsonPart), out); } catch {}
    }
    // 4) <noscript> + <template> content (renders without JS in every stack).
    $('noscript, template').each((_, e) => {
      const t = $(e).text().replace(/\s+/g, ' ').trim();
      if (t.length >= 40) out.push(t.slice(0, 2000));
    });
  } catch {}
  return Array.from(new Set<string>(out)).slice(0, 40);
}

// Pull human sentences out of raw JS bundle text — framework-agnostic.
// Bundlers (webpack/vite/esbuild) embed copy as string literals regardless
// of React vs Vue vs Svelte vs Angular, so this reads the "words in the shell"
// without executing anything.
function extractReadableStringsFromJs(js: string): string[] {
  const found: string[] = [];
  const re = /["'`]([A-Z(“"'][^"'`]{39,599}?[.!?}])["'`]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(js)) && found.length < 60) {
    const s = m[1].replace(/\\n|\\t|\\"|\\'/g, ' ').replace(/\s+/g, ' ').trim();
    if (s.split(' ').length < 6) continue;
    if (/function|return|import |export |require\(|=>|webpack|chunk|__webpack|react\/|useState|useEffect/i.test(s.slice(0, 80))) continue;
    if (/cookie|privacy policy/i.test(s.slice(0, 80))) continue;
    found.push(s.slice(0, 600));
  }
  return Array.from(new Set<string>(found));
}

function isJsShell($: cheerio.CheerioAPI) {
  // SPAs (React/Vite/etc.) serve an almost-empty body plus a bundle script.
  // If the visible text is tiny but a JS bundle exists, the real content
  // needs a browser — flag it instead of claiming "no about page".
  const textLen = $('body').text().replace(/\s+/g, ' ').trim().length;
  const hasBundle = $('script[src]').length > 0;
  return textLen < 300 && hasBundle;
}

function extractAbout($: cheerio.CheerioAPI, base: URL, embedded: string[] = []) {
  const chunks: string[] = [];
  // Prefer main/article, then section headings + paragraphs near story keywords.
  const main = $('main, article').first().text();
  const body = main.length > 200 ? main : $('body').text();
  // Layer 1: rendered DOM text. Layer 2: embedded framework-agnostic strings
  // (JSON-LD, state blobs, noscript, JS literals) — covers every stack.
  const paras = cleanText([body, ...embedded].join('\n'), 8000).split(/(?<=[.!?])\s+/);
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
    const tagline = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim().slice(0, 120);
    const logo = $('link[rel="icon"]').attr('href') || $('img[src*="logo"]').first().attr('src') || $('meta[property="og:logo"]').attr('content');
    // Universal fallback: if the DOM gives nothing (any JS framework shell),
    // pull words from embedded state/JSON/JS literals — same for every stack.
    const embeddedHome = extractEmbeddedText($, html);
    let desc = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || $('p').first().text().trim().slice(0, 300);
    if (!desc && embeddedHome.length) desc = embeddedHome.slice(0, 2).join(' ').slice(0, 300);
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
    let needsJs = isJsShell($);
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
    // De-dupe candidates (user case: vibepilot.dev + trailing-slash duplicate
    // wasted the 5-fetch budget on the same empty JS shell twice).
    const seen = new Set<string>();
    const uniqueCandidates = candidates.filter((c) => {
      try {
        const key = new URL(c).pathname.replace(/\/+$/, '') || '/';
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      } catch { return true; }
    });
    // Probe more candidates when pages are JS shells (each fetch is cheap;
    // the story is worth it). Cap total about-fetches at 8.
    const budget = needsJs ? 8 : 5;
    for (const c of uniqueCandidates.slice(0, budget)) {
      try {
        const au = new URL(c);
        if (au.origin !== u.origin) continue;
        const ahtml = await fetchHtml(au);
        const $a = cheerio.load(ahtml);
        const { summary, points } = extractAbout($a, au, extractEmbeddedText($a, ahtml));
        if (summary.length > 80) {
          aboutSummary = cleanText(summary, 600);
          aboutPoints = points.slice(0, 5);
          aboutSource = au.pathname;
          needsJs = false; // story FOUND — no longer blocked
          // pull a couple of extra images from the about page
          $a('img').each((_, e) => {
            if (heroImages.length < 8) {
              const s = abs($a(e).attr('src'), au);
              if (s && !heroImages.includes(s)) heroImages.push(s);
            }
          });
          break;
        }
        // Layer 3: same-origin JS bundle strings (framework-agnostic — works
        // for React/Vue/Svelte/Angular since copy lives in string literals
        // regardless of framework). Polite: <=2 bundles, <=300KB each.
        const bundleSrcs = $a('script[src]')
          .map((_, e) => $a(e).attr('src'))
          .get()
          .filter((s): s is string => !!s && !/analytics|gtag|gtm|facebook|hotjar/i.test(s))
          .slice(0, 2);
        for (const bs of bundleSrcs) {
          try {
            const burl = new URL(bs, au);
            if (burl.origin !== u.origin) continue;
            const res = await fetch(burl.toString(), { headers: { 'User-Agent': 'Mozilla/5.0 (AI Commercial Studio)' }, signal: AbortSignal.timeout(8000) });
            if (!res.ok) continue;
            const js = await res.text();
            if (js.length > 300000) continue;
            const strs = extractReadableStringsFromJs(js);
            if (!strs.length) continue;
            const { summary: bs2, points: bp2 } = extractAbout($a, au, strs);
            if (bs2.length > 200) {
              aboutSummary = cleanText(bs2, 600);
              aboutPoints = bp2.slice(0, 5);
              aboutSource = `${au.pathname} (bundle)`;
              needsJs = false;
              break;
            }
          } catch { /* next bundle */ }
        }
        if (aboutSummary) break;
      } catch { /* try next candidate */ }
    }

    return { brandName: title.split('|')[0].split('—')[0].trim() || u.hostname, tagline, description: desc, colors, logoUrl: abs(logo || undefined), heroImages, cta, testimonials, aboutSummary, aboutPoints, aboutSource, needsJs };
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('That website took too long to respond. Try pasting your text instead.');
    throw e instanceof Error ? e : new Error('Could not read that website. Paste your text instead.');
  }
}

/** Back-compat alias — single-page scrape callers keep working. */
export const scrapeUrl = scrapeSite;
