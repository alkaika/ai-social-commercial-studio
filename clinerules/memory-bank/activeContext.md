# Active Context (2026-10-26)

## Current Focus
MVP scaffold COMPLETE and build-verified. Awaiting user's real Meta gateway sample (base URL + redacted curl) to replace OpenAI-compatible assumptions in 4 adapter files.

## Recent Changes
- Scaffolded 41 files, `npm install` (140 pkgs), fixed 2 type errors (SourceHub heroImages, webauthn optionsJSON), `npm run build` ✅, live smoke test `/api/muse/script` returned 3 scenes.
- Implemented all locked scope: BYOK proxy, passkey vault, factual writer table, Source Hub, storyboard + Director's Notes, export SRT/txt/backup.

## Next Steps
1. Get gateway sample → update `client.ts/spark.ts/voice.ts/visual.ts` paths/payloads.
2. Wire FFmpeg.wasm (`lib/render/ffmpeg.ts`) for one-click MP4.
3. Build Advanced timeline UI (tracks model ready via projectStore).
4. Add tests: duration math, revision locked/pinned rules, Playwright WebAuthn virtual auth.
5. Upgrade Next.js past 14.2.5 vuln; consider Dexie for project persistence.

## Active Decisions
- Stay neutral on writer choice (no recommendation badge) — cost vs privacy is user's call.
- Session memory default; vault opt-in; `?demo=1` for no-key trial.
- Per-scene regen only; dual approval (plan+cost, then result).

## Rule Acknowledged
READ ALL `clinerules/memory-bank/*.md` at start of EVERY future task. Top-level `clinerules/memory-bank.md` is the index/spec; per-area files are the working memory.
