# AI Social Commercial Studio (BYOK)

Make 5/10/15/30/60s commercials for TikTok, Reels, Shorts, Instagram, YouTube, Facebook, X, LinkedIn.

- BYOK: users bring one Meta key. No subscription. Key lives in memory; optional biometric (WebAuthn PRF) vault.
- Writer choice at start of every project shows exact table: input/output cost + data training rights.
- Source Hub: website scrape + uploads + pasted snippets (pinned must-use verbatim).
- Simple Mode default: storyboard cards + Director's Notes + quick buttons + preview-and-approve.
- Advanced Edit hook + FFmpeg.wasm stub for final MP4.

## Run
```
npm install
npm run dev
```
Open http://localhost:3000/studio?demo=1 for no-key demo.

## Wire real Meta endpoints
Default gateway is the Meta Model API (`https://api.meta.ai/v1`, verified 2026-10-27). Adapters in `lib/muse/` call verified paths — only touch them if Meta changes its API.
