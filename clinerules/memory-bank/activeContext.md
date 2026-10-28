# Active Context (2026-10-27)

> Living note — status as of last push. Durable architecture lives in `systemPatterns.md`; durable scope in `projectbrief.md`.

## Current Focus
Key insight from user's live test: Gateway URL field matters. User pasted `https://api.meta.ai/v1` + key `LLM…4A` → 0/6 checks. App now (a) normalizes trailing `/v1` so both `…/api.meta.ai` and `…/api.meta.ai/v1` work, (b) returns per-model failure reasons + 0/6 explainer pointing at URL-not-key. Next: user retests and pastes the ACTUAL "Why did checks fail?" lines (expected: 401 vs 404 reveals whether this endpoint is an OpenAI-style gateway at all).

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
