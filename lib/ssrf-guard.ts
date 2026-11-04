// Shared SSRF guard — server-only (imports node:dns).
//
// Single source of truth for outbound host checks, used by BOTH user-supplied
// outbound paths: /api/scrape (fetchHtml) and the Muse gateway client
// (byokHeaders base-URL validation). Every DNS answer is checked against
// blocked ranges (loopback / private / link-local cloud metadata / CGNAT /
// IPv6 ULA / multicast), and a short re-resolve cache gives a DNS-rebinding
// margin. Thrown errors are PublicErrors (user-safe copy).
import { promises as dns } from 'node:dns';
import { PublicError } from './errors';

const HOST_OK_TTL_MS = 30_000; // re-resolve DNS after this window (rebinding margin)
const hostOkCache = new Map<string, number>();

export function isBlockedIpv4(ip: string): boolean {
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

export function isBlockedIpv6(ip: string): boolean {
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

/** Resolve the hostname and reject private/internal answers. Copy is
 *  website-worded (the scraper's original UX); the gateway client swaps in
 *  its own message. Passes are cached 30s per host as a rebinding margin. */
export async function assertPublicHost(u: URL): Promise<void> {
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if ((hostOkCache.get(host) ?? 0) > Date.now() - HOST_OK_TTL_MS) return;
  const addrs: string[] = [];
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) {
    addrs.push(host); // IP literal — validated directly
  } else {
    try {
      addrs.push(...(await dns.lookup(host, { all: true })).map((r) => r.address));
    } catch {
      throw new PublicError('Could not resolve that website address.');
    }
  }
  if (!addrs.length) throw new PublicError('Could not resolve that website address.');
  for (const a of addrs) {
    const blocked = a.includes(':') ? isBlockedIpv6(a) : isBlockedIpv4(a);
    if (blocked) throw new PublicError('That website address points to a private or internal network and cannot be read.');
  }
  hostOkCache.set(host, Date.now());
}