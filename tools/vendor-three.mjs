// Copies only the three.js modules the site imports (plus their relative deps) into /vendor.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { transform } from 'esbuild';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const pkg = join(root, 'node_modules', 'three');
const dest = join(root, 'vendor', 'three');

const entries = [
  'build/three.module.js',
  'examples/jsm/loaders/GLTFLoader.js',
  'examples/jsm/environments/RoomEnvironment.js',
  'examples/jsm/postprocessing/EffectComposer.js',
  'examples/jsm/postprocessing/RenderPass.js',
  'examples/jsm/postprocessing/UnrealBloomPass.js',
  'examples/jsm/postprocessing/OutputPass.js',
];

await rm(dest, { recursive: true, force: true });
const seen = new Set();
async function visit(rel) {
  if (seen.has(rel)) return;
  seen.add(rel);
  const from = join(pkg, rel);
  const to = join(dest, rel);
  await mkdir(dirname(to), { recursive: true });
  const src = await readFile(from, 'utf8');
  // Minify each module in place (ES module structure and import paths are preserved).
  const { code } = await transform(src, { minify: true, format: 'esm', target: 'es2020', legalComments: 'inline' });
  await writeFile(to, code);
  for (const m of src.matchAll(/(?:from|import)\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
    await visit(relative(pkg, resolve(dirname(from), m[1])).split(sep).join('/'));
  }
}
for (const e of entries) await visit(e);
console.log(`vendored ${seen.size} three.js files`);
