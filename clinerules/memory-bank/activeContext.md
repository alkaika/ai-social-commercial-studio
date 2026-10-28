# Active Context (2026-10-27)

> Living note — status as of last push. Durable architecture lives in `systemPatterns.md`; durable scope in `projectbrief.md`.

## Current Focus
User live test #3 (after probing fix): still 3/6 ✅ (spark-standard, spark-contributor, image) but errors now DIAGNOSTIC:
- voice → `/v1/audio/transcriptions` 404 (both TTS guesses dead — correct, no TTS exists)
- sam → `/v1/images/edits` 400 reveals real format: JSON `images[]` with image_url/file_id (not `image`)
- wonder → `/v1/videos/generations` 405 (path exists, wrong method/shape — but docs say no video gen at all)
Verified vs https://dev.meta.ai/docs (2026-10-27): Voice = STT ONLY (`POST /v1/asr/transcribe`, multipart, $0.18/hr); SAM ID is `sam-3-1` (hyphens) via `POST /v1/responses`; Wonder `muse-wonder-1.0` is a TEXT/reasoning model ($4/$20) — NO video endpoint. Shipped: catalog-based validate (GET /v1/models/{id} + chat/image pings, no more dead probes), SAM adapter → /v1/responses sam-3-1, voice adapter → no-TTS seam, Animate button → Ken Burns, memory bank corrected. Awaiting user retest (expect voice/sam/wonder catalog checks to flip ✅ if key scope includes those models).

## Recent Changes
- Validate v2 (`bb74b5e`): CANDIDATES map, normalizeBase() shared, MuseGatewayError with status, auth-vs-fail UI badge (🔑 endpoint exists, key rejected).
- Earlier: hydration fix (`f7f2840`), /v1 normalization + reasons (`c0ae937`), motion (`6facfa3`). `npm run build` ✅. Repo `main` = `bb74b5e`.

## Recent Changes
- Validate diagnostics: `validate/route.ts` returns `{checks, details, baseUrl}`; `KeySetup.tsx` expandable reasons + 0/6 URL-mismatch explainer.
- URL normalization in `callMuse()` strips trailing `/v1`.
- Earlier motion update (`6facfa3`) build-verified ✅, committed + pushed. Repo `main` = `6facfa3`.

## Next Steps
1. User retests with fixed build → paste "Why did checks fail?" details.
   - `401 invalid_api_key` on `…/api.meta.ai/v1/chat/completions` → URL IS an OpenAI gateway; key is wrong/type-mismatched. Get correct key.
   - `404 / HTML` → NOT an OpenAI gateway (consumer meta.ai has no API). Need real gateway base URL from Meta provider docs.
2. Once 6/6 (or N/6): wire real shapes into `spark/voice/visual` adapters.
3. FFmpeg.wasm `motionPlan()` + mute/dub; Advanced timeline; tests; Next upgrade.

## Active Decisions
- Motion locked: metai-upload → wonder → kenburns. No Seedance for now (user deferred).
- No meta.ai API/automation (none exists; ToS) — manual upload only. Check meta.ai terms for ad use.
- Stay neutral on writer choice; session memory default; vault opt-in; `?demo=1` trial.
- Per-scene regen only; dual approval (plan+cost, then result).

## Rule Acknowledged
READ ALL `clinerules/memory-bank/*.md` at start of EVERY future task. Top-level `clinerules/memory-bank.md` is the index/spec; per-area files are the working memory.
