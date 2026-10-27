// Final MP4 rendering (Phase 2 hookup): FFmpeg.wasm runs fully in the browser.
// Storyboard/export already produce script + SRT + project JSON; wire this module
// to composite scene images + voice-over + captions into an MP4 per platform preset.
export async function renderCommercial() {
  throw new Error('MP4 render via FFmpeg.wasm is stubbed — captions/script export work today.');
}
