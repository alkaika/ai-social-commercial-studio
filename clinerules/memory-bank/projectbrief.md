# Project Brief — AI Social Commercial Studio (BYOK)

## Location
`C:\Users\alana\meta-app` — Next.js 14 App Router, single codebase.

## Core Goal
Web app that generates 5/10/15/30/60s social commercials from a company website + user uploads + pasted content. Generates script, voice-over, visuals. User edits before export. No monthly subscription.

## BYOK Model
- Users bring ONE Meta API key powering all 5 Muse models via REST gateway.
- Key sent per-request in `x-meta-key` header, forwarded to Meta, never logged/stored server-side.
- Free platform; user pays Meta directly. Cost estimator shown before every AI action.

## Models & Roles (`lib/muse/`): Spark does EVERYTHING textual
- Spark 1.3 Standard (`muse-spark-1.3`) OR Contributor (`muse-spark-1.3-contributor`) — user's chosen writer handles master script, timed organize, and Director's Notes revision planning.
- Voice Transcribe 1.0 (`muse-voice-transcribe-1.0`) — KEPT for auto-captions/QC ONLY (user decision 2026-10-27). STT at POST /v1/asr/transcribe, $0.18/hr. NO synthesis — Key badge reads `voice-captions`, route returns `{captions:true, synthesis:false}`.
- Image 1.0 (`muse-image-1.0`) — scene keyframes ($0.01/image, POST /v1/images/generations; edits via /v1/images/edits `images[]`, NOT `image`)
- SAM (`sam-3-1` per docs, hyphens) — segmentation via POST /v1/responses. Catalog-dependent: validate auto-discovers SAM-like IDs; preview mode if absent.
- Wonder RETIRED 2026-10-27 (user request — Contributor praised): no code references it at runtime; Key check = 5 real capabilities.

## Motion + Voice-over (consumer meta.ai clips; NO Meta API TTS or video gen)
Story page = 10s Meta.ai batches (2026-10-30, meta.ai ~10s voice+video cap): `splitScriptIntoBatches()` auto-splits full script into ceil(duration/10) sentence-aware parts; one `buildSingleStoryPrompt(..., batchIndex/batchTotal)` paste per part with SAME voice/woman/device continuity; screenshots attached each time at meta.ai; stitched after. Continue saves per-batch scenes for Export captions.
Legacy per-scene detail (kept for reference, no longer on Story page):
1. `metai-upload` motion — user attaches MP4 made in consumer meta.ai app (no public API exists; manual import is the only legit path). Per-scene upload slot in Storyboard, inline preview, mute/dub toggle (default muted under user voice-over), remove option. Free (user's Meta account).
2. `screenshot` motion — user picks a website shot per scene on the Story page. Free renders of the user's own scanned site(s): homepage + about variants via mShots (primary, `?w=1280`) → thum.io (`width/1280/crop/720`) → microlink (`1280x720`), no API key. `ShotImg.tsx` auto-retries the mShots "Generating Preview" placeholder (naturalWidth check + cache-buster, 5 retries over ~30s). Displayed landscape edge-to-edge (`aspect-video object-cover object-top`); renders as Ken Burns zoom over the shot. Fields: `imageUrl` = shot URL, `screenshotPageUrl` = source page.
3. `metai-clip` voice-over — user turns scene script into spoken audio via meta.ai ("Make a video of a [style] voice saying: '...'"), uploads the ~10s clip per scene (accepts video/* + audio/*). Audio player + 🎙 badge inline; this audio WILL play in the final mix (motion clips stay muted under it). Bypasses the Meta Model API gap honestly.
4. `kenburns` — always-available local fallback over stills. Free. (Storyboard button: `🎞 Ken Burns motion`.)
- `wonder` removed from MotionSource union (old saves with 'wonder' fall through to kenburns). Animate never promises API video.
- Resolver: `resolveMotionTier()` in `lib/muse/visual.ts`. Scene fields: `motionSource`, `videoUrl`, `muteSourceAudio`, `voiceSource`, `voiceClipUrl` (see `lib/script-utils.ts`). Render contract in `lib/render/ffmpeg.ts:motionPlan()` includes VO source per scene.
- Voice-over: Meta has NO TTS. Real VO = (a) meta.ai text-to-voice clip per scene, (b) user recording/upload (future), or (c) script-only (captions derive from script, then `/v1/asr/transcribe` on the final mix later).

## Scope Locked
- Writer choice at start of EVERY project: exact 3-row table (Input $1.25 vs $0.10 / Output $4.25 vs $0.20 / Data rights). No pros/cons. Source: `config/pricing.ts`.
- Source Hub: multi-URL scrape + uploads + snippets with pinned must-use-verbatim.
- Simple Mode default (storyboard cards), Advanced timeline hidden behind button.
- Revision loop: manual edit + quick buttons + Director's Notes chat, preview-and-approve, locked scenes skipped, pinned preserved.
- Exports: TikTok/Reels/Shorts 9:16, IG 4:5, Square 1:1, Landscape 16:9 + SRT + script.txt.
- Fresh start EVERY load (2026-10-30, user request): studio boots blank on Key step, no auto-load, no silent autosave. Past work returns ONLY via explicit Save/Open in `ProjectBar` header (New / Save / Open(n) / Delete). Unsaved work shows amber warning; refresh wipes by design.
- Named project library: text/config in localStorage `meta-studio-projects-v1` ({id,name,updatedAt} + PersistedProject, blob URLs stripped); footage in Dexie `meta-studio-clips` v3 namespaced `{projectId}:scene:{s}:voice|video`, `{projectId}:asset:{id}`. One-time migration: legacy `meta-studio-project-v1` autosave -> "Recovered project" + legacy blobs copied into its namespace.

## Non-Goals (MVP)
- No server DB, no accounts. Projects in IndexedDB.
- No server FFmpeg. FFmpeg.wasm stub at `lib/render/ffmpeg.ts`.
- No Seedance/outside video model (user deferred, then Wonder retired — Spark-only reasoning).
- No meta.ai automation/scraping (ToS) — manual upload only.
