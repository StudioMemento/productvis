import * as THREE from 'three';
import {
  MAX_EXPLODE_STATES,
  createStoryId,
  sanitizeExplosionState,
  sanitizeExplodeOffsets,
  sanitizeExplodeVector,
} from './StoryGrammar.js';

const clone = (value) => (typeof structuredClone === 'function'
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value)));

function cleanName(value, fallback, maxLength = 100) {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return (text || fallback).slice(0, maxLength);
}

function ease(name, value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  if (name === 'linear') return t;
  if (name === 'ease-in-out') return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
  if (name === 'ease-out') return 1 - ((1 - t) ** 4);
  // Smooth, restrained commercial-camera motion.
  return t * t * t * (t * (6 * t - 15) + 10);
}

function mapToObject(map) {
  return Object.fromEntries([...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, vector]) => [id, vector.toArray()]));
}

export class ProductExplosion {
  constructor({ getRoot, getPart, getValidPartIds, getVisibleBounds, onChange } = {}) {
    this.getRoot = getRoot;
    this.getPart = getPart;
    this.getValidPartIds = getValidPartIds;
    this.getVisibleBounds = getVisibleBounds;
    this.onChange = onChange;
    this.offsets = new Map();
    this.currentOffsets = new Map();
    this.lastAppliedLocal = new Map();
    this.states = [];
    this.activeStateId = null;
    this.tween = null;
  }

  attach() {
    this.reset({ notify: false, clearLibrary: true });
    this.#applyOffsets();
    return this.getReport();
  }

  detach() {
    this.prepareFrame();
    this.offsets.clear();
    this.currentOffsets.clear();
    this.lastAppliedLocal.clear();
    this.states = [];
    this.activeStateId = null;
    this.tween = null;
  }

