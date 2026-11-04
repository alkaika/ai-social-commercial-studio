// Stateless BYOK client with optional server-key fallback for judging.
// - Normal (BYOK): key arrives per-request in x-meta-key, forwarded to Meta, never stored/logged.
// - Judging: if header is __SERVER__ and META_API_KEY is set
//   on the server, use that server key. No secret ever goes to the client.
//   After judging, delete META_API_KEY (+ NEXT_PUBLIC_JUDGING_MODE) to return to pure BYOK.
import { MuseGatewayError, PublicError } from '@/lib/errors';
import { assertPublicHost } from '@/lib/ssrf-guard';

export { MuseGatewayError }; // re-export — routes/libs keep importing it from here

export interface MuseCallOpts {
  key: string;
  baseUrl: string; // e.g. https://your-meta-gateway.example (with or without trailing /v1)
  path: string;    // e.g. /v1/chat/completions
  body: unknown;
  timeoutMs?: number;
}

// Strip trailing slashes AND a trailing /v1 so users can paste either
// https://host or https://host/v1 — paths below always add /v1/...
export function normalizeBase(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
}

export async function callMuse<T = any>(opts: MuseCallOpts): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 60000);
  try {
    const base = normalizeBase(opts.baseUrl);
    const res = await fetch(`${base}${opts.path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.key}`,
      },
      body: JSON.stringify(opts.body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new MuseGatewayError(res.status, `Meta gateway ${res.status}: ${text.slice(0, 500)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

// GET helper (e.g. GET /v1/models, GET /v1/models/{id}) for discovery checks.
export async function callMuseGet<T = any>(opts: { key: string; baseUrl: string; path: string; timeoutMs?: number }): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20000);
  try {
    const base = normalizeBase(opts.baseUrl);
    const res = await fetch(`${base}${opts.path}`, {
      headers: { Authorization: `Bearer ${opts.key}` },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new MuseGatewayError(res.status, `Meta gateway ${res.status}: ${text.slice(0, 500)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export const SERVER_KEY_PLACEHOLDER = '__SERVER__';

function serverKey(): string {
  // Server-only env. Never prefixed with NEXT_PUBLIC_ so it never leaks to the client bundle.
  return process.env.META_API_KEY || (process.env as any).META_SERVER_KEY || '';
}

export function isJudgingServerMode(): boolean {
  return !!serverKey() || process.env.JUDGING_MODE === '1';
}

// Server-side validation for the user-supplied gateway base URL (closes the
// forward-proxy hole where anyone could make this server POST anywhere with
// any Bearer header): must parse, must be https (a key must never travel over
// plaintext http), standard port only, and the host must pass the same SSRF
// guard the scraper uses (no loopback/private/link-local/metadata IPs, with a
// DNS re-resolution margin against rebinding).
async function assertGatewayUrl(raw: string): Promise<string> {
  let u: URL;
  try { u = new URL(normalizeBase(raw)); } catch { throw new PublicError('Gateway address must be a valid https:// URL.'); }
  if (u.protocol !== 'https:') throw new PublicError('Gateway address must use https:// — plain http would send your key unencrypted.');
  if (u.port && u.port !== '443') throw new PublicError('Gateway address must use the standard https port (443).');
  try { await assertPublicHost(u); } catch { throw new PublicError('That gateway address could not be resolved or points to a private/internal network, so it cannot be used.'); }
  return u.toString();
}

export async function byokHeaders(req: Request): Promise<{ key: string; baseUrl: string; source: 'byok' | 'server' }> {
  const headerKey = (req.headers.get('x-meta-key') ?? '').trim();
  const headerBase = (req.headers.get('x-meta-base-url') ?? '').trim();
  const fallbackBase = process.env.META_GATEWAY_URL || 'https://api.meta.ai/v1';

  let key: string;
  let baseUrl: string;
  let source: 'byok' | 'server';

  // 1) Real BYOK key from the user — always preferred (works before, during, and after judging).
  if (headerKey && headerKey !== SERVER_KEY_PLACEHOLDER) {
    key = headerKey;
    baseUrl = headerBase || fallbackBase;
    source = 'byok';
  } else {
    // 2) Judging fallback — host's own key from server env. Judges send no key.
    const srv = serverKey();
    if (srv) {
      key = srv;
      baseUrl = fallbackBase;
      source = 'server';
    } else if (headerKey === SERVER_KEY_PLACEHOLDER) {
      // 3) No server key configured.
      // - Explicit judging placeholder without a server key = misconfigured
      //   deploy. Throw so routes return a clear 400 instead of silent output.
      throw new PublicError('Judging mode is on but META_API_KEY is missing on the server. Add it to host env (see JUDGING.md) or turn off NEXT_PUBLIC_JUDGING_MODE to return to BYOK.');
    } else {
      // - Truly missing key also throws (KeySetup shows the message).
      throw new PublicError('Missing API key. Add your Meta key first — it is sent with this request only.');
    }
  }

  // Validated AFTER resolution: BYOK users pick their own gateway host, so the
  // base URL must pass the SSRF guard before the server fetches anything.
  return { key, baseUrl: await assertGatewayUrl(baseUrl), source };
}
