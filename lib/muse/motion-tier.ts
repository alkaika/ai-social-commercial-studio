// Motion tier resolver — PURE, client-safe (zero imports).
// Lives outside lib/muse/visual.ts so client render code (lib/render/ffmpeg.ts,
// ExportStep) never pulls the server-only gateway client into the browser
// bundle (visual.ts -> client.ts -> node:dns SSRF guard chain).
export type MotionTier = 'metai-upload' | 'kenburns';

// Motion flow: [uploaded meta.ai clip] -> [website screenshot] -> Ken Burns.
// - 'metai-upload': user-made clip from the consumer meta.ai app (10s w/ audio).
//   No API exists; the app accepts the upload and we mute/duck its baked-in
//   audio under real Voice-over at render time.
// - 'kenburns': always-available local fallback (slow zoom over the still).
// (Wonder retired 2026-10-27: muse-wonder-1.0 was text-only, never video;
// all reasoning — script, organize, revision planning — runs on the user's
// chosen Spark writer.)
export function resolveMotionTier(scene: { videoUrl?: string; motionSource?: string }): MotionTier {
  if (scene.videoUrl && scene.motionSource === 'metai-upload') return 'metai-upload';
  return 'kenburns';
}