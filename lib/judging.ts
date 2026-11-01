// Client-safe judging flag. No secret lives here — only "1"/"0".
// When NEXT_PUBLIC_JUDGING_MODE=1 the studio skips the Key step and
// sends the placeholder __SERVER__; API routes swap it for the host's
// server key (META_API_KEY, server-only, never bundled to the client).
export const JUDGING_MODE =
  process.env.NEXT_PUBLIC_JUDGING_MODE === '1' ||
  process.env.NEXT_PUBLIC_JUDGING_MODE === 'true';

// Must match SERVER_KEY_PLACEHOLDER in lib/muse/client.ts (duplicated here
// so client components don't need to import server code).
export const SERVER_KEY_PLACEHOLDER = '__SERVER__';

