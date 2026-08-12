import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

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

test('foundation and V1.2 studio module boundaries exist', async () => {
  const required = [
    'src/app/AppController.js',
    'src/app/ProjectStore.js',
    'src/model/ModelLoader.js',
    'src/model/ProductSession.js',
    'src/model/MaterialDiagnostics.js',
    'src/render/RendererEngine.js',
    'src/studio/StudioSystem.js',
    'src/studio/EnvironmentManager.js',
    'src/studio/BackdropManager.js',
    'src/studio/LightRig.js',
    'src/studio/GroundSystem.js',
    'src/studio/ContactShadowRenderer.js',
    'src/camera/CameraRig.js',
    'src/camera/CameraFraming.js',
    'src/motion/MotionController.js',
    'src/export/FrameExporter.js',
    'src/export/ExportFramePlan.js',
    'src/persistence/ProjectFileCodec.js',
    'src/persistence/ProjectMigration.js',
    'src/persistence/SavedLookLibrary.js',
    'src/persistence/RecentProjectStore.js',
    'src/persistence/RecoveryDraftStore.js',
    'src/health/ModelPreflightAnalyzer.js',
    'src/health/SupportReport.js',
    'src/runtime/RuntimePerformanceMonitor.js',
    'src/structure/StructureIndex.js',
    'src/structure/ProductStructure.js',
    'src/structure/AnchorOverlay.js',
    'src/configurator/VariantGrammar.js',
    'src/configurator/ProductVariants.js',
    'src/configurator/InfographicGrammar.js',
    'src/configurator/InfographicSystem.js',
    'src/configurator/InfographicLayout.js',
    'src/configurator/InfographicOverlay.js',
    'src/configurator/PresentationStateLibrary.js',
    'src/story/StoryGrammar.js',
    'src/story/StorySystem.js',
    'src/story/StoryPlayer.js',
    'src/story/ProductExplosion.js',
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
  assert.equal(packageJson.version, '2.1.0-alpha.1');
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

test('V1.2 removes visible limbo geometry and separates studio responsibilities', async () => {
  const studio = await readFile(resolve(root, 'src/studio/StudioSystem.js'), 'utf8');
  const backdrop = await readFile(resolve(root, 'src/studio/BackdropManager.js'), 'utf8');
  const legacyTokens = [
    'SphereGeometry',
    'Product VIS Cyclorama',
    'createCyclorama',
    'createContactShadow',
    'CanvasTexture',
    'createRadialGradient',
  ];

  for (const token of legacyTokens) {
    assert.doesNotMatch(studio, new RegExp(token), `StudioSystem should not contain legacy ${token}`);
  }

  assert.match(studio, /EnvironmentManager/);
  assert.match(studio, /BackdropManager/);
  assert.match(studio, /GroundSystem/);
  assert.match(studio, /LightRig/);
  assert.match(backdrop, /scene\.background = this\.color/);
  assert.doesNotMatch(backdrop, /scene\.environment\s*=/);
});

test('contact shadow is geometry-aware, isolated and quality-scaled', async () => {
  const contact = await readFile(resolve(root, 'src/studio/ContactShadowRenderer.js'), 'utf8');
  const product = await readFile(resolve(root, 'src/model/ProductSession.js'), 'utf8');
  const presets = await readFile(resolve(root, 'src/config/presets.js'), 'utf8');

  assert.match(contact, /WebGLRenderTarget/);
  assert.match(contact, /MeshDepthMaterial/);
  assert.match(contact, /HorizontalBlurShader/);
  assert.match(contact, /VerticalBlurShader/);
  assert.match(contact, /scene\.overrideMaterial/);
  assert.match(contact, /CONTACT_SHADOW_LAYER/);
  assert.match(contact, /try\s*\{/);
  assert.match(contact, /finally\s*\{/);
  assert.match(contact, /bounds\.max\.y/);
  assert.match(contact, /shadowPlane\.scale\.set\(width, -1, depth\)/);
  assert.match(contact, /blurPlane\.scale\.set\(width, 1, depth\)/);
  assert.match(product, /layers\.enable\(CONTACT_SHADOW_LAYER\)/);
  assert.match(presets, /contactShadowSize/);
  assert.match(presets, /contactShadowDynamicFps/);
});

test('neutral studio UI exposes a simple backdrop path without changing the core shell', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const expectedPresets = ['white', 'gray', 'black'];
  for (const id of expectedPresets) assert.match(html, new RegExp(`data-backdrop="${id}"`));
  assert.match(html, /id="backdropToneInput"/);
  assert.match(html, /data-overlay-theme="dark"/);
  assert.match(html, /id="controlPanel"/);
  assert.match(html, /id="fileInput"/);
  assert.match(html, /id="exportButton"/);
  assert.match(html, /id="viewport"/);
  assert.doesNotMatch(html, /data-backdrop="(?:studio|soft|noir|gallery|sunset)"/);
  assert.doesNotMatch(html, /fallback-glow/);
});



test('V1.3 adds camera safety controls and targeted material diagnostics', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const controller = await readFile(resolve(root, 'src/app/AppController.js'), 'utf8');
  const camera = await readFile(resolve(root, 'src/camera/CameraRig.js'), 'utf8');
  const product = await readFile(resolve(root, 'src/model/ProductSession.js'), 'utf8');
  const diagnostics = await readFile(resolve(root, 'src/model/MaterialDiagnostics.js'), 'utf8');

  assert.match(html, /id="inspectToggle"/);
  assert.match(html, /id="backfaceRepairToggle"/);
  assert.match(html, /id="cameraModeValue"/);
  assert.match(html, /id="diagBackfaceCandidates"/);
  assert.match(html, /id="diagDepthRisks"/);
  assert.match(controller, /setInspectMode/);
  assert.match(controller, /setBackfaceRepair/);
  assert.match(controller, /store\.patch\('project\.camera', \{ mode, target \}/);
  assert.match(controller, /project\.model\.backfaceRepairEnabled/);
  assert.match(camera, /presentation/);
  assert.match(camera, /inspect/);
  assert.match(camera, /enforceSafety/);
  assert.match(camera, /updateClipping/);
  assert.match(camera, /computeFitDistanceToBounds/);
  assert.match(camera, /refresh: true/);
  assert.match(product, /backfaceRepairEnabled/);
  assert.match(product, /applyMaterialPresentation/);
  assert.match(product, /override === 'auto'.*originalSide/s);
  assert.match(product, /getSuggestedMaterialSideOverrideIds/);
  assert.match(controller, /suggestedMaterialSideOverrideIds/);
  assert.match(diagnostics, /safeBackfaceCandidate/);
  assert.match(diagnostics, /Transparent and glass materials are reported for review/);
  assert.doesNotMatch(product, /DoubleSide\)\s*;\s*this\.sessionRoot\?\.traverse\(/);
});


test('V1.4 simple path is present and Advanced is closed by default', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const controller = await readFile(resolve(root, 'src/app/AppController.js'), 'utf8');
  const ui = await readFile(resolve(root, 'src/ui/UIController.js'), 'utf8');
  const studio = await readFile(resolve(root, 'src/studio/StudioSystem.js'), 'utf8');
  const styles = await readFile(resolve(root, 'src/styles.css'), 'utf8');
  const presets = await readFile(resolve(root, 'src/config/presets.js'), 'utf8');

  assert.match(html, /id="quickDock"/);
  assert.match(html, /data-lighting="soft"/);
  assert.match(html, /data-lighting="balanced"/);
  assert.match(html, /data-lighting="contrast"/);
  assert.match(html, /id="quickTurntableButton"/);
  assert.match(html, /id="fitButton"/);
  assert.match(html, /id="panelToggle"[^>]+aria-expanded="false"/);
  assert.match(html, /<aside id="controlPanel" class="control-panel"/);
  assert.doesNotMatch(html, /<aside id="controlPanel" class="[^"]*is-open/);
  assert.match(controller, /applyBackdropPreset/);
  assert.match(controller, /applyLightingPreset/);
  assert.match(controller, /lightingPreset/);
  assert.match(ui, /toggleAdvancedPanel/);
  assert.match(ui, /quickTurntableButton/);
  assert.match(studio, /backdropTween/);
  assert.match(studio, /lightingTween/);
  assert.match(styles, /\.quick-dock/);
  assert.match(styles, /\.control-panel\.is-open/);
  assert.match(presets, /LIGHT_PRESETS/);
  assert.match(presets, /schemaVersion:\s*10/);
});



test('V1.5 Advanced exposes one state model and deterministic group resets', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const controller = await readFile(resolve(root, 'src/app/AppController.js'), 'utf8');
  const ui = await readFile(resolve(root, 'src/ui/UIController.js'), 'utf8');
  const camera = await readFile(resolve(root, 'src/camera/CameraRig.js'), 'utf8');
  const product = await readFile(resolve(root, 'src/model/ProductSession.js'), 'utf8');
  const studio = await readFile(resolve(root, 'src/studio/StudioSystem.js'), 'utf8');
  const ground = await readFile(resolve(root, 'src/studio/GroundSystem.js'), 'utf8');
  const motion = await readFile(resolve(root, 'src/motion/MotionController.js'), 'utf8');
  const presets = await readFile(resolve(root, 'src/config/presets.js'), 'utf8');
  const main = await readFile(resolve(root, 'src/main.js'), 'utf8');

  const advancedIds = [
    'resetLookGroupButton',
    'resetObjectGroupButton',
    'resetCameraGroupButton',
    'resetMotionGroupButton',
    'environmentRotationInput',
    'fillInput',
    'groundOffsetInput',
    'shadowOpacityInput',
    'shadowSoftnessInput',
    'targetXInput',
    'targetYInput',
    'targetZInput',
    'materialDiagnosticsList',
  ];
  for (const id of advancedIds) assert.match(html, new RegExp(`id="${id}"`));

  assert.match(controller, /resetLookGroup/);
  assert.match(controller, /resetObjectGroup/);
  assert.match(controller, /resetCameraGroup/);
  assert.match(controller, /resetMotionGroup/);
  assert.match(controller, /setEnvironmentRotation/);
  assert.match(controller, /setGroundOffset/);
  assert.match(controller, /setCameraTarget/);
  assert.match(controller, /setMaterialSideOverride/);
  assert.match(controller, /updateGroupStatuses/);
  assert.match(ui, /materialDiagnosticsList\.addEventListener/);
  assert.match(ui, /updateGroupStatuses/);
  assert.match(camera, /setTargetNormalized/);
  assert.match(camera, /onTargetChange/);
  assert.match(product, /materialSideOverrides/);
  assert.match(product, /setMaterialSideOverride/);
  assert.match(studio, /setShadowOpacity/);
  assert.match(studio, /setShadowSoftness/);
  assert.match(ground, /setGroundOffset/);
  assert.match(motion, /reset\(\{ notify = true \}/);
  assert.match(presets, /schemaVersion:\s*10/);
  assert.match(presets, /materialSideOverrides/);
  assert.match(presets, /groundOffset/);
  assert.match(presets, /target:\s*DEFAULT_CAMERA_TARGET/);
  assert.match(main, /v2\-1a\-stability/);
});



test('V1.6 persists portable projects and exports without resizing the live renderer', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const controller = await readFile(resolve(root, 'src/app/AppController.js'), 'utf8');
  const codec = await readFile(resolve(root, 'src/persistence/ProjectFileCodec.js'), 'utf8');
  const migration = await readFile(resolve(root, 'src/persistence/ProjectMigration.js'), 'utf8');
  const recent = await readFile(resolve(root, 'src/persistence/RecentProjectStore.js'), 'utf8');
  const looks = await readFile(resolve(root, 'src/persistence/SavedLookLibrary.js'), 'utf8');
  const exporter = await readFile(resolve(root, 'src/export/FrameExporter.js'), 'utf8');
  const plan = await readFile(resolve(root, 'src/export/ExportFramePlan.js'), 'utf8');
  const renderer = await readFile(resolve(root, 'src/render/RendererEngine.js'), 'utf8');
  const camera = await readFile(resolve(root, 'src/camera/CameraRig.js'), 'utf8');
  const product = await readFile(resolve(root, 'src/model/ProductSession.js'), 'utf8');
  const motion = await readFile(resolve(root, 'src/motion/MotionController.js'), 'utf8');
  const presets = await readFile(resolve(root, 'src/config/presets.js'), 'utf8');

  for (const id of [
    'projectButton', 'projectMenu', 'saveProjectButton', 'openProjectButton',
    'projectFileInput', 'recentProjectsList', 'savedLookSelect', 'saveLookButton',
    'exportFramingNote',
  ]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /data-export-framing="match"/);
  assert.match(html, /data-export-framing="fill"/);
  assert.match(controller, /encodeProjectFile/);
  assert.match(controller, /decodeProjectFile/);
  assert.match(controller, /#captureProjectState/);
  assert.match(controller, /#applyProjectState/);
  assert.match(controller, /RecentProjectStore/);
  assert.match(controller, /SavedLookLibrary/);
  assert.match(codec, /PVISPRJ1/);
  assert.match(codec, /raw GLB|embedded-glb|assetOffset/);
  assert.doesNotMatch(codec, /base64|btoa\(|atob\(/i);
  assert.match(migration, /CURRENT_PROJECT_SCHEMA_VERSION = 10/);
  assert.match(recent, /indexedDB/);
  assert.match(looks, /localStorage/);
  assert.match(renderer, /renderOffscreen/);
  assert.match(renderer, /readRenderTargetPixels/);
  assert.doesNotMatch(exporter, /renderer\.setSize/);
  assert.match(exporter, /computeExportFramePlan/);
  assert.match(plan, /mode === 'fill'/);
  assert.match(plan, /scaleExportFramePlanForGpu/);
  assert.match(exporter, /maxTextureSize/);
  assert.match(exporter, /afterRender/);
  assert.match(exporter, /Product VIS export cleanup failed/);
  assert.match(controller, /setStructureHelpersVisible\(false\)/);
  assert.match(controller, /setStructureHelpersVisible\(true\)/);
  assert.match(camera, /getPose/);
  assert.match(camera, /setPose/);
  assert.match(product, /positionXZ/);
  assert.match(product, /applyTransformState/);
  assert.match(motion, /turntableAngle/);
  assert.match(motion, /setTime/);
  assert.match(presets, /schemaVersion:\s*10/);
  assert.match(presets, /exportFraming:\s*'match-viewport'/);
});



test('V1.7 adds production preflight, adaptive runtime and local recovery without changing the quick dock', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const controller = await readFile(resolve(root, 'src/app/AppController.js'), 'utf8');
  const preflight = await readFile(resolve(root, 'src/health/ModelPreflightAnalyzer.js'), 'utf8');
  const performance = await readFile(resolve(root, 'src/runtime/RuntimePerformanceMonitor.js'), 'utf8');
  const recovery = await readFile(resolve(root, 'src/persistence/RecoveryDraftStore.js'), 'utf8');
  const support = await readFile(resolve(root, 'src/health/SupportReport.js'), 'utf8');
  const renderer = await readFile(resolve(root, 'src/render/RendererEngine.js'), 'utf8');
  const migration = await readFile(resolve(root, 'src/persistence/ProjectMigration.js'), 'utf8');
  const presets = await readFile(resolve(root, 'src/config/presets.js'), 'utf8');

  for (const id of [
    'preflightHudBadge', 'runtimeHudBadge', 'recoveryPrompt', 'healthGroupStatus',
    'preflightScore', 'preflightIssueList', 'autoQualityToggle', 'pauseWhenHiddenToggle',
    'recoveryEnabledToggle', 'runtimeFps', 'saveRecoveryButton', 'clearRecoveryButton',
    'downloadSupportReportButton',
  ]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /data-panel="health"/);
  assert.match(html, /data-panel-page="health"/);
  assert.match(controller, /analyzeModelPreflight/);
  assert.match(controller, /RuntimePerformanceMonitor/);
  assert.match(controller, /RecoveryDraftStore/);
  assert.match(controller, /#evaluateAdaptiveQuality/);
  assert.match(controller, /#scheduleRecoveryDraft/);
  assert.match(controller, /downloadSupportReport/);
  assert.match(preflight, /renderedTriangles/);
  assert.match(preflight, /texture-memory-critical/);
  assert.match(performance, /downSustainMs/);
  assert.match(performance, /recommendQuality/);
  assert.match(recovery, /indexedDB/);
  assert.match(recovery, /application\/x-productvis|Blob/);
  assert.match(support, /No model bytes/);
  assert.match(renderer, /webglcontextrestored/);
  assert.match(renderer, /getCapabilities/);
  assert.match(migration, /CURRENT_PROJECT_SCHEMA_VERSION = 10/);
  assert.match(presets, /runtime:\s*Object\.freeze/);
  assert.match(presets, /autoQuality:\s*true/);
  assert.match(presets, /pauseWhenHidden:\s*true/);
  assert.match(presets, /recoveryEnabled:\s*true/);
  assert.doesNotMatch(html, /id="quickDock"[^>]*data-health/);
});



test('V1.7 product structure exposes deterministic parts, states and local anchors without changing the quick dock', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const controller = await readFile(resolve(root, 'src/app/AppController.js'), 'utf8');
  const product = await readFile(resolve(root, 'src/model/ProductSession.js'), 'utf8');
  const structure = await readFile(resolve(root, 'src/structure/ProductStructure.js'), 'utf8');
  const index = await readFile(resolve(root, 'src/structure/StructureIndex.js'), 'utf8');
  const overlay = await readFile(resolve(root, 'src/structure/AnchorOverlay.js'), 'utf8');
  const migration = await readFile(resolve(root, 'src/persistence/ProjectMigration.js'), 'utf8');
  const presets = await readFile(resolve(root, 'src/config/presets.js'), 'utf8');

  for (const id of [
    'anchorOverlay', 'structureGroupStatus', 'structureSearchInput', 'structurePartList',
    'showAllPartsButton', 'restoreAuthoredVisibilityButton', 'isolateSelectedPartButton',
    'visibilityStateSelect', 'saveVisibilityStateButton', 'anchorSelect',
    'createTargetAnchorButton', 'focusAnchorButton', 'deleteAnchorButton',
  ]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /data-panel="structure"/);
  assert.match(html, /data-panel-page="structure"/);
  assert.match(controller, /AnchorOverlay/);
  assert.match(controller, /#commitStructureState/);
  assert.match(controller, /createPartAnchor/);
  assert.match(controller, /createTargetAnchor/);
  assert.match(controller, /#getConfiguratorState\(\)/);
  assert.match(controller, /configurator: this\.#getConfiguratorState\(\)/);
  assert.match(product, /ProductStructure/);
  assert.match(product, /getVisibleBounds/);
  assert.match(structure, /captureVisibilityState/);
  assert.match(structure, /createAnchorAtPart/);
  assert.match(structure, /fallbackRootLocalPosition/);
  assert.match(index, /stablePartId/);
  assert.match(index, /hashStructurePath/);
  assert.match(overlay, /project\(this\.camera\)/);
  assert.match(migration, /sanitizeConfigurator/);
  assert.match(presets, /partVisibility/);
  assert.match(presets, /anchorDisplay:\s*'off'/);
  assert.doesNotMatch(html, /id="quickDock"[^>]*data-structure/);
});




test('V1.8 adds deterministic variants and anchored infographic overlays without polluting the simple renderer dock', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const controller = await readFile(resolve(root, 'src/app/AppController.js'), 'utf8');
  const product = await readFile(resolve(root, 'src/model/ProductSession.js'), 'utf8');
  const structure = await readFile(resolve(root, 'src/structure/ProductStructure.js'), 'utf8');
  const grammar = await readFile(resolve(root, 'src/configurator/VariantGrammar.js'), 'utf8');
  const variants = await readFile(resolve(root, 'src/configurator/ProductVariants.js'), 'utf8');
  const infoGrammar = await readFile(resolve(root, 'src/configurator/InfographicGrammar.js'), 'utf8');
  const infoSystem = await readFile(resolve(root, 'src/configurator/InfographicSystem.js'), 'utf8');
  const infoLayout = await readFile(resolve(root, 'src/configurator/InfographicLayout.js'), 'utf8');
  const infoOverlay = await readFile(resolve(root, 'src/configurator/InfographicOverlay.js'), 'utf8');
  const migration = await readFile(resolve(root, 'src/persistence/ProjectMigration.js'), 'utf8');
  const presets = await readFile(resolve(root, 'src/config/presets.js'), 'utf8');
  const support = await readFile(resolve(root, 'src/health/SupportReport.js'), 'utf8');
  const styles = await readFile(resolve(root, 'src/styles.css'), 'utf8');

  for (const id of [
    'variantTray', 'variantTrayGroups', 'variantGroupStatus', 'variantGroupSelect',
    'variantGroupRequiredToggle', 'variantOptionNameInput', 'variantAppearanceToggle',
    'variantColorInput', 'variantFinishSelect', 'variantVisibilitySelect',
    'variantOptionList', 'variantConflictList', 'variantConfigurationSelect',
    'variantPreviewToggle', 'infographicOverlay', 'infoGroupStatus', 'infographicAnchorSelect',
    'infographicTitleInput', 'infographicBodyInput', 'infographicAccentInput',
    'infographicSideSelect', 'infographicSelect', 'infographicVisibleToggle',
  ]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /data-panel="variants"/);
  assert.match(html, /data-panel-page="variants"/);
  assert.match(html, /data-panel="info"/);
  assert.match(html, /data-panel-page="info"/);
  assert.ok(html.indexOf('id="variantTray"') < html.indexOf('id="quickDock"'));
  assert.doesNotMatch(html, /id="quickDock"[^>]*data-variant/);
  assert.match(controller, /createVariantGroup/);
  assert.match(controller, /activateVariantOption/);
  assert.match(controller, /saveVariantConfiguration/);
  assert.match(controller, /resetVariantGroup/);
  assert.match(product, /ProductVariants/);
  assert.match(product, /variantAppearanceByMesh/);
  assert.match(product, /#applyVariantStyle/);
  assert.match(structure, /variantVisibilityOverrides/);
  assert.match(structure, /setVariantVisibilityOverrides/);
  assert.match(grammar, /resolveVariantSelection/);
  assert.match(grammar, /Later groups|groupIndex|conflicts/);
  assert.match(variants, /captureConfiguration/);
  assert.match(variants, /activeConfigurationId/);
  assert.match(infoGrammar, /sanitizeInfographicState/);
  assert.match(infoGrammar, /infographicDisplay/);
  assert.match(infoSystem, /setAnchorMarkers/);
  assert.match(infoSystem, /unresolvedCount/);
  assert.match(infoLayout, /createInfographicConnector/);
  assert.match(infoLayout, /layoutInfographicCards/);
  assert.match(infoOverlay, /project\(this\.camera\)/);
  assert.match(infoOverlay, /createElementNS/);
  assert.match(migration, /CURRENT_PROJECT_SCHEMA_VERSION = 10/);
  assert.match(presets, /variantGroups/);
  assert.match(presets, /variantSelections/);
  assert.match(presets, /configurations/);
  assert.match(presets, /infographics/);
  assert.match(presets, /infographicDisplay:\s*'off'/);
  assert.match(migration, /sanitizeInfographicState/);
  assert.doesNotMatch(presets, /callouts:\s*Object\.freeze/);
  assert.match(presets, /presentations:\s*Object\.freeze/);
  assert.match(presets, /activePresentationId:\s*null/);
  assert.match(presets, /variantPreviewEnabled:\s*false/);
  assert.match(support, /variantGroups/);
  assert.match(support, /infographics/);
  assert.match(support, /presentationStates/);
  assert.match(styles, /\.variant-tray/);
  assert.match(styles, /\.variant-option-row/);
  assert.match(styles, /\.infographic-overlay/);
  assert.match(styles, /\.infographic-card/);
  assert.match(styles, /background:\s*transparent/);
  assert.match(styles, /overflow-x:\s*auto/);
  assert.match(styles, /flex:\s*0 0 62px/);
});



test('V1.8 adds anchor-driven infographic authoring without baking editor graphics into WebGL export', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const controller = await readFile(resolve(root, 'src/app/AppController.js'), 'utf8');
  const migration = await readFile(resolve(root, 'src/persistence/ProjectMigration.js'), 'utf8');
  const presets = await readFile(resolve(root, 'src/config/presets.js'), 'utf8');
  const grammar = await readFile(resolve(root, 'src/configurator/InfographicGrammar.js'), 'utf8');
  const system = await readFile(resolve(root, 'src/configurator/InfographicSystem.js'), 'utf8');
  const layout = await readFile(resolve(root, 'src/configurator/InfographicLayout.js'), 'utf8');
  const overlay = await readFile(resolve(root, 'src/configurator/InfographicOverlay.js'), 'utf8');
  const exporter = await readFile(resolve(root, 'src/export/FrameExporter.js'), 'utf8');
  const styles = await readFile(resolve(root, 'src/styles.css'), 'utf8');

  for (const id of [
    'infographicOverlay', 'infoGroupStatus', 'infographicAnchorSelect',
    'infographicTitleInput', 'infographicBodyInput', 'infographicAccentInput',
    'createInfographicButton', 'updateInfographicButton', 'infographicSelect',
    'focusInfographicButton', 'deleteInfographicButton',
  ]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /data-panel="info"/);
  assert.match(html, /data-panel-page="info"/);
  assert.doesNotMatch(html, /id="quickDock"[^>]*data-infographic/);
  assert.match(html, /id="presentationNameInput"/);
  assert.match(html, /id="savePresentationButton"/);
  assert.match(html, /id="presentationSelect"/);
  assert.match(controller, /InfographicSystem/);
  assert.match(controller, /InfographicOverlay/);
  assert.match(controller, /createInfographic/);
  assert.match(controller, /#syncInfographicAnchors/);
  assert.match(controller, /\.infographicOverlay\?\.update/);
  assert.match(grammar, /MAX_INFOGRAPHICS/);
  assert.match(grammar, /sanitizeInfographicState/);
  assert.match(system, /unresolvedCount/);
  assert.match(layout, /layoutInfographicCards/);
  assert.match(layout, /createInfographicConnector/);
  assert.match(overlay, /createElementNS/);
  assert.match(overlay, /project\(this\.camera\)/);
  assert.match(migration, /sanitizeInfographicState/);
  assert.match(presets, /infographics:\s*Object\.freeze/);
  assert.match(presets, /infographicDisplay:\s*'off'/);
  assert.match(styles, /\.infographic-overlay/);
  assert.match(styles, /\.infographic-connector/);
  assert.match(styles, /\.infographic-card/);
  assert.doesNotMatch(exporter, /infographicOverlay|infographic-card|infographic-connector/);
});




test('V1.8 presentation states recall static shots while leaving motion outside the preset layer', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const controller = await readFile(resolve(root, 'src/app/AppController.js'), 'utf8');
  const library = await readFile(resolve(root, 'src/configurator/PresentationStateLibrary.js'), 'utf8');
  const migration = await readFile(resolve(root, 'src/persistence/ProjectMigration.js'), 'utf8');
  const presets = await readFile(resolve(root, 'src/config/presets.js'), 'utf8');
  const support = await readFile(resolve(root, 'src/health/SupportReport.js'), 'utf8');

  for (const id of [
    'presentationCount', 'presentationNameInput', 'savePresentationButton',
    'presentationSelect', 'applyPresentationButton', 'deletePresentationButton',
  ]) assert.match(html, new RegExp(`id="${id}"`));

  assert.doesNotMatch(html, /id="quickDock"[^>]*data-presentation/);
  assert.match(controller, /PresentationStateLibrary/);
  assert.match(controller, /#capturePresentationSnapshot/);
  assert.match(controller, /#applyPresentationSnapshot/);
  assert.match(controller, /Motion was left untouched/);
  assert.match(controller, /variantPreviewEnabled/);
  assert.match(library, /MAX_PRESENTATION_STATES = 32/);
  assert.match(library, /sanitizePresentationSnapshot/);
  assert.match(library, /Presentation states are deliberately static|PresentationStateLibrary/);
  assert.doesNotMatch(library, /\bmotion\s*:/);
  assert.match(migration, /sanitizePresentationState/);
  assert.match(presets, /presentations:\s*Object\.freeze/);
  assert.match(presets, /activePresentationId:\s*null/);
  assert.match(support, /presentationStates/);
});



test('V1.9 adds controlled product stories without introducing a timeline editor', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const controller = await readFile(resolve(root, 'src/app/AppController.js'), 'utf8');
  const ui = await readFile(resolve(root, 'src/ui/UIController.js'), 'utf8');
  const product = await readFile(resolve(root, 'src/model/ProductSession.js'), 'utf8');
  const explosion = await readFile(resolve(root, 'src/story/ProductExplosion.js'), 'utf8');
  const grammar = await readFile(resolve(root, 'src/story/StoryGrammar.js'), 'utf8');
  const stories = await readFile(resolve(root, 'src/story/StorySystem.js'), 'utf8');
  const player = await readFile(resolve(root, 'src/story/StoryPlayer.js'), 'utf8');
  const motion = await readFile(resolve(root, 'src/motion/MotionController.js'), 'utf8');
  const camera = await readFile(resolve(root, 'src/camera/CameraRig.js'), 'utf8');
  const migration = await readFile(resolve(root, 'src/persistence/ProjectMigration.js'), 'utf8');
  const presets = await readFile(resolve(root, 'src/config/presets.js'), 'utf8');
  const support = await readFile(resolve(root, 'src/health/SupportReport.js'), 'utf8');
  const exporter = await readFile(resolve(root, 'src/export/FrameExporter.js'), 'utf8');
  const styles = await readFile(resolve(root, 'src/styles.css'), 'utf8');
  const main = await readFile(resolve(root, 'src/main.js'), 'utf8');

  for (const id of [
    'storyTransport', 'storyGroupStatus', 'explodeDistanceInput', 'clearAllExplodeButton',
    'explodeStateSelect', 'chapterClipSelect', 'chapterSelect', 'storySelect',
    'storyStepSelect', 'storyPresentationSelect', 'storyExplodeSelect',
    'storyChapterSelect', 'storyTransitionInput', 'storyHoldInput', 'storyPreviewToggle',
  ]) assert.match(html, new RegExp(`id="${id}"`));

  assert.match(html, /data-panel="stories"/);
  assert.match(html, /data-panel-page="stories"/);
  assert.ok(html.indexOf('id="storyTransport"') < html.indexOf('id="quickDock"'));
  assert.doesNotMatch(html, /id="quickDock"[^>]*data-story/);
  assert.doesNotMatch(html, /data-panel="timeline"|id="timeline/i);

  assert.match(controller, /StorySystem/);
  assert.match(controller, /StoryPlayer/);
  assert.match(controller, /#applyStoryStep/);
  assert.match(controller, /#startStoryChapter/);
  assert.match(controller, /resetStoryGroup/);
  assert.match(controller, /schemaVersion:\s*10/);
  assert.match(ui, /updateStories/);
  assert.match(ui, /updateStoryPlayer/);

  assert.match(product, /ProductExplosion/);
  assert.match(product, /prepareAnimationFrame/);
  assert.match(product, /isExplosionDynamic/);
  assert.match(explosion, /authored target state/);
  assert.match(explosion, /captureState/);
  assert.match(explosion, /applyExplodedState/);
  assert.match(explosion, /prepareFrame/);

  assert.match(grammar, /MAX_EXPLODE_STATES = 32/);
  assert.match(grammar, /MAX_ANIMATION_CHAPTERS = 32/);
  assert.match(grammar, /MAX_STORIES = 16/);
  assert.match(grammar, /MAX_STORY_STEPS = 48/);
  assert.match(grammar, /validateStoryReferences/);
  assert.match(stories, /createChapter/);
  assert.match(stories, /addStep/);
  assert.match(player, /phase = 'transition'/);
  assert.match(player, /phase = 'chapter'/);
  assert.match(player, /phase = 'hold'/);

  assert.match(motion, /playChapter/);
  assert.match(motion, /holdAtEnd/);
  assert.match(camera, /transitionToPose/);
  assert.match(camera, /pauseTransition/);
  assert.match(camera, /resumeTransition/);
  assert.match(camera, /normalizedTarget/);
  assert.match(camera, /poseDirection/);
  assert.match(camera, /distanceFactor/);
  assert.match(camera, /isTransitioning/);
  assert.match(explosion, /pauseTransition/);
  assert.match(explosion, /resumeTransition/);
  assert.match(player, /onPauseTransition/);
  assert.match(player, /onStopTransition/);
  assert.match(migration, /CURRENT_PROJECT_SCHEMA_VERSION = 10/);
  assert.match(migration, /sanitizeExplosionState/);
  assert.match(migration, /sanitizeStoryAuthoringState/);
  assert.match(presets, /explodeOffsets:\s*Object\.freeze/);
  assert.match(presets, /animationChapters:\s*Object\.freeze/);
  assert.match(presets, /stories:\s*Object\.freeze/);
  assert.match(presets, /storyPreviewEnabled:\s*false/);
  assert.match(support, /explodedStates/);
  assert.match(support, /animationChapters/);
  assert.match(support, /storySteps/);
  assert.match(styles, /\.story-transport/);
  assert.match(styles, /\.story-step-card/);
  assert.doesNotMatch(exporter, /storyTransport|story-transport|story-step-card/);
  assert.match(main, /v2\-1a\-stability/);
});

test('V2 publishes the canonical project into a branded read-only experience without adding a second renderer', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const controller = await readFile(resolve(root, 'src/app/AppController.js'), 'utf8');
  const ui = await readFile(resolve(root, 'src/ui/UIController.js'), 'utf8');
  const presets = await readFile(resolve(root, 'src/config/presets.js'), 'utf8');
  const migration = await readFile(resolve(root, 'src/persistence/ProjectMigration.js'), 'utf8');
  const runtime = await readFile(resolve(root, 'src/presentation/ExperienceRuntime.js'), 'utf8');
  const grammar = await readFile(resolve(root, 'src/presentation/ExperienceGrammar.js'), 'utf8');
  const codec = await readFile(resolve(root, 'src/presentation/ExperienceFileCodec.js'), 'utf8');
  const composer = await readFile(resolve(root, 'src/presentation/PresentationFrameComposer.js'), 'utf8');
  const ar = await readFile(resolve(root, 'src/presentation/ARHandoff.js'), 'utf8');
  const exporter = await readFile(resolve(root, 'src/export/FrameExporter.js'), 'utf8');
  const styles = await readFile(resolve(root, 'src/styles.css'), 'utf8');
  const main = await readFile(resolve(root, 'src/main.js'), 'utf8');

  for (const id of [
    'presentButton', 'openExperienceButton', 'publishExperienceButton', 'experienceFileInput',
    'presentationShell', 'presentationIntro', 'presentationNavigation', 'presentationOutro',
    'publishGroupStatus', 'experienceTitleInput', 'experienceStorySelect',
    'downloadExperienceButton', 'shareExperienceButton', 'copyExperienceLinkButton',
    'experienceAndroidGlbUrlInput', 'experienceIosUsdzUrlInput', 'testExperienceArButton',
  ]) assert.match(html, new RegExp(`id="${id}"`));

  assert.match(html, /data-panel="publish"/);
  assert.match(html, /data-panel-page="publish"/);
  assert.match(html, /data-export-presentation="1920x1080"/);
  assert.match(html, /\.productvis-show/);
  assert.match(main, /v2-1a-stability/);

  assert.match(controller, /ExperienceRuntime/);
  assert.match(controller, /PresentationFrameComposer/);
  assert.match(controller, /encodeExperienceFile/);
  assert.match(controller, /decodeExperienceFile/);
  assert.match(controller, /enterExperienceMode/);
  assert.match(controller, /openExperienceFile/);
  assert.match(controller, /publishExperience/);
  assert.match(controller, /#bootstrapExperienceFromLocation/);
  assert.match(ui, /updateExperienceEditor/);
  assert.match(ui, /updateExperienceRuntime/);
  assert.match(ui, /presentationSource/);
  assert.match(ui, /state\.source !== 'editor'/);
  assert.match(ui, /hasSecureArTarget/);
  assert.match(ui, /const presenting = document\.body\.classList\.contains\('presentation-mode'\)/);

  assert.match(presets, /schemaVersion:\s*10/);
  assert.match(presets, /experience:\s*DEFAULT_EXPERIENCE_STATE/);
  assert.match(migration, /CURRENT_PROJECT_SCHEMA_VERSION = 10/);
  assert.match(migration, /sanitizeExperienceState/);
  assert.match(grammar, /MAX_EXPERIENCE_LOGO_BYTES/);
  assert.match(runtime, /phase = 'editor'/);
  assert.match(runtime, /wantsIntro \? 'intro' : 'active'/);
  assert.match(runtime, /phase = 'active'/);
  assert.match(runtime, /phase = 'outro'/);
  assert.match(codec, /PVISSHOW1/);
  assert.match(codec, /createPublishedProject/);
  assert.match(codec, /original raw GLB|normalizedAsset\.bytes|assetOffset/);
  assert.match(composer, /captureFrame/);
  assert.match(composer, /layoutInfographicCards/);
  assert.match(exporter, /captureFrame/);
  assert.match(ar, /scene-viewer/);
  assert.match(ar, /rel = handoff\.rel/);
  assert.match(styles, /body\.presentation-mode/);
  assert.match(styles, /\.presentation-shell/);
  assert.doesNotMatch(controller, /new RendererEngine\([^)]*presentation/i);
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
  assert.equal(runtime.CONTACT_SHADOW_LAYER, 7);
  assert.match(loader, /DECODER_BASE_PATH/);
  assert.match(config, /public\/decoders\/three-\$\{THREE_VERSION\}\/draco/);
  assert.match(config, /public\/decoders\/three-\$\{THREE_VERSION\}\/basis/);
  assert.match(config, /Required decoder source not found/);
  assert.doesNotMatch(config, /console\.warn/);
});
