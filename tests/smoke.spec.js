import { test, expect } from '@playwright/test';

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
  await expect(page.locator('html')).toHaveAttribute('data-product-vis-build', 'v1.1-foundation');
  await expect(page.locator('#modelName')).toHaveText('Demo Object');
  await expect(page.locator('#viewport')).toBeVisible();
});

test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page) || []).toEqual([]);
  expect(externalRequests.get(page) || []).toEqual([]);
});

test('core controls remain wired after the foundation refactor', async ({ page }) => {
  await page.locator('[data-preset="soft"]').click();
  await expect(page.locator('[data-preset="soft"]')).toHaveClass(/is-active/);
  await expect(page.locator('#exposureInput')).toHaveValue('0.94');

  await page.locator('[data-camera="front"]').first().click();
  await expect(page.locator('[data-camera="front"]').first()).toHaveClass(/is-active/);

  await page.locator('[data-material="clay"]').click();
  await expect(page.locator('[data-material="clay"]')).toHaveClass(/is-active/);

  await page.evaluate(() => {
    window.__PRODUCT_VIS__.setAutoRotate(true);
    window.__PRODUCT_VIS__.setTurntable(true);
    window.__PRODUCT_VIS__.setScale(1.5);
    window.__PRODUCT_VIS__.setOffset(0.4);
  });

  await page.locator('#resetButton').click();
  await expect(page.locator('[data-preset="studio"]')).toHaveClass(/is-active/);
  await expect(page.locator('[data-material="original"]')).toHaveClass(/is-active/);
  await expect(page.locator('[data-camera="hero"]').first()).toHaveClass(/is-active/);
  await expect(page.locator('#autoRotateToggle')).not.toBeChecked();
  await expect(page.locator('#turntableToggle')).not.toBeChecked();

  const project = await page.evaluate(() => window.__PRODUCT_VIS__.store.snapshot().project);
  expect(project.model.materialMode).toBe('original');
  expect(project.model.userScale).toBe(1);
  expect(project.model.userOffset).toBe(0);
  expect(project.studio.preset).toBe('studio');
  expect(project.camera.preset).toBe('hero');
  expect(project.camera.autoRotate).toBe(false);
  expect(project.motion.turntable).toBe(false);
});

test('a self-contained GLB completes import, grounding and framing', async ({ page }) => {
  await page.setInputFiles('#fileInput', 'tests/fixtures/foundation-cube.glb');
  await expect(page.locator('#modelName')).toHaveText('foundation-cube');
  await expect(page.locator('#modelMeta')).toContainText('READY');
  await expect(page.locator('#loadingOverlay')).toBeHidden();
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

test('mobile control sheet remains navigable', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'Mobile-only responsive checkpoint.');
  await page.locator('#panelToggle').click();
  await expect(page.locator('#controlPanel')).toHaveClass(/is-open/);
  await page.locator('#panelClose').click();
  await expect(page.locator('#controlPanel')).not.toHaveClass(/is-open/);
});
