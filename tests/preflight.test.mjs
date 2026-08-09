import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeModelPreflight } from '../src/health/ModelPreflightAnalyzer.js';

function geometry({ vertices = 300, indexedTriangles = 100, normals = true, uvs = true } = {}) {
  const attributes = {
    position: { count: vertices },
    ...(normals ? { normal: { count: vertices } } : {}),
    ...(uvs ? { uv: { count: vertices } } : {}),
  };
  return {
    index: indexedTriangles === null ? null : { count: indexedTriangles * 3 },
    getAttribute(name) { return attributes[name] || null; },
  };
}

function texture(width, height, options = {}) {
  return {
    isTexture: true,
    source: { data: { width, height } },
    generateMipmaps: options.generateMipmaps ?? true,
  };
}

function asset(nodes) {
  return {
    traverse(callback) { nodes.forEach(callback); },
  };
}

test('clean realtime asset receives a ready preflight report', () => {
  const report = analyzeModelPreflight(asset([
    { scale: { x: 1, y: 1, z: 1 } },
    {
      isMesh: true,
      visible: true,
      scale: { x: 1, y: 1, z: 1 },
      geometry: geometry({ vertices: 600, indexedTriangles: 200 }),
      material: { name: 'Body', map: texture(1024, 1024) },
    },
  ]), { fileSize: 8 * 1024 * 1024, animations: [] });

  assert.equal(report.status, 'ready');
  assert.equal(report.score, 100);
  assert.equal(report.metrics.meshes, 1);
  assert.equal(report.metrics.drawCalls, 1);
  assert.equal(report.metrics.triangles, 200);
  assert.equal(report.metrics.maxTextureDimension, 1024);
  assert.equal(report.issues.length, 0);
});

test('heavy geometry and material fragmentation produce critical guidance', () => {
  const materials = Array.from({ length: 330 }, (_, index) => ({ name: `Mat ${index}` }));
  const report = analyzeModelPreflight(asset([
    {
      isMesh: true,
      visible: true,
      scale: { x: 1, y: 1, z: 1 },
      geometry: geometry({ vertices: 3_000_000, indexedTriangles: 2_100_000 }),
      material: materials,
    },
  ]), { fileSize: 280 * 1024 * 1024 });

  assert.equal(report.status, 'heavy');
  assert.ok(report.score < 50);
  assert.ok(report.issues.some((issue) => issue.id === 'triangles-critical'));
  assert.ok(report.issues.some((issue) => issue.id === 'draw-calls-critical'));
  assert.ok(report.issues.some((issue) => issue.id === 'file-size-critical'));
});

test('preflight detects missing normals, UVs and texture limits without mutating the asset', () => {
  const oversized = texture(8192, 4096);
  const mesh = {
    isMesh: true,
    visible: true,
    scale: { x: -1, y: 1, z: 1 },
    geometry: geometry({ normals: false, uvs: false }),
    material: { name: 'Mapped surface', map: oversized },
  };
  const report = analyzeModelPreflight(asset([mesh]), { maxTextureSize: 4096, deviceMemory: 4 });

  assert.equal(report.status, 'heavy');
  assert.equal(report.metrics.missingNormals, 1);
  assert.equal(report.metrics.missingUvs, 1);
  assert.equal(report.metrics.negativeScaleNodes, 1);
  assert.ok(report.issues.some((issue) => issue.id === 'texture-limit-critical'));
  assert.ok(report.issues.some((issue) => issue.id === 'missing-normals-warning'));
  assert.equal(mesh.material.map, oversized);
});
