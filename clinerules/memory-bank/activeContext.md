# Active Context (2026-10-27)

> Living note — status as of last push. Durable architecture lives in `systemPatterns.md`; durable scope in `projectbrief.md`.

## Current Focus
5/5 checks live (Wonder retired — Key screen counts dynamically: spark-standard, spark-contributor, image, voice-captions, sam). Voice Transcribe KEPT for auto-captions only (relabeled `voice-captions`, route returns `{captions:true, synthesis:false}`). Messaging fix also shipped (single-voice cadence copy). Build ✅, ready to commit + push.

## Recent Changes
- Wonder RETIRED: all reasoning on chosen Spark; 5-check validate; Animate marks kenburns locally (no API fetch); 'wonder' removed from MotionSource union.
- MILESTONE: 6/6 ✅ — was all models reachable with user's key (SAM auto-discovery worked).
- Full-script timing: cadence controls (`bestCadence`, 0.85–1.2x, auto-fit) + trim recommendations (`trimWords`, per-scene approve/keep) so the entire approved script always plays; Spark prompt forbidden from trimming.
- Master script: Business page drafts/edits/approves the final narrative (`/api/muse/script` mode master → `generateMasterScript`); Story organizes it to duration (`buildScriptPrompt` takes `masterScript`, `storyBeat` traces scenes to brand truth).

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
