import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Box3 } from 'three';
import { snapValue, dragValue } from '../src/controlMath.js';
import { cubeLayout, createCubeStage, PLINTH_SIZE } from '../src/cubeStage.js';
import { DEFAULT_STATE } from '../src/state.js';

test('knob gestures clamp at endpoints and quantize fractional or negative ranges', () => {
  assert.equal(dragValue(.5, 180, 0, 1, .01), 1);
  assert.equal(dragValue(.5, -180, 0, 1, .01), 0);
  assert.equal(snapValue(-.26, -2, 2, .1), -.3);
  assert.equal(snapValue(2.19, 1.4, 16, .2), 2.2);
  assert.equal(snapValue(16, 1.4, 16, .2), 16);
  assert.ok(dragValue(50, 20, 18, 150, 1, true) < dragValue(50, 20, 18, 150, 1));
});

test('architectural cubes stay outside the product platform at all supported scales', () => {
  for (const composition of [0,1,2]) for (const seed of [0,12,9999,100000]) for (const scale of [.55,1,1.5]) {
    const cubes = cubeLayout(composition,seed,scale);
    assert.deepEqual(cubes,cubeLayout(composition,seed,scale));
    for (const cube of cubes) {
      const boundary = PLINTH_SIZE/2 + cube.side/2;
      assert.ok(Math.abs(cube.x) > boundary || Math.abs(cube.z) > boundary);
      assert.ok(cube.side > 0 && Number.isFinite(cube.y));
    }
  }
});

test('the product plinth is a true cube with its top at the product contact plane', () => {
  const { group, baseMaterial } = createCubeStage(DEFAULT_STATE.scene);
  const plinth = group.getObjectByName('Product plinth');
  group.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(plinth);
  assert.ok(Math.abs(bounds.max.y) < .00001);
  assert.ok(Math.abs(bounds.min.y + PLINTH_SIZE) < .00001);
  assert.ok(Math.abs(bounds.max.x - bounds.min.x - PLINTH_SIZE) < .00001);
  assert.ok(Math.abs(bounds.max.z - bounds.min.z - PLINTH_SIZE) < .00001);
  assert.equal(baseMaterial.roughness, DEFAULT_STATE.scene.floorRoughness);
  group.traverse(node => { node.geometry?.dispose(); node.material?.dispose(); });
});
