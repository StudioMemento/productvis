import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOOK_PRESETS,
  LIGHT_PRESETS,
  DEFAULT_LOOK_ID,
  DEFAULT_BACKDROP_ID,
  DEFAULT_LIGHT_ID,
  DEFAULT_PROJECT_STATE,
  QUALITY_PROFILES,
  DEFAULT_GROUND_OFFSET,
  DEFAULT_CAMERA_TARGET,
} from '../src/config/presets.js';

test('neutral backdrop presets are ordered from white to black', () => {
  const ordered = ['white', 'light', 'gray', 'dark', 'black'];
  const tones = ordered.map((name) => LOOK_PRESETS[name].backdropTone);
  assert.deepEqual([...tones].sort((a, b) => b - a), tones);
  assert.equal(DEFAULT_LOOK_ID, 'gray');
  assert.equal(DEFAULT_BACKDROP_ID, 'gray');
  assert.equal(DEFAULT_PROJECT_STATE.studio.backdropTone, LOOK_PRESETS.gray.backdropTone);
});

test('backdrop changes do not mutate the lighting environment', () => {
  const stableFields = [
    'exposure',
    'environment',
    'environmentRotation',
    'key',
    'fill',
    'rim',
    'bloom',
    'shadow',
    'shadowSoftness',
  ];
  const reference = LOOK_PRESETS.gray;

  for (const preset of Object.values(LOOK_PRESETS)) {
    for (const field of stableFields) {
      assert.equal(preset[field], reference[field], `${field} must stay stable across backdrop tones`);
    }
  }
});

test('V1.4 simple light presets are distinct and remain restrained', () => {
  assert.equal(DEFAULT_LIGHT_ID, 'balanced');
  assert.deepEqual(Object.keys(LIGHT_PRESETS), ['soft', 'balanced', 'contrast']);
  assert.ok(LIGHT_PRESETS.soft.fill > LIGHT_PRESETS.balanced.fill);
  assert.ok(LIGHT_PRESETS.contrast.key > LIGHT_PRESETS.balanced.key);
  assert.ok(LIGHT_PRESETS.contrast.environment < LIGHT_PRESETS.balanced.environment);
  for (const preset of Object.values(LIGHT_PRESETS)) {
    assert.equal(preset.bloom, 0);
    assert.ok(preset.exposure >= 0.8 && preset.exposure <= 1.15);
    assert.ok(preset.shadow > 0);
    assert.ok(preset.shadowSoftness > 0);
  }
});

test('V1.6 defaults preserve the simple path and persistence contract', () => {
  assert.equal(DEFAULT_PROJECT_STATE.schemaVersion, 10);
  assert.equal(DEFAULT_PROJECT_STATE.studio.backdropPreset, 'gray');
  assert.equal(DEFAULT_PROJECT_STATE.studio.lightingPreset, 'balanced');
  assert.equal(DEFAULT_PROJECT_STATE.studio.bloom, 0);
  assert.equal(DEFAULT_PROJECT_STATE.studio.groundOffset, DEFAULT_GROUND_OFFSET);
  assert.deepEqual(DEFAULT_PROJECT_STATE.camera.target, DEFAULT_CAMERA_TARGET);
  assert.deepEqual(DEFAULT_PROJECT_STATE.model.materialSideOverrides, {});
  assert.deepEqual(DEFAULT_PROJECT_STATE.model.positionXZ, { x: 0, z: 0 });
  assert.equal(DEFAULT_PROJECT_STATE.camera.pose, null);
  assert.equal(DEFAULT_PROJECT_STATE.motion.time, 0);
  assert.equal(DEFAULT_PROJECT_STATE.motion.turntableAngle, 0);
  assert.equal(DEFAULT_PROJECT_STATE.render.exportFraming, 'match-viewport');
  assert.deepEqual(DEFAULT_PROJECT_STATE.configurator.partVisibility, {});
  assert.deepEqual(DEFAULT_PROJECT_STATE.configurator.states, []);
  assert.deepEqual(DEFAULT_PROJECT_STATE.configurator.anchors, []);
  assert.equal(DEFAULT_PROJECT_STATE.configurator.anchorDisplay, 'off');
  assert.deepEqual(DEFAULT_PROJECT_STATE.configurator.variantGroups, []);
  assert.deepEqual(DEFAULT_PROJECT_STATE.configurator.variantSelections, {});
  assert.deepEqual(DEFAULT_PROJECT_STATE.configurator.configurations, []);
  assert.equal(DEFAULT_PROJECT_STATE.configurator.activeConfigurationId, null);
  assert.deepEqual(DEFAULT_PROJECT_STATE.configurator.infographics, []);
  assert.equal(DEFAULT_PROJECT_STATE.configurator.infographicDisplay, 'off');
  assert.equal(DEFAULT_PROJECT_STATE.configurator.selectedInfographicId, null);
  assert.ok(DEFAULT_PROJECT_STATE.studio.exposure >= 0.8);
  assert.ok(DEFAULT_PROJECT_STATE.studio.exposure <= 1.15);
  assert.ok(DEFAULT_PROJECT_STATE.studio.shadow > 0);
  assert.ok(DEFAULT_PROJECT_STATE.studio.shadowSoftness > 0);
});

test('each quality profile defines a bounded contact-shadow budget', () => {
  const order = ['performance', 'balanced', 'quality'];
  const sizes = order.map((name) => QUALITY_PROFILES[name].contactShadowSize);
  assert.deepEqual([...sizes].sort((a, b) => a - b), sizes);

  for (const profile of Object.values(QUALITY_PROFILES)) {
    assert.ok(profile.contactShadowSize >= 128 && profile.contactShadowSize <= 1024);
    assert.ok(profile.contactShadowBlurPasses >= 1 && profile.contactShadowBlurPasses <= 2);
    assert.ok(profile.contactShadowDynamicFps >= 12 && profile.contactShadowDynamicFps <= 30);
  }
});
