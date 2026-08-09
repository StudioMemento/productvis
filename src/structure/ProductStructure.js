import * as THREE from 'three';
import {
  buildStructureIndex,
  filterStructureRecords,
  sanitizeVisibilityOverrides,
} from './StructureIndex.js';

const MAX_VISIBILITY_STATES = 32;
const MAX_ANCHORS = 128;
const ANCHOR_DISPLAY_MODES = new Set(['off', 'selected', 'all']);

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

function finiteVector(value, fallback = [0, 0, 0]) {
  const source = Array.isArray(value) && value.length >= 3 ? value : fallback;
  return source.map((component, index) => {
    const number = Number(component);
    return Number.isFinite(number) ? THREE.MathUtils.clamp(number, -1_000_000, 1_000_000) : fallback[index];
  });
}

function sanitizeAnchor(anchor, index = 0) {
  if (!anchor || typeof anchor !== 'object') return null;
  const id = String(anchor.id || createId('anchor')).slice(0, 120);
  const attachment = anchor.attachment && typeof anchor.attachment === 'object'
    ? anchor.attachment
    : {};
  const type = attachment.type === 'part' ? 'part' : 'root';
  const partId = type === 'part' && /^part_[a-z0-9_]+$/i.test(String(attachment.partId || ''))
    ? String(attachment.partId).slice(0, 96)
    : null;
  return {
    id,
    name: cleanName(anchor.name, `Anchor ${index + 1}`),
    kind: ['part-center', 'camera-target', 'custom'].includes(anchor.kind) ? anchor.kind : 'custom',
    attachment: {
      type: partId ? 'part' : 'root',
      partId,
      localPosition: finiteVector(attachment.localPosition),
    },
    fallbackRootLocalPosition: finiteVector(anchor.fallbackRootLocalPosition),
    createdAt: typeof anchor.createdAt === 'string' ? anchor.createdAt : new Date().toISOString(),
  };
}

function sanitizeVisibilityState(state, index = 0, validIds = null) {
  if (!state || typeof state !== 'object') return null;
  return {
    id: String(state.id || createId('state')).slice(0, 120),
    name: cleanName(state.name, `State ${index + 1}`),
    visibility: sanitizeVisibilityOverrides(state.visibility, validIds),
    createdAt: typeof state.createdAt === 'string' ? state.createdAt : new Date().toISOString(),
  };
}

function sortObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}

export class ProductStructure {
  constructor({ scene, onChange } = {}) {
    this.scene = scene;
    this.onChange = onChange;
    this.root = null;
    this.index = buildStructureIndex(null);
    this.visibilityOverrides = new Map();
    this.variantVisibilityOverrides = new Map();
    this.visibilityStates = [];
    this.activeVisibilityStateId = null;
    this.selectedPartId = null;
    this.anchors = [];
    this.anchorDisplay = 'off';
    this.selectedAnchorId = null;
    this.selectionBox = new THREE.Box3();
    this.selectionHelperEnabled = true;
    this.selectionHelper = new THREE.Box3Helper(this.selectionBox, 0xff7950);
    this.selectionHelper.name = 'Product VIS Part Selection';
    this.selectionHelper.visible = false;
    this.selectionHelper.renderOrder = 999;
    if (this.selectionHelper.material) {
      this.selectionHelper.material.depthTest = false;
      this.selectionHelper.material.transparent = true;
      this.selectionHelper.material.opacity = 0.9;
      this.selectionHelper.material.toneMapped = false;
    }
    this.scene?.add(this.selectionHelper);
  }

  attach(root) {
    this.root = root || null;
    this.index = buildStructureIndex(this.root);
    this.visibilityOverrides.clear();
    this.variantVisibilityOverrides.clear();
    this.visibilityStates = [];
    this.activeVisibilityStateId = null;
    this.selectedPartId = null;
    this.anchors = [];
    this.anchorDisplay = 'off';
    this.selectedAnchorId = null;

    this.index.records.forEach((record) => {
      const object = record.object;
      object.userData = object.userData || {};
      object.userData.__pvStructureId = record.id;
      object.userData.__pvAuthoredVisibility = record.authoredVisible;
    });
    this.#applyVisibility();
    this.updateSelectionHelper();
    return this.getReport();
  }

  detach() {
    this.root = null;
    this.index = buildStructureIndex(null);
    this.visibilityOverrides.clear();
    this.variantVisibilityOverrides.clear();
    this.visibilityStates = [];
    this.activeVisibilityStateId = null;
    this.selectedPartId = null;
    this.anchors = [];
    this.anchorDisplay = 'off';
    this.selectedAnchorId = null;
    this.selectionHelper.visible = false;
  }

