# Progress

> Living note — status as of last push. `clinerules/` is intentionally committed (no secrets inside) so clones carry the why, not just the what.

## What Works ✅
- `npm run build` passes (13 routes: /, /studio, 8 APIs).
- Story ONE combined prompt (2026-10-30): `buildCombinedStoryPrompt()` single paste — full voiceover line + SEGMENT i OF N (~10s each) + ratio/platform/vibe/timing. Tight endings: each segment + whole video cut instantly on last word (no pause/silence/frame-hold) for natural stitching. Replaces multi-paste version. Export stitch kept as fallback. tsc clean.
- Landing + 8-step wizard renders; demo mode works keyless (`/studio?demo=1`).
- Key validate: 5/5 ✅ live (Wonder retired — spark-standard, spark-contributor, image, voice-captions, sam), writer table, scrape (homepage + about-page story, removable chips, multi-site merge) + Business-page master script — drafted with Setup settings (duration/platform/vibe) in mind, free edit, gated Approve → Continue + uploads (removable thumbnails) + snippets+pin, configure FIRST (duration/platform/vibe shape the draft; Story just organizes, no re-fit needed), timed organize from approved master (Spark organizes, never reinvents; storyBeat per scene), quick buttons, Director's Notes, lock, fits-meter, SRT/txt/backup export, ← Back on every step + clickable breadcrumb + ← Back to home (no state loss — Zustand), vault: biometrics + synced passkey + encrypted export/import, raw-bytes PRF fix.
- Known vault gotcha (fixed): `eval.first` must be Uint8Array, not b64url — browser type-checks extension inputs strictly.
- SAM auto-discovery: validator enumerates the model catalog and fuzzy-matches SAM-like IDs (docs ID `sam-3-1` mismatched this key's catalog) — this is what flipped the 6th check ✅.
- Motion flow: per-scene meta.ai clip slot (upload+preview+mute toggle+remove), website screenshot picker (free mShots/thum.io/microlink grid, placeholder auto-retry, landscape edge-to-edge, `motionSource='screenshot'`), Wonder animate button, Ken Burns fallback, tier badge + export icons, `motionPlan()` render contract.
- Clip watcher: Downloads-folder auto-ingest (File System Access API, read-only, Chromium) — new byte-stable media files route through `autoAttachBatch`; folder handle persisted (Dexie v2 `prefs`) + auto-restored on reload when the grant survives; one-click `Copy + open meta.ai` row button; graceful Firefox/Safari fallback message.
- Fresh-start + project library (2026-10-30): studio boots blank on Key step, no auto-load/autosave; `ProjectBar` header (📁 current-name, New / Save+name / Open(n) / Delete, amber unsaved warning); Open restores text + this project's Dexie footage (assets + voice/video clips) and lands on sources/story; Delete wipes entry + blobs; legacy autosave migrated once to "Recovered project".
- Live smoke test: 15s script → 3 scenes (Hook…).
- GitHub repo live: https://github.com/alkaika/ai-social-commercial-studio (public). Local git remote `origin` set, branch `main`.
- Default gateway everywhere is the verified Meta Model API (`https://api.meta.ai/v1`), so the Key step comes prefilled — user only pastes their key.

## What's Left
- End-to-end project run with the live key (script gen on real Spark). Verify: fresh boot blank → Save → refresh blank → Open restores text + footage; Story batches → meta.ai parts → Export stitch → final MP4 + SRT.
- VO/motion-plan assembly (motionPlan VO layering) still stub; Advanced timeline UI, music/voice pickers, caption editor, BrandKit conflict UI, cost estimator totals, tests, Next upgrade.

## Known Issues
- Next 14.2.5 security notice (build warns, runs fine).
- simplewebauthn v9 deprecated-types warning (works with `as any`).
- No native ffmpeg on machine — by design (wasm path).

## Decision Evolution
- Plan→Act 2026-10-26: plan-only → scaffolded. Added layers: BYOK vault → sources → easy UI → revise loop → factual writer table → built.
- 2026-10-27: motion locked to metai-upload → wonder → kenburns (`6facfa3`). No Seedance (deferred). No meta.ai automation (ToS). `clinerules/` kept in repo; `activeContext.md` + this file marked as living notes.
- 2026-10-30: "automatic clips" resolved ToS-safely — Playwright bot rejected; File System Access watcher automates everything AFTER the user's manual generate+download at meta.ai (reads only the user's own Downloads folder).
- Repo: `ai-social-commercial-studio` public via `gh` (Composio github toolkit blocked for session, used local gh CLI as alkaika).
