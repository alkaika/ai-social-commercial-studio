# Active Context (2026-10-30)

> Living note — status as of last push. Durable architecture lives in `systemPatterns.md`; durable scope in `projectbrief.md`.

## Current Focus
Story back to ONE combined prompt (2026-10-30, user request — one paste so meta.ai outputs everything together): `buildCombinedStoryPrompt()` carries full script + labeled SEGMENT i OF N (~10s voice+video directions each, SAME woman/voice/device) + ratio/platform/vibe/timing. Export stitch kept as optional fallback in case meta.ai returns parts. tsc clean.

## Recent Changes
- Story ONE combined prompt (2026-10-30, user request — one paste, meta.ai outputs everything together): `Storyboard.tsx` single `<pre>` via `buildCombinedStoryPrompt()` (full "saying: full script" line + SEGMENT i OF N blocks each with exact word-for-word line + ~10s direction + SAME continuity + ratio WxH/platform/vibe/timing + screenshot line). Per-part multi-paste version replaced. Export "Stitch my parts" KEPT as fallback if meta.ai returns separate files.
- Export stitch (2026-10-30): `ExportStep.tsx` gains "Stitch my parts" — upload N Part MP4s (numeric-name sort, ≤8), `stitchParts()` in `lib/render/ffmpeg.ts` (FFmpeg.wasm single-thread, loader v3: same-origin absolute worker + local `/ffmpeg/` core/wasm first, unpkg/jsdelivr core/wasm fallback — no blob:, no cross-origin worker; concat demuxer stream-copy first, scale/crop+libx264 re-encode fallback to Setup WxH), live % bar, inline preview, `commercial-{platform}-{duration}s-final.mp4` download + manual CLI fallback. Deps: @ffmpeg/ffmpeg+util+core. Build ✅ 13 routes.
- Story 10s batches (2026-10-30, meta.ai ~10s cap): `Storyboard.tsx` renders N per-part cards (copy + open meta.ai each) via `splitScriptIntoBatches()` (sentence-aware, proportional words per ceil(duration/10) secs) + `buildSingleStoryPrompt(..., batchIndex/batchTotal/totalDurationSec)` with Part-i-of-n + SAME-voice/woman/device continuity line. Continue saves per-batch scenes for Export captions. Replaces the single-prompt version.
- Fresh-start + project library (2026-10-30): `ProjectBar.tsx` (New/Save/Open/Delete + amber unsaved warning), `projectStore` gains `projectId/projectName/newFreshProject/openProject`, `lib/project/local.ts` library (`meta-studio-projects-v1`, blob-URL stripping, migrateLegacyIfNeeded), Dexie v3 `projectId` index + `blobKeyForScene/blobKeyForAsset` + `migrateLegacyBlobsToProject`, PersistGate reduced to one-time migration only, `app/studio` mounts ProjectBar + drops "Saved just now" footer. Opens land on sources/story (never Key/Writer). NOTE: editor `new_text` limit ~6000 chars — split ProjectBar into create + append.
- Clip watcher (2026-10-30): `lib/meta-sdk/watcher.ts` (2s poll, byte-stable detection, baseline sweep-guard, .crdownload-safe ext filter) + Dexie v2 `prefs` table persisting the directory handle + panel watch UI (status / stop / change / restore-on-reload) + row `Copy + open meta.ai` (clipboard write + `window.open` in the same click so user activation survives). Automation AROUND meta.ai only — no bots; ToS decision intact. NOTE: tsconfig targets es5 → no `for...of` over Map iterators (use `.forEach`).
- Story motion screenshot picker (2026-10-30): per-scene `Pick a website shot` grid (homepage + about variants from scanned urls + scraper `aboutSource`), free mShots/thum.io/microlink (no key), landscape 1280x720 edge-to-edge (`aspect-video object-cover`), `ShotImg.tsx` placeholder auto-retry (naturalWidth <700 detect, cache-buster 3/4/6/8/10s, fallback chain), `motionSource='screenshot'` + `screenshotPageUrl`, Export preview shows 🌐.
- Screenshot fix (2026-10-30): mShots first-hit "Generating Preview" WP logo handled (was stuck in thumbnails while new-tab showed real shot — generation lag); black side bars removed (was 1080x1920 vertical crop → now 1280x720 landscape).
- Wonder RETIRED: all reasoning on chosen Spark; 5-check validate; Animate marks kenburns locally (no API fetch); 'wonder' removed from MotionSource union.
- MILESTONE: 6/6 ✅ — was all models reachable with user's key (SAM auto-discovery worked).
- Full-script timing: cadence controls (`bestCadence`, 0.85–1.2x, auto-fit) + trim recommendations (`trimWords`, per-scene approve/keep) so the entire approved script always plays; Spark prompt forbidden from trimming.
- Master script: Business page drafts/edits/approves the final narrative (`/api/muse/script` mode master → `generateMasterScript`); Story organizes it to duration (`buildScriptPrompt` takes `masterScript`, `storyBeat` traces scenes to brand truth).

## Next Steps
1. End-to-end test: scrape → generate script (real Spark) → meta.ai 10s parts → stitch in Export → download final MP4 + SRT.
2. Advanced timeline UI; tests; Next upgrade.

## Active Decisions
- Story = ONE combined Meta.ai prompt (2026-10-30, user request — one paste, meta.ai outputs everything together): full script + labeled SEGMENT i OF N (~10s voice+video each) + SAME woman/voice/device continuity; screenshots attached once; ratio (9:16, 4:5, 1:1, 16:9) + platform + vibe auto-included. Voice choices: warm female/male energetic/calm; device: Mobile phone / PC monitor. Export stitch kept only as fallback.
- Motion + voice: metai-upload clips → website screenshots (free, no key, Ken Burns zoom over shot) → kenburns; `metai-clip` voice clips per scene. No Seedance. No meta.ai automation/botting (ToS) — clips are generated by hand at meta.ai; ToS-safe automation AROUND it (Downloads-folder watcher → auto-attach, 2026-10-30) is fine. Check meta.ai terms for ad use.
- No meta.ai API/automation (none exists; ToS) — manual upload only. Check meta.ai terms for ad use.
- Stay neutral on writer choice; session memory default; vault opt-in; `?demo=1` trial.
- Per-scene regen only; dual approval (plan+cost, then result).

## Rule Acknowledged
READ ALL `clinerules/memory-bank/*.md` at start of EVERY future task. Top-level `clinerules/memory-bank.md` is the index/spec; per-area files are the working memory.