  dispose() {
    this.detach();
    this.scene?.remove(this.selectionHelper);
    this.selectionHelper.geometry?.dispose?.();
    this.selectionHelper.material?.dispose?.();
  }

  getPart(id) {
    return this.index.recordById.get(String(id)) || null;
  }

  selectPart(id) {
    const record = this.getPart(id);
    this.selectedPartId = record?.id || null;
    this.updateSelectionHelper();
    this.#notify('selection', { boundsChanged: false });
    return record ? this.#serializeRecord(record) : null;
  }

  getSelectedPart() {
    const record = this.getPart(this.selectedPartId);
    return record ? this.#serializeRecord(record) : null;
  }

  setPartVisibility(id, visible) {
    const record = this.getPart(id);
    if (!record) return false;
    const next = Boolean(visible);
    if (next === record.authoredVisible) this.visibilityOverrides.delete(record.id);
    else this.visibilityOverrides.set(record.id, next);
    this.activeVisibilityStateId = null;
    this.#applyVisibility();
    this.#notify('visibility', { boundsChanged: true });
    return true;
  }

  togglePartVisibility(id) {
    const record = this.getPart(id);
    if (!record) return false;
    return this.setPartVisibility(id, !this.#requestedVisibility(record));
  }

  resetVisibility() {
    this.visibilityOverrides.clear();
    this.activeVisibilityStateId = null;
    this.#applyVisibility();
    this.#notify('visibility-reset', { boundsChanged: true });
  }

  showAllParts() {
    this.visibilityOverrides.clear();
    this.index.records.forEach((record) => {
      if (!record.authoredVisible) this.visibilityOverrides.set(record.id, true);
    });
    this.activeVisibilityStateId = null;
    this.#applyVisibility();
    this.#notify('visibility-show-all', { boundsChanged: true });
  }

  isolatePart(id = this.selectedPartId) {
    const record = this.getPart(id);
    if (!record) return false;
    const keep = new Set([record.id]);
    let parentId = record.parentId;
    while (parentId) {
      keep.add(parentId);
      parentId = this.getPart(parentId)?.parentId || null;
    }
    const prefix = `${record.path}/`;
    this.index.records.forEach((candidate) => {
      if (candidate.path.startsWith(prefix)) keep.add(candidate.id);
    });

    this.visibilityOverrides.clear();
    this.index.records.forEach((candidate) => {
      const desired = keep.has(candidate.id);
      if (desired !== candidate.authoredVisible) this.visibilityOverrides.set(candidate.id, desired);
    });
    this.activeVisibilityStateId = null;
    this.#applyVisibility();
    this.#notify('visibility-isolate', { boundsChanged: true });
    return true;
  }

  setVisibilityOverrides(value) {
    const validIds = new Set(this.index.records.map((record) => record.id));
    const sanitized = sanitizeVisibilityOverrides(value, validIds);
    this.visibilityOverrides.clear();
    Object.entries(sanitized).forEach(([id, visible]) => {
      const record = this.getPart(id);
      if (record && visible !== record.authoredVisible) this.visibilityOverrides.set(id, visible);
    });
    this.#applyVisibility();
    this.#notify('visibility-apply', { boundsChanged: true });
    return this.getVisibilityOverrides();
  }

  getVisibilityOverrides() {
    return sortObject(Object.fromEntries(this.visibilityOverrides.entries()));
  }

  setVariantVisibilityOverrides(value) {
    const validIds = new Set(this.index.records.map((record) => record.id));
    const sanitized = sanitizeVisibilityOverrides(value, validIds);
    this.variantVisibilityOverrides.clear();
    Object.entries(sanitized).forEach(([id, visible]) => {
      this.variantVisibilityOverrides.set(id, Boolean(visible));
    });
    this.#applyVisibility();
    this.#notify('variant-visibility', { boundsChanged: true });
    return this.getVariantVisibilityOverrides();
  }

  getVariantVisibilityOverrides() {
    return sortObject(Object.fromEntries(this.variantVisibilityOverrides.entries()));
  }

  getValidPartIds() {
    return new Set(this.index.records.map((record) => record.id));
  }

  expandPartToMeshIds(id) {
    const record = this.getPart(id);
    if (!record) return [];
    const prefix = `${record.path}/`;
    return this.index.records
      .filter((candidate) => (candidate.id === record.id || candidate.path.startsWith(prefix))
        && (candidate.kind === 'mesh' || candidate.kind === 'skinned-mesh'))
      .map((candidate) => candidate.id);
  }

  captureVisibilityState(name) {
    const fallback = `State ${this.visibilityStates.length + 1}`;
    const state = {
      id: createId('state'),
      name: cleanName(name, fallback),
      visibility: this.getVisibilityOverrides(),
      createdAt: new Date().toISOString(),
    };
    this.visibilityStates.unshift(state);
    this.visibilityStates = this.visibilityStates.slice(0, MAX_VISIBILITY_STATES);
    this.activeVisibilityStateId = state.id;
    this.#notify('state-save', { boundsChanged: false });
    return clone(state);
  }

  applyVisibilityState(id) {
    const state = this.visibilityStates.find((item) => item.id === id);
    if (!state) return false;
    const validIds = new Set(this.index.records.map((record) => record.id));
    const sanitized = sanitizeVisibilityOverrides(state.visibility, validIds);
    this.visibilityOverrides.clear();
    Object.entries(sanitized).forEach(([partId, visible]) => {
      const record = this.getPart(partId);
      if (record && visible !== record.authoredVisible) this.visibilityOverrides.set(partId, visible);
    });
    this.activeVisibilityStateId = state.id;
    this.#applyVisibility();
    this.#notify('state-apply', { boundsChanged: true });
    return true;
  }

  deleteVisibilityState(id) {
    const before = this.visibilityStates.length;
    this.visibilityStates = this.visibilityStates.filter((item) => item.id !== id);
    if (this.activeVisibilityStateId === id) this.activeVisibilityStateId = null;
    const changed = this.visibilityStates.length !== before;
    if (changed) this.#notify('state-delete', { boundsChanged: false });
    return changed;
  }

  setVisibilityStates(states = [], activeId = null) {
    const validIds = new Set(this.index.records.map((record) => record.id));
    this.visibilityStates = (Array.isArray(states) ? states : [])
      .map((state, index) => sanitizeVisibilityState(state, index, validIds))
      .filter(Boolean)
      .slice(0, MAX_VISIBILITY_STATES);
    this.activeVisibilityStateId = this.visibilityStates.some((state) => state.id === activeId) ? activeId : null;
    return this.getVisibilityStates();
  }

  getVisibilityStates() {
    return clone(this.visibilityStates);
  }

  createAnchorAtPart(partId = this.selectedPartId, name = '') {
    const record = this.getPart(partId);
    if (!record || !this.root) return null;
    this.root.updateMatrixWorld(true);
    const objectBounds = this.#getObjectVisibleBounds(record.object);
    const worldPosition = objectBounds.isEmpty()
      ? record.object.getWorldPosition(new THREE.Vector3())
      : objectBounds.getCenter(new THREE.Vector3());
    const partLocal = record.object.worldToLocal(worldPosition.clone()).toArray();
    const rootLocal = this.root.worldToLocal(worldPosition.clone()).toArray();
    const anchor = {
      id: createId('anchor'),
      name: cleanName(name, `${record.label} anchor`),
      kind: 'part-center',
      attachment: {
        type: 'part',
        partId: record.id,
        localPosition: partLocal,
      },
      fallbackRootLocalPosition: rootLocal,
      createdAt: new Date().toISOString(),
    };
    this.#addAnchor(anchor);
    return clone(anchor);
  }

  createAnchorAtWorld(worldPosition, name = '') {
    if (!this.root || !worldPosition) return null;
    this.root.updateMatrixWorld(true);
    const world = worldPosition.isVector3
      ? worldPosition.clone()
      : new THREE.Vector3(...finiteVector(worldPosition));
    const rootLocal = this.root.worldToLocal(world.clone()).toArray();
    const anchor = {
      id: createId('anchor'),
      name: cleanName(name, `Camera target ${this.anchors.length + 1}`),
      kind: 'camera-target',
      attachment: {
        type: 'root',
        partId: null,
        localPosition: rootLocal,
      },
      fallbackRootLocalPosition: rootLocal,
      createdAt: new Date().toISOString(),
    };
    this.#addAnchor(anchor);
    return clone(anchor);
  }

  #addAnchor(anchor) {
    this.anchors.unshift(anchor);
    this.anchors = this.anchors.slice(0, MAX_ANCHORS);
    this.selectedAnchorId = anchor.id;
    if (this.anchorDisplay === 'off') this.anchorDisplay = 'selected';
    this.#notify('anchor-create', { boundsChanged: false });
  }

