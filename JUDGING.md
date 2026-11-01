# Judging mode (temporary) — zero key friction for judges

This app is BYOK by default. For judging, it can run off YOUR hosted key
so judges never paste anything. After judging, delete the env vars to
return to pure BYOK. Your real key NEVER lives in code or git.

## 1) During judging — set 3 env vars on your HOST (not in code)

On Vercel / Netlify / your host dashboard → Environment Variables
(or a local `.env.local` file that you NEVER commit — it is git-ignored):

```
META_API_KEY=sk-your-real-meta-key-here
META_GATEWAY_URL=https://api.meta.ai/v1
NEXT_PUBLIC_JUDGING_MODE=1
# optional, explicit: JUDGING_MODE=1
```

Then redeploy / restart (`npm run build`).

What judges get:
- Landing page says "Judging build — every AI step is live, no key needed"
- `/studio` boots straight at Writer (Key step hidden, no paste, no vault)
- All `/api/muse/*` calls send the placeholder `__SERVER__`; the server
  swaps it for `META_API_KEY` and forwards to Meta. The secret never
  reaches the browser, is never logged, and never persists.
- Real BYOK keys still win if sent — so you can test BYOK even while
  judging mode is on.

## 2) After judging — back to pure BYOK (1 minute)

1. Delete from host env: `META_API_KEY` (+ `JUDGING_MODE` if you set it)
   and `NEXT_PUBLIC_JUDGING_MODE`
2. Redeploy / `npm run build`
3. Verify: landing shows "Bring your own Meta key", `/studio` boots at Key

No code changes needed — the toggle is env-only.

## Safety notes

- NEVER put your real key in `NEXT_PUBLIC_*`, in `lib/judging.ts`,
  in `.env.example`, or in chat. Only `META_API_KEY` (server-only).
- `.env*.local` is git-ignored — safe for local judging tests.
- Cost: judges spend YOUR key quota. Set a spend cap / rotate the key after.
