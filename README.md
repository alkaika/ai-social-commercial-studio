# AI Social Commercial Studio

Make a commercial **in under 10 minutes**. No editing experience needed. No monthly subscription.

Free studio — you bring one Meta API key and pay the provider directly, only for what you generate. Your key stays in your browser tab and is never stored on our server.

## 🎬 Demo Video

<video src="https://github.com/alkaika/ai-social-commercial-studio/raw/main/docs/demo.mp4" controls width="100%" playsinline preload="metadata">
  Your browser does not support the video tag.
  📥 <a href="https://github.com/alkaika/ai-social-commercial-studio/raw/main/docs/demo.mp4">Download / watch the MP4 demo</a>
</video>

> ⏱️ 3-min walkthrough: judging mode vs. BYOK key, Standard vs. Contributor, platform + vibe, website → script → Meta.ai prompts → stitch.
> 📥 [Download / watch the MP4 demo](docs/demo.mp4)

## Why this app works in tandem with Meta.ai

Meta doesn't have a text-to-video or text-to-speech generation AI model to use directly with a Meta API key. However, Meta.ai can generate high-quality voice and video files, so we created an app to work in tandem with Meta.ai. The app generates the script, screenshots (you can use the app-generated images or your own images), and the prompts to paste into Meta.ai. A minor inconvenience is that you have to copy and paste your app-generated prompts and images directly into Meta.ai, and while Meta.ai can only generate 10-second video or voice files at a time, the good news is they can stitch them together afterwards to give you a complete, platform-ready commercial. Even with these minor inconveniences, creating a high-quality commercial with our app in tandem with Meta.ai takes about the same amount of time as generating a video with a subscription-based text-to-video generation platform. The biggest benefit is that it costs very little to use the app in tandem with Meta.ai to generate high-quality social media commercials.

<div style="background-color:#FFF3E0; border:1px solid #F5C16C; border-radius:12px; padding:16px; margin-top:12px;">

**Why manual paste instead of an integration?** Meta's Terms of Service (§3, Your commitments to Facebook and our community) prohibit accessing or collecting data from Meta Products using automated means without Meta's prior permission, or accessing data you do not have permission to access. Meta's Platform Terms (§2.a, Our License to You) allow only expressly licensed uses of its APIs, SDKs, tools, and services — no unlicensed use, integration, modification, derivative works, or reverse engineering. Meta offers no public API or SDK for Meta.ai voice/video generation, so there is no authorized way to automate it. That's why this studio generates copy-paste prompts and screenshots, and you complete each 10-second generation yourself by hand at meta.ai. ([Meta Terms §3](https://www.facebook.com/legal/terms) · [Meta Platform Terms §2.a](https://developers.facebook.com/terms/))

</div>

## Workflow steps

**01 · Key — Connect your key**
Checked once, optionally saved with biometrics. Encrypted on your device.

**02 · Script writer — Choose Muse Spark 1.3 Standard or Contributor**
Compare input/output costs and data training rights in the exact 3-row table before you spend anything.

**03 · Choose Platform & Settings — Instagram, Facebook, TikTok, X, YouTube Shorts, YouTube Video**
Select 10s, 20s, 30s, or 60s timeframe and vibe (Fun / Professional / Bold / Friendly / Premium). That sets your part count: 10s = 1 part, 20s = 2 parts, 30s = 3 parts, 60s = 6 parts. Every part is ~10 seconds / ~35 words.

We build in 10-second batches to prevent syncing issues when Meta.ai stitches them together — TikTok, Reels & Shorts use 10s or 20s.

**04 · Add company details — Add website**
AI model analyzes the website, compiles screenshots, and drafts the script. User reviews, edits (if needed), and finalizes the script. Website screenshots (up to 12 pages, auto-discovered from sitemap + nav) can be saved for attaching inside meta.ai.

**05 · Choose your preferences — 🧍 People + app (Meta.ai), 🎙 Voices + screenshots only (Meta.ai), 🎧 Voice MP3 (Meta.ai) + Ken Burns in app**
AI model drafts your 10-second part prompts to use on Meta.ai. Meta.ai generates your 10-second video or voice files and stitches them together. Download completed commercial file.

- People + app: one self-contained prompt per part — different speaker/face/voice each part, same aspect/device/vibe. Last part asks Meta.ai to stitch everything into one finished video first.
- Voices + screenshots only: same, but voiceover-only with no person on camera — Meta.ai renders motion over your screenshots.
- Voice MP3 + Ken Burns: one voice-only MP3 prompt per part (same narrator throughout, last part asks Meta.ai to stitch MP3s first). Parts join under slow-zoom motion over your images in-app.

Instructions adapt to your part count: a 10-second (1-part) video shows a single "Copy Part 1 … then download the file" step; 2–6 parts show one "Use the same chat as Part 1 / Part 1-2 / …" step per part plus the automatic-stitch line.

**06 · Stitch files if needed — Use the Stitch feature as a fallback**
Our Stitch feature is available if Meta.ai has issues stitching your files. The Download page is stitch-only: Part MP4s join to one final MP4, Part MP3s join to one final MP3, all in your browser via FFmpeg.wasm.

## Run locally

```
npm install
npm run dev    # http://localhost:3000
npm run build  # production build, 13 routes
```

Default gateway is the Meta Model API (`https://api.meta.ai/v1`). No ffmpeg install, no database. Projects persist via explicit Save/Open only (localStorage text + IndexedDB footage) — refresh starts fresh by design.

## BYOK + judging builds

- BYOK (default): one Meta key powers Spark Standard/Contributor (script), voice-captions, image, and SAM. Key is sent per-request in `x-meta-key`, never logged or stored server-side.
- Judging (temporary during judging period, env-only): host sets server-only `META_API_KEY` + `NEXT_PUBLIC_JUDGING_MODE=1` — landing reads "Judging build — every AI step is live, no key needed", studio boots at Writer, all calls use the host key. Judging mode along with both env vars will be removed at the end of the Judging period. The app will go back to pure BYOK. See `JUDGING.md`.

## Notes

- This app was built during the 2026 Meta Global AI Developer Hackathon.
- This app was built with Muse Spark 1.3 Contributor (95%) and Muse Wonder 1.0 (5%)
- Stack: Next.js 14, React 18, TypeScript, Tailwind, Zustand, Dexie, FFmpeg.wasm, WebAuthn PRF vault.
- Voice-only prompts: no background music, no sound effects — Meta.ai text-to-voice only.
- No meta.ai automation (None exists due to Meta TOS) — copy/paste prompts + screenshots by hand.
