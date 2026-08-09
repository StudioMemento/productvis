import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROJECT_FILE_MAGIC,
  encodeProjectFile,
  decodeProjectFile,
  projectFilename,
} from '../src/persistence/ProjectFileCodec.js';
import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  migrateProjectState,
  sanitizeProjectState,
} from '../src/persistence/ProjectMigration.js';
import { SavedLookLibrary } from '../src/persistence/SavedLookLibrary.js';
import { DEFAULT_PROJECT_STATE } from '../src/config/presets.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test('binary .productvis round-trip preserves project state and raw GLB bytes', async () => {
  const bytes = Uint8Array.from([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0, 12, 0, 0, 0]);
  const project = sanitizeProjectState({
    ...DEFAULT_PROJECT_STATE,
    meta: { id: 'roundtrip', title: 'Round Trip', createdAt: '2026-08-08T10:00:00.000Z', updatedAt: '2026-08-08T10:00:00.000Z' },
    model: { ...DEFAULT_PROJECT_STATE.model, name: 'Fixture', procedural: false, fileSize: bytes.byteLength },
    camera: { ...DEFAULT_PROJECT_STATE.camera, pose: { target: { x: .1, y: .6, z: -.1 }, direction: [1, .4, 1], distance: 2.4, up: [0, 1, 0], sourceAspect: 16 / 9 } },
    motion: { ...DEFAULT_PROJECT_STATE.motion, time: 1.25, turntableAngle: .7 },
    configurator: {
      partVisibility: { part_abc1234: false },
      states: [{ id: 'state-one', name: 'Open shell', visibility: { part_abc1234: false }, createdAt: '2026-08-08T10:00:00.000Z' }],
      activeStateId: 'state-one',
      anchors: [{
        id: 'anchor-one',
        name: 'Feature point',
        kind: 'part-center',
        attachment: { type: 'part', partId: 'part_abc1234', localPosition: [0.1, 0.2, 0.3] },
        fallbackRootLocalPosition: [0.4, 0.5, 0.6],
        createdAt: '2026-08-08T10:00:00.000Z',
      }],
      anchorDisplay: 'selected',
      selectedAnchorId: 'anchor-one',
      variantGroups: [{
        id: 'group-finish',
        name: 'Finish',
        required: true,
        defaultOptionId: 'option-red',
        options: [{
          id: 'option-red',
          name: 'Racing Red',
          swatch: '#ff3311',
          changes: {
            appearance: { part_abc1234: { color: '#ff3311', roughness: 0.25 } },
            visibility: {},
          },
          createdAt: '2026-08-08T10:00:00.000Z',
        }],
        createdAt: '2026-08-08T10:00:00.000Z',
      }],
      variantSelections: { 'group-finish': 'option-red' },
      configurations: [{
        id: 'configuration-red',
        name: 'Red launch',
        selections: { 'group-finish': 'option-red' },
        createdAt: '2026-08-08T10:00:00.000Z',
      }],
      activeConfigurationId: 'configuration-red',
      variantPreviewEnabled: true,
      infographics: [{
        id: 'info-feature',
        anchorId: 'anchor-one',
        eyebrow: 'FEATURE',
        title: 'Precision point',
        body: 'Anchored product information.',
        accent: '#12c9b2',
        side: 'right',
        visible: true,
        createdAt: '2026-08-08T10:00:00.000Z',
        updatedAt: '2026-08-08T10:00:00.000Z',
      }],
      infographicDisplay: 'selected',
      selectedInfographicId: 'info-feature',
      presentations: [{
        id: 'presentation-hero',
        name: 'Hero launch',
        snapshot: {
          studio: { ...DEFAULT_PROJECT_STATE.studio, backdropPreset: 'black', backdropTone: 0.025 },
          model: { ...DEFAULT_PROJECT_STATE.model, userScale: 1.2 },
          camera: { ...DEFAULT_PROJECT_STATE.camera, focalLength: 70 },
          configurator: {
            partVisibility: { part_abc1234: false },
            variantSelections: { 'group-finish': 'option-red' },
            activeConfigurationId: 'configuration-red',
            variantPreviewEnabled: true,
            infographicDisplay: 'selected',
            selectedInfographicId: 'info-feature',
          },
          render: { ...DEFAULT_PROJECT_STATE.render, exportFraming: 'fill' },
        },
        createdAt: '2026-08-08T10:00:00.000Z',
        updatedAt: '2026-08-08T10:00:00.000Z',
      }],
      activePresentationId: 'presentation-hero',
      explodeOffsets: { part_abc1234: [0.8, 0, 0] },
      explodeStates: [{
        id: 'explode-open',
        name: 'Open assembly',
        offsets: { part_abc1234: [0.8, 0, 0] },
        createdAt: '2026-08-08T10:00:00.000Z',
      }],
      activeExplodeStateId: 'explode-open',
      animationChapters: [{
        id: 'chapter-open',
        name: 'Open mechanism',
        clipIndex: 0,
        startTime: 0.2,
        endTime: 1.4,
        speed: 1.25,
        loop: false,
        holdAtEnd: true,
      }],
      stories: [{
        id: 'story-launch',
        name: 'Launch story',
        loop: false,
        steps: [{
          id: 'step-open',
          name: 'Reveal mechanism',
          presentationId: 'presentation-hero',
          explodeStateId: 'explode-open',
          chapterId: 'chapter-open',
          infographicDisplay: 'selected',
          selectedInfographicId: 'info-feature',
          transitionDuration: 1.2,
          holdDuration: 0.8,
          easing: 'cinematic',
        }],
      }],
      activeStoryId: 'story-launch',
      activeStoryStepId: 'step-open',
      storyPreviewEnabled: true,
    },
  });
  const blob = encodeProjectFile({
    project,
    asset: { kind: 'embedded-glb', name: 'fixture.glb', mimeType: 'model/gltf-binary', bytes },
    appVersion: '2.0.0',
  });
  const prefix = new TextDecoder().decode(new Uint8Array(await blob.slice(0, 8).arrayBuffer()));
  assert.equal(prefix, PROJECT_FILE_MAGIC);
  const decoded = await decodeProjectFile(blob);
  assert.equal(decoded.project.schemaVersion, 10);
  assert.equal(decoded.project.meta.title, 'Round Trip');
  assert.equal(decoded.project.motion.time, 1.25);
  assert.equal(decoded.project.motion.turntableAngle, .7);
  assert.deepEqual(decoded.project.configurator.partVisibility, { part_abc1234: false });
  assert.equal(decoded.project.configurator.states[0].name, 'Open shell');
  assert.equal(decoded.project.configurator.anchors[0].attachment.partId, 'part_abc1234');
  assert.equal(decoded.project.configurator.anchorDisplay, 'selected');
  assert.equal(decoded.project.configurator.selectedAnchorId, 'anchor-one');
  assert.equal(decoded.project.configurator.variantGroups[0].name, 'Finish');
  assert.equal(decoded.project.configurator.variantSelections['group-finish'], 'option-red');
  assert.equal(decoded.project.configurator.configurations[0].name, 'Red launch');
  assert.equal(decoded.project.configurator.activeConfigurationId, 'configuration-red');
  assert.equal(decoded.project.configurator.variantPreviewEnabled, true);
  assert.equal(decoded.project.configurator.infographics[0].anchorId, 'anchor-one');
  assert.equal(decoded.project.configurator.infographics[0].title, 'Precision point');
  assert.equal(decoded.project.configurator.infographicDisplay, 'selected');
  assert.equal(decoded.project.configurator.selectedInfographicId, 'info-feature');
  assert.equal(decoded.project.configurator.presentations[0].name, 'Hero launch');
  assert.equal(decoded.project.configurator.presentations[0].snapshot.camera.focalLength, 70);
  assert.equal(decoded.project.configurator.presentations[0].snapshot.configurator.variantPreviewEnabled, true);
  assert.equal(decoded.project.configurator.activePresentationId, 'presentation-hero');
  assert.deepEqual(decoded.project.configurator.explodeOffsets.part_abc1234, [0.8, 0, 0]);
  assert.equal(decoded.project.configurator.explodeStates[0].name, 'Open assembly');
  assert.equal(decoded.project.configurator.activeExplodeStateId, 'explode-open');
  assert.equal(decoded.project.configurator.animationChapters[0].name, 'Open mechanism');
  assert.equal(decoded.project.configurator.stories[0].steps[0].chapterId, 'chapter-open');
  assert.equal(decoded.project.configurator.activeStoryId, 'story-launch');
  assert.equal(decoded.project.configurator.activeStoryStepId, 'step-open');
  assert.equal(decoded.project.configurator.storyPreviewEnabled, true);
  assert.deepEqual([...decoded.asset.bytes], [...bytes]);
  assert.equal(decoded.asset.name, 'fixture.glb');
  assert.equal(decoded.legacyJson, false);
});

