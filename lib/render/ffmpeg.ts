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
//   If Meta ships one, resolveMotionTier gains the tier back here.
//   Voice: Meta has NO TTS; per-scene VO comes from s.voiceClipUrl
//   (meta.ai text-to-voice clip) or stays script-only. Cadence (0.85–1.2)
//   sets playback speed so the FULL script fits; trims apply only after
//   per-scene user approval.
export function motionPlan(scenes: { id: string; videoUrl?: string; motionSource?: string; imageUrl?: string; voiceSource?: string; voiceClipUrl?: string; cadence?: number }[]) {
  const { resolveMotionTier } = require('@/lib/muse/visual') as typeof import('@/lib/muse/visual');
  return scenes.map((s) => ({ id: s.id, tier: resolveMotionTier(s), src: s.videoUrl || s.imageUrl || '', vo: s.voiceClipUrl || null, voSource: s.voiceSource || 'script', cadence: s.cadence ?? 1 }));
}

export async function renderCommercial() {
  throw new Error('MP4 render via FFmpeg.wasm is stubbed — captions/script export work today.');
}
