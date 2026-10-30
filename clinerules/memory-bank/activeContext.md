# Active Context (2026-10-30)

> Living note — status as of last push. Durable architecture lives in `systemPatterns.md`; durable scope in `projectbrief.md`.

## Current Focus
Story split into 10s Meta.ai batches (2026-10-30, user request — meta.ai caps voice+video at ~10s): Story page auto-splits full script into ceil(duration/10) parts (sentence-aware, proportional word targets) and builds one copy-paste prompt per part with SAME voice/woman/device + Part i-of-n continuity. tsc clean.

## Recent Changes
- Story 10s batches (2026-10-30, meta.ai ~10s cap): `Storyboard.tsx` renders N per-part cards (copy + open meta.ai each) via `splitScriptIntoBatches()` (sentence-aware, proportional words per ceil(duration/10) secs) + `buildSingleStoryPrompt(..., batchIndex/batchTotal/totalDurationSec)` with Part-i-of-n + SAME-voice/woman/device continuity line. Continue saves per-batch scenes for Export captions. Replaces the single-prompt version.
- Story single-prompt (2026-10-30): `Storyboard.tsx` rewritten simple — 3 cards (script textarea pre-filled from Business master → voice dropdown + Mobile phone/PC monitor buttons → single prompt `<pre>` + Copy + Open meta.ai). `lib/meta-sdk/prompts.ts` gains `STORY_VOICES`, `STORY_DEVICES`, `buildSingleStoryPrompt()` (duration + aspect WxH + platform label + vibe + voice line + woman-using-app visual + attach-screenshots line). Replaces per-scene voice/video upload slots, cadence sliders, trim, Ken Burns buttons, WebsiteShots grid, Director's Notes on this page. Continue saves masterApproved + single-scene timed script for Export captions. Old multi-card version NOT kept (no backup file).
- Fresh-start + project library (2026-10-30): `ProjectBar.tsx` (New/Save/Open/Delete + amber unsaved warning), `projectStore` gains `projectId/projectName/newFreshProject/openProject`, `lib/project/local.ts` library (`meta-studio-projects-v1`, blob-URL stripping, migrateLegacyIfNeeded), Dexie v3 `projectId` index + `blobKeyForScene/blobKeyForAsset` + `migrateLegacyBlobsToProject`, PersistGate reduced to one-time migration only, `app/studio` mounts ProjectBar + drops "Saved just now" footer. Opens land on sources/story (never Key/Writer). NOTE: editor `new_text` limit ~6000 chars — split ProjectBar into create + append.
- Clip watcher (2026-10-30): `lib/meta-sdk/watcher.ts` (2s poll, byte-stable detection, baseline sweep-guard, .crdownload-safe ext filter) + Dexie v2 `prefs` table persisting the directory handle + panel watch UI (status / stop / change / restore-on-reload) + row `Copy + open meta.ai` (clipboard write + `window.open` in the same click so user activation survives). Automation AROUND meta.ai only — no bots; ToS decision intact. NOTE: tsconfig targets es5 → no `for...of` over Map iterators (use `.forEach`).
- Story motion screenshot picker (2026-10-30): per-scene `Pick a website shot` grid (homepage + about variants from scanned urls + scraper `aboutSource`), free mShots/thum.io/microlink (no key), landscape 1280x720 edge-to-edge (`aspect-video object-cover`), `ShotImg.tsx` placeholder auto-retry (naturalWidth <700 detect, cache-buster 3/4/6/8/10s, fallback chain), `motionSource='screenshot'` + `screenshotPageUrl`, Export preview shows 🌐.
- Screenshot fix (2026-10-30): mShots first-hit "Generating Preview" WP logo handled (was stuck in thumbnails while new-tab showed real shot — generation lag); black side bars removed (was 1080x1920 vertical crop → now 1280x720 landscape).
- Wonder RETIRED: all reasoning on chosen Spark; 5-check validate; Animate marks kenburns locally (no API fetch); 'wonder' removed from MotionSource union.
- MILESTONE: 6/6 ✅ — was all models reachable with user's key (SAM auto-discovery worked).
- Full-script timing: cadence controls (`bestCadence`, 0.85–1.2x, auto-fit) + trim recommendations (`trimWords`, per-scene approve/keep) so the entire approved script always plays; Spark prompt forbidden from trimming.
- Master script: Business page drafts/edits/approves the final narrative (`/api/muse/script` mode master → `generateMasterScript`); Story organizes it to duration (`buildScriptPrompt` takes `masterScript`, `storyBeat` traces scenes to brand truth).

## Next Steps
1. End-to-end test: scrape → generate script (real Spark) → attach meta.ai voice + motion clips → export SRT/txt.
2. FFmpeg.wasm: implement `motionPlan()` + VO assembly in `lib/render/ffmpeg.ts`.
3. Advanced timeline UI; tests; Next upgrade.

## Active Decisions
- Story = 10s Meta.ai batches (2026-10-30, meta.ai ~10s voice+video cap): one prompt per ceil(duration/10) part; SAME woman/voice/device/vibe continuity; screenshots attached each time; stitched after. Voice choices: warm female/male energetic/calm; device: Mobile phone / PC monitor. Ratio (9:16, 4:5, 1:1, 16:9) + platform (TikTok, Instagram, YT Short, Instagram, Square, YouTube/LinkedIn) + vibe (fun, professional, bold, friendly, premium) auto-included from Setup picks.
- Motion + voice: metai-upload clips → website screenshots (free, no key, Ken Burns zoom over shot) → kenburns; `metai-clip` voice clips per scene. No Seedance. No meta.ai automation/botting (ToS) — clips are generated by hand at meta.ai; ToS-safe automation AROUND it (Downloads-folder watcher → auto-attach, 2026-10-30) is fine. Check meta.ai terms for ad use.
- No meta.ai API/automation (none exists; ToS) — manual upload only. Check meta.ai terms for ad use.
- Stay neutral on writer choice; session memory default; vault opt-in; `?demo=1` trial.
- Per-scene regen only; dual approval (plan+cost, then result).

## Rule Acknowledged
READ ALL `clinerules/memory-bank/*.md` at start of EVERY future task. Top-level `clinerules/memory-bank.md` is the index/spec; per-area files are the working memory.
