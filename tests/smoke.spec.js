import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const runtimeErrors = new WeakMap();
const externalRequests = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = [];
  const external = [];
  runtimeErrors.set(page, errors);
  externalRequests.set(page, external);

  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http') && !['127.0.0.1', 'localhost'].includes(url.hostname)) {
      external.push(request.url());
    }
  });

  await page.goto('/');
  await page.waitForFunction(() => (
    window.__PRODUCT_VIS__?.store?.get('session.status') === 'ready'
  ));
  await expect(page.locator('html')).toHaveAttribute('data-product-vis-build', 'v2-1a-stability');
  await expect(page.locator('#modelName')).toHaveText('Demo Object');
  await expect(page.locator('#viewport')).toBeVisible();
});

test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page) || []).toEqual([]);
  expect(externalRequests.get(page) || []).toEqual([]);
});

test('simple path creates a useful shot without opening Advanced', async ({ page }) => {
  await expect(page.locator('#quickDock')).toBeVisible();
  await expect(page.locator('#controlPanel')).not.toHaveClass(/is-open/);
  await expect(page.locator('#panelToggle')).toHaveAttribute('aria-expanded', 'false');

  await page.locator('[data-backdrop="black"]').click();
  await expect(page.locator('[data-backdrop="black"]')).toHaveClass(/is-active/);
  await expect(page.locator('#backdropToneInput')).toHaveValue('0.025');

  await page.locator('[data-lighting="contrast"]').click();
  await expect(page.locator('[data-lighting="contrast"]')).toHaveClass(/is-active/);
  await expect(page.locator('#exposureInput')).toHaveValue('0.94');

  await page.locator('[data-camera="front"]').first().click();
  await expect(page.locator('[data-camera="front"]').first()).toHaveClass(/is-active/);

  await page.locator('#quickTurntableButton').click();
  await expect(page.locator('#quickTurntableButton')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#exportButton')).toBeVisible();

  const project = await page.evaluate(() => window.__PRODUCT_VIS__.store.snapshot().project);
  expect(project.studio.backdropPreset).toBe('black');
  expect(project.studio.lightingPreset).toBe('contrast');
  expect(project.camera.preset).toBe('front');
  expect(project.motion.turntable).toBe(true);
});

test('Advanced opens deliberately and reset restores the simple defaults', async ({ page }) => {
  await page.locator('#panelToggle').click();
  await expect(page.locator('#controlPanel')).toHaveClass(/is-open/);
  await expect(page.locator('#panelToggle')).toHaveAttribute('aria-expanded', 'true');

  await page.locator('[data-material="clay"]').click();
  await expect(page.locator('[data-material="clay"]')).toHaveClass(/is-active/);

  await page.evaluate(() => {
    window.__PRODUCT_VIS__.setAutoRotate(true);
    window.__PRODUCT_VIS__.setTurntable(true);
    window.__PRODUCT_VIS__.setScale(1.5);
    window.__PRODUCT_VIS__.setOffset(0.4);
  });

  await page.locator('#resetButton').click();
  await expect(page.locator('[data-backdrop="gray"]')).toHaveClass(/is-active/);
  await expect(page.locator('[data-lighting="balanced"]')).toHaveClass(/is-active/);
  await expect(page.locator('[data-material="original"]')).toHaveClass(/is-active/);
  await expect(page.locator('[data-camera="hero"]').first()).toHaveClass(/is-active/);
  await expect(page.locator('#autoRotateToggle')).not.toBeChecked();
  await expect(page.locator('#turntableToggle')).not.toBeChecked();
  await expect(page.locator('#quickTurntableButton')).toHaveAttribute('aria-pressed', 'false');

  const project = await page.evaluate(() => window.__PRODUCT_VIS__.store.snapshot().project);
  expect(project.model.materialMode).toBe('original');
  expect(project.model.userScale).toBe(1);
  expect(project.model.userOffset).toBe(0);
  expect(project.studio.preset).toBe('gray');
  expect(project.studio.backdropPreset).toBe('gray');
  expect(project.studio.lightingPreset).toBe('balanced');
  expect(project.studio.backdropTone).toBe(0.48);
  expect(project.studio.bloom).toBe(0);
  expect(project.camera.preset).toBe('hero');
  expect(project.camera.autoRotate).toBe(false);
  expect(project.motion.turntable).toBe(false);
});

test('backdrop and lighting presets remain independent', async ({ page }) => {
  const before = await page.evaluate(() => {
    const app = window.__PRODUCT_VIS__;
    return {
      environmentUuid: app.engine.scene.environment?.uuid,
      backgroundIsColor: Boolean(app.engine.scene.background?.isColor),
      environment: app.store.get('project.studio.environment'),
      backdropTone: app.store.get('project.studio.backdropTone'),
      bloom: app.engine.bloomPass.strength,
    };
  });

  await page.locator('[data-backdrop="white"]').click();
  await page.waitForTimeout(560);
  const afterBackdrop = await page.evaluate(() => ({
    environment: window.__PRODUCT_VIS__.store.get('project.studio.environment'),
    backdropTone: window.__PRODUCT_VIS__.store.get('project.studio.backdropTone'),
  }));

  await page.locator('[data-lighting="soft"]').click();
  await page.waitForTimeout(760);

  const afterLighting = await page.evaluate(() => {
    const app = window.__PRODUCT_VIS__;
    const sceneNames = [];
    app.engine.scene.traverse((object) => sceneNames.push(object.name));
    const shadow = app.studio.ground.contactShadow;
    return {
      environmentUuid: app.engine.scene.environment?.uuid,
      backgroundIsColor: Boolean(app.engine.scene.background?.isColor),
      backdropTone: app.store.get('project.studio.backdropTone'),
      environment: app.store.get('project.studio.environment'),
      hasLegacyCyclorama: sceneNames.includes('Product VIS Cyclorama'),
      hasBackgroundSphere: sceneNames.some((name) => /background/i.test(name)),
      contactShadowMap: Boolean(shadow.shadowPlane?.material?.map?.isTexture),
      contactShadowTarget: Boolean(shadow.renderTarget?.isWebGLRenderTarget),
      bloom: app.engine.bloomPass.strength,
    };
  });

  expect(before.backgroundIsColor).toBe(true);
  expect(afterLighting.backgroundIsColor).toBe(true);
  expect(afterLighting.environmentUuid).toBe(before.environmentUuid);
  expect(afterBackdrop.environment).toBe(before.environment);
  expect(afterBackdrop.backdropTone).toBe(0.965);
  expect(afterLighting.backdropTone).toBe(0.965);
  expect(afterLighting.environment).not.toBe(before.environment);
  expect(afterLighting.hasLegacyCyclorama).toBe(false);
  expect(afterLighting.hasBackgroundSphere).toBe(false);
  expect(afterLighting.contactShadowMap).toBe(true);
  expect(afterLighting.contactShadowTarget).toBe(true);
  expect(before.bloom).toBe(0);
  expect(afterLighting.bloom).toBe(0);
});

test('a self-contained GLB completes import, grounding and framing', async ({ page }) => {
  await page.setInputFiles('#fileInput', 'tests/fixtures/foundation-cube.glb');
  await expect(page.locator('#modelName')).toHaveText('foundation-cube');
  await expect(page.locator('#modelMeta')).toContainText('READY');
  await expect(page.locator('#loadingOverlay')).toBeHidden();

  await page.locator('#panelToggle').click();
  await page.locator('[data-panel="object"]').click();
  await expect(page.locator('#trianglesStat')).toHaveText('12');
  await expect(page.locator('#materialsStat')).toHaveText('1');
  await expect(page.locator('#animationsStat')).toHaveText('0');

  const metrics = await page.evaluate(() => {
    const app = window.__PRODUCT_VIS__;
    const { bounds, radius } = app.product.getMetrics();
    return {
      minY: bounds.min.y,
      maxY: bounds.max.y,
      radius,
      cameraDistance: app.engine.camera.position.distanceTo(app.cameraRig.controls.target),
    };
  });

  expect(Math.abs(metrics.minY)).toBeLessThan(0.01);
  expect(metrics.maxY).toBeGreaterThan(0);
  expect(metrics.radius).toBeGreaterThan(0);
  expect(metrics.cameraDistance).toBeGreaterThan(metrics.radius);

  const firstRootUuid = await page.evaluate(() => window.__PRODUCT_VIS__.product.sessionRoot.uuid);
  await page.setInputFiles('#fileInput', 'tests/fixtures/foundation-cube.glb');
  await page.waitForFunction((previousUuid) => (
    window.__PRODUCT_VIS__.product.sessionRoot?.uuid !== previousUuid
    && window.__PRODUCT_VIS__.store.get('session.status') === 'ready'
  ), firstRootUuid);

  const lifecycle = await page.evaluate((previousUuid) => {
    const app = window.__PRODUCT_VIS__;
    return {
      sessionRoots: app.engine.scene.children.filter(
        (child) => child.name === 'Product VIS Session Root',
      ).length,
      previousRootAttached: Boolean(app.engine.scene.getObjectByProperty('uuid', previousUuid)),
    };
  }, firstRootUuid);

  expect(lifecycle.sessionRoots).toBe(1);
  expect(lifecycle.previousRootAttached).toBe(false);
});



test('Advanced groups share project state and reset independently', async ({ page }) => {
  await page.locator('#panelToggle').click();
  await expect(page.locator('#controlPanel')).toHaveClass(/is-open/);

  await page.evaluate(() => {
    const app = window.__PRODUCT_VIS__;
    app.setEnvironmentRotation(Math.PI * 0.5);
    app.setFill(1.6);
    app.setGroundOffset(0.22);
    app.setShadowOpacity(0.77);
    app.setCameraTarget('x', 0.3);
    app.setCameraTarget('y', 0.68);
    app.setInspectMode(true);
    app.setScale(1.35);
    app.setTurntable(true);
  });

  await expect(page.locator('#panelToggle')).toHaveClass(/has-custom/);
  await expect(page.locator('#lookGroupStatus')).toHaveText('CUSTOM');
  await expect(page.locator('#objectGroupStatus')).toHaveText('CUSTOM');
  await expect(page.locator('#cameraGroupStatus')).toHaveText('CUSTOM');
  await expect(page.locator('#motionGroupStatus')).toHaveText('CUSTOM');

  await page.locator('#resetCameraGroupButton').click();
  let project = await page.evaluate(() => window.__PRODUCT_VIS__.store.snapshot().project);
  expect(project.camera.preset).toBe('hero');
  expect(project.camera.mode).toBe('presentation');
  expect(project.camera.target).toEqual({ x: 0, y: 0.47, z: 0 });
  expect(project.model.userScale).toBe(1.35);
  expect(project.motion.turntable).toBe(true);

  await page.locator('#resetLookGroupButton').click();
  await page.locator('#resetObjectGroupButton').click();
  await page.locator('#resetMotionGroupButton').click();

  project = await page.evaluate(() => window.__PRODUCT_VIS__.store.snapshot().project);
  expect(project.studio.backdropPreset).toBe('gray');
  expect(project.studio.lightingPreset).toBe('balanced');
  expect(project.studio.groundOffset).toBe(0);
  expect(project.model.userScale).toBe(1);
  expect(project.model.materialSideOverrides).toEqual({});
  expect(project.motion.turntable).toBe(false);
  await expect(page.locator('#panelToggle')).not.toHaveClass(/has-custom/);
});


test('portable project round-trips the embedded GLB and exact shot state', async ({ page }) => {
  await page.setInputFiles('#fileInput', 'tests/fixtures/foundation-cube.glb');
  await expect(page.locator('#modelName')).toHaveText('foundation-cube');

  await page.evaluate(() => {
    const app = window.__PRODUCT_VIS__;
    app.applyBackdropPreset('black', { immediate: true, showMessage: false });
    app.applyLightingPreset('contrast', { immediate: true, showMessage: false });
    app.setScale(1.42);
    app.setOffset(0.24);
    app.setCameraPreset('side', { immediate: true });
    app.setTurntable(true);
    app.setTurntableSpeed(0.01);
    app.motion.setTurntableAngle(0.83);
    app.setExportFraming('fill');
  });

  const downloadPromise = page.waitForEvent('download');
  await page.evaluate(() => window.__PRODUCT_VIS__.saveProject());
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.productvis$/);
  const projectPath = await download.path();
  expect(projectPath).toBeTruthy();

  await page.evaluate(() => {
    const app = window.__PRODUCT_VIS__;
    app.applyBackdropPreset('white', { immediate: true, showMessage: false });
    app.applyLightingPreset('soft', { immediate: true, showMessage: false });
    app.setScale(1);
    app.setOffset(0);
    app.setCameraPreset('hero', { immediate: true });
    app.setTurntable(false);
    app.setExportFraming('match');
  });

  await page.setInputFiles('#projectFileInput', projectPath);
  await page.waitForFunction(() => (
    window.__PRODUCT_VIS__.store.get('session.status') === 'ready'
    && window.__PRODUCT_VIS__.store.get('project.schemaVersion') === 10
    && window.__PRODUCT_VIS__.store.get('project.model.name') === 'foundation-cube'
  ));
  await expect(page.locator('#loadingOverlay')).toBeHidden();
  await expect(page.locator('#modelName')).toHaveText('foundation-cube');

  const restored = await page.evaluate(() => {
    const app = window.__PRODUCT_VIS__;
    return {
      project: app.store.snapshot().project,
      sourceKind: app.sourceAsset.kind,
      sourceBytes: app.sourceAsset.bytes?.byteLength || 0,
      transform: app.product.getTransformState(),
      motion: app.motion.getSerializableState(),
    };
  });

  expect(restored.sourceKind).toBe('embedded-glb');
  expect(restored.sourceBytes).toBeGreaterThan(20);
  expect(restored.project.studio.backdropPreset).toBe('black');
  expect(restored.project.studio.lightingPreset).toBe('contrast');
  expect(restored.project.camera.preset).toBe('side');
  expect(restored.project.render.exportFraming).toBe('fill');
  expect(restored.transform.userScale).toBeCloseTo(1.42, 5);
  expect(restored.transform.userOffset).toBeCloseTo(0.24, 5);
  expect(restored.motion.turntable).toBe(true);
  expect(restored.motion.turntableSpeed).toBeCloseTo(0.01, 5);
  expect(restored.motion.turntableAngle).toBeCloseTo(0.83, 1);
});

