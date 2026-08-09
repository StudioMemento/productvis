import {
  BACKDROP_PRESETS,
  LIGHT_PRESETS,
  CAMERA_PRESETS,
  QUALITY_PROFILES,
  DEFAULT_PROJECT_STATE,
  DEFAULT_CAMERA_TARGET,
} from '../config/presets.js';
import { sanitizeVariantState } from '../configurator/VariantGrammar.js';
import { sanitizeInfographicState } from '../configurator/InfographicGrammar.js';
import { sanitizePresentationState } from '../configurator/PresentationStateLibrary.js';
import { sanitizeExplosionState, sanitizeStoryAuthoringState } from '../story/StoryGrammar.js';
import { sanitizeExperienceState } from '../presentation/ExperienceGrammar.js';

export const CURRENT_PROJECT_SCHEMA_VERSION = 10;

const MATERIAL_MODES = new Set(['original', 'clay', 'chrome', 'matte']);
const CAMERA_MODES = new Set(['presentation', 'inspect']);
const SIDE_POLICIES = new Set(['original', 'front', 'back', 'double']);
const EXPORT_FRAMING_MODES = new Set(['match-viewport', 'fill']);

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max, fallback = min) {
  return Math.min(max, Math.max(min, finite(value, fallback)));
}

function boolean(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function text(value, fallback = '', maxLength = 160) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return (normalized || fallback).slice(0, maxLength);
}

function nullableText(value, maxLength = 160) {
  if (value === null || value === undefined || value === '') return null;
  return text(value, '', maxLength) || null;
}

function isoDate(value, fallback = null) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function enumValue(value, allowed, fallback) {
  return allowed.has(value) ? value : fallback;
}

function normalizeVector(value, fallback) {
  const source = Array.isArray(value) && value.length >= 3
    ? [finite(value[0], fallback[0]), finite(value[1], fallback[1]), finite(value[2], fallback[2])]
    : [...fallback];
  const length = Math.hypot(source[0], source[1], source[2]);
  if (!Number.isFinite(length) || length < 0.000001) return normalizeVector(fallback, [1, 0.35, 1.4]);
  return source.map((component) => component / length);
}

function sanitizeTarget(value, fallback = DEFAULT_CAMERA_TARGET) {
  return {
    x: clamp(value?.x, -1, 1, fallback.x),
    y: clamp(value?.y, 0, 1, fallback.y),
    z: clamp(value?.z, -1, 1, fallback.z),
  };
}

function sanitizePose(value, fallbackTarget = DEFAULT_CAMERA_TARGET) {
  if (value === null || value === undefined) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return {
    target: sanitizeTarget(value.target, fallbackTarget),
    direction: normalizeVector(value.direction, [1.12, 0.45, 1.65]),
    distance: clamp(value.distance, 0.05, 100, 2.8),
    up: normalizeVector(value.up, [0, 1, 0]),
    sourceAspect: clamp(value.sourceAspect, 0.1, 10, 16 / 9),
  };
}

function sanitizeRotation(value) {
  const twoPi = Math.PI * 2;
  return {
    x: clamp(value?.x, -twoPi, twoPi, 0),
    y: clamp(value?.y, -twoPi, twoPi, 0),
    z: clamp(value?.z, -twoPi, twoPi, 0),
  };
}

function sanitizePositionXZ(value) {
  return {
    x: clamp(value?.x, -50, 50, 0),
    z: clamp(value?.z, -50, 50, 0),
  };
}

function sanitizeMaterialSideOverrides(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  Object.entries(value).slice(0, 512).forEach(([id, policy]) => {
    const normalizedId = String(id).replace(/[^0-9]/g, '').slice(0, 8);
    if (normalizedId && SIDE_POLICIES.has(policy)) result[normalizedId] = policy;
  });
  return result;
}

function sanitizePartId(value) {
  const normalized = typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 96)
    : '';
  return /^part_[a-z0-9_]+$/.test(normalized) ? normalized : null;
}

function sanitizePartVisibility(value, max = 4096) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  Object.entries(value).slice(0, max).forEach(([id, visible]) => {
    const partId = sanitizePartId(id);
    if (partId && typeof visible === 'boolean') result[partId] = visible;
  });
  return result;
}