test('schema migration upgrades a V3 project through V10 without losing intent', () => {
  const migrated = migrateProjectState({
    schemaVersion: 3,
    model: { name: 'Legacy', userScale: 1.4, userOffset: .2 },
    studio: { preset: 'black', backdropTone: .025, exposure: .9 },
    camera: { preset: 'front', focalLength: 70, mode: 'presentation' },
    motion: { rotationY: .8 },
    render: { quality: 'balanced' },
  });
  assert.equal(migrated.sourceVersion, 3);
  assert.equal(migrated.targetVersion, CURRENT_PROJECT_SCHEMA_VERSION);
  assert.equal(migrated.migrated, true);
  assert.deepEqual(migrated.project.model.positionXZ, { x: 0, z: 0 });
  assert.equal(migrated.project.camera.pose, null);
  assert.equal(migrated.project.motion.turntableAngle, .8);
  assert.equal(migrated.project.render.exportFraming, 'match-viewport');
  assert.equal(migrated.project.runtime.autoQuality, true);
  assert.equal(migrated.project.runtime.pauseWhenHidden, true);
  assert.equal(migrated.project.runtime.recoveryEnabled, true);
  assert.deepEqual(migrated.project.configurator.partVisibility, {});
  assert.deepEqual(migrated.project.configurator.states, []);
  assert.deepEqual(migrated.project.configurator.anchors, []);
  assert.equal(migrated.project.configurator.anchorDisplay, 'off');
  assert.deepEqual(migrated.project.configurator.variantGroups, []);
  assert.deepEqual(migrated.project.configurator.variantSelections, {});
  assert.deepEqual(migrated.project.configurator.configurations, []);
  assert.equal(migrated.project.configurator.activeConfigurationId, null);
  assert.deepEqual(migrated.project.configurator.infographics, []);
  assert.equal(migrated.project.configurator.infographicDisplay, 'off');
  assert.equal(migrated.project.configurator.selectedInfographicId, null);
  assert.equal(migrated.project.configurator.variantPreviewEnabled, false);
  assert.deepEqual(migrated.project.configurator.presentations, []);
  assert.equal(migrated.project.configurator.activePresentationId, null);
  assert.deepEqual(migrated.project.configurator.explodeOffsets, {});
  assert.deepEqual(migrated.project.configurator.explodeStates, []);
  assert.equal(migrated.project.configurator.activeExplodeStateId, null);
  assert.deepEqual(migrated.project.configurator.animationChapters, []);
  assert.deepEqual(migrated.project.configurator.stories, []);
  assert.equal(migrated.project.configurator.activeStoryId, null);
  assert.equal(migrated.project.configurator.activeStoryStepId, null);
  assert.equal(migrated.project.configurator.storyPreviewEnabled, false);
});