test('saved looks and export framing use the versioned project state', async ({ page }) => {
  await page.locator('#panelToggle').click();
  await page.locator('#savedLookNameInput').fill('Noir Product');
  await page.locator('[data-backdrop="black"]').click();
  await page.locator('[data-lighting="contrast"]').click();
  await page.locator('#saveLookButton').click();
  await expect(page.locator('#savedLookCount')).toHaveText('1 SAVED');
  await expect(page.locator('#savedLookSelect')).not.toHaveValue('');

  await page.locator('[data-backdrop="white"]').click();
  await page.locator('[data-lighting="soft"]').click();
  await page.locator('#applyLookButton').click();
  await expect(page.locator('[data-backdrop="black"]')).toHaveClass(/is-active/);
  await expect(page.locator('[data-lighting="contrast"]')).toHaveClass(/is-active/);
  await page.locator('#panelClose').click();

  await page.locator('#exportButton').click();
  await page.locator('[data-export-framing="fill"]').click();
  await expect(page.locator('[data-export-framing="fill"]')).toHaveClass(/is-active/);
  await expect(page.locator('#exportFramingNote')).toContainText('Fill');

  const project = await page.evaluate(() => window.__PRODUCT_VIS__.store.snapshot().project);
  expect(project.schemaVersion).toBe(10);
  expect(project.studio.backdropPreset).toBe('black');
  expect(project.studio.lightingPreset).toBe('contrast');
  expect(project.render.exportFraming).toBe('fill');
});

