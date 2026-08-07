import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectStore, createInitialState } from '../src/app/ProjectStore.js';

test('ProjectStore exposes a versioned serializable project state', () => {
  const store = new ProjectStore(createInitialState());
  assert.equal(store.get('project.schemaVersion'), 1);
  assert.equal(store.get('project.model.name'), 'Demo Object');
  assert.doesNotThrow(() => JSON.stringify(store.snapshot()));
});

test('ProjectStore set, patch and transaction emit deterministic revisions', () => {
  const store = new ProjectStore(createInitialState());
  const events = [];
  store.subscribe((event) => events.push(event));

  store.set('project.camera.focalLength', 70, { source: 'test' });
  store.patch('project.studio', { preset: null, exposure: 0.9 }, { source: 'test' });
  store.transaction((state) => {
    state.project.motion.turntable = true;
  }, { source: 'test' });

  assert.equal(store.get('project.camera.focalLength'), 70);
  assert.equal(store.get('project.studio.preset'), null);
  assert.equal(store.get('project.studio.exposure'), 0.9);
  assert.equal(store.get('project.motion.turntable'), true);
  assert.deepEqual(events.map((event) => event.revision), [1, 2, 3]);
});

test('ProjectStore snapshot does not mutate live state', () => {
  const store = new ProjectStore(createInitialState());
  const snapshot = store.snapshot();
  snapshot.project.model.name = 'Changed outside store';
  assert.equal(store.get('project.model.name'), 'Demo Object');
});
