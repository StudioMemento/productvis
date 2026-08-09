import { DEFAULT_EXPERIENCE_STATE } from '../presentation/ExperienceGrammar.js';

const NEUTRAL_STUDIO = Object.freeze({
  exposure: 0.98,
  environment: 1.18,
  environmentRotation: Math.PI * 0.08,
  key: 2.35,
  fill: 0.78,
  rim: 1.8,
  bloom: 0,
  shadow: 0.52,
  shadowSoftness: 0.58,
});

function createBackdropPreset(label, backdropTone) {
  return Object.freeze({
    label,
    backdropTone,
    ...NEUTRAL_STUDIO,
  });
}

function createLightingPreset(label, values) {
  return Object.freeze({ label, ...values });
}

/**
 * Visible backdrop and lighting remain independent. The simple dock exposes
 * White / Gray / Black while Advanced keeps the continuous neutral range.
 */
export const BACKDROP_PRESETS = Object.freeze({
  white: createBackdropPreset('White', 0.965),
  light: createBackdropPreset('Light', 0.82),
  gray: createBackdropPreset('Gray', 0.48),
  dark: createBackdropPreset('Dark', 0.16),
  black: createBackdropPreset('Black', 0.025),
});

// Stable public export for earlier checkpoints and integrations.
export const LOOK_PRESETS = BACKDROP_PRESETS;

export const LIGHT_PRESETS = Object.freeze({
  soft: createLightingPreset('Soft', {
    exposure: 1.03,
    environment: 1.46,
    environmentRotation: Math.PI * 0.11,
    key: 1.55,
    fill: 1.16,
    rim: 1.08,
    bloom: 0,
    shadow: 0.42,
    shadowSoftness: 0.74,
  }),
  balanced: createLightingPreset('Balanced', NEUTRAL_STUDIO),
  contrast: createLightingPreset('Contrast', {
    exposure: 0.94,
    environment: 0.84,
    environmentRotation: Math.PI * 0.06,
    key: 3.2,
    fill: 0.36,
    rim: 2.55,
    bloom: 0,
    shadow: 0.62,
    shadowSoftness: 0.44,
  }),
});

export const DEFAULT_BACKDROP_ID = 'gray';
export const DEFAULT_LOOK_ID = DEFAULT_BACKDROP_ID;
export const DEFAULT_LIGHT_ID = 'balanced';
export const DEFAULT_GROUND_OFFSET = 0;
export const DEFAULT_CAMERA_TARGET = Object.freeze({ x: 0, y: 0.47, z: 0 });

export const CAMERA_PRESETS = Object.freeze({
  hero: Object.freeze({ direction: [1.12, 0.45, 1.65], distance: 0.9, target: DEFAULT_CAMERA_TARGET }),
  front: Object.freeze({ direction: [0, 0.18, 1], distance: 0.94, target: Object.freeze({ x: 0, y: 0.48, z: 0 }) }),
  side: Object.freeze({ direction: [1, 0.2, 0], distance: 0.96, target: Object.freeze({ x: 0, y: 0.48, z: 0 }) }),
  top: Object.freeze({ direction: [0.32, 1, 0.34], distance: 1.02, target: Object.freeze({ x: 0, y: 0.42, z: 0 }) }),
  detail: Object.freeze({ direction: [0.9, 0.34, 1.25], distance: 0.62, target: Object.freeze({ x: 0, y: 0.65, z: 0 }) }),
});

export const QUALITY_PROFILES = Object.freeze({
  performance: Object.freeze({
    maxPixelRatio: 1,
    shadowMapSize: 1024,
    contactShadowSize: 256,
    contactShadowBlurPasses: 1,
    contactShadowDynamicFps: 16,
  }),
  balanced: Object.freeze({
    maxPixelRatio: 1.45,
    shadowMapSize: 1536,
    contactShadowSize: 512,
    contactShadowBlurPasses: 1,
    contactShadowDynamicFps: 24,
  }),
  quality: Object.freeze({
    maxPixelRatio: 2,
    shadowMapSize: 2048,
    contactShadowSize: 768,
    contactShadowBlurPasses: 2,
    contactShadowDynamicFps: 30,
  }),
});

const defaultBackdrop = BACKDROP_PRESETS[DEFAULT_BACKDROP_ID];
const defaultLighting = LIGHT_PRESETS[DEFAULT_LIGHT_ID];

export const DEFAULT_PROJECT_STATE = Object.freeze({
  schemaVersion: 10,
  meta: Object.freeze({
    id: null,
    title: 'Demo Object',
    createdAt: null,
    updatedAt: null,
  }),
  model: Object.freeze({
    name: 'Demo Object',
    fileSize: null,
    procedural: true,
    materialMode: 'original',
    userScale: 1,
    userOffset: 0,
    rotation: Object.freeze({ x: 0, y: 0, z: 0 }),
    positionXZ: Object.freeze({ x: 0, z: 0 }),
    backfaceRepairEnabled: false,
    materialSideOverrides: Object.freeze({}),
  }),
  studio: Object.freeze({
    // `preset` remains a legacy alias for the active backdrop preset.
    preset: DEFAULT_BACKDROP_ID,
    backdropPreset: DEFAULT_BACKDROP_ID,
    lightingPreset: DEFAULT_LIGHT_ID,
    backdropTone: defaultBackdrop.backdropTone,
    exposure: defaultLighting.exposure,
    environment: defaultLighting.environment,
    environmentRotation: defaultLighting.environmentRotation,
    key: defaultLighting.key,
    fill: defaultLighting.fill,
    rim: defaultLighting.rim,
    bloom: defaultLighting.bloom,
    groundOffset: DEFAULT_GROUND_OFFSET,
    shadow: defaultLighting.shadow,
    shadowSoftness: defaultLighting.shadowSoftness,
    floorEnabled: true,
    shadowsEnabled: true,
    postEnabled: true,
  }),
  camera: Object.freeze({
    preset: 'hero',
    focalLength: 50,
    target: DEFAULT_CAMERA_TARGET,
    pose: null,
    damping: 0.08,
    autoRotate: false,
    horizonLocked: true,
    mode: 'presentation',
  }),
  motion: Object.freeze({
    clipIndex: 0,
    playing: false,
    loop: true,
    speed: 1,
    time: 0,
    turntable: false,
    turntableSpeed: 0.3,
    turntableAngle: 0,
  }),
  configurator: Object.freeze({
    partVisibility: Object.freeze({}),
    states: Object.freeze([]),
    activeStateId: null,
    anchors: Object.freeze([]),
    anchorDisplay: 'off',
    selectedAnchorId: null,
    variantGroups: Object.freeze([]),
    variantSelections: Object.freeze({}),
    configurations: Object.freeze([]),
    activeConfigurationId: null,
    variantPreviewEnabled: false,
    infographics: Object.freeze([]),
    infographicDisplay: 'off',
    selectedInfographicId: null,
    presentations: Object.freeze([]),
    activePresentationId: null,
    explodeOffsets: Object.freeze({}),
    explodeStates: Object.freeze([]),
    activeExplodeStateId: null,
    animationChapters: Object.freeze([]),
    stories: Object.freeze([]),
    activeStoryId: null,
    activeStoryStepId: null,
    storyPreviewEnabled: false,
  }),
  render: Object.freeze({
    quality: 'quality',
    exportFraming: 'match-viewport',
  }),
  experience: DEFAULT_EXPERIENCE_STATE,
  runtime: Object.freeze({
    autoQuality: true,
    pauseWhenHidden: true,
    recoveryEnabled: true,
  }),
});