test('versioned local decoder assets are available', async ({ page }) => {
  const decoderStatus = await page.evaluate(async () => {
    const paths = [
      '/decoders/three-0.185.1/draco/draco_decoder.wasm',
      '/decoders/three-0.185.1/basis/basis_transcoder.wasm',
    ];
    return Promise.all(paths.map(async (path) => {
      const response = await fetch(path);
      return { path, ok: response.ok, status: response.status };
    }));
  });

  expect(decoderStatus).toEqual([
    { path: '/decoders/three-0.185.1/draco/draco_decoder.wasm', ok: true, status: 200 },
    { path: '/decoders/three-0.185.1/basis/basis_transcoder.wasm', ok: true, status: 200 },
  ]);
});

test('mobile Advanced sheet remains navigable', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'Mobile-only responsive checkpoint.');
  await page.locator('#panelToggle').click();
  await expect(page.locator('#controlPanel')).toHaveClass(/is-open/);
  await page.locator('#panelClose').click();
  await expect(page.locator('#controlPanel')).not.toHaveClass(/is-open/);
  await expect(page.locator('#quickDock')).toBeVisible();
});


test('Parts workspace authors visibility states and product-local anchors', async ({ page }) => {
  await page.locator('#panelToggle').click();
  await page.locator('.panel-tab[data-panel="structure"]').click();
  await expect(page.locator('[data-panel-page="structure"]')).toBeVisible();
  await expect(page.locator('#structurePartList .structure-part-select').first()).toBeVisible();

  await page.locator('#structurePartList .structure-part-select').first().click();
  await expect(page.locator('#selectedPartName')).not.toHaveText('No part selected');
  await page.locator('#toggleSelectedPartButton').click();
  await page.locator('#visibilityStateNameInput').fill('Hidden detail');
  await page.locator('#saveVisibilityStateButton').click();
  await expect(page.locator('#visibilityStateCount')).toContainText('1 SAVED');

  await page.locator('#anchorNameInput').fill('Detail anchor');
  await page.locator('#anchorSelectedPartButton').click();
  await expect(page.locator('#anchorCount')).toContainText('1 ANCHOR');
  await page.locator('[data-anchor-display="all"]').click();

  let project = await page.evaluate(() => window.__PRODUCT_VIS__.store.snapshot().project);
  expect(Object.keys(project.configurator.partVisibility).length).toBeGreaterThan(0);
  expect(project.configurator.states).toHaveLength(1);
  expect(project.configurator.anchors).toHaveLength(1);
  expect(project.configurator.anchorDisplay).toBe('all');

  await page.locator('#resetStructureGroupButton').click();
  project = await page.evaluate(() => window.__PRODUCT_VIS__.store.snapshot().project);
  expect(project.configurator.partVisibility).toEqual({});
  expect(project.configurator.states).toEqual([]);
  expect(project.configurator.anchors).toEqual([]);
  expect(project.configurator.anchorDisplay).toBe('off');
});

