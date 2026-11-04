import * as cheerio from 'cheerio';
import { promises as dns } from 'node:dns'; // SSRF guard — this module is server-only (imported by /api/scrape)

export interface ScrapeResult {
  brandName: string; tagline: string; description: string;
  colors: string[]; logoUrl?: string; heroImages: string[];
  cta: string; testimonials: string[];
  // Main site pages discovered (sitemap + nav, same-origin, capped ~12) —
  // Business page renders these as screenshot candidates (10+ when available).
  sitePages: string[];
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

// Main-page discovery for the Business screenshot gallery (10+ when available).
// Merges (1) same-origin sitemap URLs + (2) same-origin nav links, prioritizes
// short human pages, dedupes by pathname, caps at 12.
const PAGE_EXT_RE = /\.(pdf|jpg|jpeg|png|gif|webp|svg|ico|css|js|json|xml|zip|mp4|mov|avi|mp3|wav)$/i;
const MAIN_PAGE_KEYWORDS = [
  'about', 'services', 'service', 'products', 'product', 'shop', 'store', 'menu',
  'pricing', 'plans', 'contact', 'portfolio', 'work', 'gallery', 'testimonials',
  'reviews', 'team', 'faq', 'blog', 'features', 'book', 'reserve', 'order',
];

// ---------------------------------------------------------------------------
// SSRF guard (server-only). The scraper fetches user-supplied URLs, so EVERY
// outbound request goes through safeFetch(): http(s) + port 80/443 whitelist,
// DNS answers checked against blocked ranges (loopback / private / link-local
// cloud metadata / IPv6 ULA / multicast), and redirects followed MANUALLY so
// each hop is re-validated — a public URL that 302s to 169.254.169.254 is
// rejected.
// ---------------------------------------------------------------------------
const MAX_REDIRECTS = 3;
const HOST_OK_TTL_MS = 30_000; // re-resolve DNS after this window (rebinding margin)
const hostOkCache = new Map<string, number>();

function isBlockedIpv4(ip: string): boolean {
  const o = ip.split('.').map(Number);
  if (o.length !== 4 || o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = o;
  return (
    a === 0 || a === 10 || a === 127 ||                  // this-network, private, loopback
    (a === 169 && b === 254) ||                          // link-local (cloud metadata)
    (a === 172 && b >= 16 && b <= 31) ||                 // private
    (a === 192 && b === 168) ||                          // private
    (a === 100 && b >= 64 && b <= 127) ||                // CGNAT 100.64/10
    a >= 224                                             // multicast + reserved
  );
}

function isBlockedIpv6(ip: string): boolean {
  const raw = ip.replace(/^\[|\]$/g, '').split('%')[0].toLowerCase();
  if (!raw.includes(':')) return isBlockedIpv4(raw);
  if (raw === '::' || raw === '::1') return true;        // unspecified + loopback
  const v4mapped = raw.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4mapped) return isBlockedIpv4(v4mapped[1]);       // IPv4-mapped
  return (
    raw.startsWith('fe80') ||                            // link-local
    raw.startsWith('fc') || raw.startsWith('fd') ||      // unique local
    raw.startsWith('ff')                                 // multicast
  );
}

function validateUrl(u: URL): void {
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Only http(s) websites can be read.');
  if (u.port && u.port !== '80' && u.port !== '443') {
    throw new Error('Only standard web ports (80/443) can be read.');
  }
}

async function assertPublicHost(u: URL): Promise<void> {
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if ((hostOkCache.get(host) ?? 0) > Date.now() - HOST_OK_TTL_MS) return;
  const addrs: string[] = [];
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) {
    addrs.push(host); // IP literal — validated directly
  } else {
    try {
      addrs.push(...(await dns.lookup(host, { all: true })).map((r) => r.address));
    } catch {
      throw new Error('Could not resolve that website address.');
    }
  }
  if (!addrs.length) throw new Error('Could not resolve that website address.');
  for (const a of addrs) {
    const blocked = a.includes(':') ? isBlockedIpv6(a) : isBlockedIpv4(a);
    if (blocked) throw new Error('That website address points to a private or internal network and cannot be read.');
  }
  hostOkCache.set(host, Date.now());
}

async function safeFetch(u: URL, timeoutMs: number): Promise<Response> {
  validateUrl(u);
  await assertPublicHost(u);
  const init = {
    redirect: 'manual' as const,
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'User-Agent': 'Mozilla/5.0 (AI Commercial Studio)' },
  };
  let res = await fetch(u.toString(), init);
  for (let hop = 0; hop < MAX_REDIRECTS && [301, 302, 303, 307, 308].includes(res.status); hop++) {
    const loc = res.headers.get('location');
    if (!loc) break;
    let next: URL;
    try { next = new URL(loc, u); } catch { break; }
    validateUrl(next);
    await assertPublicHost(next); // every hop re-validated
    u = next;
    res = await fetch(u.toString(), init);
  }
  return res;
}

