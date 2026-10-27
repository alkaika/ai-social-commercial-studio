// Final MP4 rendering (Phase 2 hookup): FFmpeg.wasm runs fully in the browser.
// Storyboard/export already produce script + SRT + project JSON; wire this module
// to composite per-scene motion into an MP4 per platform preset.
//
// Locked motion flow per scene (lib/muse/visual.ts: resolveMotionTier):
//   1. 'metai-upload' — user-attached clip from meta.ai consumer app.
//      Mute/duck baked-in audio when scene.muteSourceAudio (default true),
//      lay our Voice-over on top, re-sync captions.
//   2. 'wonder' — Muse Wonder 1.0 image-to-video output URL.
//   3. 'kenburns' — slow zoom over scene.imageUrl (always available, free).
export function motionPlan(scenes: { id: string; videoUrl?: string; motionSource?: string; imageUrl?: string }[]) {
  const { resolveMotionTier } = require('@/lib/muse/visual') as typeof import('@/lib/muse/visual');
  return scenes.map((s) => ({ id: s.id, tier: resolveMotionTier(s), src: s.videoUrl || s.imageUrl || '' }));
}

export async function renderCommercial() {
  throw new Error('MP4 render via FFmpeg.wasm is stubbed — captions/script export work today.');
}
