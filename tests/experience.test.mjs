import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DEFAULT_PROJECT_STATE } from '../src/config/presets.js';
import {
  DEFAULT_EXPERIENCE_STATE,
  sanitizeExperienceState,
  sanitizeLogoDataUrl,
} from '../src/presentation/ExperienceGrammar.js';
import {
  encodeExperienceFile,
  decodeExperienceFile,
  experienceFilename,
  EXPERIENCE_FILE_MAGIC,
} from '../src/presentation/ExperienceFileCodec.js';
import { ExperienceRuntime } from '../src/presentation/ExperienceRuntime.js';
import {
  buildAndroidSceneViewerUrl,
  buildIosQuickLookUrl,
  resolveArHandoff,
} from '../src/presentation/ARHandoff.js';
import {
  mapNdcToExport,
  presentationSafeArea,
  presentationCardSize,
} from '../src/presentation/PresentationFrameLayout.js';

const root = resolve(import.meta.dirname, '..');

function projectFixture() {
  return structuredClone({
    ...DEFAULT_PROJECT_STATE,
    meta: {
      id: 'project-v2',
      title: 'V2 Product',
      createdAt: '2026-08-09T10:00:00.000Z',
      updatedAt: '2026-08-09T10:00:00.000Z',
    },
    model: { ...DEFAULT_PROJECT_STATE.model, name: 'V2 Product', procedural: false },
    configurator: {
      ...DEFAULT_PROJECT_STATE.configurator,
      stories: [{
        id: 'story-1',
        name: 'Launch Story',
        loop: false,
        steps: [{
          id: 'step-1',
          name: 'Hero',
          presentationId: null,
          explodeStateId: null,
          chapterId: null,
          infographicDisplay: 'off',
          selectedInfographicId: null,
          transitionDuration: 0.8,
          holdDuration: 1.2,
          easing: 'cinematic',
        }],
      }],
      activeStoryId: 'story-1',
      activeStoryStepId: 'step-1',
    },
    experience: {
      ...DEFAULT_EXPERIENCE_STATE,
      title: 'Launch Experience',
      entryStoryId: 'story-1',
      accent: '#12aabb',
      ar: {
        ...DEFAULT_EXPERIENCE_STATE.ar,
        androidGlbUrl: 'https://cdn.example.com/product.glb',
        iosUsdzUrl: 'https://cdn.example.com/product.usdz',
      },
    },
  });
}

test('experience grammar sanitizes brand, controls, URLs and logo safety', () => {
  const tinyPng = 'data:image/png;base64,iVBORw0KGgo=';
  const state = sanitizeExperienceState({
    title: '  Product   Launch  ',
    theme: 'neon',
    accent: '#ABCDEF',
    logoDataUrl: tinyPng,
    entryMode: 'broken',
    share: { hostedPackageUrl: 'javascript:alert(1)' },
    ar: { androidGlbUrl: 'https://cdn.example.com/product.glb', resizable: false },
  });
  assert.equal(state.title, 'Product Launch');
  assert.equal(state.theme, DEFAULT_EXPERIENCE_STATE.theme);
  assert.equal(state.accent, '#abcdef');
  assert.equal(state.logoDataUrl, tinyPng);
  assert.equal(state.entryMode, DEFAULT_EXPERIENCE_STATE.entryMode);
  assert.equal(state.share.hostedPackageUrl, null);
  assert.equal(state.ar.androidGlbUrl, 'https://cdn.example.com/product.glb');
  assert.equal(state.ar.resizable, false);
  assert.equal(sanitizeLogoDataUrl('data:text/plain;base64,AAAA'), null);
});