  deleteAnchor(id = this.selectedAnchorId) {
    const before = this.anchors.length;
    this.anchors = this.anchors.filter((anchor) => anchor.id !== id);
    if (this.selectedAnchorId === id) this.selectedAnchorId = this.anchors[0]?.id || null;
    const changed = before !== this.anchors.length;
    if (changed) this.#notify('anchor-delete', { boundsChanged: false });
    return changed;
  }

  selectAnchor(id) {
    this.selectedAnchorId = this.anchors.some((anchor) => anchor.id === id) ? id : null;
    this.#notify('anchor-select', { boundsChanged: false });
    return this.selectedAnchorId;
  }

  setAnchorDisplay(mode) {
    this.anchorDisplay = ANCHOR_DISPLAY_MODES.has(mode) ? mode : 'off';
    this.#notify('anchor-display', { boundsChanged: false });
    return this.anchorDisplay;
  }

  setAnchors(anchors = [], selectedAnchorId = null) {
    this.anchors = (Array.isArray(anchors) ? anchors : [])
      .map((anchor, index) => sanitizeAnchor(anchor, index))
      .filter(Boolean)
      .slice(0, MAX_ANCHORS);
    this.selectedAnchorId = this.anchors.some((anchor) => anchor.id === selectedAnchorId)
      ? selectedAnchorId
      : this.anchors[0]?.id || null;
    return this.getAnchors();
  }