/** Read at most `maxBytes` of the body so byte caps stop the download early
 *  instead of buffering the whole response first. */
async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return (await res.text()).slice(0, maxBytes);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
  } finally {
    try { await reader.cancel(); } catch { /* already closed */ }
  }
  const out = new Uint8Array(Math.min(total, maxBytes));
  let off = 0;
  for (const c of chunks) {
    const take = Math.min(c.length, out.length - off);
    out.set(c.subarray(0, take), off);
    off += take;
    if (off >= out.length) break;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(out);
}

async function fetchSitemapPages(base: URL): Promise<string[]> {
  try {
    const res = await safeFetch(new URL('/sitemap.xml', base), 6000);
    if (!res.ok) return [];
    const xml = await readCapped(res, 500000);
    const $x = cheerio.load(xml, { xmlMode: true });
    const locs = $x('loc').map((_, e) => $x(e).text().trim()).get().filter(Boolean).slice(0, 40);
    const out: string[] = [];
    for (const loc of locs) {
      try {
        if (/\.xml$/i.test(loc)) continue; // sitemap index — skip nested fetches
        const u = new URL(loc, base);
        if (u.origin !== base.origin) continue;
        if (PAGE_EXT_RE.test(u.pathname)) continue;
        out.push(u.toString());
        if (out.length >= 20) break;
      } catch { /* skip bad loc */ }
    }
    return out;
  } catch {
    return [];
  }
}

function discoverSitePages($: cheerio.CheerioAPI, base: URL, extra: string[] = []): string[] {
  const byPath = new Map<string, string>();
  const add = (href: string) => {
    try {
      if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) return;
      const u = new URL(href, base);
      if (u.origin !== base.origin) return;
      if (PAGE_EXT_RE.test(u.pathname)) return;
      u.hash = '';
      const key = u.pathname.replace(/\/+$/, '').toLowerCase() || '/';
      if (!byPath.has(key)) byPath.set(key, u.toString());
    } catch { /* skip */ }
  };
  // Homepage always first.
  add(base.toString());
  for (const e of extra) add(e);
  $('a[href]').each((_, el) => add($(el).attr('href') || ''));
  const all = Array.from(byPath.entries());
  const score = ([path]: [string, string]): number => {
    if (path === '/') return -100;
    for (let i = 0; i < MAIN_PAGE_KEYWORDS.length; i++) {
      if (path.includes(MAIN_PAGE_KEYWORDS[i])) return i - 50;
    }
    const depth = path.split('/').filter(Boolean).length;
    return depth * 10 + Math.min(path.length / 20, 10);
  };
  all.sort((a, b) => score(a) - score(b) || a[0].localeCompare(b[0]));
  return all.slice(0, 12).map(([, url]) => url);
}

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
  const res = await safeFetch(u, TIMEOUT);
  if (!res.ok) throw new Error(`status ${res.status}`);
  return readCapped(res, MAX_BYTES);
}

/** Try homepage + about variants; return merged brand with about story. */
export async function scrapeSite(rawUrl: string): Promise<ScrapeResult> {
  let u: URL;
  try { u = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`); }
  catch { throw new Error('That link does not look like a website address. Check it and try again.'); }
  validateUrl(u); // protocol + port whitelist (SSRF guard)
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
    // Generic CTAs first (not every site is ecommerce), commerce verbs last.
    const cta = $('a:contains("Get started"),a:contains("Sign up"),a:contains("Learn more"),a:contains("Contact"),a:contains("Book"),a:contains("Shop"),a:contains("Buy")').first().text().trim().slice(0, 40) || 'Get started';
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
            const res = await safeFetch(burl, 8000);
            if (!res.ok) continue;
            const js = await readCapped(res, 300000);
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

    // Main-page gallery for Business screenshots (sitemap + nav links, ≤12).
    let sitePages: string[] = [];
    try {
      const sitemapPages = await fetchSitemapPages(u);
      sitePages = discoverSitePages($, u, sitemapPages);
    } catch { try { sitePages = discoverSitePages($, u, []); } catch { sitePages = []; } }

    return { brandName: title.split('|')[0].split('—')[0].trim() || u.hostname, tagline, description: desc, colors, logoUrl: abs(logo || undefined), heroImages, cta, testimonials, sitePages, aboutSummary, aboutPoints, aboutSource, needsJs };
  } catch (e: any) {
    if (e?.name === 'AbortError' || e?.name === 'TimeoutError') throw new Error('That website took too long to respond. Try pasting your text instead.');
    throw e instanceof Error ? e : new Error('Could not read that website. Paste your text instead.');
  }
}

/** Back-compat alias — single-page scrape callers keep working. */
export const scrapeUrl = scrapeSite;