  applyState(state = {}, { notify = true, immediate = true } = {}) {
    const sanitized = sanitizeExplosionState(state, { validPartIds: this.#validPartIds() });
    this.states = sanitized.explodeStates;
    this.activeStateId = sanitized.activeExplodeStateId;
    const offsets = this.#objectToMap(sanitized.explodeOffsets);
    if (immediate) this.#setOffsetsImmediate(offsets);
    else this.#transitionTo(offsets, { duration: 0.8, easing: 'cinematic' });
    if (notify) this.#notify('state-apply', { boundsChanged: true });
    return this.getState();
  }

  setPartDistance(partId, distance, direction = 'auto', { notify = true } = {}) {
    const record = this.getPart?.(partId);
    if (!record) return false;
    const amount = THREE.MathUtils.clamp(Number(distance) || 0, 0, 8);
    const vector = amount <= 0.000001
      ? new THREE.Vector3()
      : this.#resolveDirection(record, direction).multiplyScalar(amount);
    return this.setPartOffset(partId, vector.toArray(), { notify });
  }

  setPartOffset(partId, value, { notify = true } = {}) {
    const record = this.getPart?.(partId);
    if (!record) return false;
    const vector = new THREE.Vector3(...sanitizeExplodeVector(value));
    this.prepareFrame();
    if (vector.lengthSq() <= 0.0000001) this.offsets.delete(record.id);
    else this.offsets.set(record.id, vector);
    this.currentOffsets = this.#cloneMap(this.offsets);
    this.activeStateId = null;
    this.tween = null;
    this.#applyOffsets();
    if (notify) this.#notify('offset-set', { boundsChanged: true });
    return true;
  }

  clearPart(partId, options = {}) {
    return this.setPartOffset(partId, [0, 0, 0], options);
  }

  clearOffsets({ duration = 0, easing = 'cinematic', notify = true } = {}) {
    const empty = new Map();
    if (duration > 0) this.#transitionTo(empty, { duration, easing });
    else this.#setOffsetsImmediate(empty);
    this.activeStateId = null;
    if (notify) this.#notify('offsets-clear', { boundsChanged: true });
  }

  captureState(name) {
    if (this.states.length >= MAX_EXPLODE_STATES) return null;
    const now = new Date().toISOString();
    const item = {
      id: createStoryId('explode'),
      name: cleanName(name, `Exploded state ${this.states.length + 1}`),
      offsets: mapToObject(this.offsets),
      createdAt: now,
      updatedAt: now,
    };
    this.states.unshift(item);
    this.activeStateId = item.id;
    this.#notify('state-capture', { boundsChanged: false });
    return clone(item);
  }

  applyExplodedState(id, { duration = 1.2, easing = 'cinematic', notify = true } = {}) {
    const item = this.states.find((state) => state.id === id);
    if (!item) return false;
    this.activeStateId = item.id;
    this.#transitionTo(this.#objectToMap(item.offsets), { duration, easing });
    if (notify) this.#notify('state-activate', { boundsChanged: true });
    return true;
  }

  deleteState(id) {
    const before = this.states.length;
    this.states = this.states.filter((state) => state.id !== id);
    if (this.activeStateId === id) this.activeStateId = null;
    const changed = before !== this.states.length;
    if (changed) this.#notify('state-delete', { boundsChanged: false });
    return changed;
  }

  prepareFrame() {
    this.lastAppliedLocal.forEach((localOffset, partId) => {
      const object = this.getPart?.(partId)?.object;
      if (object) object.position.sub(localOffset);
    });
    this.lastAppliedLocal.clear();
  }

  update(now = performance.now()) {
    if (this.tween) {
      if (!this.tween.pausedAt) {
        const raw = this.tween.durationMs <= 1
          ? 1
          : THREE.MathUtils.clamp((now - this.tween.startedAt) / this.tween.durationMs, 0, 1);
        const t = ease(this.tween.easing, raw);
        this.currentOffsets = this.#interpolateMaps(this.tween.from, this.tween.to, t);
        if (raw >= 1) {
          this.offsets = this.#cloneMap(this.tween.to);
          this.currentOffsets = this.#cloneMap(this.offsets);
          this.tween = null;
          this.#notify('transition-complete', { boundsChanged: true });
        }
      }
    } else {
      this.currentOffsets = this.#cloneMap(this.offsets);
    }
    this.#applyOffsets();
    return this.isDynamic();
  }

  pauseTransition({ now = performance.now() } = {}) {
    if (!this.tween || this.tween.pausedAt) return false;
    this.tween.pausedAt = now;
    return true;
  }

  resumeTransition({ now = performance.now() } = {}) {
    if (!this.tween?.pausedAt) return false;
    this.tween.startedAt += Math.max(0, now - this.tween.pausedAt);
    this.tween.pausedAt = 0;
    return true;
  }

  stopTransition({ snapToTarget = true } = {}) {
    if (!this.tween) return false;
    this.prepareFrame();
    this.offsets = this.#cloneMap(snapToTarget ? this.tween.to : this.currentOffsets);
    this.currentOffsets = this.#cloneMap(this.offsets);
    if (!snapToTarget) this.activeStateId = null;
    this.tween = null;
    this.#applyOffsets();
    this.#notify('transition-stop', { boundsChanged: true });
    return true;
  }

  getOffset(partId) {
    return (this.offsets.get(partId) || new THREE.Vector3()).toArray();
  }

  getState() {
    return clone({
      explodeOffsets: mapToObject(this.offsets),
      explodeStates: this.states,
      activeExplodeStateId: this.activeStateId,
    });
  }

  getReport() {
    return clone({
      ...this.getState(),
      offsetCount: this.offsets.size,
      stateCount: this.states.length,
      dynamic: this.isDynamic(),
      activeState: this.states.find((item) => item.id === this.activeStateId) || null,
    });
  }

  isDynamic() {
    return Boolean(this.tween && !this.tween.pausedAt);
  }

  reset({ notify = true, clearLibrary = false } = {}) {
    this.prepareFrame();
    this.offsets.clear();
    this.currentOffsets.clear();
    this.lastAppliedLocal.clear();
    this.activeStateId = null;
    this.tween = null;
    if (clearLibrary) this.states = [];
    if (notify) this.#notify('reset', { boundsChanged: true });
  }

  #validPartIds() {
    const source = this.getValidPartIds?.();
    return source instanceof Set ? source : new Set(Array.isArray(source) ? source : []);
  }

  #objectToMap(value) {
    const sanitized = sanitizeExplodeOffsets(value, { validPartIds: this.#validPartIds() });
    return new Map(Object.entries(sanitized).map(([id, vector]) => [id, new THREE.Vector3(...vector)]));
  }

  #cloneMap(source) {
    return new Map([...source.entries()].map(([id, vector]) => [id, vector.clone()]));
  }

  #transitionTo(target, { duration = 1.2, easing = 'cinematic' } = {}) {
    this.prepareFrame();
    const from = this.#cloneMap(this.currentOffsets.size ? this.currentOffsets : this.offsets);
    const to = this.#cloneMap(target);
    // `offsets` is the authored target state while `currentOffsets` is the
    // interpolated runtime pose. Persisting during a transition therefore
    // always saves the intended exploded composition, never a stale source.
    this.offsets = this.#cloneMap(to);
    const durationMs = Math.max(0, Number(duration) || 0) * 1000;
    if (durationMs <= 1) {
      this.#setOffsetsImmediate(to);
      return;
    }
    this.tween = {
      from,
      to,
      startedAt: performance.now(),
      durationMs,
      easing,
      pausedAt: 0,
    };
    this.currentOffsets = this.#cloneMap(from);
    this.#applyOffsets();
  }

