import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { analyzeMaterialDiagnostics, materialSideName } from '../src/model/MaterialDiagnostics.js';
import { ProductSession } from '../src/model/ProductSession.js';

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
  assert.equal(report.depthWriteRisks, 1);
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
  assert.equal(glassReport.transparentDepthRisk, true);
  assert.equal(glassReport.safeBackfaceCandidate, false, 'glass must not be blanket repaired');
  assert.equal(strapReport.originalSide, 'double');
  assert.equal(strapReport.safeBackfaceCandidate, false);
});

test('material side labels map Three.js numeric side values without importing Three.js', () => {
  assert.equal(materialSideName(0), 'front');
  assert.equal(materialSideName(1), 'flip');
  assert.equal(materialSideName(2), 'double');
  assert.equal(materialSideName(undefined), 'front');
});

test('Auto restores the imported side while suggested repairs become explicit Double overrides', () => {
  const scene = new THREE.Scene();
  const material = new THREE.MeshStandardMaterial({ name: 'Paper panel', side: THREE.FrontSide, alphaTest: 0.5 });
  const asset = new THREE.Group();
  asset.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 1), material));
  const product = new ProductSession({
    scene,
    renderer: { capabilities: { getMaxAnisotropy: () => 1 } },
  });
  product.setModel(asset, { name: 'Thin panel' });
  const materialId = product.getMaterialDiagnostics().materials[0].id;

  product.setBackfaceRepairEnabled(true);
  assert.equal(material.side, THREE.DoubleSide);
  assert.equal(product.getMaterialSideOverrides()[materialId], 'double');

  const suggestedOverrides = product.getMaterialSideOverrides();
  const suggestedIds = product.getSuggestedMaterialSideOverrideIds();
  product.setMaterialSideOverrides(suggestedOverrides, { suggestedIds });
  assert.equal(product.getMaterialDiagnostics().suggestedOverrides, 1);
  product.setBackfaceRepairEnabled(false);
  assert.equal(material.side, THREE.FrontSide);
  assert.equal(product.getMaterialSideOverrides()[materialId], undefined);

  product.setMaterialSideOverride(materialId, 'double');
  product.setBackfaceRepairEnabled(true);
  product.setBackfaceRepairEnabled(false);
  assert.equal(material.side, THREE.DoubleSide, 'manual Double must survive disabling suggestions');

  product.setMaterialSideOverride(materialId, 'auto');
  assert.equal(material.side, THREE.FrontSide);
  assert.equal(product.getMaterialSideOverrides()[materialId], 'auto');

  product.setBackfaceRepairEnabled(true);
  assert.equal(material.side, THREE.FrontSide, 'explicit Auto must opt out of future suggestions');
  assert.equal(product.getMaterialSideOverrides()[materialId], 'auto');
  assert.equal(product.getSuggestedMaterialSideOverrideIds().includes(String(materialId)), false);
  product.setBackfaceRepairEnabled(false);
  assert.equal(product.getMaterialSideOverrides()[materialId], 'auto');
  product.dispose();
});

test('empty diagnostics are deterministic and serializable', () => {
  const report = analyzeMaterialDiagnostics(null, { forEachMaterial: eachMaterial });
  assert.equal(report.uniqueMaterials, 0);
  assert.equal(report.health, 'safe');
  assert.deepEqual(report.materials, []);
  assert.doesNotThrow(() => JSON.stringify(report));
});
