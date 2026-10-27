# Project Brief — AI Social Commercial Studio (BYOK)

## Location
`C:\Users\alana\meta-app` — Next.js 14 App Router, single codebase.

## Core Goal
Web app that generates 5/10/15/30/60s social commercials from a company website + user uploads + pasted content. Generates script, voice-over, visuals. User edits before export. No monthly subscription.

## BYOK Model
- Users bring ONE Meta API key powering all 5 Muse models via REST gateway.
- Key sent per-request in `x-meta-key` header, forwarded to Meta, never logged/stored server-side.
- Free platform; user pays Meta directly. Cost estimator shown before every AI action.

## Models & Roles (`lib/muse/`)
- Spark 1.3 Standard (`muse-spark-1.3`) — scriptwriter option A
- Spark 1.3 Contributor (`muse-spark-1.3-contributor`) — scriptwriter option B
- Voice Transcribe 1.0 (`muse-voice-transcribe-1.0`) — TTS + transcribe for captions
- Image 1.0 (`muse-image-1.0`) — scene keyframes
- Sam 3.1 (`sam-3.1`) — segmentation / cutout
- Wonder 1.0 (`muse-wonder-1.0`) — image-to-video, Ken Burns fallback

## Scope Locked
- Writer choice at start of EVERY project: exact 3-row table (Input $1.25 vs $0.10 / Output $4.25 vs $0.20 / Data rights). No pros/cons. Source: `config/pricing.ts`.
- Source Hub: multi-URL scrape + uploads + snippets with pinned must-use-verbatim.
- Simple Mode default (storyboard cards), Advanced timeline hidden behind button.
- Revision loop: manual edit + quick buttons + Director's Notes chat, preview-and-approve, locked scenes skipped, pinned preserved.
- Exports: TikTok/Reels/Shorts 9:16, IG 4:5, Square 1:1, Landscape 16:9 + SRT + script.txt.

## Non-Goals (MVP)
- No server DB, no accounts. Projects in IndexedDB.
- No server FFmpeg. FFmpeg.wasm stub at `lib/render/ffmpeg.ts`.
