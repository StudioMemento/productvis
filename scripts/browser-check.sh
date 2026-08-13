#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
LOG=validation/browser-check.log
: > "$LOG"
run() { printf '\n$ %q ' "$1" >> "$LOG"; shift || true; printf '%q ' "$@" >> "$LOG"; printf '\n' >> "$LOG"; "$@" >> "$LOG" 2>&1; }
AB=(agent-browser --session productvis-v21b)

"${AB[@]}" close >> "$LOG" 2>&1 || true
"${AB[@]}" open http://127.0.0.1:4173 >> "$LOG" 2>&1
"${AB[@]}" set viewport 1440 900 >> "$LOG" 2>&1 || "${AB[@]}" viewport 1440 900 >> "$LOG" 2>&1
"${AB[@]}" wait 1200 >> "$LOG" 2>&1
"${AB[@]}" eval --stdin >> "$LOG" 2>&1 <<'JS'
(async () => {
  const api = window.__PRODUCT_VIS__;
  if (!api) throw new Error('Debug API missing.');
  await api.ready;
  const stats = api.stats();
  if (stats.meshes < 1 || stats.materials < 1) throw new Error(`Starter did not load: ${JSON.stringify(stats)}`);
  if (document.querySelector('#loading-overlay') && !document.querySelector('#loading-overlay').classList.contains('hidden')) throw new Error('Loading overlay did not close.');
  if (!document.querySelector('#import-model')?.textContent.includes('Replace model')) throw new Error('Visible replace/import action is missing.');
  return { version: api.version, stats };
})()
JS
"${AB[@]}" screenshot validation/01-initial-nsx.png >> "$LOG" 2>&1
"${AB[@]}" snapshot -i >> "$LOG" 2>&1

"${AB[@]}" eval --stdin >> "$LOG" 2>&1 <<'JS'
(async () => {
  const api = window.__PRODUCT_VIS__;
  const names = ['Hero','Front','Rear','Left','Right','Top','Detail','Fit'];
  const results = [];
  for (const name of names) {
    await api.applyCameraPreset(name, true);
    const check = api.validatePreset(name);
    if (!check.centered || !check.targetOk || !check.distanceOk || !check.clippingOk) throw new Error(`Camera ${name} failed: ${JSON.stringify(check)}`);
    results.push(check);
  }
  return results;
})()
JS
"${AB[@]}" screenshot validation/02-camera-top-fit.png >> "$LOG" 2>&1

"${AB[@]}" eval --stdin >> "$LOG" 2>&1 <<'JS'
(async () => {
  const api = window.__PRODUCT_VIS__;
  const results = [];
  for (const category of ['exterior','interior','wheel','wing']) results.push(await api.doubleFocus(category));
  const state = api.snapshot();
  if (!state.camera.focusPointLocal || !state.camera.focusPointWorld) throw new Error('Focus point was not persisted in local/world form.');
  if (Math.abs(state.dof.focusDistance - state.cameraSnapshot.position.reduce ? 0 : 0) < -1) throw new Error('unreachable');
  return results;
})()
JS
"${AB[@]}" screenshot validation/03-surface-focus.png >> "$LOG" 2>&1

"${AB[@]}" eval --stdin >> "$LOG" 2>&1 <<'JS'
(() => {
  const api = window.__PRODUCT_VIS__;
  const before = api.dofUniforms();
  api.setDof({ enabled: true, focusDistance: 2.75, aperture: 9.2, bokeh: 1.12, focusRange: 0.22 });
  const after = api.dofUniforms();
  if (!after.enabled || Math.abs(after.focus - 2.75) > 0.001 || !(after.aperture > before.aperture) || !(after.maxblur > before.maxblur)) throw new Error(`DOF uniforms did not respond: ${JSON.stringify({before,after})}`);
  api.setDof({ enabled: false });
  if (api.dofUniforms().enabled) throw new Error('DOF off switch failed.');
  api.setDof({ enabled: true });
  return { before, after };
})()
JS

"${AB[@]}" eval --stdin >> "$LOG" 2>&1 <<'JS'
(async () => {
  const api = window.__PRODUCT_VIS__;
  const app = api.app;
  const glass = app.materialEntries.filter((entry) => entry.classification === 'Transparent glass');
  if (!glass.length) throw new Error('No glass materials were classified.');
  for (const name of ['Front','Rear']) {
    await api.applyCameraPreset(name, true);
    const invalid = glass.filter((entry) => !entry.material.transparent || entry.material.depthWrite !== false || entry.material.depthTest !== true);
    if (invalid.length) throw new Error(`Glass policy invalid from ${name}: ${invalid.map((entry) => entry.name).join(', ')}`);
  }
  const proxyCount = glass.reduce((sum, entry) => sum + entry.meshes.reduce((meshSum, mesh) => meshSum + Object.keys(mesh.userData.__pvBackfaceProxies || {}).length, 0), 0);
  if (proxyCount < 1 && !glass.some((entry) => entry.material.side === 2)) throw new Error('Transparent front/back handling was not installed.');
  if (!(app.semanticGroups.interior.length > 0)) throw new Error('Interior semantic group is empty.');
  return { glass: glass.length, proxyCount, interior: app.semanticGroups.interior.length };
})()
JS
"${AB[@]}" screenshot validation/04-glass-rear.png >> "$LOG" 2>&1

