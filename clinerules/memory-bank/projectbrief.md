# Project Brief — AI Social Commercial Studio (BYOK)

## Location
`C:\Users\alana\meta-app` — Next.js 14 App Router, single codebase.

## Core Goal
Web app that generates 10/20/30/60s social commercials from a company website + user uploads + pasted content (10s batches only — 5s/15s removed 2026-10-31; legacy saves snap 5→10, 15→20). Generates script, voice-over, visuals. User edits before export. No monthly subscription.

## BYOK Model
- Users bring ONE Meta API key powering all 5 Muse models via REST gateway.
- Key sent per-request in `x-meta-key` header, forwarded to Meta, never logged/stored server-side.
- Free platform; user pays Meta directly. Cost estimator shown before every AI action.
- Judging mode (temporary, env-only, 2026-11-01): host sets server-only `META_API_KEY` + `NEXT_PUBLIC_JUDGING_MODE=1`; client boots at Writer (Key step hidden) and sends placeholder `__SERVER__`; `byokHeaders()` swaps it for the server key. Real BYOK keys still win if sent. Delete both env vars to return to pure BYOK. See `JUDGING.md`.

## Models & Roles (`lib/muse/`): Spark does EVERYTHING textual
- Spark 1.3 Standard (`muse-spark-1.3`) OR Contributor (`muse-spark-1.3-contributor`) — user's chosen writer handles master script, timed organize, and Director's Notes revision planning.
- Voice Transcribe 1.0 (`muse-voice-transcribe-1.0`) — KEPT for auto-captions/QC ONLY (user decision 2026-10-27). STT at POST /v1/asr/transcribe, $0.18/hr. NO synthesis — Key badge reads `voice-captions`, route returns `{captions:true, synthesis:false}`.
- Image 1.0 (`muse-image-1.0`) — scene keyframes ($0.01/image, POST /v1/images/generations; edits via /v1/images/edits `images[]`, NOT `image`)
- SAM (`sam-3-1` per docs, hyphens) — segmentation via POST /v1/responses. Catalog-dependent: validate auto-discovers SAM-like IDs; preview mode if absent.
- Wonder RETIRED 2026-10-27 (user request — Contributor praised): no code references it at runtime; Key check = 5 real capabilities.

