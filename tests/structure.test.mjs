import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStructureIndex,
  filterStructureRecords,
  sanitizeVisibilityOverrides,
  stablePartId,
} from '../src/structure/StructureIndex.js';

function mesh(name, { visible = true, materialSlots = 1 } = {}) {
  return {
    name,
    type: 'Mesh',
    isMesh: true,
    visible,
    material: materialSlots === 1
      ? { name: `${name} material` }
      : Array.from({ length: materialSlots }, (_, index) => ({ name: `${name} ${index + 1}` })),
    children: [],
  };
}

function group(name, children = [], { visible = true } = {}) {
  return {
    name,
    type: 'Group',
    isGroup: true,
    visible,
    children,
  };
}

function fixture() {
  return group('Scene', [
    group('Vehicle', [
      mesh('Wheel'),
      mesh('Wheel'),
      mesh('Body', { materialSlots: 3 }),
      group('Interior', [mesh('Seat'), mesh('Dashboard')]),
    ]),
    group('Accessories', [mesh('Spoiler', { visible: false })]),
  ]);
}

test('structure IDs are deterministic and duplicate sibling names remain unique', () => {
  const first = buildStructureIndex(fixture());
  const second = buildStructureIndex(fixture());
  assert.deepEqual(first.records.map((record) => record.id), second.records.map((record) => record.id));
  assert.equal(new Set(first.records.map((record) => record.id)).size, first.records.length);

  const wheels = first.records.filter((record) => record.label === 'Wheel');
  assert.equal(wheels.length, 2);
  assert.notEqual(wheels[0].id, wheels[1].id);
  assert.match(wheels[0].path, /wheel\[1\]/);
  assert.match(wheels[1].path, /wheel\[2\]/);
  assert.equal(stablePartId(wheels[0].path), wheels[0].id);
});

test('structure index preserves authored visibility and hierarchy metadata', () => {
  const index = buildStructureIndex(fixture());
  const spoiler = index.records.find((record) => record.label === 'Spoiler');
  const body = index.records.find((record) => record.label === 'Body');
  const interior = index.records.find((record) => record.label === 'Interior');

  assert.equal(spoiler.authoredVisible, false);
  assert.equal(body.materialSlots, 3);
  assert.equal(interior.meshCount, 2);
  assert.ok(interior.childIds.length >= 2);
  assert.equal(index.objectById.get(body.id).name, 'Body');
});

test('visibility sanitization accepts only stable boolean part overrides', () => {
  const index = buildStructureIndex(fixture());
  const validIds = new Set(index.records.map((record) => record.id));
  const firstId = index.records[0].id;
  const sanitized = sanitizeVisibilityOverrides({
    [firstId]: false,
    part_missing: true,
    invalid: false,
    [index.records[1].id]: 'false',
  }, validIds);
  assert.deepEqual(sanitized, { [firstId]: false });
});

test('structure search matches labels, paths and node kinds', () => {
  const index = buildStructureIndex(fixture());
  assert.equal(filterStructureRecords(index.records, 'dashboard').length, 1);
  assert.equal(filterStructureRecords(index.records, 'vehicle wheel').length, 2);
  assert.ok(filterStructureRecords(index.records, 'mesh').length >= 6);
  assert.equal(filterStructureRecords(index.records, 'missing part').length, 0);
});
