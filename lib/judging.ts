// Client-safe judging flag. No secret lives here — only "1"/"0".
// When NEXT_PUBLIC_JUDGING_MODE=1 the studio defaults to judging (skips the
// Key step, sends placeholder __SERVER__; API routes swap it for the host's
// server key META_API_KEY, server-only, never bundled to the client).
// The landing page lets visitors preview the BYOK copy via a runtime toggle
// (localStorage + ?build=byok); the studio respects that preview so the BYOK
// flow (Key step) works even while the judging build flag is on.
export const JUDGING_MODE =
  process.env.NEXT_PUBLIC_JUDGING_MODE === '1' ||
  process.env.NEXT_PUBLIC_JUDGING_MODE === 'true';

// True when this build was made with the judging flag (deploy-time).
export const JUDGING_BUILD = JUDGING_MODE;

// Must match SERVER_KEY_PLACEHOLDER in lib/muse/client.ts (duplicated here
// so client components don't need to import server code).
export const SERVER_KEY_PLACEHOLDER = '__SERVER__';

export type BuildView = 'judging' | 'byok';

export const BUILD_VIEW_KEY = 'studio.build-view';

export function getStoredBuildView(): BuildView | null {
  try {
    if (typeof window === 'undefined') return null;
    const v = window.localStorage.getItem(BUILD_VIEW_KEY);
    return v === 'judging' || v === 'byok' ? v : null;
  } catch {
    return null;
  }
}

export function setStoredBuildView(v: BuildView) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BUILD_VIEW_KEY, v);
  } catch {
    /* ignore */
  }
}

// Runtime view checks (safe on server — default to build flag).
// - Pure BYOK builds (flag off): always BYOK.
// - Judging builds: ?build=byok (or stored 'byok' with no ?build=judging
//   override) previews the post-judging BYOK flow; everything else is judging.
export function isByokPreview(): boolean {
  if (!JUDGING_BUILD) return true;
  try {
    if (typeof window === 'undefined') return false;
    const q = new URLSearchParams(window.location.search).get('build');
    if (q === 'byok') return true;
    if (q === 'judging') return false;
    return getStoredBuildView() === 'byok';
  } catch {
    return false;
  }
}

export function isJudgingView(): boolean {
  return JUDGING_BUILD && !isByokPreview();
}


