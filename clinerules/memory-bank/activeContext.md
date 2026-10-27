# Active Context (2026-10-26)

## Current Focus
Motion flow LOCKED per user: [uploaded meta.ai clip] → Wonder → Ken Burns. Implemented per-scene upload slot + Wonder animate + tier resolver. Build-verify + commit/push pending.

## Recent Changes
- Motion update: `ScriptScene` gains `motionSource/videoUrl/muteSourceAudio` (`lib/script-utils.ts`); `resolveMotionTier()` + `generateMotion()` kept for Wonder (`lib/muse/visual.ts`); Storyboard per-scene 🎞 Use a Meta AI clip (upload+preview+mute toggle+remove), 🎞 Animate (Wonder) button, motion badge; Export icons per tier; `motionPlan()` render contract (`lib/render/ffmpeg.ts`).
- Earlier: scaffolded 41 files, `npm install` (140 pkgs), fixed 2 type errors, `npm run build` ✅, live smoke test `/api/muse/script` returned 3 scenes.
- Repo live: https://github.com/alkaika/ai-social-commercial-studio (public, pushed 2026-10-27).

## Next Steps
1. `npm run build` + smoke test motion attach (object URL preview) — do now.
2. Commit + push motion changes.
3. Get gateway sample → update `client.ts/spark.ts/voice.ts/visual.ts` paths/payloads (Wonder quality test decides Seedance later).
4. Wire FFmpeg.wasm (`lib/render/ffmpeg.ts` honoring `motionPlan()` + mute/dub).
5. Build Advanced timeline UI; tests; Next upgrade.

## Active Decisions
- Motion locked: metai-upload → wonder → kenburns. No Seedance for now (user deferred).
- No meta.ai API/automation (none exists; ToS) — manual upload only. Check meta.ai terms for ad use.
- Stay neutral on writer choice; session memory default; vault opt-in; `?demo=1` trial.
- Per-scene regen only; dual approval (plan+cost, then result).

## Rule Acknowledged
READ ALL `clinerules/memory-bank/*.md` at start of EVERY future task. Top-level `clinerules/memory-bank.md` is the index/spec; per-area files are the working memory.
