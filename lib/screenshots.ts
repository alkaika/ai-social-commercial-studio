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
// Every page is offered in TWO devices (2026-11-04, user request):
// - desktop: landscape render, displayed aspect-video + object-cover
// - mobile:  phone-browser portrait render, 390x844, displayed
//   aspect-[390/844] — the renderers are width-driven, so responsive sites
//   show their real mobile layout at 390px wide (no key, still free).
//
// Usage: screenshotCandidates(urls, aboutSource, sitePages, device) ->
// [{ pageUrl, imageUrl, fallbackUrl, label, device }] with 'desktop' or
// 'mobile'; the Business + Story galleries toggle between the two (same 12
// discovered pages each). The <ShotImg> component handles placeholder retry
// and the portrait/landscape display aspect per shot.device.

export type ShotDevice = 'desktop' | 'mobile';

/** Render + display viewport per device. */
export const SHOT_VIEWPORTS: Record<ShotDevice, { w: number; h: number }> = {
  desktop: { w: 1080, h: 720 },
  mobile: { w: 390, h: 844 }, // iPhone-ish portrait — natural fit for 9:16 cuts
};

export interface WebsiteShot {
  id: string;
  pageUrl: string;
  imageUrl: string;
  fallbackUrl: string;
  label: string;
  device: ShotDevice;
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

/** mShots render at the requested width; optional height pins a portrait shot. */
export function mshotsUrl(pageUrl: string, width = 1280, height?: number): string {
  const h = height ? `&h=${height}` : '';
  return `https://s0.wp.com/mshots/v1/${encodeURIComponent(pageUrl)}?w=${width}${h}`;
}

/** Landscape 16:9 crop — full-width site, no side bars. */
export function thumUrl(pageUrl: string, width = 1280, height = 720): string {
  return `https://image.thum.io/get/width/${width}/crop/${height}/noanimate/${pageUrl}`;
}

export function microlinkUrl(pageUrl: string, device: ShotDevice = 'desktop'): string {
  const vp = SHOT_VIEWPORTS[device];
  return `https://image.microlink.io/?url=${encodeURIComponent(pageUrl)}&viewport.width=${vp.w}&viewport.height=${vp.h}&screenshot=true&meta=false&embed=screenshot.url`;
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

function fileSafe(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'page';
}

const ABOUT_PATHS = ['/about', '/about-us', '/our-story', '/story', '/pricing', '/services'];

/** Download-friendly filename: brand-host + path (+ `-mobile` for phone renders). */
export function shotFileName(shot: WebsiteShot, index: number): string {
  const suffix = shot.device === 'mobile' ? '-mobile' : '';
  try {
    const u = new URL(shot.pageUrl);
    const host = fileSafe(u.hostname.replace(/^www\./, ''));
    const path = u.pathname.replace(/\/$/, '') || 'homepage';
    return `${String(index + 1).padStart(2, '0')}-${host}${path === 'homepage' ? '-homepage' : `-${fileSafe(path)}`}${suffix}.jpg`;
  } catch {
    return `website-shot-${index + 1}${suffix}.jpg`;
  }
}

/** Best-effort download of a rendered screenshot (mShots -> thum.io -> open tab). */
export async function downloadWebsiteShot(shot: WebsiteShot, index: number): Promise<'saved' | 'opened'> {
  const name = shotFileName(shot, index);
  const tries = [shot.imageUrl, shot.fallbackUrl, microlinkUrl(shot.pageUrl, shot.device)];
  for (const url of tries) {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) continue;
      const blob = await res.blob();
      // Skip tiny error payloads (<15KB) — try the next renderer instead.
      if (blob.size < 15000) continue;
      const obj = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = obj;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(obj), 8000);
      return 'saved';
    } catch { /* try next renderer */ }
  }
  window.open(shot.imageUrl, '_blank', 'noopener');
  return 'opened';
}

/** Build screenshot candidates for ONE device: discovered site pages (up to 12) + homepage + about variants. */
export function screenshotCandidates(urls: string[], aboutSource = '', sitePages: string[] = [], device: ShotDevice = 'desktop'): WebsiteShot[] {
  const pages: string[] = [];
  const push = (p: string) => {
    const n = normalizePageUrl(p);
    if (n && !pages.includes(n)) pages.push(n);
  };
  // Discovered main pages first (sitemap + nav, up to 12) — the 10+ gallery.
  for (const sp of sitePages || []) {
    push(sp);
    if (pages.length >= 12) break;
  }
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
  const vp = SHOT_VIEWPORTS[device];
  return pages.slice(0, 12).map((pageUrl, i) => ({
    id: `shot-${device}-${i}-${pageUrl}`,
    pageUrl,
    device,
    // Desktop keeps the historical width-only mShots URL (warm cache);
    // mobile pins w+h so the render is a full phone-portrait shot.
    imageUrl: device === 'mobile' ? mshotsUrl(pageUrl, vp.w, vp.h) : mshotsUrl(pageUrl, vp.w),
    fallbackUrl: thumUrl(pageUrl, vp.w, vp.h),
    label: shortLabel(pageUrl),
  }));
}