test('binary .productvis-show round-trip preserves schema-10 project state and raw GLB bytes', async () => {
  const bytes = new Uint8Array(await readFile(resolve(root, 'tests/fixtures/foundation-cube.glb')));
  const project = projectFixture();
  const blob = encodeExperienceFile({
    project,
    asset: { kind: 'embedded-glb', name: 'product.glb', mimeType: 'model/gltf-binary', bytes },
    appVersion: '2.0.0',
  });
  const prefix = new TextDecoder().decode(new Uint8Array(await blob.slice(0, EXPERIENCE_FILE_MAGIC.length).arrayBuffer()));
  assert.equal(prefix, EXPERIENCE_FILE_MAGIC);
  const decoded = await decodeExperienceFile(blob);
  assert.equal(decoded.project.schemaVersion, 10);
  assert.equal(decoded.project.experience.title, 'Launch Experience');
  assert.equal(decoded.project.experience.entryStoryId, 'story-1');
  assert.equal(decoded.project.runtime.recoveryEnabled, false);
  assert.equal(decoded.asset.name, 'product.glb');
  assert.deepEqual(decoded.asset.bytes, bytes);
  assert.equal(experienceFilename('Launch Experience'), 'launch-experience.productvis-show');
});

test('ExperienceRuntime keeps intro, active, story and outro phases deterministic', () => {
  const changes = [];
  const runtime = new ExperienceRuntime({ onChange: ({ reason, state }) => changes.push([reason, state.phase]) });
  let state = runtime.enter({ ...DEFAULT_EXPERIENCE_STATE, entryStoryId: 'story-1' });
  assert.equal(state.active, true);
  assert.equal(state.phase, 'intro');
  runtime.start();
  runtime.updateStory({ storyId: 'story-1', stepId: 'step-1', playing: true });
  state = runtime.getState();
  assert.equal(state.phase, 'active');
  assert.equal(state.storyState.stepId, 'step-1');
  runtime.showOutro();
  assert.equal(runtime.getState().phase, 'outro');
  runtime.dismissOutro();
  runtime.updateProfile({ ...DEFAULT_EXPERIENCE_STATE, title: 'Updated' });
  assert.equal(runtime.getState().profile.title, 'Updated');
  runtime.exit();
  assert.equal(runtime.getState().active, false);
  assert.deepEqual(changes.map(([reason]) => reason), ['enter', 'start', 'story', 'outro', 'outro-dismiss', 'profile', 'exit']);
});

test('AR handoff creates Android Scene Viewer and Apple Quick Look targets only from hosted HTTPS assets', () => {
  const experience = projectFixture().experience;
  const android = buildAndroidSceneViewerUrl(experience, { baseUrl: 'https://viewer.example.com/' });
  assert.match(android, /^intent:\/\/arvr\.google\.com\/scene-viewer\/1\.0\?/);
  assert.match(android, /file=https%3A%2F%2Fcdn\.example\.com%2Fproduct\.glb/);
  const ios = buildIosQuickLookUrl(experience, { baseUrl: 'https://viewer.example.com/' });
  assert.equal(ios, 'https://cdn.example.com/product.usdz');
  assert.equal(resolveArHandoff(experience, { userAgent: 'iPhone', baseUrl: 'https://viewer.example.com/' }).kind, 'quick-look');
  assert.equal(resolveArHandoff(experience, { userAgent: 'Android', baseUrl: 'https://viewer.example.com/' }).kind, 'scene-viewer');
  assert.equal(buildAndroidSceneViewerUrl({ ar: { androidGlbUrl: 'http://example.com/p.glb' } }), null);
});

test('presentation frame layout maps viewport NDC through Match padding and returns bounded safe areas', () => {
  const plan = {
    renderWidth: 1600,
    renderHeight: 900,
    outputWidth: 1080,
    outputHeight: 1350,
    source: { x: 0, y: 0, width: 1600, height: 900 },
    destination: { x: 0, y: 371.25, width: 1080, height: 607.5 },
  };
  const center = mapNdcToExport({ x: 0, y: 0, z: 0 }, plan);
  assert.equal(center.x, 540);
  assert.equal(center.y, 675);
  assert.equal(center.visible, true);
  assert.equal(mapNdcToExport({ x: 0, y: 0, z: 2 }, plan), null);
  const safe = presentationSafeArea(1920, 1080);
  assert.ok(safe.left > 0 && safe.right < 1920 && safe.width > 1600);
  const card = presentationCardSize(1920, 1080);
  assert.ok(card.width >= 240 && card.width <= 430);
});
