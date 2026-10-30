# Tech Context

## Stack
Next.js 14.2.5, React 18.3, TypeScript 5.4, Tailwind 3.4, Zustand 4.5, Dexie 4 (clip blobs + watch-folder prefs, `meta-studio-clips` v3), react-dropzone, wavesurfer.js, @simplewebauthn/browser ^9.0.1, cheerio, zod, @ffmpeg/ffmpeg + @ffmpeg/util + @ffmpeg/core (in-browser stitching, single-thread core via unpkg blob URLs — no COOP/COEP headers needed). Node 26.12.1, npm 11.20.0. Windows.

## Setup
```
cd C:\Users\alana\meta-app
npm install
npm run dev   # http://localhost:3000/studio?demo=1
npm run build # passes, 13 routes
```
No ffmpeg needed (wasm stub). No DB. `.env.example` defaults META_GATEWAY_URL to the verified Meta Model API (`https://api.meta.ai/v1`).

## Constraints
- simplewebauthn/browser v9: `startRegistration(opts)` / `startAuthentication(opts)` take options directly (NOT `{optionsJSON}`) → code uses `as any` casts. Verified via .d.ts.
- TSX `new_text` limit ~6000 chars → split large components (Storyboard was split).
- Next 14.2.5 has known vuln notice; upgrade later.
- PRF support: Chrome/Edge strong, Safari improving, Firefox weak → session-only fallback required.

## Tool Patterns
- `default.editor` for files; `default.run_commands` for npm/build; `default.read_files` for .d.ts verification.
- Always verify with `npm run build` + live `npm run start` smoke test of `/api/muse/script`.