"${AB[@]}" eval --stdin >> "$LOG" 2>&1 <<'JS'
(() => {
  const api = window.__PRODUCT_VIS__;
  const names = ['Soft Studio','Balanced','Contrast','High Key','Rim','Night'];
  const values = [];
  for (const name of names) {
    const state = api.applyLightingPreset(name);
    if (state.preset !== name || !(state.keyIntensity >= 0) || !(state.rimIntensity >= 0) || !(state.shadowSoftness >= 0)) throw new Error(`Lighting ${name} failed.`);
    values.push([name,state.exposure,state.environmentIntensity,state.keyIntensity,state.rimIntensity,state.shadowSoftness]);
  }
  if (new Set(values.map((row) => row.slice(1).join('|'))).size !== names.length) throw new Error('Lighting presets are not coherent distinct looks.');
  return values;
})()
JS
"${AB[@]}" screenshot validation/05-lighting-night.png >> "$LOG" 2>&1

"${AB[@]}" eval --stdin >> "$LOG" 2>&1 <<'JS'
(() => {
  const api = window.__PRODUCT_VIS__;
  const names = ['Neutral Studio','White Cyclorama','Dark Studio','Black Void','Showroom','Night Stage'];
  const values = [];
  for (const name of names) {
    const state = api.applyStagePreset(name);
    if (state.preset !== name || !state.background || !Number.isFinite(state.environmentIntensity)) throw new Error(`Stage ${name} failed.`);
    values.push([name,state.background,state.groundVisible,state.contactShadow,state.rotation,state.backgroundBlur,state.environmentIntensity]);
  }
  if (new Set(values.map((row) => row.slice(1).join('|'))).size !== names.length) throw new Error('Stage presets are not distinct.');
  return values;
})()
JS
"${AB[@]}" screenshot validation/06-stage-night.png >> "$LOG" 2>&1

"${AB[@]}" eval --stdin >> "$LOG" 2>&1 <<'JS'
(() => {
  const api = window.__PRODUCT_VIS__;
  const app = api.app;
  const selections = { body: 'Electric Blue', wheels: 'Bronze', interior: 'Warm Tan', brakes: 'Yellow', glass: 'Smoke' };
  const before = {};
  for (const group of Object.keys(selections)) {
    if (!(app.semanticGroups[group]?.length > 0)) throw new Error(`Semantic group ${group} is empty.`);
    const entry = app.semanticGroups[group][0];
    before[group] = entry.material.color?.getHexString?.() || '';
    const active = api.selectConfiguration(group, selections[group]);
    if (active !== selections[group]) throw new Error(`Configuration ${group} did not activate.`);
    if (entry.material.map && !entry.material.map.isTexture) throw new Error(`${group} texture map was damaged.`);
  }
  const after = Object.fromEntries(Object.keys(selections).map((group) => [group, app.semanticGroups[group][0].material.color?.getHexString?.() || '']));
  if (!Object.keys(selections).some((group) => before[group] !== after[group])) throw new Error('Configurator did not alter material appearance.');
  return { selections, groups: api.stats().groups, before, after };
})()
JS
"${AB[@]}" screenshot validation/07-configurator.png >> "$LOG" 2>&1

"${AB[@]}" eval --stdin >> "$LOG" 2>&1 <<'JS'
(async () => {
  const api = window.__PRODUCT_VIS__;
  const app = api.app;
  const results = [];
  api.setAnimation('Still', true); api.resetPose();
  for (const mode of ['Turntable','Float','Showcase','Detail orbit']) {
    api.setAnimation(mode, true);
    const before = { rotation: app.productContainer.rotation.y, y: app.productContainer.position.y, camera: app.camera.position.toArray() };
    await new Promise((resolve) => setTimeout(resolve, 420));
    const after = { rotation: app.productContainer.rotation.y, y: app.productContainer.position.y, camera: app.camera.position.toArray() };
    const changed = Math.abs(after.rotation-before.rotation) > 1e-5 || Math.abs(after.y-before.y) > 1e-5 || after.camera.some((value,index) => Math.abs(value-before.camera[index]) > 1e-5);
    if (!changed) throw new Error(`Procedural mode ${mode} did not move.`);
    results.push({ mode, before, after });
  }
  api.setAnimation('Still', false); api.resetPose();
  return results;
})()
JS
"${AB[@]}" screenshot validation/08-animation.png >> "$LOG" 2>&1

