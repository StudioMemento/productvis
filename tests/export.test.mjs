import test from 'node:test';
import assert from 'node:assert/strict';
import { computeExportFramePlan, scaleExportFramePlanForGpu } from '../src/export/ExportFramePlan.js';

test('Match export preserves a 16:9 viewport inside a square output', () => {
  const plan = computeExportFramePlan({ viewportWidth: 1600, viewportHeight: 900, outputWidth: 2048, outputHeight: 2048, mode: 'match' });
  assert.equal(plan.renderWidth, 2048);
  assert.equal(plan.renderHeight, 1152);
  assert.deepEqual(plan.destination, { x: 0, y: 448, width: 2048, height: 1152 });
  assert.equal(plan.hasBars, true);
});

test('Fill export center-crops a 16:9 viewport into portrait output', () => {
  const plan = computeExportFramePlan({ viewportWidth: 1600, viewportHeight: 900, outputWidth: 2160, outputHeight: 2700, mode: 'fill' });
  assert.equal(plan.renderWidth, 4800);
  assert.equal(plan.renderHeight, 2700);
  assert.deepEqual(plan.source, { x: 1320, y: 0, width: 2160, height: 2700 });
  assert.deepEqual(plan.destination, { x: 0, y: 0, width: 2160, height: 2700 });
  assert.equal(plan.hasBars, false);
});

test('same-aspect Match export uses the complete output without padding', () => {
  const plan = computeExportFramePlan({ viewportWidth: 1920, viewportHeight: 1080, outputWidth: 3840, outputHeight: 2160, mode: 'match' });
  assert.equal(plan.renderWidth, 3840);
  assert.equal(plan.renderHeight, 2160);
  assert.deepEqual(plan.destination, { x: 0, y: 0, width: 3840, height: 2160 });
  assert.equal(plan.hasBars, false);
});


test('oversized Fill export is scaled safely to the GPU limit without changing composition', () => {
  const base = computeExportFramePlan({ viewportWidth: 1600, viewportHeight: 900, outputWidth: 2160, outputHeight: 2700, mode: 'fill' });
  const plan = scaleExportFramePlanForGpu(base, 4096);
  assert.equal(plan.renderWidth, 4096);
  assert.equal(plan.renderHeight, 2304);
  assert.equal(plan.scaledForGpu, true);
  assert.equal(plan.destination.width, 2160);
  assert.equal(plan.destination.height, 2700);
  assert.ok(Math.abs((plan.source.x / plan.renderWidth) - (base.source.x / base.renderWidth)) < 1e-9);
  assert.ok(Math.abs((plan.source.width / plan.renderWidth) - (base.source.width / base.renderWidth)) < 1e-9);
});

test('GPU scaling leaves plans under the texture limit unchanged', () => {
  const base = computeExportFramePlan({ viewportWidth: 1600, viewportHeight: 900, outputWidth: 2048, outputHeight: 2048, mode: 'match' });
  const plan = scaleExportFramePlanForGpu(base, 4096);
  assert.equal(plan.renderWidth, base.renderWidth);
  assert.equal(plan.renderHeight, base.renderHeight);
  assert.equal(plan.renderScale, 1);
  assert.equal(plan.scaledForGpu, false);
});