test('Health workspace reports the model and versions runtime preferences', async ({ page }) => {
  await page.locator('#panelToggle').click();
  await page.locator('.panel-tab[data-panel="health"]').click();
  await expect(page.locator('[data-panel-page="health"]')).toBeVisible();

  await expect(page.locator('#preflightScore')).not.toHaveText('—');
  await expect(page.locator('#preflightStatus')).toContainText(/READY|REVIEW|HEAVY/);
  await expect(page.locator('#runtimeQuality')).toContainText(/QUALITY|BALANCED|FAST/);
  await expect(page.locator('#preflightHudBadge')).toContainText(/READY|REVIEW|HEAVY/);

  await page.locator('#autoQualityToggle').uncheck();
  await page.locator('#pauseWhenHiddenToggle').uncheck();
  await expect(page.locator('#healthGroupStatus')).toContainText('CUSTOM');

  let project = await page.evaluate(() => window.__PRODUCT_VIS__.store.snapshot().project);
  expect(project.schemaVersion).toBe(10);
  expect(project.runtime.autoQuality).toBe(false);
  expect(project.runtime.pauseWhenHidden).toBe(false);
  expect(project.runtime.recoveryEnabled).toBe(true);

  await page.locator('#resetHealthGroupButton').click();
  project = await page.evaluate(() => window.__PRODUCT_VIS__.store.snapshot().project);
  expect(project.runtime).toEqual({
    autoQuality: true,
    pauseWhenHidden: true,
    recoveryEnabled: true,
  });
  await expect(page.locator('#healthGroupStatus')).not.toContainText('CUSTOM');
});