test('project sanitization clamps unsafe values and rejects unknown enums', () => {
  const project = sanitizeProjectState({
    schemaVersion: 8,
    model: { userScale: 999, userOffset: -999, positionXZ: { x: 200, z: -200 }, materialMode: 'laser' },
    camera: { focalLength: 999, target: { x: 8, y: -3, z: -9 }, mode: 'tunnel' },
    motion: { speed: 100, turntableSpeed: -8 },
    render: { quality: 'cinema', exportFraming: 'stretch' },
    runtime: { autoQuality: 'yes', pauseWhenHidden: false, recoveryEnabled: false },
    configurator: {
      partVisibility: { part_valid123: false, invalid: true, part_wrong: 'false' },
      states: [{ id: 'state one', name: 'One', visibility: { part_valid123: false } }],
      activeStateId: 'state-one',
      anchors: [{ id: 'anchor one', name: 'Point', attachment: { type: 'part', partId: 'part_valid123', localPosition: [1, 2, 3] }, fallbackRootLocalPosition: [4, 5, 6] }],
      anchorDisplay: 'explode',
      selectedAnchorId: 'missing',
      variantGroups: [{
        id: 'finish group',
        name: 'Finish',
        required: true,
        defaultOptionId: 'red option',
        options: [{
          id: 'red option',
          name: 'Red',
          swatch: '#f30',
          changes: {
            appearance: { part_valid123: { color: '#f30', roughness: 9 } },
            visibility: { part_valid123: false, invalid: true },
          },
        }],
      }],
      variantSelections: { 'finish group': 'red option', unknown: 'missing' },
      configurations: [{ id: 'launch config', name: 'Launch', selections: { 'finish group': 'red option' } }],
      activeConfigurationId: 'launch config',
      infographics: [
        { id: 'feature one', anchorId: 'anchor one', eyebrow: '  BENEFIT ', title: ' Feature ', body: 'One   sentence.', accent: '#f70', side: 'right' },
        { id: 'feature one', anchorId: 'anchor one', title: 'Second', accent: 'invalid', side: 'diagonal', visible: false },
        { id: 'broken', title: 'No anchor' },
      ],
      infographicDisplay: 'explode',
      selectedInfographicId: 'missing',
      variantPreviewEnabled: 'yes',
      presentations: [
        { id: 'shot one', name: 'One', snapshot: { camera: { focalLength: 999 }, configurator: { infographicDisplay: 'all' } } },
        { id: 'shot one', name: 'Two', snapshot: { model: { materialMode: 'laser' }, render: { exportFraming: 'stretch' } } },
      ],
      activePresentationId: 'missing',
    },
  });
  assert.equal(project.model.userScale, 100);
  assert.equal(project.model.userOffset, -100);
  assert.deepEqual(project.model.positionXZ, { x: 50, z: -50 });
  assert.equal(project.model.materialMode, 'original');
  assert.equal(project.camera.focalLength, 160);
  assert.deepEqual(project.camera.target, { x: 1, y: 0, z: -1 });
  assert.equal(project.camera.mode, 'presentation');
  assert.equal(project.motion.speed, 10);
  assert.equal(project.motion.turntableSpeed, .01);
  assert.equal(project.render.quality, 'quality');
  assert.equal(project.render.exportFraming, 'match-viewport');
  assert.equal(project.runtime.autoQuality, true);
  assert.equal(project.runtime.pauseWhenHidden, false);
  assert.equal(project.runtime.recoveryEnabled, false);
  assert.deepEqual(project.configurator.partVisibility, { part_valid123: false });
  assert.equal(project.configurator.states[0].id, 'state-one');
  assert.equal(project.configurator.anchors[0].id, 'anchor-one');
  assert.equal(project.configurator.anchors[0].attachment.partId, 'part_valid123');
  assert.equal(project.configurator.anchorDisplay, 'off');
  assert.equal(project.configurator.selectedAnchorId, null);
  assert.equal(project.configurator.variantGroups.length, 1);
  assert.equal(project.configurator.variantGroups[0].id, 'group_finish-group');
  assert.equal(project.configurator.variantGroups[0].options[0].swatch, '#ff3300');
  assert.equal(project.configurator.variantGroups[0].options[0].changes.appearance.part_valid123.roughness, 1);
  assert.equal(project.configurator.variantGroups[0].options[0].changes.visibility.part_valid123, false);
  assert.equal(project.configurator.configurations.length, 1);
  assert.equal(project.configurator.infographics.length, 2);
  assert.equal(project.configurator.infographics[0].id, 'feature-one');
  assert.equal(project.configurator.infographics[1].id, 'feature-one-2');
  assert.equal(project.configurator.infographics[0].anchorId, 'anchor-one');
  assert.equal(project.configurator.infographics[0].accent, '#ff7700');
  assert.equal(project.configurator.infographics[1].accent, '#ff7950');
  assert.equal(project.configurator.infographics[1].side, 'auto');
  assert.equal(project.configurator.infographicDisplay, 'off');
  assert.equal(project.configurator.selectedInfographicId, null);
  assert.equal(project.configurator.variantPreviewEnabled, false);
  assert.equal(project.configurator.presentations.length, 2);
  assert.equal(project.configurator.presentations[0].id, 'shot-one');
  assert.equal(project.configurator.presentations[1].id, 'shot-one-2');
  assert.equal(project.configurator.presentations[0].snapshot.camera.focalLength, 160);
  assert.equal(project.configurator.presentations[1].snapshot.model.materialMode, 'original');
  assert.equal(project.configurator.presentations[1].snapshot.render.exportFraming, 'match-viewport');
  assert.equal(project.configurator.activePresentationId, null);
});

