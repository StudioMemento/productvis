import {
  MAX_INFOGRAPHICS,
  INFOGRAPHIC_DISPLAY_MODES,
  createInfographicId,
  sanitizeInfographicState,
  sanitizeInfographics,
  sanitizeInfographicAnchorId,
} from './InfographicGrammar.js';

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export class InfographicSystem {
  constructor({ onChange } = {}) {
    this.onChange = onChange;
    this.records = [];
    this.display = 'off';
    this.selectedId = null;
    this.anchorMarkers = [];
  }

  setAnchorMarkers(markers = []) {
    this.anchorMarkers = Array.isArray(markers) ? markers : [];
    return this.getReport();
  }

  applyState(state = {}, { notify = false } = {}) {
    const sanitized = sanitizeInfographicState(state);
    this.records = sanitized.infographics;
    this.display = sanitized.infographicDisplay;
    this.selectedId = sanitized.selectedInfographicId;
    if (notify) this.#notify('state-apply');
    return this.getState();
  }

  reset({ notify = true } = {}) {
    this.records = [];
    this.display = 'off';
    this.selectedId = null;
    if (notify) this.#notify('reset');
    return this.getState();
  }

  create({ anchorId, eyebrow, title, body, accent, side } = {}) {
    const normalizedAnchor = sanitizeInfographicAnchorId(anchorId);
    if (!normalizedAnchor || this.records.length >= MAX_INFOGRAPHICS) return null;
    const now = new Date().toISOString();
    const record = sanitizeInfographics([{
      id: createInfographicId(),
      anchorId: normalizedAnchor,
      eyebrow,
      title,
      body,
      accent,
      side,
      visible: true,
      createdAt: now,
      updatedAt: now,
    }])[0];
    if (!record) return null;
    this.records.unshift(record);
    this.selectedId = record.id;
    if (this.display === 'off') this.display = 'selected';
    this.#notify('create');
    return clone(record);
  }

  update(id, patch = {}) {
    const index = this.records.findIndex((item) => item.id === id);
    if (index < 0) return null;
    const current = this.records[index];
    const record = sanitizeInfographics([{
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    }])[0];
    if (!record) return null;
    this.records[index] = record;
    this.selectedId = record.id;
    this.#notify('update');
    return clone(record);
  }

  delete(id = this.selectedId) {
    const before = this.records.length;
    this.records = this.records.filter((item) => item.id !== id);
    if (this.selectedId === id) this.selectedId = this.records[0]?.id || null;
    const changed = before !== this.records.length;
    if (changed) this.#notify('delete');
    return changed;
  }

  select(id) {
    this.selectedId = this.records.some((item) => item.id === id) ? id : null;
    this.#notify('select');
    return this.selectedId;
  }

  setDisplay(mode) {
    this.display = INFOGRAPHIC_DISPLAY_MODES.has(mode) ? mode : 'off';
    this.#notify('display');
    return this.display;
  }

  setVisible(id, visible) {
    const record = this.records.find((item) => item.id === id);
    if (!record) return false;
    record.visible = Boolean(visible);
    record.updatedAt = new Date().toISOString();
    this.#notify('visible');
    return true;
  }

  get(id) {
    const record = this.records.find((item) => item.id === id);
    return record ? clone(record) : null;
  }

  getState() {
    return {
      infographics: clone(this.records),
      infographicDisplay: this.display,
      selectedInfographicId: this.selectedId,
    };
  }

  getReport(markers = this.anchorMarkers) {
    const markerMap = new Map((Array.isArray(markers) ? markers : []).map((marker) => [marker.id, marker]));
    const records = this.records.map((record) => {
      const marker = markerMap.get(record.anchorId);
      return {
        ...clone(record),
        selected: record.id === this.selectedId,
        resolved: Boolean(marker?.resolved !== false && marker?.worldPosition),
        anchorName: marker?.name || 'Missing anchor',
      };
    });
    return {
      infographics: records,
      infographicCount: records.length,
      unresolvedCount: records.filter((record) => !record.resolved).length,
      display: this.display,
      selectedInfographicId: this.selectedId,
      selectedInfographic: records.find((record) => record.id === this.selectedId) || null,
      availableAnchors: (Array.isArray(markers) ? markers : []).map((marker) => ({
        id: marker.id,
        name: marker.name,
        resolved: marker.resolved !== false,
      })),
    };
  }

  #notify(reason) {
    this.onChange?.({ reason, state: this.getState(), report: this.getReport() });
  }
}
