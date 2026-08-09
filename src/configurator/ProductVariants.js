import {
  MAX_VARIANT_GROUPS,
  MAX_VARIANT_OPTIONS,
  MAX_VARIANT_CONFIGURATIONS,
  sanitizeAppearanceStyle,
  sanitizeHexColor,
  sanitizeVariantState,
  resolveVariantSelection,
} from './VariantGrammar.js';

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function cleanName(value, fallback, maxLength = 80) {
  const text = typeof value === 'string' ? value.trim() : '';
  return (text || fallback).slice(0, maxLength);
}

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export class ProductVariants {
  constructor({ getValidPartIds, expandAppearanceTarget, onApply, onChange } = {}) {
    this.getValidPartIds = getValidPartIds;
    this.expandAppearanceTarget = expandAppearanceTarget;
    this.onApply = onApply;
    this.onChange = onChange;
    this.groups = [];
    this.selections = {};
    this.configurations = [];
    this.activeConfigurationId = null;
    this.lastResolution = resolveVariantSelection();
  }

  attach() {
    this.clearAll({ notify: false });
    this.#apply('attach', false);
    return this.getReport();
  }

  detach() {
    this.clearAll({ notify: false });
    this.#apply('detach', false);
  }

  applyState(state = {}) {
    const validPartIds = this.#validPartIds();
    const sanitized = sanitizeVariantState(state, { validPartIds });
    this.groups = sanitized.variantGroups;
    this.selections = sanitized.variantSelections;
    this.configurations = sanitized.configurations;
    this.activeConfigurationId = sanitized.activeConfigurationId;
    this.#apply('state-apply');
    return this.getState();
  }

  createGroup(name, { required = true } = {}) {
    if (this.groups.length >= MAX_VARIANT_GROUPS) return null;
    const group = {
      id: createId('group'),
      name: cleanName(name, `Option group ${this.groups.length + 1}`),
      required: Boolean(required),
      defaultOptionId: null,
      options: [],
      createdAt: new Date().toISOString(),
    };
    this.groups.push(group);
    this.activeConfigurationId = null;
    this.#apply('group-create');
    return clone(group);
  }

  deleteGroup(groupId) {
    const before = this.groups.length;
    this.groups = this.groups.filter((group) => group.id !== groupId);
    delete this.selections[groupId];
    this.configurations = this.configurations.map((configuration) => {
      const selections = { ...configuration.selections };
      delete selections[groupId];
      return { ...configuration, selections };
    });
    const changed = this.groups.length !== before;
    if (changed) {
      this.activeConfigurationId = null;
      this.#apply('group-delete');
    }
    return changed;
  }

  setGroupRequired(groupId, required) {
    const group = this.groups.find((candidate) => candidate.id === groupId);
    if (!group) return false;
    group.required = Boolean(required);
    this.activeConfigurationId = null;
    this.#apply('group-required');
    return true;
  }

  createOption(groupId, { name, swatch = null, appearance = {}, visibility = {} } = {}) {
    const group = this.groups.find((candidate) => candidate.id === groupId);
    if (!group || group.options.length >= MAX_VARIANT_OPTIONS) return null;
    const valid = this.#validPartIds();
    const sanitizedAppearance = {};
    Object.entries(appearance || {}).forEach(([partId, style]) => {
      if (valid.size && !valid.has(partId)) return;
      const normalized = sanitizeAppearanceStyle(style);
      if (normalized) sanitizedAppearance[partId] = normalized;
    });
    const sanitizedVisibility = {};
    Object.entries(visibility || {}).forEach(([partId, visible]) => {
      if (valid.size && !valid.has(partId)) return;
      if (typeof visible === 'boolean') sanitizedVisibility[partId] = visible;
    });
    if (!Object.keys(sanitizedAppearance).length && !Object.keys(sanitizedVisibility).length) return null;
    const option = {
      id: createId('option'),
      name: cleanName(name, `Option ${group.options.length + 1}`),
      swatch: sanitizeHexColor(swatch, Object.values(sanitizedAppearance)[0]?.color || null),
      changes: { appearance: sanitizedAppearance, visibility: sanitizedVisibility },
      createdAt: new Date().toISOString(),
    };
    group.options.push(option);
    if (!group.defaultOptionId) group.defaultOptionId = option.id;
    this.selections[group.id] = option.id;
    this.activeConfigurationId = null;
    this.#apply('option-create');
    return clone(option);
  }

  deleteOption(groupId, optionId) {
    const group = this.groups.find((candidate) => candidate.id === groupId);
    if (!group) return false;
    const before = group.options.length;
    group.options = group.options.filter((option) => option.id !== optionId);
    if (group.defaultOptionId === optionId) group.defaultOptionId = group.options[0]?.id || null;
    if (this.selections[groupId] === optionId) delete this.selections[groupId];
    this.configurations = this.configurations.map((configuration) => {
      const selections = { ...configuration.selections };
      if (selections[groupId] === optionId) delete selections[groupId];
      return { ...configuration, selections };
    });
    const changed = group.options.length !== before;
    if (changed) {
      this.activeConfigurationId = null;
      this.#apply('option-delete');
    }
    return changed;
  }

  setDefaultOption(groupId, optionId) {
    const group = this.groups.find((candidate) => candidate.id === groupId);
    if (!group || !group.options.some((option) => option.id === optionId)) return false;
    group.defaultOptionId = optionId;
    if (group.required && !this.selections[groupId]) this.selections[groupId] = optionId;
    this.#apply('default-option');
    return true;
  }

  activateOption(groupId, optionId) {
    const group = this.groups.find((candidate) => candidate.id === groupId);
    if (!group || !group.options.some((option) => option.id === optionId)) return false;
    this.selections[groupId] = optionId;
    this.activeConfigurationId = null;
    this.#apply('option-activate');
    return true;
  }

  clearSelection(groupId) {
    const group = this.groups.find((candidate) => candidate.id === groupId);
    if (!group || group.required) return false;
    delete this.selections[groupId];
    this.activeConfigurationId = null;
    this.#apply('selection-clear');
    return true;
  }

  setSelections(selections = {}, { activeConfigurationId = null } = {}) {
    this.selections = selections && typeof selections === 'object' && !Array.isArray(selections)
      ? { ...selections }
      : {};
    this.activeConfigurationId = this.configurations.some((configuration) => configuration.id === activeConfigurationId)
      ? activeConfigurationId
      : null;
    this.#apply('selection-set');
    return this.getSelections();
  }

  resetSelectionsToDefaults() {
    this.selections = {};
    this.activeConfigurationId = null;
    this.#apply('selection-reset');
    return this.getSelections();
  }

  captureConfiguration(name) {
    if (this.configurations.length >= MAX_VARIANT_CONFIGURATIONS) return null;
    const configuration = {
      id: createId('configuration'),
      name: cleanName(name, `Configuration ${this.configurations.length + 1}`),
      selections: this.getSelections(),
      createdAt: new Date().toISOString(),
    };
    this.configurations.unshift(configuration);
    this.activeConfigurationId = configuration.id;
    this.#notify('configuration-save');
    return clone(configuration);
  }

  applyConfiguration(id) {
    const configuration = this.configurations.find((candidate) => candidate.id === id);
    if (!configuration) return false;
    this.selections = { ...configuration.selections };
    this.activeConfigurationId = id;
    this.#apply('configuration-apply');
    return true;
  }

  deleteConfiguration(id) {
    const before = this.configurations.length;
    this.configurations = this.configurations.filter((configuration) => configuration.id !== id);
    if (this.activeConfigurationId === id) this.activeConfigurationId = null;
    const changed = this.configurations.length !== before;
    if (changed) this.#notify('configuration-delete');
    return changed;
  }

  clearAll({ notify = true } = {}) {
    this.groups = [];
    this.selections = {};
    this.configurations = [];
    this.activeConfigurationId = null;
    this.lastResolution = resolveVariantSelection();
    if (notify) this.#apply('variants-clear');
  }

  getSelections() {
    return clone(this.lastResolution?.selections || this.selections);
  }

  getState() {
    return clone({
      variantGroups: this.groups,
      variantSelections: this.getSelections(),
      configurations: this.configurations,
      activeConfigurationId: this.activeConfigurationId,
    });
  }

  getReport() {
    const optionCount = this.groups.reduce((total, group) => total + group.options.length, 0);
    const selections = this.getSelections();
    const groups = this.groups.map((group) => ({
      ...group,
      activeOptionId: selections[group.id] || null,
    }));
    return clone({
      ...this.getState(),
      groups,
      selections,
      groupCount: this.groups.length,
      optionCount,
      configurationCount: this.configurations.length,
      activeOptions: this.lastResolution.activeOptions,
      conflicts: this.lastResolution.conflicts,
      conflictCount: this.lastResolution.conflicts.length,
    });
  }

  #validPartIds() {
    const source = this.getValidPartIds?.();
    if (source instanceof Set) return source;
    return new Set(Array.isArray(source) ? source : []);
  }

  #apply(reason, notify = true) {
    const validPartIds = this.#validPartIds();
    this.lastResolution = resolveVariantSelection({
      groups: this.groups,
      selections: this.selections,
      validPartIds: validPartIds.size ? validPartIds : null,
      expandAppearanceTarget: (partId) => this.expandAppearanceTarget?.(partId) || [partId],
    });
    this.groups = this.lastResolution.groups;
    this.selections = this.lastResolution.selections;
    this.onApply?.(clone(this.lastResolution));
    if (notify) this.#notify(reason);
  }

  #notify(reason) {
    this.onChange?.({ reason, state: this.getState(), report: this.getReport() });
  }
}
