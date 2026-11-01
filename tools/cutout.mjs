// Removes the studio background from portrait.jpg without altering the subject.
// Output: assets/portrait/subject.webp (alpha) + subject-mobile.webp
import { removeBackground } from '@imgly/background-removal-node';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const src = new URL('../portrait.jpg', import.meta.url);
const out = (name) => fileURLToPath(new URL(`../assets/portrait/${name}`, import.meta.url));

const input = await readFile(src);
const blob = await removeBackground(new Blob([input], { type: 'image/jpeg' }), {
  model: 'medium',
  output: { format: 'image/png', quality: 1 },
});
const png = Buffer.from(await blob.arrayBuffer());

// Edge decontamination: semi-transparent pixels (hair strands) still contain the
// grey studio wall. Un-mix it: F = (C - (1 - a) * B) / a, with B = mean wall colour.
const orig = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const cut = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = cut.info;
const C = cut.data, O = orig.data;
let br = 0, bg = 0, bb = 0, n = 0;
for (let i = 0, p = 0; p < W * H; p++, i += 4) {
  if (C[i + 3] === 0) { br += O[p * 3]; bg += O[p * 3 + 1]; bb += O[p * 3 + 2]; n++; }
}
const B = [br / n, bg / n, bb / n];
console.log('wall colour', B.map(Math.round));
for (let i = 0, p = 0; p < W * H; p++, i += 4) {
  const a = C[i + 3] / 255;
  if (a <= 0 || a >= 0.98) continue;
  const ae = Math.max(a, 0.12);
  for (let c = 0; c < 3; c++) {
    const v = (O[p * 3 + c] - (1 - ae) * B[c]) / ae;
    C[i + c] = Math.max(0, Math.min(255, Math.round(v)));
  }
}
const cleaned = await sharp(C, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();

// Trim transparent margins so layout math is based on the subject itself.
const trimmed = await sharp(cleaned).trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true });
console.log('trimmed size', trimmed.info.width, trimmed.info.height);

await sharp(trimmed.data).resize({ height: 1600, withoutEnlargement: true })
  .webp({ quality: 88, alphaQuality: 95, effort: 6 }).toFile(out('subject.webp'));
await sharp(trimmed.data).resize({ height: 960, withoutEnlargement: true })
  .webp({ quality: 84, alphaQuality: 92, effort: 6 }).toFile(out('subject-mobile.webp'));
console.log('cutout done');
