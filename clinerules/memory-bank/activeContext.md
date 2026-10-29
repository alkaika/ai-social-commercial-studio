# Active Context (2026-10-27)

> Living note — status as of last push. Durable architecture lives in `systemPatterns.md`; durable scope in `projectbrief.md`.

## Current Focus
Master-script flow shipped + Setup now starts a FRESH cut: Generate clears previously organized scenes (`script: null`) so the Story step always re-organizes the untouched approved master for the newly picked duration/platform/vibe. Build ✅, ready to commit + push.

## Recent Changes
- MILESTONE: 6/6 ✅ — all models reachable with user's key (SAM auto-discovery worked).
- Master script: Business page drafts/edits/approves the final narrative (`/api/muse/script` mode master → `generateMasterScript`); Story organizes it to duration (`buildScriptPrompt` takes `masterScript`, `storyBeat` traces scenes to brand truth).
- About-page stories: `scrapeSite()` follows in-page /about links + 8 variants, merges stories across URLs.
- Vault: biometrics (device-bound) + passkey (synced) options, both PRF-encrypted, export/import of encrypted bundle, raw-bytes PRF fix, duplicate-Back fix.
- meta.ai clips: per-scene 🎙 voice slot + motion slot, prompt routing, `motionPlan()` carries VO + tier.

## Next Steps
1. End-to-end test: scrape → generate script (real Spark) → attach meta.ai voice + motion clips → export SRT/txt.
2. FFmpeg.wasm: implement `motionPlan()` + VO assembly in `lib/render/ffmpeg.ts`.
3. Advanced timeline UI; tests; Next upgrade.

## Active Decisions
- Motion + voice: metai-upload clips → kenburns; `metai-clip` voice clips per scene. No Seedance. No meta.ai automation (ToS) — manual upload only. Check meta.ai terms for ad use.
- No meta.ai API/automation (none exists; ToS) — manual upload only. Check meta.ai terms for ad use.
- Stay neutral on writer choice; session memory default; vault opt-in; `?demo=1` trial.
- Per-scene regen only; dual approval (plan+cost, then result).

## Rule Acknowledged
READ ALL `clinerules/memory-bank/*.md` at start of EVERY future task. Top-level `clinerules/memory-bank.md` is the index/spec; per-area files are the working memory.
