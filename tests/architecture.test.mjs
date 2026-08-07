import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');

async function walk(directory) {
  const entries = await readdir(directory);
  const files = [];
  for (const entry of entries) {
    const absolute = resolve(directory, entry);
    const info = await stat(absolute);
    if (info.isDirectory()) files.push(...await walk(absolute));
    else files.push(absolute);
  }
  return files;
}

test('foundation module boundaries exist', async () => {
  const required = [
    'src/app/AppController.js',
    'src/app/ProjectStore.js',
    'src/model/ModelLoader.js',
    'src/model/ProductSession.js',
    'src/render/RendererEngine.js',
    'src/studio/StudioSystem.js',
    'src/camera/CameraRig.js',
    'src/motion/MotionController.js',
    'src/export/FrameExporter.js',
    'src/ui/UIController.js',
  ];

  for (const path of required) {
    const source = await readFile(resolve(root, path), 'utf8');
    assert.ok(source.length > 100, `${path} should contain an implementation`);
  }
});

test('runtime source has no CDN dependency', async () => {
  const sourceFiles = (await walk(resolve(root, 'src'))).filter((path) => path.endsWith('.js'));
  sourceFiles.push(resolve(root, 'index.html'));

  for (const file of sourceFiles) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /cdn\.jsdelivr|unpkg\.com|cdnjs\.cloudflare/i, relative(root, file));
  }
});

test('render dependency and build tools are pinned', async () => {
  const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  assert.equal(packageJson.dependencies.three, '0.185.1');
  assert.equal(packageJson.devDependencies.vite, '7.3.5');
  assert.doesNotMatch(packageJson.dependencies.three, /^[~^]/);
  assert.doesNotMatch(packageJson.devDependencies.vite, /^[~^]/);
  assert.equal(packageJson.devDependencies['@playwright/test'], '1.62.0');
  assert.doesNotMatch(packageJson.devDependencies['@playwright/test'], /^[~^]/);
  assert.equal(packageJson.engines.node, '^20.19.0 || >=22.12.0');
});

test('all local JavaScript imports resolve to files', async () => {
  const sourceFiles = (await walk(resolve(root, 'src'))).filter((path) => path.endsWith('.js'));
  const importPattern = /(?:from\s+|import\s*)['"](\.{1,2}\/[^'"]+)['"]/g;

  for (const file of sourceFiles) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(importPattern)) {
      const target = resolve(file, '..', match[1]);
      const info = await stat(target).catch(() => null);
      assert.ok(info?.isFile(), `${relative(root, file)} imports missing file ${match[1]}`);
    }
  }
});

test('DOM bindings are complete and IDs are unique', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const domSource = await readFile(resolve(root, 'src/ui/dom.js'), 'utf8');
  const ids = [...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]);
  const bindings = [...domSource.matchAll(/byId\(['"]([^'"]+)['"]\)/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'index.html contains duplicate IDs');
  for (const id of bindings) assert.ok(ids.includes(id), `DOM binding #${id} is missing from index.html`);
});


test('V1 visual shell remains locked to the accepted baseline', async () => {
  const css = await readFile(resolve(root, 'src/styles.css'));
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const body = html.match(/<body>(.*)<\/body>/s)?.[1]?.replace('/src/main.js', '__ENTRY__');
  assert.ok(body, 'index.html body could not be extracted');

  const cssHash = createHash('sha256').update(css).digest('hex');
  const bodyHash = createHash('sha256').update(body).digest('hex');
  assert.equal(cssHash, '0262bc43dcde4a5b7a4b39826144a75aafe335e3841ea4a555a882d5244c2d04');
  assert.equal(bodyHash, 'f6ef703f103a7247d8691518c07959792537d0b9fdef441f2647c29223840332');
});

test('UI layer does not import Three.js runtime objects', async () => {
  const uiFiles = (await walk(resolve(root, 'src/ui'))).filter((path) => path.endsWith('.js'));
  for (const file of uiFiles) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /from\s+['"]three(?:\/|['"])/, relative(root, file));
  }
});

test('development server is local-only and production source maps are disabled', async () => {
  const config = await readFile(resolve(root, 'vite.config.js'), 'utf8');
  assert.match(config, /host:\s*['"]127\.0\.0\.1['"]/);
  assert.match(config, /sourcemap:\s*false/);
  assert.doesNotMatch(config, /host:\s*['"]0\.0\.0\.0['"]/);
});


test('Vercel deployment is gated by source tests before bundling', async () => {
  const config = JSON.parse(await readFile(resolve(root, 'vercel.json'), 'utf8'));
  assert.equal(config.buildCommand, 'npm run check');
  assert.equal(config.outputDirectory, 'dist');
});

test('GLB smoke fixture has a valid glTF 2.0 container header', async () => {
  const fixture = await readFile(resolve(root, 'tests/fixtures/foundation-cube.glb'));
  assert.equal(fixture.readUInt32LE(0), 0x46546c67, 'GLB magic');
  assert.equal(fixture.readUInt32LE(4), 2, 'GLB version');
  assert.equal(fixture.readUInt32LE(8), fixture.byteLength, 'GLB declared length');
  assert.equal(fixture.readUInt32LE(16), 0x4e4f534a, 'first chunk is JSON');
});

test('decoder URLs are versioned before immutable caching', async () => {
  const runtime = await import('../src/config/runtime.js');
  const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const loader = await readFile(resolve(root, 'src/model/ModelLoader.js'), 'utf8');
  const config = await readFile(resolve(root, 'vite.config.js'), 'utf8');
  assert.equal(runtime.THREE_VERSION, packageJson.dependencies.three);
  assert.equal(runtime.DECODER_BASE_PATH, '/decoders/three-0.185.1');
  assert.match(loader, /DECODER_BASE_PATH/);
  assert.match(config, /public\/decoders\/three-\$\{THREE_VERSION\}\/draco/);
  assert.match(config, /public\/decoders\/three-\$\{THREE_VERSION\}\/basis/);
  assert.match(config, /Required decoder source not found/);
  assert.doesNotMatch(config, /console\.warn/);
});
