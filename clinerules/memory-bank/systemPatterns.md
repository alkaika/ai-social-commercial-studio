# System Patterns

## Architecture
Next.js App Router. Client wizard (`app/studio/page.tsx` + `stores/projectStore.ts`) → API routes (`app/api/scrape`, `app/api/muse/*`) → Muse gateway via `lib/muse/client.ts:callMuse`. Key NEVER persisted server-side.

## Key Decisions
- `byokHeaders(req)`: reads `x-meta-key`/`x-meta-base-url`; throws if missing → routes fall back to DEMO mocks.
- Project state: single Zustand object (`projectStore.ts`) + `projectId/projectName/newFreshProject/openProject`. NO autosave — studio boots fresh; explicit Save/Open only via `ProjectBar`.
- Library: text/config in localStorage `meta-studio-projects-v1` ({id,name,updatedAt,savedAt} + PersistedProject; blob: URLs stripped on save); footage in Dexie `meta-studio-clips` v3 (`blobs: key,projectId,sceneId,kind,assetId` + `prefs: key`). Keys `blobKeyForScene(pid,s,k)` / `blobKeyForAsset(pid,id)`. Open revokes live blob URLs first (leak/bleed guard), loads text, then re-attaches this project's Dexie blobs (assets → `getBlobsForProject` + URL map; scenes → `hydrateForProject`). Delete removes entry + `removeBlobsForProject`. One-time migration: legacy `meta-studio-project-v1` → "Recovered project" + `migrateLegacyBlobsToProject`, legacy slot cleared.
- Model adapters isolated in `lib/muse/{spark,voice,visual,mocks}.ts` — only files needing change for real gateway shapes.
- `lib/muse/models.config.ts` + `config/pricing.ts` single source for model IDs, costs, table copy.
- Vault: `lib/vault/webauthn-prf.ts` (register/authenticate with PRF extension, raw-bytes `eval.first`, `as any` casts for v9 browser API; two slots: device-bound biometrics + synced passkey, export/import of encrypted-only bundle) + `lib/vault/crypto.ts` (HKDF→AES-GCM, IndexedDB slots `vault`/`vault-passkey` storing ONLY {credId,iv,ct,baseUrl,kind}).
- Scraper: homepage + 8 de-duped about candidates, JS-shell detection (`needsJs`) with honest fallback message, story beats into `aboutSummary`/`aboutPoints`/`aboutSource`, merges across URLs.
- Duration math: `WORDS_PER_SEC=2.5`, `targetWordRange(duration)` gives target/min/max/hardMax; master draft is sized to the slot (buildMasterScriptPrompt + retry + `constrainToWordRange` backstop), so Story starts fitting and `fitsDuration()`/cadence are only safety nets.
- DEMO mode: `key==='DEMO'` → deterministic mock script/images; `?demo=1` enters without key.

## Component Map
`KeySetup` → `ModelPicker` → `SourceHub` → `ConfigureStep` → `Storyboard` (batches: full-script textarea → voice+device → per-part copy prompts via `splitScriptIntoBatches`) → `ExportStep` (stitch Part MP4s via FFmpeg.wasm → final MP4 + SRT/txt/backup). `lib/screenshots.ts` for the retired per-scene shot picker. Studio header: `ProjectBar` (New / Save+name / Open(n) / Delete + amber unsaved warning) — the ONLY persistence UI; studio boots fresh, PersistGate is migration-only.

## Critical Paths
- `POST /api/muse/script` → `generateScript()` → Spark chat → strict JSON parse → fallback mock.
- `POST /api/muse/revise` →Spark→ EditPlan {summary,steps,targets,estCost}; locked scenes excluded upstream.
- `POST /api/muse/validate` → GET /v1/models/{id} catalog checks + 1-token chat pings (Spark×2) + image ping → per-model ok/auth/fail. Never probes dead paths (/v1/audio/speech, /v1/sam/segment, /v1/video(s)/generations).