test('saved-look library stores only reusable studio and render state', () => {
  const storage = new MemoryStorage();
  const library = new SavedLookLibrary(storage, { maxEntries: 3 });
  const look = library.add({
    ...DEFAULT_PROJECT_STATE,
    model: { ...DEFAULT_PROJECT_STATE.model, name: 'Should not be saved' },
    studio: { ...DEFAULT_PROJECT_STATE.studio, backdropPreset: 'black', backdropTone: .025 },
    render: { ...DEFAULT_PROJECT_STATE.render, quality: 'balanced', exportFraming: 'fill' },
  }, 'Noir product');
  assert.equal(library.list().length, 1);
  assert.equal(look.name, 'Noir product');
  assert.equal(look.studio.backdropPreset, 'black');
  assert.equal(look.render.exportFraming, 'fill');
  assert.equal('model' in look, false);
  assert.equal(library.remove(look.id), true);
  assert.equal(library.list().length, 0);
});

test('project decoder rejects corrupt binary headers and truncated embedded assets', async () => {
  const magic = new TextEncoder().encode(PROJECT_FILE_MAGIC);
  const badHeader = new Uint8Array(12);
  badHeader.set(magic);
  new DataView(badHeader.buffer).setUint32(8, 9_000_000, true);
  await assert.rejects(() => decodeProjectFile(new Blob([badHeader])), /header is invalid/i);

  const good = encodeProjectFile({
    project: DEFAULT_PROJECT_STATE,
    asset: { kind: 'embedded-glb', name: 'x.glb', bytes: Uint8Array.from([1, 2, 3, 4]) },
  });
  const truncated = good.slice(0, good.size - 2);
  await assert.rejects(() => decodeProjectFile(truncated), /missing or truncated/i);
});

test('project filename is portable and legacy JSON projects remain readable', async () => {
  assert.equal(projectFilename('  MY Product / Shot 01 '), 'my-product-shot-01.productvis');
  const legacy = new Blob([JSON.stringify({
    appVersion: '1.0.0',
    project: { schemaVersion: 2, model: { name: 'Legacy JSON' } },
  })], { type: 'application/json' });
  const decoded = await decodeProjectFile(legacy);
  assert.equal(decoded.legacyJson, true);
  assert.equal(decoded.project.schemaVersion, 10);
  assert.equal(decoded.project.model.name, 'Legacy JSON');
});
