// Website screenshots for Story motion picker (no API key, free).
// Primary: WordPress mShots (https://s0.wp.com/mshots/v1/) — renders any
// public URL as an image, hotlinkable in an <img>.
// Fallbacks: thum.io + microlink (also keyless, hotlinkable).
//
// NOTE on mShots "Generating Preview" placeholder: the FIRST request for a
// never-before-rendered URL returns a small WordPress-logo placeholder while
// mShots renders the page server-side (~5-15s). Opening the URL in a new tab
// later shows the real shot because generation has finished. The <ShotImg>
// component in WebsiteShots.tsx handles this: it detects the small
// placeholder via naturalWidth and auto-retries with a cache-buster until the
// full-width render arrives, then falls back to thum.io / microlink.
//
// All shots are LANDSCAPE (desktop 1280x720-ish) and displayed with
// aspect-video + object-cover so only the website fills the frame — no
// black side bars.
//
// Usage: screenshotCandidates(urls, aboutSource) -> [{ pageUrl, imageUrl, label }]
// The Story page lets the user tap one per scene; the chosen imageUrl becomes
// the scene still and motionSource becomes 'screenshot' (Ken Burns zoom over
// the shot at render time — same tier as 'kenburns').

export interface WebsiteShot {
  id: string;
  pageUrl: string;
  imageUrl: string;
  fallbackUrl: string;
  label: string;
}

export function normalizePageUrl(raw: string): string {
  const t = (raw || '').trim();
  if (!t) return '';
  try {
    const u = new URL(t.startsWith('http') ? t : `https://${t}`);
    if (!['http:', 'https:'].includes(u.protocol)) return '';
    return u.toString();
  } catch {
    return '';
  }
}

/** Landscape desktop render (mShots returns ~4:3 at the requested width). */
export function mshotsUrl(pageUrl: string, width = 1280): string {
  return `https://s0.wp.com/mshots/v1/${encodeURIComponent(pageUrl)}?w=${width}`;
}

/** Landscape 16:9 crop — full-width site, no side bars. */
export function thumUrl(pageUrl: string, width = 1280, height = 720): string {
  return `https://image.thum.io/get/width/${width}/crop/${height}/noanimate/${pageUrl}`;
}

export function microlinkUrl(pageUrl: string): string {
  return `https://image.microlink.io/?url=${encodeURIComponent(pageUrl)}&viewport.width=1280&viewport.height=720&screenshot=true&meta=false&embed=screenshot.url`;
}

function shortLabel(pageUrl: string): string {
  try {
    const u = new URL(pageUrl);
    const path = u.pathname.replace(/\/$/, '') || '/';
    const pretty = path === '/' ? 'Homepage' : path.slice(0, 28);
    return `${u.hostname}${pretty === 'Homepage' ? '' : ` · ${pretty}`}`;
  } catch {
    return pageUrl.slice(0, 40);
  }
}

const ABOUT_PATHS = ['/about', '/about-us', '/our-story', '/story', '/pricing', '/services'];

/** Build homepage + about-variant screenshot candidates from scanned urls. */
export function screenshotCandidates(urls: string[], aboutSource = ''): WebsiteShot[] {
  const pages: string[] = [];
  const push = (p: string) => {
    const n = normalizePageUrl(p);
    if (n && !pages.includes(n)) pages.push(n);
  };
  for (const u of urls || []) {
    const home = normalizePageUrl(u);
    if (!home) continue;
    push(home);
    // Offer one about-variant per site so the user can pick a story page too.
    try {
      const base = new URL(home);
      for (const ap of ABOUT_PATHS.slice(0, 2)) {
        push(new URL(ap, base).toString());
      }
    } catch { /* homepage only */ }
  }
  // If the scraper found a real about page (e.g. "/team"), make sure it's listed.
  if (aboutSource) {
    const firstUrl = normalizePageUrl(urls?.[0] || '');
    try {
      const base = new URL(firstUrl || 'https://example.com');
      const srcs = aboutSource.split(',').map((s) => s.trim()).filter(Boolean);
      for (const s of srcs.slice(0, 2)) {
        push(s.startsWith('http') ? s : new URL(s.startsWith('/') ? s : `/${s}`, base).toString());
      }
    } catch { /* ignore */ }
  }
  return pages.slice(0, 8).map((pageUrl, i) => ({
    id: `shot-${i}-${pageUrl}`,
    pageUrl,
    imageUrl: mshotsUrl(pageUrl, 1080),
    fallbackUrl: thumUrl(pageUrl, 1080),
    label: shortLabel(pageUrl),
  }));
}
