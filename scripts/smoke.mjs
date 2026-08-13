import { readFile, stat, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const failures = [];

async function exists(path) { try { await stat(path); return true; } catch { return false; } }
if (!await exists(join(dist, 'index.html'))) failures.push('dist/index.html is missing; run npm run check first.');
if (!await exists(join(dist, 'models/2015-rocket-bunny-honda-nsx.glb'))) failures.push('Bundled NSX is missing from dist/models.');

const glbPath = join(root, 'public/models/2015-rocket-bunny-honda-nsx.glb');
const glb = await readFile(glbPath);
if (glb.subarray(0, 4).toString('ascii') !== 'glTF') failures.push('Starter model GLB magic is invalid.');
const version = glb.readUInt32LE(4);
const totalLength = glb.readUInt32LE(8);
if (version !== 2) failures.push(`Expected GLB v2; found v${version}.`);
if (totalLength !== glb.length) failures.push(`GLB length header mismatch (${totalLength} vs ${glb.length}).`);
let offset = 12;
let json = null;
while (offset + 8 <= glb.length) {
  const length = glb.readUInt32LE(offset);
  const type = glb.readUInt32LE(offset + 4);
  const chunk = glb.subarray(offset + 8, offset + 8 + length);
  if (type === 0x4E4F534A) json = JSON.parse(chunk.toString('utf8').replace(/\0+$/g, '').trim());
  offset += 8 + length;
}
if (!json) failures.push('GLB JSON chunk could not be parsed.');
else {
  if (!(json.meshes?.length > 0)) failures.push('GLB has no meshes.');
  if (!(json.materials?.length > 0)) failures.push('GLB has no materials.');
  if (!(json.nodes?.length > 0)) failures.push('GLB has no nodes.');
  if (!json.scenes?.length) failures.push('GLB has no scenes.');
}

if (await exists(dist)) {
  const distFiles = [];
  async function walk(path) {
    for (const name of await readdir(path)) {
      const item = join(path, name);
      const info = await stat(item);
      if (info.isDirectory()) await walk(item); else distFiles.push(item);
    }
  }
  await walk(dist);
  if (distFiles.length >= 100) failures.push(`Built output has ${distFiles.length} files; expected fewer than 100.`);
  const html = await readFile(join(dist, 'index.html'), 'utf8').catch(() => '');
  if (!html.includes('PRODUCT VIS')) failures.push('Built shell marker is missing.');
  const jsFiles = distFiles.filter((file) => file.endsWith('.js'));
  if (!jsFiles.length) failures.push('Built application JavaScript is missing.');
}

if (failures.length) {
  console.error('Product VIS V2.1B smoke test failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`Product VIS V2.1B smoke passed · GLB ${json.meshes.length} meshes / ${json.materials.length} materials · build present.`);
