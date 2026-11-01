// Stateless BYOK client with optional server-key fallback for judging.
// - Normal (BYOK): key arrives per-request in x-meta-key, forwarded to Meta, never stored/logged.
// - Judging: if header is missing / DEMO / __SERVER__ and META_API_KEY is set
//   on the server, use that server key. No secret ever goes to the client.
//   After judging, delete META_API_KEY (+ NEXT_PUBLIC_JUDGING_MODE) to return to pure BYOK.
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

export class MuseGatewayError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
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

export function byokHeaders(req: Request): { key: string; baseUrl: string; source: 'byok' | 'server' } {
  const headerKey = (req.headers.get('x-meta-key') ?? '').trim();
  const headerBase = (req.headers.get('x-meta-base-url') ?? '').trim();
  const baseUrl =
    headerBase ||
    process.env.META_GATEWAY_URL ||
    'https://api.meta.ai/v1';

  // 1) Real BYOK key from the user — always preferred (works before, during, and after judging).
  if (headerKey && headerKey !== 'DEMO' && headerKey !== SERVER_KEY_PLACEHOLDER) {
    return { key: headerKey, baseUrl, source: 'byok' };
  }

  // 2) Judging fallback — host's own key from server env. Judges send no key.
  const srv = serverKey();
  if (srv) {
    return { key: srv, baseUrl: process.env.META_GATEWAY_URL || baseUrl, source: 'server' };
  }

  // 3) No server key configured.
  // - Explicit judging placeholder without a server key = misconfigured
  //   deploy (judges would silently get mocks thinking it's live AI).
  //   Throw so routes return a clear 400 instead of silent demo output.
  // - Plain DEMO passes through so /studio?demo=1 keeps returning free mocks.
  // - Truly missing key also throws (KeySetup shows the message).
  if (headerKey === SERVER_KEY_PLACEHOLDER) {
    throw new Error('Judging mode is on but META_API_KEY is missing on the server. Add it to host env (see JUDGING.md) or turn off NEXT_PUBLIC_JUDGING_MODE to return to BYOK.');
  }
  if (!headerKey) throw new Error('Missing API key. Add your Meta key first — it is sent with this request only.');
  return { key: headerKey, baseUrl, source: 'byok' };
}