  getAnchors() {
    return clone(this.anchors);
  }

  getAnchorWorldPosition(id) {
    const anchor = this.anchors.find((item) => item.id === id);
    if (!anchor || !this.root) return null;
    this.root.updateMatrixWorld(true);
    const attachment = anchor.attachment || {};
    if (attachment.type === 'part' && attachment.partId) {
      const record = this.getPart(attachment.partId);
      if (record?.object) {
        return record.object.localToWorld(new THREE.Vector3(...finiteVector(attachment.localPosition)));
      }
    }
    return this.root.localToWorld(new THREE.Vector3(...finiteVector(anchor.fallbackRootLocalPosition)));
  }

  getAnchorMarkers() {
    return this.anchors.map((anchor) => {
      const world = this.getAnchorWorldPosition(anchor.id);
      const resolvedPart = anchor.attachment?.type !== 'part' || Boolean(this.getPart(anchor.attachment.partId));
      return {
        id: anchor.id,
        name: anchor.name,
        kind: anchor.kind,
        selected: anchor.id === this.selectedAnchorId,
        resolved: Boolean(world) && resolvedPart,
        partId: anchor.attachment?.partId || null,
        worldPosition: world?.toArray() || null,
      };
    });
  }

  applyState(state = {}) {
    const states = state.states ?? state.visibilityStates;
    const activeStateId = state.activeStateId ?? state.activeVisibilityStateId;
    this.setVisibilityStates(states, activeStateId);
    this.setVisibilityOverrides(state.partVisibility);
    if (activeStateId && this.visibilityStates.some((item) => item.id === activeStateId)) {
      this.activeVisibilityStateId = activeStateId;
    }
    this.setAnchors(state.anchors, state.selectedAnchorId);
    const legacyDisplay = state.showAnchors === true ? 'all' : state.showAnchors === false ? 'off' : null;
    const display = state.anchorDisplay ?? legacyDisplay;
    this.anchorDisplay = ANCHOR_DISPLAY_MODES.has(display) ? display : 'off';
    this.#notify('structure-state', { boundsChanged: true });
    return this.getState();
  }

  reset() {
    this.visibilityOverrides.clear();
    this.visibilityStates = [];
    this.activeVisibilityStateId = null;
    this.anchors = [];
    this.anchorDisplay = 'off';
    this.selectedAnchorId = null;
    this.selectedPartId = null;
    this.#applyVisibility();
    this.updateSelectionHelper();
    this.#notify('structure-reset', { boundsChanged: true });
  }

  getState() {
    return {
      partVisibility: this.getVisibilityOverrides(),
      states: this.getVisibilityStates(),
      activeStateId: this.activeVisibilityStateId,
      anchors: this.getAnchors(),
      anchorDisplay: this.anchorDisplay,
      selectedAnchorId: this.selectedAnchorId,
    };
  }

