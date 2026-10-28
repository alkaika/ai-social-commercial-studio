// Stateless BYOK client. Key arrives per-request, is forwarded to Meta, never stored/logged.
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

export function byokHeaders(req: Request): { key: string; baseUrl: string } {
  const key = req.headers.get('x-meta-key') ?? '';
  const baseUrl =
    req.headers.get('x-meta-base-url') ??
    process.env.META_GATEWAY_URL ??
    'https://api.meta.example';
  if (!key) throw new Error('Missing API key. Add your Meta key first — it is sent with this request only.');
  return { key, baseUrl };
}
