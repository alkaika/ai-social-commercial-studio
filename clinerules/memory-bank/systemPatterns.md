# System Patterns

## Architecture
Next.js App Router. Client wizard (`app/studio/page.tsx` + `stores/projectStore.ts`) → API routes (`app/api/scrape`, `app/api/muse/*`) → Muse gateway via `lib/muse/client.ts:callMuse`. Key NEVER persisted server-side.

## Key Decisions
- `byokHeaders(req)`: reads `x-meta-key`/`x-meta-base-url`; throws if missing → routes fall back to DEMO mocks.
- Single project object in Zustand (`projectStore.ts`) = source of truth for preview/autosave/undo/render.
- Model adapters isolated in `lib/muse/{spark,voice,visual,mocks}.ts` — only files needing change for real gateway shapes.
- `lib/muse/models.config.ts` + `config/pricing.ts` single source for model IDs, costs, table copy.
- Vault: `lib/vault/webauthn-prf.ts` (register/authenticate with PRF extension, `as any` casts for v9 browser API) + `lib/vault/crypto.ts` (HKDF→AES-GCM, IndexedDB `meta-studio-vault` stores ONLY {credId,iv,ct,baseUrl}).
- Scraper: `lib/scraper.ts` — URL validate, 15s timeout, 2MB cap, cheerio, OG/logo/colors/testimonials/CTA.
- Duration math: `WORDS_PER_SEC=2.5`, `fitsDuration()` gates storyboard meter.
- DEMO mode: `key==='DEMO'` → deterministic mock script/images; `?demo=1` enters without key.

## Component Map
`KeySetup` → `ModelPicker` → `SourceHub` → `ConfigureStep` → `Storyboard` (generate/quick/revise/lock) → `ExportStep` (SRT/txt/backup). `lib/render/ffmpeg.ts` stub for Phase-2 MP4.

## Critical Paths
- `POST /api/muse/script` → `generateScript()` → Spark chat → strict JSON parse → fallback mock.
- `POST /api/muse/revise` →Spark→ EditPlan {summary,steps,targets,estCost}; locked scenes excluded upstream.
- `POST /api/muse/validate` → GET /v1/models/{id} catalog checks + 1-token chat pings (Spark×2) + image ping → per-model ok/auth/fail. Never probes dead paths (/v1/audio/speech, /v1/sam/segment, /v1/video(s)/generations).
