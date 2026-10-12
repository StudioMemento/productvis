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

test('random clears stale focus, changes motion and cannot repeat a setup at RNG endpoints', () => {
  for (const value of [0, 1 - Number.EPSILON]) {
    let state = setup();
    state.camera.focusPoint = [1, 2, 3]; state.camera.autoFocus = false;
    state.motion = { ...state.motion, preset: 'orbit', playing: true };
    for (let i = 0; i < 8; i++) {
      const next = randomizePresentation(state, metadata, { delta: 100, random: () => value });
      assert.notEqual(next.scene.preset, state.scene.preset);
      assert.notEqual(next.motion.preset,state.motion.preset); assert.equal(next.motion.playing,true);
      assert.equal(next.camera.autoFocus, true); assert.equal(next.camera.focusPoint, null);
      assert.notEqual(next.camera.preset, state.camera.preset);
      assert.notEqual(next.lighting.preset, state.lighting.preset);
      assert.notDeepEqual(next.post, state.post);
      assert.notEqual(next.materials['mat-7'].color, state.materials['mat-7'].color);
      assert.notEqual(next.materials['mat-7'].finish, state.materials['mat-7'].finish);
      state = next;
    }
  }
});

test('every positive delta changes environment, shot type, lights and mood while preserving authored surfaces below 70', () => {
  const state=setup();
  for(const delta of [1,10,35,55,69,70,100])for(const value of [0,.5,1-Number.EPSILON]) {
    const next=randomizePresentation(state,metadata,{delta,random:()=>value});
    assert.notEqual(next.scene.preset,state.scene.preset);
    assert.notEqual(next.camera.preset,state.camera.preset);
    assert.notEqual(next.lighting.preset,state.lighting.preset);
    assert.notDeepEqual(next.post,state.post);
    if(delta<70)assert.deepEqual(next.materials,state.materials);
    assert.deepEqual(validateProject(makeProject(next,{type:'demo',name:'NSX'})).state,next);
  }
});

test('delta changes variation amplitude, zero preserves all state, and sparkle returns to the presentation', () => {
  const state=setup();state.motion.playing=true;state.motion.preset='orbit';
  state.camera.autoFocus=false;state.camera.focusPoint=[1,2,3];
  state.render.alpha=true;state.section.enabled=true;state.inspection.view='normals';
  assert.deepEqual(randomizePresentation(state,metadata,{delta:0}),state);
  const low=randomizePresentation(state,metadata,{delta:1,random:()=>.8});
  const high=randomizePresentation(state,metadata,{delta:100,random:()=>.8});
  assert.equal(low.camera.preset,high.camera.preset);
  assert.ok(Math.abs(high.lighting.rotation)>Math.abs(low.lighting.rotation));
  assert.ok(Math.abs(high.scene.scale-1)>Math.abs(low.scene.scale-1));
  for(const next of [low,high]) {
    assert.equal(next.motion.playing,true);assert.equal(next.camera.autoFocus,true);assert.equal(next.camera.focusPoint,null);
    assert.equal(next.render.alpha,false);assert.equal(next.inspection.view,'pbr');assert.equal(next.section.enabled,false);
    assert.equal(next.render.msaa,state.render.msaa);assert.equal(next.render.resolution,state.render.resolution);
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
  assert.notEqual(next.scene.preset, state.scene.preset);
  const project = makeProject(next, { type: 'demo', name: 'NSX' });
  assert.equal(validateProject(project).state.randomDelta, 12);
  delete project.state.randomDelta;
  assert.equal(validateProject(project).state.randomDelta, 35);
  for (const [value, expected] of [[-25, 0], [150, 100], [55.6, 56], [null, 35]]) {
    project.state.randomDelta = value;
    assert.equal(validateProject(project).state.randomDelta, expected);
  }
});
