export const MAX_PRESENTATION_STATES = 32;

const MATERIAL_MODES = new Set(['original', 'clay', 'chrome', 'matte']);
const CAMERA_MODES = new Set(['presentation', 'inspect']);
const QUALITY_MODES = new Set(['performance', 'balanced', 'quality']);
const EXPORT_MODES = new Set(['match-viewport', 'fill']);
const INFO_DISPLAY_MODES = new Set(['off', 'selected', 'all']);

const clone = (value) => (typeof structuredClone === 'function'
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value)));
const finite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const clamp = (value, min, max, fallback = min) => Math.min(max, Math.max(min, finite(value, fallback)));
const bool = (value, fallback = false) => (typeof value === 'boolean' ? value : fallback);
const cleanText = (value, fallback = '', maxLength = 120) => {
  const normalized = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return (normalized || fallback).slice(0, maxLength);
};

function cleanId(value, fallback = null, maxLength = 120) {
  if (value === null || value === undefined || value === '') return fallback;
  const normalized = String(value).trim().replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, maxLength);
  return normalized || fallback;
}

function isoDate(value, fallback = null) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function sanitizeRotation(value) {
  const limit = Math.PI * 2;
  return {
    x: clamp(value?.x, -limit, limit, 0),
    y: clamp(value?.y, -limit, limit, 0),
    z: clamp(value?.z, -limit, limit, 0),
  };
}

function sanitizeTarget(value) {
  return {
    x: clamp(value?.x, -1, 1, 0),
    y: clamp(value?.y, 0, 1, 0.47),
    z: clamp(value?.z, -1, 1, 0),
  };
}

function sanitizeDirection(value, fallback = [1.12, 0.45, 1.65]) {
  const source = Array.isArray(value) && value.length >= 3
    ? value.slice(0, 3).map((component, index) => finite(component, fallback[index]))
    : [...fallback];
  const length = Math.hypot(...source);
  return Number.isFinite(length) && length > 0.000001 ? source.map((component) => component / length) : [1, 0, 0];
}

function sanitizePose(value, fallbackTarget) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return {
    target: sanitizeTarget(value.target || fallbackTarget),
    direction: sanitizeDirection(value.direction),
    distance: clamp(value.distance, 0.05, 100, 2.8),
    up: sanitizeDirection(value.up, [0, 1, 0]),
    sourceAspect: clamp(value.sourceAspect, 0.1, 10, 16 / 9),
  };
}

function sanitizeBooleanMap(value, max = 4096) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  Object.entries(value).slice(0, max).forEach(([key, flag]) => {
    const id = cleanId(key);
    if (id && typeof flag === 'boolean') result[id] = flag;
  });
  return result;
}

function sanitizeStringMap(value, max = 128) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  Object.entries(value).slice(0, max).forEach(([key, item]) => {
    const safeKey = cleanId(key);
    const safeValue = cleanId(item);
    if (safeKey && safeValue) result[safeKey] = safeValue;
  });
  return result;
}

function sanitizeSideOverrides(value) {
  const policies = new Set(['original', 'front', 'back', 'double']);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  Object.entries(value).slice(0, 512).forEach(([key, policy]) => {
    const id = String(key).replace(/[^0-9]/g, '').slice(0, 8);
    if (id && policies.has(policy)) result[id] = policy;
  });
  return result;
}