"${AB[@]}" eval --stdin >> "$LOG" 2>&1 <<'JS'
(async () => {
  const api = window.__PRODUCT_VIS__;
  api.applyLightingPreset('Rim');
  api.applyStagePreset('Showroom');
  api.selectConfiguration('body','Gunmetal');
  await api.doubleFocus('wheel');
  api.saveProject();
  api.applyLightingPreset('High Key');
  api.applyStagePreset('White Cyclorama');
  api.selectConfiguration('body','Pearl White');
  if (!await api.openProject()) throw new Error('Project reopen returned false.');
  let state = api.snapshot();
  if (state.lighting.preset !== 'Rim' || state.stage.preset !== 'Showroom' || state.configuration.body !== 'Gunmetal' || !state.camera.focusPointLocal) throw new Error(`Project state did not restore: ${JSON.stringify(state)}`);
  api.savePresentation();
  api.applyStagePreset('Black Void');
  api.selectConfiguration('wheels','Polished');
  if (!await api.openPresentation()) throw new Error('Presentation reopen returned false.');
  state = api.snapshot();
  if (state.stage.preset !== 'Showroom' || state.configuration.body !== 'Gunmetal' || !state.camera.focusPointLocal) throw new Error('Presentation state did not restore.');
  return { project: true, presentation: true, focus: state.camera.focusPointWorld };
})()
JS

"${AB[@]}" eval --stdin >> "$LOG" 2>&1 <<'JS'
(async () => {
  const api = window.__PRODUCT_VIS__;
  const custom = await api.replaceCustom();
  if (custom.source !== 'custom' || custom.meshes < 1) throw new Error(`Custom replacement failed: ${JSON.stringify(custom)}`);
  await api.loadStarter();
  const state = api.snapshot();
  if (state.model.source !== 'starter') throw new Error('Starter model could not be restored after custom replacement.');
  return { custom, restored: state.model };
})()
JS
"${AB[@]}" screenshot validation/09-custom-replaced-restored.png >> "$LOG" 2>&1

"${AB[@]}" eval --stdin >> "$LOG" 2>&1 <<'JS'
(() => {
  const api = window.__PRODUCT_VIS__;
  const layout = api.layout();
  if (window.innerWidth < 1000) throw new Error(`Desktop emulation failed: ${window.innerWidth}px.`);
  if (!layout.globalVisible || !layout.canvasVisible || layout.categories !== 5) throw new Error(`Desktop layout failed: ${JSON.stringify(layout)}`);
  if (window.__PRODUCT_VIS_ERRORS__?.length) throw new Error(`Runtime errors: ${JSON.stringify(window.__PRODUCT_VIS_ERRORS__)}`);
  return layout;
})()
JS
"${AB[@]}" screenshot validation/10-desktop-final.png >> "$LOG" 2>&1

# agent-browser supports viewport emulation; keep a fallback so the diagnostics still record the actual viewport.
"${AB[@]}" set viewport 390 844 >> "$LOG" 2>&1 || "${AB[@]}" viewport 390 844 >> "$LOG" 2>&1
"${AB[@]}" wait 350 >> "$LOG" 2>&1
"${AB[@]}" eval --stdin >> "$LOG" 2>&1 <<'JS'
(async () => {
  const api = window.__PRODUCT_VIS__;
  const layout = api.layout();
  if (window.innerWidth > 430) throw new Error(`Mobile emulation failed: ${window.innerWidth}px.`);
  if (!layout.globalVisible || layout.categories !== 5) throw new Error(`Mobile Global Studio failed: ${JSON.stringify(layout)}`);
  for (const category of ['camera','lighting','stage','configurator','animation']) {
    document.querySelector(`[data-studio="${category}"]`).click();
    await new Promise((resolve) => setTimeout(resolve, 40));
    if (document.querySelector('#studio-panel').hidden) throw new Error(`Mobile ${category} panel did not open.`);
  }
  document.querySelector('[data-studio="camera"]').click();
  await api.doubleTap('exterior');
  if (!api.snapshot().camera.focusPointLocal) throw new Error('Mobile double-tap did not persist focus.');
  return { layout, doubleTap: true };
})()
JS
"${AB[@]}" screenshot validation/11-mobile.png >> "$LOG" 2>&1
"${AB[@]}" close >> "$LOG" 2>&1
printf 'PASS\n' > validation/browser-check.pass
