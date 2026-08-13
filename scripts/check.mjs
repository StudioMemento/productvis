import { readFile, readdir, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const required = [
  'index.html', 'src/main.js', 'src/app.js', 'src/config.js', 'src/materials.js', 'src/styles.css',
  'public/models/2015-rocket-bunny-honda-nsx.glb', 'vercel.json', 'package.json'
];
const failures = [];
const files = [];

async function walk(directory) {
  for (const name of await readdir(directory)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
    const path = join(directory, name);
    const info = await stat(path);
    if (info.isDirectory()) await walk(path);
    else files.push(relative(root, path));
  }
}

for (const file of required) {
  try { await stat(join(root, file)); }
  catch { failures.push(`Missing required file: ${file}`); }
}
await walk(root);
if (files.length >= 100) failures.push(`Deployable source file count is ${files.length}; expected fewer than 100.`);

for (const file of files.filter((name) => name.endsWith('.js') || name.endsWith('.mjs'))) {
  const result = spawnSync(process.execPath, ['--check', join(root, file)], { encoding: 'utf8' });
  if (result.status !== 0) failures.push(`Syntax error in ${file}: ${result.stderr || result.stdout}`);
}

const app = await readFile(join(root, 'src/app.js'), 'utf8');
const config = await readFile(join(root, 'src/config.js'), 'utf8');
const html = await readFile(join(root, 'index.html'), 'utf8');
const materials = await readFile(join(root, 'src/materials.js'), 'utf8');
const css = await readFile(join(root, 'src/styles.css'), 'utf8');
const tokens = [
  ['local starter preload', html, '/models/2015-rocket-bunny-honda-nsx.glb'],
  ['visible import action', html, 'Replace model / Import your GLB'],
  ['Global Studio camera', html, 'data-studio="camera"'],
  ['Global Studio lighting', html, 'data-studio="lighting"'],
  ['Global Studio stage', html, 'data-studio="stage"'],
  ['Global Studio configurator', html, 'data-studio="configurator"'],
  ['Global Studio animation', html, 'data-studio="animation"'],
  ['eight camera presets', config, "'Hero', 'Front', 'Rear', 'Left', 'Right', 'Top', 'Detail', 'Fit'"],
  ['double click focus', app, "addEventListener('dblclick'"],
  ['double tap focus', app, "'double-tap'"],
  ['product-only raycast', app, 'intersectObjects(this.productMeshes'],
  ['exact world hit', app, 'const point = hit.point.clone()'],
  ['focus state persistence', app, 'focusPointLocal'],
  ['camera and focus tween', app, 'animateCamera(position, point, desiredDistance'],
  ['DOF pass', app, 'new BokehPass'],
  ['lighting presets', config, "'Soft Studio'"],
  ['stage presets', config, "'White Cyclorama'"],
  ['semantic configuration', app, 'rebuildSemanticGroups'],
  ['procedural modes', config, "'Detail orbit'"],
  ['native clips', app, 'nativeActions'],
  ['material classifications', materials, "'Transparent glass'"],
  ['manual material policies', config, "'Auto', 'Front', 'Back', 'Double', 'Opaque', 'Cutout', 'Transparent'"],
  ['transparent front/back pass', materials, 'addBackfaceProxy'],
  ['mobile Global Studio', css, '@media (max-width: 760px)']
];
for (const [label, source, token] of tokens) if (!source.includes(token)) failures.push(`Gate token missing: ${label}`);

const modelPath = join(root, 'public/models/2015-rocket-bunny-honda-nsx.glb');
try {
  const model = await readFile(modelPath);
  if (model.length < 1024 * 1024) failures.push(`Starter GLB is unexpectedly small (${model.length} bytes).`);
  if (model.subarray(0, 4).toString('ascii') !== 'glTF') failures.push('Starter model is not a valid GLB header.');
} catch {}

if (/https?:\/\/(?!openapi\.vercel\.sh)/.test(`${html}\n${app}\n${config}`)) failures.push('Runtime source contains an external HTTP dependency.');
if (/traverse\([\s\S]{0,300}material\.side\s*=\s*THREE\.DoubleSide/.test(app)) failures.push('Detected a possible global DoubleSide traversal.');

if (failures.length) {
  console.error(`Product VIS V2.1B check failed with ${failures.length} issue(s):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`Product VIS V2.1B static check passed · ${files.length} deployable source files · starter model local.`);
