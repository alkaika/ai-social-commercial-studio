// Shared API error types (server-side).
//
// - PublicError: the message is written FOR the end user — safe to return in
//   API responses ("Missing API key…", "That website address points to a
//   private network…").
// - MuseGatewayError: diagnostics from the CALLER'S OWN gateway (their key,
//   their endpoint) — safe to surface; body text is capped at 500 chars in
//   lib/muse/client before it ever reaches here.
//
// Anything else thrown inside a route (TypeErrors, stack traces, internals)
// is logged server-side only and replaced with a generic message via
// routeError() — internals never leak to the public internet.
export class PublicError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublicError';
  }
}

export class MuseGatewayError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'MuseGatewayError';
    this.status = status;
  }
}

/** Route catch-block helper: pass user-safe messages through, hide the rest. */
export function routeError(e: unknown, fallback: string): string {
  if (e instanceof PublicError || e instanceof MuseGatewayError) return e.message;
  console.error('[api]', e); // full detail server-side only
  return fallback;
}