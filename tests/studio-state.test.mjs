import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_STATE, PRESETS, applyPreset, clone, makeProject, validateProject } from '../src/state.js';
import { motionSample } from '../src/motion.js';

test('every preset preserves the other categories and the original state', () => {
  const base = clone(DEFAULT_STATE);
  base.materials = { 'mat-7': { color: '#923344', overlay: .7, roughness: .8, metalness: .2, finish: 'matte' } };
  base.selectedMaterial = 'mat-7';
  const original = { color: '#123456', overlay: 0, roughness: .2, metalness: .5, finish: 'original' };
  const snapshot = clone(base);
  for (const [category, presets] of Object.entries(PRESETS)) {
    for (const preset of presets) {
      const next = applyPreset(base, category, preset.id, original);
      for (const key of ['scene', 'lighting', 'camera', 'motion', 'materials']) {
        if (key !== (category === 'product' ? 'materials' : category)) assert.deepEqual(next[key], base[key]);
      }
      assert.deepEqual(base, snapshot);
    }
  }
});

test('camera presets pause camera motion without changing material or scene', () => {
  const base = applyPreset(clone(DEFAULT_STATE), 'motion', 'orbit');
  const result = applyPreset(base, 'camera', 'macro');
  assert.equal(result.motion.playing, false);
  assert.equal(result.motion.preset, 'orbit');
  assert.deepEqual(result.scene, base.scene);
});

test('save and open retain every adjustable value and embedded model descriptor', () => {
  const state = clone(DEFAULT_STATE);
  state.name = 'Studio è 03'; state.motion.travel = .45;
  state.camera.focusPoint = [1, .4, -2];
  state.materials = { 'mat-7': { finish: 'satin', color: '#ddeeff', overlay: .7, roughness: .4, metalness: .5, clearcoat: .8, opacity: .9, uvChannel: 1, normalScale: .6 } };
  state.selectedMaterial = 'mat-7';
  const model = { type: 'embedded', name: 'Product', data: 'data:model/gltf-binary;base64,Z2xURg==' };
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(makeProject(state, model)))), { state, model });
});

test('untrusted projects reject incompatible formats and clamp unsafe parameters', () => {
  assert.throws(() => validateProject({ format: 'other' }));
  const project = makeProject(clone(DEFAULT_STATE), { type: 'demo', name: 'NSX' });
  project.state.camera.focal = 1e12; project.state.scene.scale = -99;
  project.state.materials = { '__proto__': { overlay: 1 }, 'mat-7': { overlay: 9, color: 'red' } };
  const valid = validateProject(project).state;
  assert.equal(valid.camera.focal, 150); assert.equal(valid.scene.scale, .55);
  assert.equal(valid.materials['mat-7'].overlay, 1); assert.equal(valid.materials['mat-7'].color, undefined);
  project.model = { type: 'embedded', data: 'https://external.test/model.glb' };
  assert.throws(() => validateProject(project));
});

test('bounded motion loops return to origin; one-shot motion stops at endpoint', () => {
  const motion = { ...DEFAULT_STATE.motion, preset: 'turntable', amplitude: 90 };
  assert.equal(motionSample(motion, 0).angle, 0);
  assert.ok(Math.abs(motionSample(motion, 4.5).angle - Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(motionSample(motion, 9).angle) < 1e-9);
  const end = motionSample({ ...motion, loop: false }, 99);
  assert.equal(end.ended, true); assert.equal(end.angle, Math.PI / 2);
});

test('dolly responds to direction and travel while maintaining positive distance', () => {
  const motion = { ...DEFAULT_STATE.motion, preset: 'dolly', travel: .6, loop: false };
  assert.equal(motionSample(motion, 6).dolly, .4);
  assert.equal(motionSample({ ...motion, direction: -1 }, 6).dolly, 1.6);
  assert.equal(motionSample(motion, 6).ended, true);
});