export function createPresentationStateId() {
  if (globalThis.crypto?.randomUUID) return `presentation_${globalThis.crypto.randomUUID()}`;
  return `presentation_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function sanitizePresentationSnapshot(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const studio = source.studio || {};
  const model = source.model || {};
  const camera = source.camera || {};
  const configurator = source.configurator || {};
  const render = source.render || {};
  const target = sanitizeTarget(camera.target);
  return {
    studio: {
      preset: cleanId(studio.preset, null, 64),
      backdropPreset: cleanId(studio.backdropPreset, null, 64),
      lightingPreset: cleanId(studio.lightingPreset, null, 64),
      backdropTone: clamp(studio.backdropTone, 0.001, 0.999, 0.48),
      exposure: clamp(studio.exposure, 0.1, 4, 0.98),
      environment: clamp(studio.environment, 0, 8, 1.18),
      environmentRotation: clamp(studio.environmentRotation, -Math.PI * 8, Math.PI * 8, Math.PI * 0.08),
      key: clamp(studio.key, 0, 20, 2.35),
      fill: clamp(studio.fill, 0, 20, 0.78),
      rim: clamp(studio.rim, 0, 20, 1.8),
      bloom: clamp(studio.bloom, 0, 2, 0),
      groundOffset: clamp(studio.groundOffset, -10, 10, 0),
      shadow: clamp(studio.shadow, 0, 1, 0.52),
      shadowSoftness: clamp(studio.shadowSoftness, 0.01, 2, 0.58),
      floorEnabled: bool(studio.floorEnabled, true),
      shadowsEnabled: bool(studio.shadowsEnabled, true),
      postEnabled: bool(studio.postEnabled, true),
    },
    model: {
      materialMode: MATERIAL_MODES.has(model.materialMode) ? model.materialMode : 'original',
      userScale: clamp(model.userScale, 0.01, 100, 1),
      userOffset: clamp(model.userOffset, -100, 100, 0),
      rotation: sanitizeRotation(model.rotation),
      positionXZ: { x: clamp(model.positionXZ?.x, -50, 50, 0), z: clamp(model.positionXZ?.z, -50, 50, 0) },
      backfaceRepairEnabled: bool(model.backfaceRepairEnabled, false),
      materialSideOverrides: sanitizeSideOverrides(model.materialSideOverrides),
    },
    camera: {
      preset: cleanId(camera.preset, null, 64),
      focalLength: clamp(camera.focalLength, 18, 160, 50),
      target,
      pose: sanitizePose(camera.pose, target),
      damping: clamp(camera.damping, 0.01, 0.3, 0.08),
      autoRotate: bool(camera.autoRotate, false),
      horizonLocked: bool(camera.horizonLocked, true),
      mode: CAMERA_MODES.has(camera.mode) ? camera.mode : 'presentation',
    },
    configurator: {
      partVisibility: sanitizeBooleanMap(configurator.partVisibility),
      variantSelections: sanitizeStringMap(configurator.variantSelections),
      activeConfigurationId: cleanId(configurator.activeConfigurationId),
      variantPreviewEnabled: bool(configurator.variantPreviewEnabled, false),
      infographicDisplay: INFO_DISPLAY_MODES.has(configurator.infographicDisplay) ? configurator.infographicDisplay : 'off',
      selectedInfographicId: cleanId(configurator.selectedInfographicId),
    },
    render: {
      quality: QUALITY_MODES.has(render.quality) ? render.quality : 'quality',
      exportFraming: EXPORT_MODES.has(render.exportFraming) ? render.exportFraming : 'match-viewport',
    },
  };
}

export function sanitizePresentationStates(value) {
  const source = Array.isArray(value) ? value : [];
  const usedIds = new Set();
  return source.slice(0, MAX_PRESENTATION_STATES).map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    let id = cleanId(item.id, `presentation_${index + 1}`);
    const base = id;
    let suffix = 2;
    while (usedIds.has(id)) id = `${base}-${suffix++}`;
    usedIds.add(id);
    return {
      id,
      name: cleanText(item.name, `Presentation ${index + 1}`, 100),
      snapshot: sanitizePresentationSnapshot(item.snapshot),
      createdAt: isoDate(item.createdAt),
      updatedAt: isoDate(item.updatedAt),
    };
  }).filter(Boolean);
}

export function sanitizePresentationState(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const presentations = sanitizePresentationStates(source.presentations ?? source.presentationStates);
  const candidate = cleanId(source.activePresentationId ?? source.activePresentationStateId);
  return { presentations, activePresentationId: presentations.some((item) => item.id === candidate) ? candidate : null };
}

export class PresentationStateLibrary {
  constructor({ onChange } = {}) {
    this.onChange = onChange;
    this.presentations = [];
    this.activePresentationId = null;
  }

  applyState(state = {}, { notify = true } = {}) {
    const sanitized = sanitizePresentationState(state);
    this.presentations = sanitized.presentations;
    this.activePresentationId = sanitized.activePresentationId;
    if (notify) this.#notify('state-apply');
    return this.getState();
  }

  capture(name, snapshot) {
    if (this.presentations.length >= MAX_PRESENTATION_STATES) return null;
    const now = new Date().toISOString();
    const item = {
      id: createPresentationStateId(),
      name: cleanText(name, `Presentation ${this.presentations.length + 1}`, 100),
      snapshot: sanitizePresentationSnapshot(snapshot),
      createdAt: now,
      updatedAt: now,
    };
    this.presentations.unshift(item);
    this.activePresentationId = item.id;
    this.#notify('capture');
    return clone(item);
  }

  apply(id, callback) {
    const item = this.presentations.find((candidate) => candidate.id === id);
    if (!item) return false;
    this.activePresentationId = id;
    callback?.(clone(item.snapshot), clone(item));
    this.#notify('apply');
    return true;
  }

  get(id) {
    const item = this.presentations.find((candidate) => candidate.id === id);
    return item ? clone(item) : null;
  }

  delete(id) {
    const before = this.presentations.length;
    this.presentations = this.presentations.filter((item) => item.id !== id);
    if (this.activePresentationId === id) this.activePresentationId = null;
    const changed = before !== this.presentations.length;
    if (changed) this.#notify('delete');
    return changed;
  }

  clear({ notify = true } = {}) {
    this.presentations = [];
    this.activePresentationId = null;
    if (notify) this.#notify('clear');
  }

  getState() {
    return clone({ presentations: this.presentations, activePresentationId: this.activePresentationId });
  }

  getReport() {
    return clone({
      ...this.getState(),
      count: this.presentations.length,
      activePresentation: this.presentations.find((item) => item.id === this.activePresentationId) || null,
    });
  }

  #notify(reason) {
    this.onChange?.({ reason, state: this.getState(), report: this.getReport() });
  }
}
