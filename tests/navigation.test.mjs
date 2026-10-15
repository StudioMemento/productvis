import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boundedIndex, pageIndex, scrubIndex, groupMaterials, locateMaterial } from '../src/navigation.js';
import { friendlyMaterialName } from '../src/state.js';

test('category and tactile surface navigation stop at the ends without wrapping', () => {
  assert.equal(boundedIndex(-1,6),0);
  assert.equal(boundedIndex(6,6),5);
  assert.equal(pageIndex(1210,400,6),3);
  assert.equal(pageIndex(300,0,6),0);
  assert.equal(scrubIndex(2,-128,6),4);
  assert.equal(scrubIndex(2,900,6),0);
  assert.equal(scrubIndex(2,-900,6),5);
});

test('every NSX material is reachable in at most six families', () => {
  const buffer = readFileSync(new URL('../public/models/demo.glb',import.meta.url));
  const json = JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)).toString());
  const materials = json.materials.map((m,index)=>({id:`mat-${index}`,rawName:m.name,label:friendlyMaterialName(m.name,index)}));
  const snapshot=structuredClone(materials);
  const groups=groupMaterials(materials);
  assert.ok(groups.length<=6);
  assert.equal(groups[0].id,'body');
  assert.deepEqual(groups.flatMap(g=>g.materials.map(m=>m.id)).sort(),materials.map(m=>m.id).sort());
  for(const material of materials){
    const found=locateMaterial(groups,material.id);
    assert.equal(groups[found.groupIndex].materials[found.materialIndex].id,material.id);
  }
  assert.deepEqual(materials,snapshot);
});

test('unknown GLB materials stay accessible without assuming a car part', () => {
  const groups=groupMaterials([{id:'a',label:'Custom surface'},{id:'b',label:'Unmapped surface'}]);
  assert.equal(groups.length,1);
  assert.equal(groups[0].id,'details');
  assert.equal(groups[0].materials.length,2);
  assert.deepEqual(groupMaterials([]),[]);
  assert.deepEqual(locateMaterial([],''),{groupIndex:0,materialIndex:0});
});
