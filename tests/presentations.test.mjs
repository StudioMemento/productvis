import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PRESENTATION_STATES,
  PresentationStateLibrary,
  sanitizePresentationSnapshot,
  sanitizePresentationState,
  sanitizePresentationStates,
} from '../src/configurator/PresentationStateLibrary.js';

function exampleSnapshot() {
  return {
    studio: {
      backdropPreset: 'gray',
      lightingPreset: 'balanced',
      backdropTone: 0.48,
      exposure: 1.04,
      environment: 1.4,
      environmentRotation: 0.2,
      key: 2.5,
      fill: 0.9,
      rim: 1.7,
      bloom: 0.05,
      groundOffset: 0.1,
      shadow: 0.54,
      shadowSoftness: 0.6,
      floorEnabled: true,
      shadowsEnabled: true,
      postEnabled: true,
    },
    model: {
      materialMode: 'chrome',
      userScale: 1.2,
      userOffset: 0.15,
      rotation: { x: 0.1, y: 0.8, z: 0 },
      positionXZ: { x: 0.2, z: -0.1 },
      backfaceRepairEnabled: true,
      materialSideOverrides: { 1: 'double' },
    },
    camera: {
      preset: null,
      focalLength: 72,
      target: { x: 0.1, y: 0.62, z: -0.1 },
      pose: {
        target: { x: 0.1, y: 0.62, z: -0.1 },
        direction: [1, 0.4, 1.2],
        distance: 3.2,
        up: [0, 1, 0],
        sourceAspect: 16 / 9,
      },
      damping: 0.09,
      autoRotate: false,
      horizonLocked: true,
      mode: 'presentation',
    },
    configurator: {
      partVisibility: { part_ab12: false },
      variantSelections: { group_finish: 'option_black' },
      activeConfigurationId: 'configuration_black',
      variantPreviewEnabled: true,
      infographicDisplay: 'all',
      selectedInfographicId: 'info_detail',
    },
    render: {
      quality: 'balanced',
      exportFraming: 'fill',
    },
    motion: {
      playing: true,
      time: 5.5,
      turntable: true,
    },
  };
}

test('presentation snapshots preserve static shot state and deliberately exclude motion', () => {
  const source = exampleSnapshot();
  const snapshot = sanitizePresentationSnapshot(source);

  assert.equal(snapshot.studio.backdropPreset, 'gray');
  assert.equal(snapshot.model.materialMode, 'chrome');
  assert.equal(snapshot.camera.focalLength, 72);
  assert.equal(snapshot.configurator.variantSelections.group_finish, 'option_black');
  assert.equal(snapshot.configurator.infographicDisplay, 'all');
  assert.equal(snapshot.render.exportFraming, 'fill');
  assert.equal('motion' in snapshot, false);
  assert.deepEqual(source.motion, { playing: true, time: 5.5, turntable: true });
});

test('presentation sanitization caps records, de-duplicates IDs and clamps unsafe values', () => {
  const input = Array.from({ length: MAX_PRESENTATION_STATES + 8 }, (_, index) => ({
    id: 'same id',
    name: `State ${index + 1}`,
    snapshot: {
      ...exampleSnapshot(),
      camera: { ...exampleSnapshot().camera, focalLength: index === 0 ? 999 : 72 },
    },
  }));

  const states = sanitizePresentationStates(input);
  assert.equal(states.length, MAX_PRESENTATION_STATES);
  assert.equal(new Set(states.map((item) => item.id)).size, MAX_PRESENTATION_STATES);
  assert.equal(states[0].id, 'same-id');
  assert.equal(states[1].id, 'same-id-2');
  assert.equal(states[0].snapshot.camera.focalLength, 160);

  const state = sanitizePresentationState({
    presentations: input,
    activePresentationId: 'same id',
  });
  assert.equal(state.activePresentationId, 'same-id');
});

test('PresentationStateLibrary captures, applies and deletes deterministic static states', () => {
  const reasons = [];
  const library = new PresentationStateLibrary({ onChange: ({ reason }) => reasons.push(reason) });
  const first = library.capture('Hero black', exampleSnapshot());
  const second = library.capture('Detail', {
    ...exampleSnapshot(),
    camera: { ...exampleSnapshot().camera, focalLength: 100 },
  });

  assert.equal(library.getReport().count, 2);
  assert.equal(library.getState().activePresentationId, second.id);

  let applied = null;
  assert.equal(library.apply(first.id, (snapshot, item) => {
    applied = { snapshot, item };
  }), true);
  assert.equal(applied.item.name, 'Hero black');
  assert.equal(applied.snapshot.camera.focalLength, 72);
  assert.equal('motion' in applied.snapshot, false);
  assert.equal(library.getState().activePresentationId, first.id);

  assert.equal(library.delete(first.id), true);
  assert.equal(library.getReport().count, 1);
  assert.equal(library.getState().activePresentationId, null);
  assert.deepEqual(reasons, ['capture', 'capture', 'apply', 'delete']);
});

test('PresentationStateLibrary accepts legacy presentation-state aliases', () => {
  const source = [{ id: 'legacy_state', name: 'Legacy', snapshot: exampleSnapshot() }];
  const library = new PresentationStateLibrary();
  library.applyState({
    presentationStates: source,
    activePresentationStateId: 'legacy_state',
  }, { notify: false });

  const state = library.getState();
  assert.equal(state.presentations.length, 1);
  assert.equal(state.presentations[0].id, 'legacy_state');
  assert.equal(state.activePresentationId, 'legacy_state');
});