  #setOffsetsImmediate(offsets) {
    this.prepareFrame();
    this.offsets = this.#cloneMap(offsets);
    this.currentOffsets = this.#cloneMap(offsets);
    this.tween = null;
    this.#applyOffsets();
  }

  #interpolateMaps(from, to, t) {
    const ids = new Set([...from.keys(), ...to.keys()]);
    const result = new Map();
    ids.forEach((id) => {
      const a = from.get(id) || new THREE.Vector3();
      const b = to.get(id) || new THREE.Vector3();
      const vector = a.clone().lerp(b, t);
      if (vector.lengthSq() > 0.0000001) result.set(id, vector);
    });
    return result;
  }

  #applyOffsets() {
    const root = this.getRoot?.();
    if (!root) return;
    root.updateMatrixWorld(true);
    this.currentOffsets.forEach((rootVector, partId) => {
      const record = this.getPart?.(partId);
      const object = record?.object;
      if (!object?.parent) return;
      const localOffset = this.#rootVectorToParentLocal(root, object.parent, rootVector);
      object.position.add(localOffset);
      this.lastAppliedLocal.set(partId, localOffset);
    });
    root.updateMatrixWorld(true);
  }

  #rootVectorToParentLocal(root, parent, vector) {
    const rootOriginWorld = root.localToWorld(new THREE.Vector3());
    const rootTargetWorld = root.localToWorld(vector.clone());
    const parentOrigin = parent.worldToLocal(rootOriginWorld.clone());
    const parentTarget = parent.worldToLocal(rootTargetWorld.clone());
    return parentTarget.sub(parentOrigin);
  }

  #resolveDirection(record, mode) {
    if (mode === 'x') return new THREE.Vector3(1, 0, 0);
    if (mode === '-x') return new THREE.Vector3(-1, 0, 0);
    if (mode === 'y') return new THREE.Vector3(0, 1, 0);
    if (mode === '-y') return new THREE.Vector3(0, -1, 0);
    if (mode === 'z') return new THREE.Vector3(0, 0, 1);
    if (mode === '-z') return new THREE.Vector3(0, 0, -1);

    const root = this.getRoot?.();
    if (!root) return new THREE.Vector3(1, 0, 0);
    root.updateMatrixWorld(true);
    const partBounds = new THREE.Box3().setFromObject(record.object);
    const rootBounds = this.getVisibleBounds?.(new THREE.Box3()) || new THREE.Box3().setFromObject(root);
    const partWorld = partBounds.isEmpty()
      ? record.object.getWorldPosition(new THREE.Vector3())
      : partBounds.getCenter(new THREE.Vector3());
    const rootWorld = rootBounds.isEmpty()
      ? root.getWorldPosition(new THREE.Vector3())
      : rootBounds.getCenter(new THREE.Vector3());
    const partLocal = root.worldToLocal(partWorld.clone());
    const centerLocal = root.worldToLocal(rootWorld.clone());
    const direction = partLocal.sub(centerLocal);
    if (!Number.isFinite(direction.lengthSq()) || direction.lengthSq() < 0.000001) {
      const fallback = record.object.getWorldPosition(new THREE.Vector3());
      direction.copy(root.worldToLocal(fallback)).normalize();
    }
    if (direction.lengthSq() < 0.000001) direction.set(1, 0, 0);
    return direction.normalize();
  }

  #notify(reason, extra = {}) {
    this.onChange?.({ reason, ...extra, state: this.getState(), report: this.getReport() });
  }
}
