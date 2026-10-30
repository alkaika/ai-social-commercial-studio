// Copies the FFmpeg.wasm browser runtime into public/ so the app serves it
// itself (no CDN / CORS / ad-block risk at stitch time).
// Run: `node scripts/copy-ffmpeg-core.mjs` (also wired as postinstall).
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'ffmpeg');
mkdirSync(out, { recursive: true });

const pairs = [
  ['node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js', 'ffmpeg-core.js'],
  ['node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm', 'ffmpeg-core.wasm'],
  ['node_modules/@ffmpeg/ffmpeg/dist/esm/worker.js', 'ffmpeg-worker.js'],
  ['node_modules/@ffmpeg/ffmpeg/dist/esm/const.js', 'const.js'],
  ['node_modules/@ffmpeg/ffmpeg/dist/esm/errors.js', 'errors.js'],
];
let ok = 0;
for (const [src, dest] of pairs) {
  const from = join(root, src);
  if (!existsSync(from)) { console.warn(`[copy-ffmpeg-core] missing ${src} — is @ffmpeg/core installed?`); continue; }
  cpSync(from, join(out, dest));
  ok++;
}
console.log(`[copy-ffmpeg-core] ${ok}/${pairs.length} files -> public/ffmpeg/`);
