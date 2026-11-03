import { SPARK_MODELS, type SparkModelId } from '@/config/pricing';

export const GATEWAY_MODELS = {
  sparkStandard: 'muse-spark-1.3',
  sparkContributor: 'muse-spark-1.3-contributor',
  // Wonder REMOVED 2026-10-27 (user request): all text/reasoning now runs on
  // the user's CHOSEN Spark writer instead of muse-wonder-1.0. Spark handles
  // script + organize + revision planning; Wonder's catalog check and the
  // dead video stub are gone.
  sam: 'sam-3-1',
  voice: 'muse-voice-transcribe-1.0',
  image: 'muse-image-1.0',
} as const;

// Verified against https://dev.meta.ai/docs (2026-10-27):
// - Spark: POST /v1/chat/completions (or /v1/responses). IDs above are exact.
//   Standard muse-spark-1.3 ($1.25/$4.25, data NOT used) vs
//   Contributor muse-spark-1.3-contributor ($0.10/$0.20, data MAY be used).
// - Image: POST /v1/images/generations with model muse-image-1.0 ($0.01/image);
//   edits via POST /v1/images/edits with { images: [{ image_url }] } (NOT `image`).
// - Captions (KEEP — user decision 2026-10-27): Muse Voice Transcribe is
//   SPEECH-TO-TEXT ONLY for auto-captions/QC. POST /v1/asr/transcribe
//   (multipart: request JSON + audio file). There is NO text-to-speech
//   endpoint — voice-over comes from meta.ai clips. $0.18/hour.
// - SAM 3.1: segmentation via Responses API POST /v1/responses, model sam-3-1.
// - Text/reasoning (script, organize, revision planning): the user's CHOSEN
//   Spark writer (standard or contributor). Wonder retired 2026-10-27.
//   Reasoning depth: MAX where supported (user request 2026-11-03) via
//   top-level `reasoning_effort` on POST /v1/chat/completions.
//   Per https://dev.meta.ai/docs/reasoning: `max` is supported by
//   muse-spark-1.3 (Standard) but NOT by muse-spark-1.3-contributor
//   (Contributor tops out at `xhigh`). So Standard sends `max`,
//   Contributor sends `xhigh` (its highest) — see reasoningEffortForSpark().
//   Video motion in this app comes from user-uploaded meta.ai clips or
//   Ken Burns.

// Single source of truth for Spark reasoning depth.
// Chat Completions = top-level `reasoning_effort`; Responses API would be `reasoning.effort`.
export const SPARK_REASONING_EFFORT = 'max' as const;
export const SPARK_CONTRIBUTOR_REASONING_EFFORT = 'xhigh' as const;

/** Highest supported reasoning effort for a given Spark writer. */
export function reasoningEffortForSpark(id: SparkModelId) {
  return id === 'spark-contributor' ? SPARK_CONTRIBUTOR_REASONING_EFFORT : SPARK_REASONING_EFFORT;
}

export function endpointModelForSpark(id: SparkModelId) {
  return SPARK_MODELS[id].endpointModel;
}
