// Final MP4 rendering (Phase 2 hookup): FFmpeg.wasm runs fully in the browser.
// Storyboard/export already produce script + SRT + project JSON; wire this module
// to composite per-scene motion into an MP4 per platform preset.
//
// Motion flow per scene (lib/muse/visual.ts: resolveMotionTier):
//   1. 'metai-upload' — user-attached clip from meta.ai consumer app.
//      Mute/duck baked-in audio when scene.muteSourceAudio (default true),
//      lay user voice-over (recorded/uploaded) on top, re-sync captions.
//      (Meta has NO TTS endpoint; captions come from the approved script.)
//   2. 'kenburns' — slow zoom over scene.imageUrl (always available, free).
//   Note: Muse Wonder 1.0 is a text/reasoning model — no video endpoint exists.
//   If Meta ships one, resolveMotionTier gains the tier back here.
export function motionPlan(scenes: { id: string; videoUrl?: string; motionSource?: string; imageUrl?: string }[]) {
  const { resolveMotionTier } = require('@/lib/muse/visual') as typeof import('@/lib/muse/visual');
  return scenes.map((s) => ({ id: s.id, tier: resolveMotionTier(s), src: s.videoUrl || s.imageUrl || '' }));
}

export async function renderCommercial() {
  throw new Error('MP4 render via FFmpeg.wasm is stubbed — captions/script export work today.');
}
