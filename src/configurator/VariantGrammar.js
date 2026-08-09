export const MAX_VARIANT_GROUPS = 24;
export const MAX_VARIANT_OPTIONS = 32;
export const MAX_VARIANT_CONFIGURATIONS = 32;
export const MAX_VARIANT_TARGETS = 256;

const APPEARANCE_KEYS = ['color', 'roughness', 'metalness', 'clearcoat'];

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

function text(value, fallback = '', maxLength = 80) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return (normalized || fallback).slice(0, maxLength);
}

function sanitizeId(value, fallback, prefix) {
  const source = text(value, fallback, 120).replace(/[^a-zA-Z0-9_-]/g, '-');
  const normalized = source || fallback;
  return normalized.startsWith(`${prefix}_`) || normalized.startsWith(`${prefix}-`)
    ? normalized
    : `${prefix}_${normalized}`;
}

export function sanitizePartId(value) {
  const normalized = typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 96)
    : '';
  return /^part_[a-z0-9_]+$/.test(normalized) ? normalized : null;
}

export function sanitizeHexColor(value, fallback = null) {
  if (typeof value !== 'string') return fallback;
  const raw = value.trim().toLowerCase();
  const short = /^#([0-9a-f]{3})$/.exec(raw);
  if (short) return `#${[...short[1]].map((char) => `${char}${char}`).join('')}`;
  const full = /^#([0-9a-f]{6})$/.exec(raw);
  return full ? `#${full[1]}` : fallback;
}

export function sanitizeAppearanceStyle(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = {};
  const color = sanitizeHexColor(value.color, null);
  if (color) result.color = color;
  ['roughness', 'metalness', 'clearcoat'].forEach((key) => {
    if (value[key] !== null && value[key] !== undefined && Number.isFinite(Number(value[key]))) {
      result[key] = clamp(value[key], 0, 1, 0);
    }
  });
  return Object.keys(result).length ? result : null;
}

function sanitizeAppearanceMap(value, validPartIds = null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  Object.entries(value).slice(0, MAX_VARIANT_TARGETS).forEach(([candidateId, style]) => {
    const partId = sanitizePartId(candidateId);
    const sanitized = sanitizeAppearanceStyle(style);
    if (!partId || !sanitized) return;
    if (validPartIds && !validPartIds.has(partId)) return;
    result[partId] = sanitized;
  });
  return result;
}

function sanitizeVisibilityMap(value, validPartIds = null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  Object.entries(value).slice(0, MAX_VARIANT_TARGETS).forEach(([candidateId, visible]) => {
    const partId = sanitizePartId(candidateId);
    if (!partId || typeof visible !== 'boolean') return;
    if (validPartIds && !validPartIds.has(partId)) return;
    result[partId] = visible;
  });
  return result;
}

function uniqueId(candidate, fallback, prefix, used) {
  const base = sanitizeId(candidate, fallback, prefix);
  let id = base;
  let suffix = 2;
  while (used.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(id);
  return id;
}

export function sanitizeVariantOption(option, index = 0, { validPartIds = null, usedIds = new Set() } = {}) {
  if (!option || typeof option !== 'object' || Array.isArray(option)) return null;
  const id = uniqueId(option.id, `option-${index + 1}`, 'option', usedIds);
  const appearance = sanitizeAppearanceMap(option.changes?.appearance ?? option.appearance, validPartIds);
  const visibility = sanitizeVisibilityMap(option.changes?.visibility ?? option.visibility, validPartIds);
  if (!Object.keys(appearance).length && !Object.keys(visibility).length) return null;
  const swatch = sanitizeHexColor(option.swatch, Object.values(appearance)[0]?.color || null);
  return {
    id,
    name: text(option.name, `Option ${index + 1}`, 80),
    swatch,
    changes: { appearance, visibility },
    createdAt: typeof option.createdAt === 'string' ? option.createdAt : null,
  };
}

export function sanitizeVariantGroup(group, index = 0, { validPartIds = null, usedIds = new Set() } = {}) {
  if (!group || typeof group !== 'object' || Array.isArray(group)) return null;
  const id = uniqueId(group.id, `group-${index + 1}`, 'group', usedIds);
  const optionIds = new Set();
  const options = (Array.isArray(group.options) ? group.options : [])
    .slice(0, MAX_VARIANT_OPTIONS)
    .map((option, optionIndex) => sanitizeVariantOption(option, optionIndex, { validPartIds, usedIds: optionIds }))
    .filter(Boolean);
  const defaultOptionId = options.some((option) => option.id === group.defaultOptionId)
    ? group.defaultOptionId
    : options[0]?.id || null;
  return {
    id,
    name: text(group.name, `Group ${index + 1}`, 80),
    required: group.required !== false,
    defaultOptionId,
    options,
    createdAt: typeof group.createdAt === 'string' ? group.createdAt : null,
  };
}

export function sanitizeVariantGroups(groups, { validPartIds = null } = {}) {
  const usedIds = new Set();
  return (Array.isArray(groups) ? groups : [])
    .slice(0, MAX_VARIANT_GROUPS)
    .map((group, index) => sanitizeVariantGroup(group, index, { validPartIds, usedIds }))
    .filter(Boolean);
}

export function sanitizeVariantSelections(value, groups, { applyDefaults = true } = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const result = {};
  (groups || []).forEach((group) => {
    const candidate = source[group.id];
    const selected = group.options.find((option) => option.id === candidate);
    if (selected) result[group.id] = selected.id;
    else if (applyDefaults && group.required && group.defaultOptionId) result[group.id] = group.defaultOptionId;
  });
  return result;
}

export function sanitizeVariantConfigurations(value, groups) {
  const usedIds = new Set();
  return (Array.isArray(value) ? value : [])
    .slice(0, MAX_VARIANT_CONFIGURATIONS)
    .map((configuration, index) => {
      if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) return null;
      return {
        id: uniqueId(configuration.id, `configuration-${index + 1}`, 'configuration', usedIds),
        name: text(configuration.name, `Configuration ${index + 1}`, 80),
        selections: sanitizeVariantSelections(configuration.selections, groups, { applyDefaults: false }),
        createdAt: typeof configuration.createdAt === 'string' ? configuration.createdAt : null,
      };
    })
    .filter(Boolean);
}

function sortedObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}

function valuesEqual(a, b) {
  if (typeof a === 'number' || typeof b === 'number') return Math.abs(Number(a) - Number(b)) <= 0.000001;
  return a === b;
}

export function resolveVariantSelection({
  groups = [],
  selections = {},
  validPartIds = null,
  expandAppearanceTarget = null,
} = {}) {
  const sanitizedGroups = sanitizeVariantGroups(groups, { validPartIds });
  const normalizedSelections = sanitizeVariantSelections(selections, sanitizedGroups, { applyDefaults: true });
  const visibility = {};
  const appearanceByMesh = {};
  const visibilitySources = new Map();
  const appearanceSources = new Map();
  const conflicts = [];
  const activeOptions = [];

  sanitizedGroups.forEach((group, groupIndex) => {
    const optionId = normalizedSelections[group.id];
    const option = group.options.find((candidate) => candidate.id === optionId);
    if (!option) return;
    activeOptions.push({ groupId: group.id, groupName: group.name, optionId: option.id, optionName: option.name, groupIndex });

    Object.entries(option.changes.visibility).forEach(([partId, visible]) => {
      const previous = visibilitySources.get(partId);
      if (previous && previous.value !== visible) {
        conflicts.push({
          type: 'visibility',
          targetId: partId,
          property: 'visible',
          previous,
          next: { groupId: group.id, optionId: option.id, value: visible },
        });
      }
      visibility[partId] = visible;
      visibilitySources.set(partId, { groupId: group.id, optionId: option.id, value: visible });
    });

    Object.entries(option.changes.appearance).forEach(([partId, style]) => {
      const expanded = typeof expandAppearanceTarget === 'function'
        ? expandAppearanceTarget(partId)
        : [partId];
      const meshIds = [...new Set((Array.isArray(expanded) ? expanded : [partId])
        .map((id) => sanitizePartId(id))
        .filter(Boolean))];
      meshIds.forEach((meshId) => {
        appearanceByMesh[meshId] ||= {};
        APPEARANCE_KEYS.forEach((property) => {
          if (!(property in style)) return;
          const sourceKey = `${meshId}:${property}`;
          const previous = appearanceSources.get(sourceKey);
          if (previous && !valuesEqual(previous.value, style[property])) {
            conflicts.push({
              type: 'appearance',
              targetId: meshId,
              authoredTargetId: partId,
              property,
              previous,
              next: { groupId: group.id, optionId: option.id, value: style[property] },
            });
          }
          appearanceByMesh[meshId][property] = style[property];
          appearanceSources.set(sourceKey, { groupId: group.id, optionId: option.id, value: style[property] });
        });
      });
    });
  });

  return {
    groups: sanitizedGroups,
    selections: sortedObject(normalizedSelections),
    visibility: sortedObject(visibility),
    appearanceByMesh: sortedObject(appearanceByMesh),
    conflicts,
    activeOptions,
  };
}

export function sanitizeVariantState(value, { validPartIds = null } = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const groups = sanitizeVariantGroups(source.variantGroups ?? source.groups, { validPartIds });
  const selections = sanitizeVariantSelections(source.variantSelections ?? source.selections, groups, { applyDefaults: true });
  const configurations = sanitizeVariantConfigurations(source.configurations, groups);
  const activeConfigurationId = configurations.some((configuration) => configuration.id === source.activeConfigurationId)
    ? source.activeConfigurationId
    : null;
  return clone({ variantGroups: groups, variantSelections: selections, configurations, activeConfigurationId });
}
