import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomizePresentation } from '../src/presentation.js';
import { DEFAULT_STATE, clone, makeProject, validateProject } from '../src/state.js';

const surface = { color: '#424752', overlay: .7, roughness: .32, metalness: .65, clearcoat: .25, opacity: 1, normalScale: .8, uvChannel: 1, finish: 'satin' };
const metadata = [
  { id: 'mat-7', rawName: 'body_paint', original: { ...surface } },
  { id: 'mat-8', rawName: 'windows', original: { ...surface, opacity: .4 } },
];
const setup = () => ({ ...clone(DEFAULT_STATE), name: 'Il mio prodotto', quality: 'fluid', selectedMaterial: 'mat-7', materials: { 'mat-7': { ...surface }, 'mat-8': { ...surface, opacity: .4 } } });

test('successive random presentations are distinct, valid and survive a project roundtrip', () => {
  let seed = 12, state = setup();
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const scenes = new Set();
  for (let i = 0; i < 180; i++) {
    const before = clone(state), next = randomizePresentation(state, metadata, { delta: 100, random });
    assert.notEqual(next.scene.preset, state.scene.preset);
    assert.deepEqual(state, before, 'the previous state remains available for one-step undo');
    assert.equal(next.name, state.name);
    assert.equal(next.quality, state.quality);
    assert.equal(next.selectedMaterial, state.selectedMaterial);
    assert.deepEqual(next.materials['mat-8'], state.materials['mat-8']);
    assert.equal(next.materials['mat-7'].uvChannel, 1);
    assert.equal(next.materials['mat-7'].normalScale, .8);
    assert.equal(next.materials['mat-7'].opacity, 1);
    const model = { type: 'demo', name: 'NSX', data: undefined };
    assert.deepEqual(validateProject(JSON.parse(JSON.stringify(makeProject(next, model)))), { state: next, model });
    scenes.add(next.scene.preset); state = next;
  }
  assert.equal(scenes.size, 6);
});

test('random does not recolor transparent surfaces, glass, lights or unknown selections', () => {
  for (const fixture of [
    { rawName: 'windows', opacity: 1 },
    { rawName: 'headlamp', opacity: 1 },
    { rawName: 'custom shell', opacity: .6 },
    { rawName: 'custom shell', opacity: 1, originalOpacity: .5 },
  ]) {
    const state = setup(); state.materials['mat-7'].opacity = fixture.opacity;
    const target = [{ id: 'mat-7', rawName: fixture.rawName, original: { opacity: fixture.originalOpacity ?? fixture.opacity } }];
    const next = randomizePresentation(state, target, { delta: 100, random: () => .5 });
    assert.deepEqual(next.materials, state.materials);
    assert.notEqual(next.scene.preset, state.scene.preset);
  }
  for (const state of [setup(), clone(DEFAULT_STATE)]) {
    const next = randomizePresentation(state, [], { delta: 100, random: () => 0 });
    assert.deepEqual(next.materials, state.materials, 'no phantom material is created');
  }
});

test('random clears stale focus and motion and cannot repeat a setup at RNG endpoints', () => {
  for (const value of [0, 1 - Number.EPSILON]) {
    let state = setup();
    state.camera.focusPoint = [1, 2, 3]; state.camera.autoFocus = false;
    state.motion = { ...state.motion, preset: 'orbit', playing: true };
    for (let i = 0; i < 8; i++) {
      const next = randomizePresentation(state, metadata, { delta: 100, random: () => value });
      assert.notEqual(next.scene.preset, state.scene.preset);
      assert.equal(next.motion.preset, 'still'); assert.equal(next.motion.playing, false);
      assert.equal(next.camera.autoFocus, true); assert.equal(next.camera.focusPoint, null);
      assert.notEqual(next.camera.preset, 'macro');
      assert.notEqual(next.materials['mat-7'].color, state.materials['mat-7'].color);
      assert.notEqual(next.materials['mat-7'].finish, state.materials['mat-7'].finish);
      state = next;
    }
  }
});

test('small deltas keep the same set and product while scaling the camera variation', () => {
  const state = setup();
  let previousDifference = 0;
  for (const delta of [1, 10, 20, 35]) {
    const next = randomizePresentation(state, metadata, { delta, random: () => .9 });
    assert.equal(next.scene.preset, state.scene.preset);
    assert.equal(next.scene.composition, state.scene.composition);
    assert.equal(next.scene.seed, state.scene.seed);
    assert.equal(next.scene.scale, state.scene.scale);
    assert.equal(next.lighting.preset, state.lighting.preset);
    assert.equal(next.lighting.tint, state.lighting.tint);
    assert.equal(next.camera.preset, state.camera.preset);
    assert.deepEqual(next.materials, state.materials);
    const difference = Math.abs(next.camera.azimuth - state.camera.azimuth);
    assert.ok(difference > previousDifference);
    assert.ok(difference <= 40 * delta / 100 + .1);
    previousDifference = difference;
  }
});

test('delta zero is unchanged, mid delta retains the environment, high delta changes it', () => {
  const state = setup();
  state.motion.playing = true; state.motion.preset = 'orbit';
  state.camera.autoFocus = false; state.camera.focusPoint = [1, 2, 3];
  assert.deepEqual(randomizePresentation(state, metadata, { delta: 0 }), state);
  for (const delta of [40, 55, 69, 70, 85, 100]) {
    const next = randomizePresentation(state, metadata, { delta, random: () => .5 });
    if (delta < 70) assert.equal(next.scene.preset, state.scene.preset);
    else assert.notEqual(next.scene.preset, state.scene.preset);
    assert.notEqual(next.camera.azimuth, state.camera.azimuth);
    assert.equal(next.motion.playing, false);
    assert.equal(next.camera.autoFocus, true);
    assert.equal(next.camera.focusPoint, null);
    assert.deepEqual(validateProject(makeProject(next, { type: 'demo', name: 'NSX' })).state, next);
  }
});

test('delta stays effective at camera limits and is persisted with compatible defaults', () => {
  for (const azimuth of [-180, 180]) for (const delta of [1, 35, 55, 100]) for (const sample of [0, .5, 1 - Number.EPSILON]) {
    const state = setup(); state.camera.azimuth = azimuth;
    const next = randomizePresentation(state, metadata, { delta, random: () => sample });
    assert.notEqual(next.camera.azimuth, azimuth);
    assert.deepEqual(validateProject(makeProject(next, { type: 'demo', name: 'NSX' })).state, next);
  }
  const state = setup(); state.randomDelta = 12;
  const next = randomizePresentation(state, metadata, { random: () => .5 });
  assert.equal(next.scene.preset, state.scene.preset);
  const project = makeProject(next, { type: 'demo', name: 'NSX' });
  assert.equal(validateProject(project).state.randomDelta, 12);
  delete project.state.randomDelta;
  assert.equal(validateProject(project).state.randomDelta, 35);
  for (const [value, expected] of [[-25, 0], [150, 100], [55.6, 56], [null, 35]]) {
    project.state.randomDelta = value;
    assert.equal(validateProject(project).state.randomDelta, expected);
  }
});
