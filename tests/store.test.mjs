import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectStore, createInitialState } from '../src/app/ProjectStore.js';

test('ProjectStore exposes a versioned serializable project state', () => {
  const store = new ProjectStore(createInitialState());
  assert.equal(store.get('project.schemaVersion'), 10);
  assert.equal(store.get('project.model.name'), 'Demo Object');
  assert.equal(store.get('project.model.backfaceRepairEnabled'), false);
  assert.deepEqual(store.get('project.model.materialSideOverrides'), {});
  assert.deepEqual(store.get('project.model.rotation'), { x: 0, y: 0, z: 0 });
  assert.deepEqual(store.get('project.model.positionXZ'), { x: 0, z: 0 });
  assert.equal(store.get('project.studio.preset'), 'gray');
  assert.equal(store.get('project.runtime.autoQuality'), true);
  assert.equal(store.get('project.runtime.recoveryEnabled'), true);
  assert.equal(store.get('project.studio.backdropPreset'), 'gray');
  assert.equal(store.get('project.studio.lightingPreset'), 'balanced');
  assert.equal(store.get('project.camera.mode'), 'presentation');
  assert.deepEqual(store.get('project.camera.target'), { x: 0, y: 0.47, z: 0 });
  assert.equal(store.get('project.camera.pose'), null);
  assert.equal(store.get('project.studio.groundOffset'), 0);
  assert.equal(store.get('project.studio.bloom'), 0);
  assert.equal(store.get('project.motion.time'), 0);
  assert.equal(store.get('project.motion.turntableAngle'), 0);
  assert.equal(store.get('project.render.exportFraming'), 'match-viewport');
  assert.deepEqual(store.get('project.configurator.partVisibility'), {});
  assert.deepEqual(store.get('project.configurator.states'), []);
  assert.deepEqual(store.get('project.configurator.anchors'), []);
  assert.equal(store.get('project.configurator.anchorDisplay'), 'off');
  assert.deepEqual(store.get('project.configurator.variantGroups'), []);
  assert.deepEqual(store.get('project.configurator.variantSelections'), {});
  assert.deepEqual(store.get('project.configurator.configurations'), []);
  assert.equal(store.get('project.configurator.activeConfigurationId'), null);
  assert.deepEqual(store.get('project.configurator.infographics'), []);
  assert.equal(store.get('project.configurator.infographicDisplay'), 'off');
  assert.equal(store.get('project.configurator.selectedInfographicId'), null);
  assert.doesNotThrow(() => JSON.stringify(store.snapshot()));
});

test('ProjectStore set, patch and transaction emit deterministic revisions', () => {
  const store = new ProjectStore(createInitialState());
  const events = [];
  store.subscribe((event) => events.push(event));

  store.set('project.camera.focalLength', 70, { source: 'test' });
  store.patch('project.studio', { lightingPreset: null, exposure: 0.9 }, { source: 'test' });
  store.transaction((state) => {
    state.project.motion.turntable = true;
  }, { source: 'test' });
  const replacement = store.snapshot().project;
  replacement.meta.title = 'Replaced';
  store.replaceProject(replacement, { source: 'test' });

  assert.equal(store.get('project.camera.focalLength'), 70);
  assert.equal(store.get('project.studio.lightingPreset'), null);
  assert.equal(store.get('project.studio.exposure'), 0.9);
  assert.equal(store.get('project.motion.turntable'), true);
  assert.equal(store.get('project.meta.title'), 'Replaced');
  assert.deepEqual(events.map((event) => event.revision), [1, 2, 3, 4]);
});

test('ProjectStore snapshot does not mutate live state', () => {
  const store = new ProjectStore(createInitialState());
  const snapshot = store.snapshot();
  snapshot.project.model.name = 'Changed outside store';
  snapshot.project.studio.backdropPreset = 'black';
  assert.equal(store.get('project.model.name'), 'Demo Object');
  assert.equal(store.get('project.model.backfaceRepairEnabled'), false);
  assert.equal(store.get('project.studio.backdropPreset'), 'gray');
  assert.equal(store.get('project.studio.lightingPreset'), 'balanced');
  assert.equal(store.get('project.camera.mode'), 'presentation');
  assert.equal(store.get('project.studio.bloom'), 0);
});
