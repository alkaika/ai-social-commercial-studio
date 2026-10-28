# Active Context (2026-10-27)

> Living note — status as of last push. Durable architecture lives in `systemPatterns.md`; durable scope in `projectbrief.md`.

## Current Focus
Good catch by user: consumer meta.ai also does text-to-voice ("Make a video of a warm female voice saying: '...'"). Meta Model API still has NO TTS, so wired as a legit import path: per-scene 🎙 voice-clip slot (video/audio upload + inline player + remove) with `voiceSource`/`voiceClipUrl` on the scene, voice routing message now pastes the exact meta.ai prompt prefilled with the scene's line, `motionPlan()` carries VO per scene. Clarifies audio hierarchy: voice clip PLAYS, motion clips muted under it. Memory bank + render contract updated.

## Recent Changes
- meta.ai voice clips: per-scene 🎙 slot + `voiceSource`/`voiceClipUrl`, routing message pastes exact meta.ai prompt, `motionPlan()` carries VO. (This turn.)
- Validate: catalog checks + SAM auto-discovery (`d7023cd`), default gateway `https://api.meta.ai/v1` (`3cfaee8`), aligned adapters to verified API (`1f7f4f4`). `npm run build` ✅ (13 routes).
- Earlier: motion clips (`6facfa3`), hydration fix, /v1 normalization.

## Next Steps
1. User retests with fixed build → paste "Why did checks fail?" details.
   - `401 invalid_api_key` on `…/api.meta.ai/v1/chat/completions` → URL IS an OpenAI gateway; key is wrong/type-mismatched. Get correct key.
   - `404 / HTML` → NOT an OpenAI gateway (consumer meta.ai has no API). Need real gateway base URL from Meta provider docs.
2. Once 6/6 (or N/6): wire real shapes into `spark/voice/visual` adapters.
3. FFmpeg.wasm `motionPlan()` + mute/dub; Advanced timeline; tests; Next upgrade.

## Active Decisions
- Motion + voice: metai-upload clips → kenburns; `metai-clip` voice clips per scene. No Seedance. No meta.ai automation (ToS) — manual upload only. Check meta.ai terms for ad use.
- No meta.ai API/automation (none exists; ToS) — manual upload only. Check meta.ai terms for ad use.
- Stay neutral on writer choice; session memory default; vault opt-in; `?demo=1` trial.
- Per-scene regen only; dual approval (plan+cost, then result).

## Rule Acknowledged
READ ALL `clinerules/memory-bank/*.md` at start of EVERY future task. Top-level `clinerules/memory-bank.md` is the index/spec; per-area files are the working memory.
