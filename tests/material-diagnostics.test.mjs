import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMaterialDiagnostics, materialSideName } from '../src/model/MaterialDiagnostics.js';

function createAsset(meshes) {
  return {
    traverse(callback) {
      meshes.forEach(callback);
    },
  };
}

function eachMaterial(materialOrArray, callback) {
  if (Array.isArray(materialOrArray)) materialOrArray.forEach(callback);
  else callback(materialOrArray);
}

test('material diagnostics classify stable unique materials and preserve original sides', () => {
  const opaque = { name: 'Paint', side: 0, opacity: 1, transparent: false, userData: {} };
  const label = { name: 'Paper label', side: 0, alphaTest: 0.5, opacity: 1, userData: {} };
  const glass = { name: 'Window glass', side: 0, transmission: 1, transparent: true, userData: {} };
  const double = { name: 'Fabric strap', side: 2, opacity: 1, userData: {} };
  const asset = createAsset([
    { isMesh: true, name: 'Body', material: opaque },
    { isMesh: true, name: 'Repeated Body', material: opaque },
    { isMesh: true, name: 'Flat Label', material: [label, glass] },
    { isMesh: true, name: 'Strap', material: double },
  ]);

  const report = analyzeMaterialDiagnostics(asset, { forEachMaterial: eachMaterial });

  assert.equal(report.totalSlots, 5);
  assert.equal(report.uniqueMaterials, 4);
  assert.equal(report.alphaMasked, 1);
  assert.equal(report.glass, 1);
  assert.equal(report.doubleSided, 1);
  assert.equal(report.backfaceCandidates, 1);
  assert.equal(report.health, 'review');

  const [paintReport, labelReport, glassReport, strapReport] = report.materials;
  assert.equal(paintReport.id, 1);
  assert.equal(opaque.userData.pvDiagnosticId, 1);
  assert.equal(labelReport.originalSide, 'front');
  assert.equal(labelReport.safeBackfaceCandidate, true);
  assert.equal(labelReport.recommendedSide, 'double');
  assert.equal(glassReport.glassLike, true);
  assert.equal(glassReport.safeBackfaceCandidate, false, 'glass must not be blanket repaired');
  assert.equal(strapReport.originalSide, 'double');
  assert.equal(strapReport.safeBackfaceCandidate, false);
});

test('material side labels map Three.js numeric side values without importing Three.js', () => {
  assert.equal(materialSideName(0), 'front');
  assert.equal(materialSideName(1), 'back');
  assert.equal(materialSideName(2), 'double');
  assert.equal(materialSideName(undefined), 'front');
});

test('empty diagnostics are deterministic and serializable', () => {
  const report = analyzeMaterialDiagnostics(null, { forEachMaterial: eachMaterial });
  assert.equal(report.uniqueMaterials, 0);
  assert.equal(report.health, 'safe');
  assert.deepEqual(report.materials, []);
  assert.doesNotThrow(() => JSON.stringify(report));
});