test('support report downloads local diagnostics without embedding asset bytes', async ({ page }) => {
  await page.locator('#panelToggle').click();
  await page.locator('.panel-tab[data-panel="health"]').click();

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#downloadSupportReportButton').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/-support\.json$/);
  const path = await download.path();
  expect(path).toBeTruthy();

  const report = JSON.parse(await readFile(path, 'utf8'));
  expect(report.appVersion).toBe('2.1.0-alpha.1');
  expect(report.project.schemaVersion).toBe(10);
  expect(report).not.toHaveProperty('assetBytes');
  expect(JSON.stringify(report)).not.toContain('data:application/octet-stream');
});

test('V1.8 authors a commercial variant and an anchored infographic from one canonical project state', async ({ page }) => {
  await page.locator('#panelToggle').click();
  await page.locator('.panel-tab[data-panel="structure"]').click();
  await page.locator('#structurePartList .structure-part-select').first().click();
  await expect(page.locator('#selectedPartName')).not.toHaveText('No part selected');

  await page.locator('#anchorNameInput').fill('Feature point');
  await page.locator('#anchorSelectedPartButton').click();
  await expect(page.locator('#anchorCount')).toContainText('1 ANCHOR');

  await page.locator('.panel-tab[data-panel="variants"]').click();
  await page.locator('#variantGroupNameInput').fill('Finish');
  await page.locator('#createVariantGroupButton').click();
  await expect(page.locator('#variantGroupCount')).toContainText('1 GROUP');
  await page.locator('#variantOptionNameInput').fill('Memento Orange');
  await page.locator('#variantColorInput').evaluate((input) => {
    input.value = '#ff7950';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#createVariantOptionButton').click();
  await expect(page.locator('#variantOptionCount')).toContainText('1 OPTION');
  await page.locator('#variantPreviewToggle').check();
  await expect(page.locator('#variantTray')).not.toHaveAttribute('hidden', '');

  await page.locator('.panel-tab[data-panel="info"]').click();
  await page.locator('#infographicTitleInput').fill('Precision detail');
  await page.locator('#infographicBodyInput').fill('This label stays attached to the product anchor.');
  await page.locator('#createInfographicButton').click();
  await expect(page.locator('#infographicCount')).toContainText('1 INFOGRAPHIC');
  await page.locator('[data-infographic-display="all"]').click();

  await page.locator('#presentationNameInput').fill('Hero story');
  await page.locator('#savePresentationButton').click();
  await expect(page.locator('#presentationCount')).toContainText('1 SAVED');
  const motionBeforePresentation = await page.evaluate(() => window.__PRODUCT_VIS__.store.snapshot().project.motion);
  await page.locator('#applyPresentationButton').click();
  const motionAfterPresentation = await page.evaluate(() => window.__PRODUCT_VIS__.store.snapshot().project.motion);
  expect(motionAfterPresentation).toEqual(motionBeforePresentation);

  await page.locator('#panelClose').click();
  await expect(page.locator('#infographicOverlay')).toHaveClass(/is-visible/);
  await expect(page.locator('#infographicOverlay .infographic-card')).toContainText('Precision detail');

  const state = await page.evaluate(() => window.__PRODUCT_VIS__.store.snapshot().project.configurator);
  expect(state.variantGroups).toHaveLength(1);
  expect(Object.keys(state.variantSelections)).toHaveLength(1);
  expect(state.variantPreviewEnabled).toBe(true);
  expect(state.infographics).toHaveLength(1);
  expect(state.presentations).toHaveLength(1);
  expect(state.infographics[0].anchorId).toBe(state.anchors[0].id);
  expect(state.infographicDisplay).toBe('all');
});

test('V1.9 composes and plays a deterministic product story without a timeline editor', async ({ page }) => {
  await page.locator('#panelToggle').click();
  await page.locator('.panel-tab[data-panel="stories"]').click();
  await expect(page.locator('[data-panel-page="stories"]')).toBeVisible();
  await expect(page.locator('[data-panel-page="timeline"]')).toHaveCount(0);

  const authored = await page.evaluate(() => {
    const app = window.__PRODUCT_VIS__;
    const report = app.product.getStructureReport();
    const part = report.records.find((record) => record.kind === 'mesh') || report.records[0];
    if (!part) throw new Error('Demo product has no authorable part.');

    app.selectPart(part.id);
    app.setSelectedExplode(0.65, 'auto');
    app.saveExplodedState('Service exploded');
    const exploded = app.product.getExplosionReport().explodeStates[0];

    app.createStory('Service reveal', false);
    const story = app.stories.getStory();
    app.addStoryStep(story.id, {
      name: 'Reveal components',
      explodeStateId: exploded.id,
      infographicDisplay: 'off',
      transitionDuration: 0.6,
      holdDuration: 0.2,
      easing: 'cinematic',
    });
    app.setStoryPreviewEnabled(true);

    return {
      partId: part.id,
      explodedId: exploded.id,
      storyId: story.id,
    };
  });

  await expect(page.locator('#explodeOffsetCount')).toContainText('1 PART');
  await expect(page.locator('#storyCount')).toContainText('1 STORY');
  await expect(page.locator('#storyStepCount')).toContainText('1 STEP');
  await expect(page.locator('#storyTransport')).toBeVisible();

  await page.locator('#storyPanelPlayButton').click();
  await expect(page.locator('#storyTransportStatus')).toContainText(/TRANSITION|HOLD/);
  await page.waitForTimeout(1200);
  await expect(page.locator('#storyTransportStatus')).toContainText('READY');

  const result = await page.evaluate(() => ({
    project: window.__PRODUCT_VIS__.store.snapshot().project,
    player: window.__PRODUCT_VIS__.storyPlayer.getState(),
  }));
  expect(result.project.schemaVersion).toBe(10);
  expect(result.project.configurator.explodeStates).toHaveLength(1);
  expect(result.project.configurator.animationChapters).toEqual([]);
  expect(result.project.configurator.stories).toHaveLength(1);
  expect(result.project.configurator.stories[0].steps).toHaveLength(1);
  expect(result.project.configurator.stories[0].steps[0].explodeStateId).toBe(authored.explodedId);
  expect(result.project.configurator.storyPreviewEnabled).toBe(true);
  expect(result.player.playing).toBe(false);
  expect(result.player.phase).toBe('idle');
});


test('V2 enters a separate branded read-only presentation and restores the editor on exit', async ({ page }) => {
  const before = await page.evaluate(() => ({
    project: window.__PRODUCT_VIS__.store.snapshot().project,
    cameraInteraction: window.__PRODUCT_VIS__.cameraRig.interactionEnabled,
  }));

  await page.locator('#presentButton').click();
  await expect(page.locator('body')).toHaveClass(/presentation-mode/);
  await expect(page.locator('#presentationShell')).toBeVisible();
  await expect(page.locator('#presentationIntro')).toBeVisible();
  await expect(page.locator('#controlPanel')).not.toHaveClass(/is-open/);
  await expect(page.locator('#quickDock')).toBeHidden();

  await page.locator('#presentationStartButton').click();
  await expect(page.locator('#presentationIntro')).toBeHidden();
  await expect(page.locator('#presentationNavigation')).toBeVisible();
  await expect(page.locator('#presentationStoryName')).toContainText(/PRODUCT STORY|Explore/i);

  const active = await page.evaluate(() => ({
    runtime: window.__PRODUCT_VIS__.experienceRuntime.getState(),
    schema: window.__PRODUCT_VIS__.store.get('project.schemaVersion'),
  }));
  expect(active.schema).toBe(10);
  expect(active.runtime.active).toBe(true);
  expect(active.runtime.phase).toBe('active');
  expect(active.runtime.profile.title).toBe('Product Experience');

  await page.locator('#presentationExitButton').click();
  await expect(page.locator('body')).not.toHaveClass(/presentation-mode/);
  await expect(page.locator('#presentationShell')).toBeHidden();
  await expect(page.locator('#quickDock')).toBeVisible();

  const after = await page.evaluate(() => ({
    project: window.__PRODUCT_VIS__.store.snapshot().project,
    runtime: window.__PRODUCT_VIS__.experienceRuntime.getState(),
    cameraInteraction: window.__PRODUCT_VIS__.cameraRig.interactionEnabled,
  }));
  expect(after.runtime.active).toBe(false);
  expect(after.runtime.phase).toBe('editor');
  expect(after.cameraInteraction).toBe(true);
  expect(after.project.model).toEqual(before.project.model);
  expect(after.project.studio).toEqual(before.project.studio);
  expect(after.project.camera).toEqual(before.project.camera);
});