## Motion + Voice-over (consumer meta.ai clips; NO Meta API TTS or video gen)
Story page = pick your Meta.ai path (2026-11-01, user request — text-to-voice ONLY for Meta.ai, same 10s cap as video): `storyMode` in store (`people` | `voices-meta` | `voice-kenburns`).
1. People + app (Meta.ai) — one self-contained prompt per ceil(duration/10) part via `buildBatchTestimonialPrompt()`, each its own voice + face + lines, DIFFERENT-speaker continuity, SAME aspect/device/vibe/music. Cast 6 personas + recast dropdowns. Stitch in Export (`stitchParts()`).
2. Voices + screenshots only (Meta.ai) — same per-part prompts with `showPerson=false` (voiceover-only, no person on camera), Meta.ai renders video over screenshots.
3. Voice MP3s (Meta.ai) + Ken Burns in app — one `buildVoiceBatchPrompt()` per ~10s part (same 10s cap, same narrator voice throughout); per-part MP3 uploads in `VoiceMp3Card.tsx` (Dexie `{pid}:voice-part-{1..N}` + `voicePartUrls/Names` in store); Export `KenBurnsExportCard.tsx` + `buildKenBurnsCommercial()` (concatenates N MP3s, one motion segment per part timed to its real duration, alternating zoom).
Legacy per-scene detail (kept for reference, no longer on Story page):
1. `metai-upload` motion — user attaches MP4 made in consumer meta.ai app (no public API exists; manual import is the only legit path). Per-scene upload slot in Storyboard, inline preview, mute/dub toggle (default muted under user voice-over), remove option. Free (user's Meta account).
2. `screenshot` gallery — website page shots on Business + Story (2026-11-01). Free renders of the user's own scanned site(s): up to 12 main pages (sitemap + nav discovery into `brand.sitePages`) via mShots (primary, `?w=1280`) → thum.io (`width/1280/crop/720`) → microlink (`1280x720`), no API key. `ShotImg.tsx` auto-retries the mShots "Generating Preview" placeholder (naturalWidth check + cache-buster, 5 retries over ~30s). Displayed landscape edge-to-edge (`aspect-video object-cover object-top`). Business gallery (select-all/clear + Save selected/all/per-shot via `downloadWebsiteShot` → `01-host-path.jpg`, open-tab fallback) is the Meta.ai attach source; Story mirrors it above the per-part prompts. (Retired: old per-scene shot picker — `WebsiteShots.tsx` unused.)
3. `metai-clip` voice-over — user turns scene script into spoken audio via meta.ai ("Make a video of a [style] voice saying: '...'"), uploads the ~10s clip per scene (accepts video/* + audio/*). Audio player + 🎙 badge inline; this audio WILL play in the final mix (motion clips stay muted under it). Bypasses the Meta Model API gap honestly.
4. `kenburns` — always-available local fallback over stills. Free. (Storyboard button: `🎞 Ken Burns motion`.)
- `wonder` removed from MotionSource union (old saves with 'wonder' fall through to kenburns). Animate never promises API video.
- Resolver: `resolveMotionTier()` in `lib/muse/visual.ts`. Scene fields: `motionSource`, `videoUrl`, `muteSourceAudio`, `voiceSource`, `voiceClipUrl` (see `lib/script-utils.ts`). Render contract in `lib/render/ffmpeg.ts:motionPlan()` includes VO source per scene.
- Voice-over: Meta has NO TTS. Real VO = (a) meta.ai text-to-voice clip per scene, (b) user recording/upload (future), or (c) script-only (captions derive from script, then `/v1/asr/transcribe` on the final mix later).

## Scope Locked
- Writer choice at start of EVERY project: exact 3-row table (Input $1.25 vs $0.10 / Output $4.25 vs $0.20 / Data rights). No pros/cons. Source: `config/pricing.ts`.
- Source Hub: multi-URL scrape + uploads + Final script box (paste-card removed 2026-10-31 — no snippets/pins; users write/paste directly in the Final script). Draft-from-website sends `extraContext: ''`. Business also shows 🖼 photos (logo + site images) and a 🌐 website screenshot gallery: scraper discovers main pages (sitemap + nav, up to 12) into `brand.sitePages`; gallery offers select + Save selected / Save all / per-shot Save for easy Meta.ai attach.
- Story page mirrors the same screenshot gallery above the per-part prompts (Save-all + per-shot Save) so each Meta.ai paste can carry the real site.
- Simple Mode default (storyboard cards), Advanced timeline hidden behind button.
- Revision loop: manual edit + quick buttons + Director's Notes chat, preview-and-approve, locked scenes skipped, pinned preserved.
- Exports: TikTok/Reels/Shorts 9:16, IG 4:5, Square 1:1, Landscape 16:9 + SRT + script.txt.
- Fresh start EVERY load (2026-10-30, user request): studio boots blank on Key step (Writer step when `NEXT_PUBLIC_JUDGING_MODE=1`), no auto-load, no silent autosave. Past work returns ONLY via explicit Save/Open in `ProjectBar` header (New / Save / Open(n) / Delete). Unsaved work shows amber warning; refresh wipes by design.
- Named project library: text/config in localStorage `meta-studio-projects-v1` ({id,name,updatedAt} + PersistedProject, blob URLs stripped); footage in Dexie `meta-studio-clips` v3 namespaced `{projectId}:scene:{s}:voice|video`, `{projectId}:asset:{id}`. One-time migration: legacy `meta-studio-project-v1` autosave -> "Recovered project" + legacy blobs copied into its namespace.

## Non-Goals (MVP)
- No server DB, no accounts. Projects in IndexedDB.
- No server FFmpeg. FFmpeg.wasm stub at `lib/render/ffmpeg.ts`.
- No Seedance/outside video model (user deferred, then Wonder retired — Spark-only reasoning).
- No meta.ai automation/scraping (ToS) — manual upload only.