function sanitizeConfigurationStates(value) {
  const states = Array.isArray(value) ? value : [];
  const usedIds = new Set();
  return states.slice(0, 32).map((state, index) => {
    let id = text(state?.id, `state_${index + 1}`, 120).replace(/[^a-zA-Z0-9_-]/g, '-');
    if (!id) id = `state_${index + 1}`;
    let suffix = 2;
    const base = id;
    while (usedIds.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    const legacyVisibility = Array.isArray(state?.hiddenPartIds)
      ? Object.fromEntries(state.hiddenPartIds.map((partId) => [partId, false]))
      : null;
    return {
      id,
      name: text(state?.name, `State ${index + 1}`, 80),
      visibility: sanitizePartVisibility(state?.visibility || legacyVisibility),
      createdAt: isoDate(state?.createdAt, null),
    };
  });
}

function sanitizeLocalVector(value, fallback = [0, 0, 0]) {
  const source = Array.isArray(value) && value.length >= 3 ? value : fallback;
  return source.slice(0, 3).map((component, index) => clamp(component, -1_000_000, 1_000_000, fallback[index]));
}

function sanitizeAnchors(value) {
  const anchors = Array.isArray(value) ? value : [];
  const usedIds = new Set();
  return anchors.slice(0, 128).map((anchor, index) => {
    let id = text(anchor?.id, `anchor_${index + 1}`, 120).replace(/[^a-zA-Z0-9_-]/g, '-');
    if (!id) id = `anchor_${index + 1}`;
    let suffix = 2;
    const base = id;
    while (usedIds.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    const attachment = anchor?.attachment && typeof anchor.attachment === 'object'
      ? anchor.attachment
      : {};
    const partId = sanitizePartId(attachment.partId);
    const type = attachment.type === 'part' && partId ? 'part' : 'root';
    return {
      id,
      name: text(anchor?.name, `Anchor ${index + 1}`, 80),
      kind: ['part-center', 'camera-target', 'custom'].includes(anchor?.kind) ? anchor.kind : 'custom',
      attachment: {
        type,
        partId: type === 'part' ? partId : null,
        localPosition: sanitizeLocalVector(attachment.localPosition),
      },
      fallbackRootLocalPosition: sanitizeLocalVector(anchor?.fallbackRootLocalPosition),
      createdAt: isoDate(anchor?.createdAt, null),
    };
  });
}

function sanitizeConfigurator(value, defaults) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const states = sanitizeConfigurationStates(source.states || source.visibilityStates);
  const activeCandidate = source.activeStateId ?? source.activeVisibilityStateId;
  const activeStateId = states.some((state) => state.id === activeCandidate) ? activeCandidate : null;
  const anchors = sanitizeAnchors(source.anchors);
  const selectedAnchorId = anchors.some((anchor) => anchor.id === source.selectedAnchorId)
    ? source.selectedAnchorId
    : null;
  const legacyDisplay = source.showAnchors === true ? 'all' : source.showAnchors === false ? 'off' : null;
  const anchorDisplay = ['off', 'selected', 'all'].includes(source.anchorDisplay)
    ? source.anchorDisplay
    : ['off', 'selected', 'all'].includes(legacyDisplay)
      ? legacyDisplay
      : defaults.anchorDisplay;
  const variants = sanitizeVariantState(source);
  const infographics = sanitizeInfographicState(source);
  const presentations = sanitizePresentationState(source);
  const explosion = sanitizeExplosionState(source);
  const stories = sanitizeStoryAuthoringState(source);
  return {
    partVisibility: sanitizePartVisibility(source.partVisibility),
    states,
    activeStateId,
    anchors,
    anchorDisplay,
    selectedAnchorId,
    ...variants,
    variantPreviewEnabled: boolean(source.variantPreviewEnabled, defaults.variantPreviewEnabled),
    ...infographics,
    ...presentations,
    ...explosion,
    ...stories,
  };
}

function presetOrNull(value, collection, fallback = null) {
  if (value === null) return null;
  return Object.prototype.hasOwnProperty.call(collection, value) ? value : fallback;
}

function inferBackdropPreset(studio, fallback) {
  const explicit = studio?.backdropPreset ?? studio?.preset;
  if (explicit === null) return null;
  if (Object.prototype.hasOwnProperty.call(BACKDROP_PRESETS, explicit)) return explicit;
  const tone = finite(studio?.backdropTone, Number.NaN);
  if (Number.isFinite(tone)) {
    const match = Object.entries(BACKDROP_PRESETS)
      .find(([, preset]) => Math.abs(preset.backdropTone - tone) <= 0.0001);
    if (match) return match[0];
  }
  return fallback;
}

function valuesMatch(source, reference, keys, epsilon = 0.0001) {
  return keys.every((key) => Math.abs(finite(source?.[key], Number.NaN) - finite(reference?.[key], Number.NaN)) <= epsilon);
}

function inferLightingPreset(studio, fallback) {
  if (studio?.lightingPreset === null) return null;
  if (Object.prototype.hasOwnProperty.call(LIGHT_PRESETS, studio?.lightingPreset)) return studio.lightingPreset;
  const keys = ['exposure', 'environment', 'environmentRotation', 'key', 'fill', 'rim', 'bloom', 'shadow', 'shadowSoftness'];
  const match = Object.entries(LIGHT_PRESETS).find(([, preset]) => valuesMatch(studio, preset, keys));
  return match?.[0] ?? fallback;
}

function migrateShape(input) {
  const project = clone(input);
  let version = Math.max(1, Math.floor(finite(project.schemaVersion, 1)));

  if (version < 3) {
    project.model ||= {};
    project.model.backfaceRepairEnabled ??= false;
    project.camera ||= {};
    project.camera.mode ??= 'presentation';
    version = 3;
  }

  if (version < 4) {
    project.studio ||= {};
    project.studio.backdropPreset ??= project.studio.preset ?? DEFAULT_PROJECT_STATE.studio.backdropPreset;
    project.studio.lightingPreset ??= DEFAULT_PROJECT_STATE.studio.lightingPreset;
    version = 4;
  }

  if (version < 5) {
    project.model ||= {};
    project.model.rotation ??= { x: 0, y: 0, z: 0 };
    project.model.materialSideOverrides ??= {};
    project.studio ||= {};
    project.studio.groundOffset ??= 0;
    project.camera ||= {};
    project.camera.target ??= clone(DEFAULT_CAMERA_TARGET);
    version = 5;
  }

  if (version < 6) {
    project.model ||= {};
    project.model.positionXZ ??= { x: 0, z: 0 };
    project.camera ||= {};
    project.camera.pose ??= null;
    project.motion ||= {};
    project.motion.time ??= 0;
    project.motion.turntableAngle ??= project.motion.rotationY ?? 0;
    project.render ||= {};
    project.render.exportFraming ??= 'match-viewport';
    version = 6;
  }

  if (version < 7) {
    project.configurator ||= {};
    project.configurator.partVisibility ??= {};
    project.configurator.states ??= [];
    project.configurator.activeStateId ??= null;
    project.configurator.anchors ??= [];
    project.configurator.anchorDisplay ??= 'off';
    project.configurator.selectedAnchorId ??= null;
    project.runtime ||= {};
    project.runtime.autoQuality ??= true;
    project.runtime.pauseWhenHidden ??= true;
    project.runtime.recoveryEnabled ??= true;
    version = 7;
  }

  if (version < 8) {
    project.configurator ||= {};
    project.configurator.variantGroups ??= [];
    project.configurator.variantSelections ??= {};
    project.configurator.configurations ??= [];
    project.configurator.activeConfigurationId ??= null;
    project.configurator.variantPreviewEnabled ??= false;
    project.configurator.infographics ??= project.configurator.callouts ?? [];
    project.configurator.infographicDisplay ??= project.configurator.calloutDisplay ?? 'off';
    project.configurator.selectedInfographicId ??= project.configurator.selectedCalloutId ?? null;
    project.configurator.presentations ??= project.configurator.presentationStates ?? [];
    project.configurator.activePresentationId ??= project.configurator.activePresentationStateId ?? null;
    version = 8;
  }

  if (version < 9) {
    project.configurator ||= {};
    project.configurator.explodeOffsets ??= project.configurator.partOffsets ?? {};
    project.configurator.explodeStates ??= project.configurator.explodedStates ?? [];
    project.configurator.activeExplodeStateId ??= project.configurator.activeExplodedStateId ?? null;
    project.configurator.animationChapters ??= project.configurator.chapters ?? [];
    project.configurator.stories ??= project.configurator.storySequences ?? [];
    project.configurator.activeStoryId ??= null;
    project.configurator.activeStoryStepId ??= project.configurator.activeStepId ?? null;
    project.configurator.storyPreviewEnabled ??= false;
    version = 9;
  }

  if (version < 10) {
    project.experience ??= project.presentationExperience ?? {};
    version = 10;
  }

  project.schemaVersion = CURRENT_PROJECT_SCHEMA_VERSION;
  return project;
}

export function createProjectId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `pv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function migrateProjectState(input, { now = new Date().toISOString() } = {}) {
  const source = input?.project && typeof input.project === 'object' ? input.project : input;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new TypeError('A Product VIS project object is required.');
  }

  const sourceVersion = Math.max(1, Math.floor(finite(source.schemaVersion, 1)));
  const shaped = migrateShape(source);
  const defaults = clone(DEFAULT_PROJECT_STATE);
  const sourceMeta = shaped.meta || {};
  const sourceModel = shaped.model || {};
  const sourceStudio = shaped.studio || {};
  const sourceCamera = shaped.camera || {};
  const sourceMotion = shaped.motion || {};
  const sourceConfigurator = shaped.configurator || {};
  const sourceRender = shaped.render || {};
  const sourceRuntime = shaped.runtime || {};
  const sourceExperience = shaped.experience || {};

  const backdropPreset = inferBackdropPreset(sourceStudio, defaults.studio.backdropPreset);
  const lightingPreset = inferLightingPreset(sourceStudio, defaults.studio.lightingPreset);
  const cameraPreset = sourceCamera.preset === null
    ? null
    : presetOrNull(sourceCamera.preset, CAMERA_PRESETS, defaults.camera.preset);
  const targetFallback = cameraPreset ? CAMERA_PRESETS[cameraPreset].target : defaults.camera.target;
  const cameraTarget = sanitizeTarget(sourceCamera.target, targetFallback);

  const project = {
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    meta: {
      id: nullableText(sourceMeta.id, 96),
      title: text(sourceMeta.title, sourceModel.name || defaults.meta?.title || 'Product VIS Project', 120),
      createdAt: isoDate(sourceMeta.createdAt, null),
      updatedAt: isoDate(sourceMeta.updatedAt, now),
    },
    model: {
      name: text(sourceModel.name, defaults.model.name, 180),
      fileSize: sourceModel.fileSize === null || sourceModel.fileSize === undefined
        ? null
        : Math.max(0, Math.floor(finite(sourceModel.fileSize, 0))),
      procedural: boolean(sourceModel.procedural, defaults.model.procedural),
      materialMode: enumValue(sourceModel.materialMode, MATERIAL_MODES, defaults.model.materialMode),
      userScale: clamp(sourceModel.userScale, 0.01, 100, defaults.model.userScale),
      userOffset: clamp(sourceModel.userOffset, -100, 100, defaults.model.userOffset),
      rotation: sanitizeRotation(sourceModel.rotation),
      positionXZ: sanitizePositionXZ(sourceModel.positionXZ),
      backfaceRepairEnabled: boolean(sourceModel.backfaceRepairEnabled, defaults.model.backfaceRepairEnabled),
      materialSideOverrides: sanitizeMaterialSideOverrides(sourceModel.materialSideOverrides),
    },
    studio: {
      preset: backdropPreset,
      backdropPreset,
      lightingPreset,
      backdropTone: clamp(sourceStudio.backdropTone, 0.001, 0.999, defaults.studio.backdropTone),
      exposure: clamp(sourceStudio.exposure, 0.1, 4, defaults.studio.exposure),
      environment: clamp(sourceStudio.environment, 0, 8, defaults.studio.environment),
      environmentRotation: clamp(sourceStudio.environmentRotation, -Math.PI * 8, Math.PI * 8, defaults.studio.environmentRotation),
      key: clamp(sourceStudio.key, 0, 20, defaults.studio.key),
      fill: clamp(sourceStudio.fill, 0, 20, defaults.studio.fill),
      rim: clamp(sourceStudio.rim, 0, 20, defaults.studio.rim),
      bloom: clamp(sourceStudio.bloom, 0, 2, defaults.studio.bloom),
      groundOffset: clamp(sourceStudio.groundOffset, -10, 10, defaults.studio.groundOffset),
      shadow: clamp(sourceStudio.shadow, 0, 1, defaults.studio.shadow),
      shadowSoftness: clamp(sourceStudio.shadowSoftness, 0.01, 2, defaults.studio.shadowSoftness),
      floorEnabled: boolean(sourceStudio.floorEnabled, defaults.studio.floorEnabled),
      shadowsEnabled: boolean(sourceStudio.shadowsEnabled, defaults.studio.shadowsEnabled),
      postEnabled: boolean(sourceStudio.postEnabled, defaults.studio.postEnabled),
    },
    camera: {
      preset: cameraPreset,
      focalLength: clamp(sourceCamera.focalLength, 18, 160, defaults.camera.focalLength),
      target: cameraTarget,
      pose: sanitizePose(sourceCamera.pose, cameraTarget),
      damping: clamp(sourceCamera.damping, 0.01, 0.3, defaults.camera.damping),
      autoRotate: boolean(sourceCamera.autoRotate, defaults.camera.autoRotate),
      horizonLocked: boolean(sourceCamera.horizonLocked, defaults.camera.horizonLocked),
      mode: enumValue(sourceCamera.mode, CAMERA_MODES, defaults.camera.mode),
    },
    motion: {
      clipIndex: Math.max(0, Math.floor(finite(sourceMotion.clipIndex, defaults.motion.clipIndex))),
      playing: boolean(sourceMotion.playing, defaults.motion.playing),
      loop: boolean(sourceMotion.loop, defaults.motion.loop),
      speed: clamp(sourceMotion.speed, 0.01, 10, defaults.motion.speed),
      time: Math.max(0, finite(sourceMotion.time, defaults.motion.time)),
      turntable: boolean(sourceMotion.turntable, defaults.motion.turntable),
      turntableSpeed: clamp(sourceMotion.turntableSpeed, 0.01, 10, defaults.motion.turntableSpeed),
      turntableAngle: clamp(
        sourceMotion.turntableAngle ?? sourceMotion.rotationY,
        -Math.PI * 1000,
        Math.PI * 1000,
        defaults.motion.turntableAngle,
      ),
    },
    configurator: sanitizeConfigurator(sourceConfigurator, defaults.configurator),
    render: {
      quality: enumValue(sourceRender.quality, new Set(Object.keys(QUALITY_PROFILES)), defaults.render.quality),
      exportFraming: sourceRender.exportFraming === 'fill-frame'
        ? 'fill'
        : enumValue(sourceRender.exportFraming, EXPORT_FRAMING_MODES, defaults.render.exportFraming),
    },
    experience: sanitizeExperienceState(sourceExperience, defaults.experience),
    runtime: {
      autoQuality: boolean(sourceRuntime.autoQuality, defaults.runtime.autoQuality),
      pauseWhenHidden: boolean(sourceRuntime.pauseWhenHidden, defaults.runtime.pauseWhenHidden),
      recoveryEnabled: boolean(sourceRuntime.recoveryEnabled, defaults.runtime.recoveryEnabled),
    },
  };

  return {
    project,
    sourceVersion,
    targetVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    migrated: sourceVersion !== CURRENT_PROJECT_SCHEMA_VERSION,
  };
}

export function sanitizeProjectState(input, options = {}) {
  return migrateProjectState(input, options).project;
}