  getReport(query = '') {
    const records = filterStructureRecords(this.index.records, query).map((record) => this.#serializeRecord(record));
    const all = this.index.records.map((record) => this.#serializeRecord(record));
    const hiddenCount = all.filter((record) => !record.effectiveVisible).length;
    const authoredHiddenCount = all.filter((record) => !record.authoredVisible).length;
    const selectedPart = this.getSelectedPart();
    return {
      totalParts: this.index.records.length,
      meshParts: this.index.meshCount,
      groupParts: this.index.groupCount,
      hiddenCount,
      authoredHiddenCount,
      manualVisibilityOverrides: this.visibilityOverrides.size,
      variantVisibilityOverrides: this.variantVisibilityOverrides.size,
      records,
      selectedPart,
      visibilityStates: this.getVisibilityStates(),
      activeVisibilityStateId: this.activeVisibilityStateId,
      anchors: this.getAnchorMarkers(),
      anchorDisplay: this.anchorDisplay,
      selectedAnchorId: this.selectedAnchorId,
    };
  }

  getVisibleBounds(target = new THREE.Box3()) {
    target.makeEmpty();
    if (!this.root) return target;
    this.root.updateMatrixWorld(true);
    this.root.traverse((object) => {
      if (!object.isMesh || !this.#isEffectivelyVisibleObject(object)) return;
      const box = new THREE.Box3().setFromObject(object, true);
      if (!box.isEmpty()) target.union(box);
    });
    if (target.isEmpty()) target.setFromObject(this.root, true);
    return target;
  }

  update() {
    this.updateSelectionHelper();
  }

  setSelectionHelperVisible(enabled) {
    this.selectionHelperEnabled = Boolean(enabled);
    this.updateSelectionHelper();
  }

  updateSelectionHelper() {
    if (!this.selectionHelperEnabled) {
      this.selectionHelper.visible = false;
      return;
    }
    const record = this.getPart(this.selectedPartId);
    if (!record || !this.#isEffectivelyVisibleObject(record.object)) {
      this.selectionHelper.visible = false;
      return;
    }
    const box = this.#getObjectVisibleBounds(record.object);
    if (box.isEmpty()) {
      this.selectionHelper.visible = false;
      return;
    }
    this.selectionBox.copy(box);
    this.selectionHelper.visible = true;
    this.selectionHelper.updateMatrixWorld(true);
  }

  #manualRequestedVisibility(record) {
    return this.visibilityOverrides.has(record.id)
      ? this.visibilityOverrides.get(record.id)
      : record.authoredVisible;
  }

  #requestedVisibility(record) {
    return this.variantVisibilityOverrides.has(record.id)
      ? this.variantVisibilityOverrides.get(record.id)
      : this.#manualRequestedVisibility(record);
  }

  #effectiveVisibility(record) {
    if (!record) return false;
    let current = record;
    while (current) {
      if (!this.#requestedVisibility(current)) return false;
      current = current.parentId ? this.getPart(current.parentId) : null;
    }
    return true;
  }

  #isEffectivelyVisibleObject(object) {
    let current = object;
    while (current) {
      if (current.visible === false) return false;
      if (current === this.root) return true;
      current = current.parent;
    }
    return false;
  }

  #applyVisibility() {
    this.index.records.forEach((record) => {
      record.object.visible = this.#requestedVisibility(record);
    });
    this.root?.updateMatrixWorld(true);
    this.updateSelectionHelper();
  }

  #getObjectVisibleBounds(object) {
    const box = new THREE.Box3().makeEmpty();
    object?.traverse?.((child) => {
      if (!child.isMesh || !this.#isEffectivelyVisibleObject(child)) return;
      const childBox = new THREE.Box3().setFromObject(child, true);
      if (!childBox.isEmpty()) box.union(childBox);
    });
    if (box.isEmpty() && object?.isMesh && this.#isEffectivelyVisibleObject(object)) {
      box.setFromObject(object, true);
    }
    return box;
  }

  #serializeRecord(record) {
    return {
      id: record.id,
      label: record.label,
      path: record.path,
      kind: record.kind,
      depth: record.depth,
      parentId: record.parentId,
      childIds: [...record.childIds],
      authoredVisible: record.authoredVisible,
      baseRequestedVisible: this.#manualRequestedVisibility(record),
      requestedVisible: this.#requestedVisibility(record),
      variantVisible: this.variantVisibilityOverrides.has(record.id)
        ? this.variantVisibilityOverrides.get(record.id)
        : null,
      effectiveVisible: this.#effectiveVisibility(record),
      meshCount: record.meshCount,
      materialSlots: record.materialSlots,
      selected: record.id === this.selectedPartId,
    };
  }

  #notify(reason, { boundsChanged = false } = {}) {
    this.onChange?.({
      reason,
      boundsChanged,
      state: this.getState(),
      report: this.getReport(),
    });
  }
}
