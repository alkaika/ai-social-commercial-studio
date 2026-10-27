# Active Context (2026-10-27)

> Living note — status as of last push. Durable architecture lives in `systemPatterns.md`; durable scope in `projectbrief.md`.

## Current Focus
Motion flow LOCKED per user: [uploaded meta.ai clip] → Wonder → Ken Burns. Implemented, build-verified ✅, committed + pushed (`6facfa3`). Awaiting user's real Meta gateway sample to replace OpenAI-compatible assumptions in adapters.

## Recent Changes
- Motion update (2026-10-27, `6facfa3`): `ScriptScene` gains `motionSource/videoUrl/muteSourceAudio`; `resolveMotionTier()` + Wonder `generateMotion()`; Storyboard per-scene clip slot + Wonder button + badge; Export tier icons; `motionPlan()` render contract. `npm run build` ✅ (13 routes).
- Earlier: scaffolded 41 files, `npm install` (140 pkgs), fixed 2 type errors, live smoke test `/api/muse/script` → 3 scenes.
- Repo live: https://github.com/alkaika/ai-social-commercial-studio (public, `main` = `6facfa3`).
- Docs decision: keep `clinerules/` in repo (no secrets inside) — freshened this file + `progress.md`.

## Next Steps
1. Get gateway sample → update `client.ts/spark.ts/voice.ts/visual.ts` paths/payloads (Wonder quality test decides Seedance later).
2. Wire FFmpeg.wasm (`lib/render/ffmpeg.ts` honoring `motionPlan()` + mute/dub).
3. Build Advanced timeline UI; tests; Next upgrade past 14.2.5.

## Active Decisions
- Motion locked: metai-upload → wonder → kenburns. No Seedance for now (user deferred).
- No meta.ai API/automation (none exists; ToS) — manual upload only. Check meta.ai terms for ad use.
- Stay neutral on writer choice; session memory default; vault opt-in; `?demo=1` trial.
- Per-scene regen only; dual approval (plan+cost, then result).

## Rule Acknowledged
READ ALL `clinerules/memory-bank/*.md` at start of EVERY future task. Top-level `clinerules/memory-bank.md` is the index/spec; per-area files are the working memory.
