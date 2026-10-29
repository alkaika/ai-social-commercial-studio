# Progress

> Living note — status as of last push. `clinerules/` is intentionally committed (no secrets inside) so clones carry the why, not just the what.

## What Works ✅
- `npm run build` passes (13 routes: /, /studio, 8 APIs).
- Landing + 8-step wizard renders; demo mode works keyless (`/studio?demo=1`).
- Key validate: 5/5 ✅ live (Wonder retired — spark-standard, spark-contributor, image, voice-captions, sam), writer table, scrape (homepage + about-page story, removable chips, multi-site merge) + Business-page master script — drafted with Setup settings (duration/platform/vibe) in mind, free edit, gated Approve → Continue + uploads (removable thumbnails) + snippets+pin, configure FIRST (duration/platform/vibe shape the draft; Story just organizes, no re-fit needed), timed organize from approved master (Spark organizes, never reinvents; storyBeat per scene), quick buttons, Director's Notes, lock, fits-meter, SRT/txt/backup export, ← Back on every step + clickable breadcrumb + ← Back to home (no state loss — Zustand), vault: biometrics + synced passkey + encrypted export/import, raw-bytes PRF fix.
- Known vault gotcha (fixed): `eval.first` must be Uint8Array, not b64url — browser type-checks extension inputs strictly.
- SAM auto-discovery: validator enumerates the model catalog and fuzzy-matches SAM-like IDs (docs ID `sam-3-1` mismatched this key's catalog) — this is what flipped the 6th check ✅.
- Motion flow: per-scene meta.ai clip slot (upload+preview+mute toggle+remove), Wonder animate button, Ken Burns fallback, tier badge + export icons, `motionPlan()` render contract.
- Live smoke test: 15s script → 3 scenes (Hook…).
- GitHub repo live: https://github.com/alkaika/ai-social-commercial-studio (public). Local git remote `origin` set, branch `main`.
- Default gateway everywhere is the verified Meta Model API (`https://api.meta.ai/v1`), so the Key step comes prefilled — user only pastes their key.

## What's Left
- End-to-end project run with the live key (script gen on real Spark — mocks are gone for chat/image now).
- FFmpeg.wasm MP4 honoring `motionPlan()` + VO (stub), Advanced timeline UI, music/voice pickers, caption editor, BrandKit conflict UI, cost estimator totals, version history UI, tests, Next upgrade.

## Known Issues
- Next 14.2.5 security notice (build warns, runs fine).
- simplewebauthn v9 deprecated-types warning (works with `as any`).
- No native ffmpeg on machine — by design (wasm path).

## Decision Evolution
- Plan→Act 2026-10-26: plan-only → scaffolded. Added layers: BYOK vault → sources → easy UI → revise loop → factual writer table → built.
- 2026-10-27: motion locked to metai-upload → wonder → kenburns (`6facfa3`). No Seedance (deferred). No meta.ai automation (ToS). `clinerules/` kept in repo; `activeContext.md` + this file marked as living notes.
- Repo: `ai-social-commercial-studio` public via `gh` (Composio github toolkit blocked for session, used local gh CLI as alkaika).
