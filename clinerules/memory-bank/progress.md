# Progress

## What Works ✅
- `npm run build` passes (13 routes: /, /studio, 8 APIs).
- Landing + 8-step wizard renders; demo mode works keyless.
- Key validate (6 checks), writer factual table, scrape (multi-URL), uploads, snippets+pin, configure, script gen (mock→real fallback), quick buttons, Director's Notes plan+cost, lock scene, fits-meter, SRT/txt/backup export.
- Live smoke test: 15s script → 3 scenes (Hook…).

## What's Left
- Real gateway shapes (need sample curl) — adapters ready, 4 files to touch.
- FFmpeg.wasm MP4 (stub), Advanced timeline UI, music/voice pickers, caption editor, BrandKit conflict UI, cost estimator totals, version history UI, tests, Next upgrade.

## Known Issues
- Next 14.2.5 security notice (build warns, runs fine).
- simplewebauthn v9 deprecated-types warning (works with `as any`).
- No native ffmpeg on machine — by design (wasm path).

## Decision Evolution
Plan→Act 2026-10-26: plan-only → scaffolded. Added layers: BYOK vault → sources → easy UI → revise loop → factual writer table → built. User asked `update memory bank` + always-read-first → created `clinerules/memory-bank/{projectbrief,productContext,activeContext,systemPatterns,techContext,progress}.md`.
