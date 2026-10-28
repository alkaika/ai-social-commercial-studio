# Active Context (2026-10-27)

> Living note — status as of last push. Durable architecture lives in `systemPatterns.md`; durable scope in `projectbrief.md`.

## Current Focus
User live test #2: `https://api.meta.ai/v1` + key `LLM…4A` → **3/6 ✅** (spark-standard, spark-contributor, image) + 404 on voice/wonder/sam. Conclusion: gateway IS a real OpenAI-style API; 3 failing paths are MY guesses (`/v1/audio/speech`, `/v1/sam/segment`, `/v1/video/generations`), not user's fault. Shipped (`bb74b5e`): multi-candidate probing + 401/403='auth' vs 404-try-next distinction. Probe confirmed all 6 endpoints EXIST (all 401 with bad key = auth-shaped, not missing). So with the REAL key: Spark/Image should go ✅; voice/sam/wonder outcome depends on whether candidates match real paths — retest needed.

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
