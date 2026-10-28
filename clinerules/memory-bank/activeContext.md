# Active Context (2026-10-27)

> Living note — status as of last push. Durable architecture lives in `systemPatterns.md`; durable scope in `projectbrief.md`.

## Current Focus
MILESTONE 2026-10-27: user live test → **6/6 ✅** on `https://api.meta.ai/v1`. Now: Back navigation added — every step has ← Back, Story/Export label it "Back to story", and the step breadcrumb is clickable for visited steps (forward steps stay locked). No state loss: all inputs live in Zustand (`projectStore`) so going back never wipes key/brand/script/work. Build ✅, ready to commit.

## Recent Changes
- MILESTONE: 6/6 ✅ — all models reachable with user's key (SAM auto-discovery worked).
- meta.ai clips: per-scene 🎙 voice slot + motion slot, prompt routing, `motionPlan()` carries VO + tier.
- Validate: catalog checks + SAM auto-discovery (`d7023cd`), default gateway `https://api.meta.ai/v1` (`3cfaee8`), aligned adapters to verified API (`1f7f4f4`). `npm run build` ✅ (13 routes).

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
