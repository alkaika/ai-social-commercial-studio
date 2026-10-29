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
// - Voice Transcribe: SPEECH-TO-TEXT ONLY. POST /v1/asr/transcribe
//   (multipart: request JSON + audio file). There is NO text-to-speech endpoint.
//   $0.18/hour.
// - SAM 3.1: segmentation via Responses API POST /v1/responses, model sam-3-1.
// - Text/reasoning (script, organize, revision planning): the user's CHOSEN
//   Spark writer (standard or contributor). Wonder retired 2026-10-27.
//   Video motion in this app comes from user-uploaded meta.ai clips or
//   Ken Burns.

export function endpointModelForSpark(id: SparkModelId) {
  return SPARK_MODELS[id].endpointModel;
}
