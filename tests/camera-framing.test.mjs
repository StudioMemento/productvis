import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  computeClipRange,
  computeFitDistanceToBounds,
  isFiniteBox3,
  resolveFramingMetrics,
} from '../src/camera/CameraFraming.js';
import { computeVisibleBounds } from '../src/model/VisibleBounds.js';

function assertCornersInside(camera, bounds, tolerance = 1.001) {
  const { min, max } = bounds;
  for (const x of [min.x, max.x]) {
    for (const y of [min.y, max.y]) {
      for (const z of [min.z, max.z]) {
        const point = new THREE.Vector3(x, y, z).project(camera);
        assert.ok(Math.abs(point.x) <= tolerance, `x ${point.x} should fit`);
        assert.ok(Math.abs(point.y) <= tolerance, `y ${point.y} should fit`);
      }
    }
  }
}

test('box-aware fitting keeps every bound corner inside the viewport', () => {
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.01, 100);
  const bounds = new THREE.Box3(
    new THREE.Vector3(-2.4, -0.8, -1),
    new THREE.Vector3(2.4, 1.2, 1),
  );
  const target = bounds.getCenter(new THREE.Vector3());
  const direction = new THREE.Vector3(0, 0.18, 1).normalize();
  const distance = computeFitDistanceToBounds(camera, bounds, target, direction, { padding: 1.02 });

  assert.ok(Number.isFinite(distance));
  camera.position.copy(target).add(direction.clone().multiplyScalar(distance));
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  assertCornersInside(camera, bounds);
});

test('portrait framing moves farther back for a wide product and clipping stays finite', () => {
  const bounds = new THREE.Box3(
    new THREE.Vector3(-3, -1, -0.8),
    new THREE.Vector3(3, 1, 0.8),
  );
  const target = bounds.getCenter(new THREE.Vector3());
  const direction = new THREE.Vector3(0, 0.12, 1).normalize();
  const landscape = new THREE.PerspectiveCamera(50, 16 / 9, 0.01, 100);
  const portrait = new THREE.PerspectiveCamera(50, 9 / 16, 0.01, 100);
  const landscapeDistance = computeFitDistanceToBounds(landscape, bounds, target, direction);
  const portraitDistance = computeFitDistanceToBounds(portrait, bounds, target, direction);

  assert.ok(portraitDistance > landscapeDistance);
  portrait.position.copy(target).add(direction.clone().multiplyScalar(portraitDistance));
  portrait.lookAt(target);
  portrait.updateMatrixWorld(true);
  const clip = computeClipRange(portrait, bounds, { target, mode: 'presentation' });
  assert.ok(clip.near > 0);
  assert.ok(clip.far > clip.near);
  assert.ok(Number.isFinite(clip.far));
});

test('framing metrics prefer robust visible bounds and reject invalid boxes', () => {
  const root = new THREE.Group();
  const full = new THREE.Box3(new THREE.Vector3(-100, -1, -1), new THREE.Vector3(100, 1, 1));
  const framing = new THREE.Box3(new THREE.Vector3(-2, -1, -1), new THREE.Vector3(2, 1, 1));
  const resolved = resolveFramingMetrics({ root, bounds: full, radius: 100, framingBounds: framing, framingRadius: 2.5, framingSource: 'robust-core' });
  assert.equal(resolved.bounds, framing);
  assert.equal(resolved.radius, 2.5);
  assert.equal(resolved.boundsSource, 'robust-core');
  assert.equal(isFiniteBox3(new THREE.Box3()), false);
});

test('visible bounds keep the exact product box but trim a pathological rogue vertex for camera framing', () => {
  const root = new THREE.Group();
  const product = new THREE.Mesh(
    new THREE.BoxGeometry(4, 1.5, 2, 14, 8, 8),
    new THREE.MeshStandardMaterial({ opacity: 1 }),
  );
  product.name = 'Product body';
  root.add(product);

  const rogueGeometry = new THREE.BufferGeometry();
  rogueGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    1000, 0, 0,
    1000.01, 0, 0,
    1000, 0.01, 0,
  ], 3));
  const rogue = new THREE.Mesh(rogueGeometry, new THREE.MeshStandardMaterial());
  rogue.name = 'Malformed export fragment';
  root.add(rogue);

  const report = computeVisibleBounds(root, { isVisible: () => true, allowRobustTrim: true });
  assert.equal(report.robustTrimmed, true);
  assert.equal(report.source, 'robust-core');
  assert.ok(report.fullBounds.max.x > 900);
  assert.ok(report.framingBounds.max.x < 10);
  assert.ok(report.outlierRatio > 4.5);
});
